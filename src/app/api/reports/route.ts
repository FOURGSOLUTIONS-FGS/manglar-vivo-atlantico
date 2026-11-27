import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";
import { computeReliabilityScore } from "@/lib/reliability";
import { EVENT_CATEGORIES } from "@/lib/cra-domain";
import { createDefaultAlertDispatcher } from "@/core/alerts/dispatcher";
import {
  computeBufferSha256,
  evaluateReportAntiSpam,
} from "@/core/security/anti-spam";
import { getClientIp } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const trackingCode = searchParams.get("tracking_code");
  const sectorId = searchParams.get("sector_id");
  const estado = searchParams.get("estado");

  const supabase = createServerSupabase();
  let query = supabase
    .from("citizen_reports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (trackingCode) query = query.eq("tracking_code", trackingCode.trim().toUpperCase());
  if (sectorId) query = query.eq("sector_id", Number(sectorId));
  if (estado) query = query.eq("estado_validacion", estado);

  const { data: reports, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const reportIds = (reports ?? []).map((r) => r.id);
  const validationsByReport: Record<string, unknown[]> = {};
  if (reportIds.length > 0) {
    const { data: vals } = await supabase
      .from("report_validations")
      .select("*")
      .in("report_id", reportIds)
      .order("created_at", { ascending: true });
    for (const v of vals ?? []) {
      if (!validationsByReport[v.report_id]) validationsByReport[v.report_id] = [];
      validationsByReport[v.report_id].push(v);
    }
  }

  const enriched = (reports ?? []).map((r) => ({
    ...r,
    validations: validationsByReport[r.id] ?? [],
  }));

  return NextResponse.json({ reports: enriched });
}

export async function POST(request: Request) {
  try {
    const supabase = createServerSupabase();
    const contentType = request.headers.get("content-type") || "";
    let payload: Record<string, unknown> = {};
    const photoFiles: File[] = [];

    if (contentType.includes("multipart/form-data")) {
      const fd = await request.formData();
      const rawPayload = fd.get("payload");
      if (typeof rawPayload === "string") {
        payload = JSON.parse(rawPayload);
      }
      for (const fieldName of ["photo", "photo_0", "photo_1", "photo_2"]) {
        const f = fd.get(fieldName);
        if (f instanceof File && f.size > 0 && photoFiles.length < 3) {
          photoFiles.push(f);
        }
      }
    } else {
      payload = await request.json();
    }

    const clientUuid = String(payload.client_uuid || crypto.randomUUID());
    const lat = Number(payload.latitud);
    const lon = Number(payload.longitud);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return NextResponse.json({ error: "Coordenadas latitud/longitud inválidas." }, { status: 400 });
    }

    // Calcular SHA-256 de cada foto antes de guardar para detección anti-spam de duplicados
    const preparedPhotos: Array<{ file: File; buf: Uint8Array; sha256: string }> = [];
    for (const f of photoFiles) {
      const buf = new Uint8Array(await f.arrayBuffer());
      preparedPhotos.push({ file: f, buf, sha256: computeBufferSha256(buf) });
    }

    // Escudo Anti-Spam 6 capas (Honeypot, velocidad bot, jurisdicción Atlántico, texto basura, ráfaga IP, foto duplicada)
    const spamCheck = evaluateReportAntiSpam({
      ip: getClientIp(request),
      fingerprint:
        typeof payload.client_fingerprint === "string" ? payload.client_fingerprint : null,
      honeypot: typeof payload.website_hp === "string" ? payload.website_hp : null,
      formDurationMs:
        typeof payload.form_duration_ms === "number" ? payload.form_duration_ms : null,
      lat,
      lon,
      description:
        typeof payload.descripcion_ciudadana === "string" ? payload.descripcion_ciudadana : null,
      photoHashes: preparedPhotos.map((p) => p.sha256),
    });

    if (!spamCheck.allowed) {
      return NextResponse.json(
        { error: spamCheck.reason, spamCode: spamCheck.code },
        { status: spamCheck.httpStatus }
      );
    }

    // Subir hasta 3 fotos originales preservando EXIF
    const uploadedUrls: string[] = [];
    if (typeof payload.evidencia_foto_url === "string" && payload.evidencia_foto_url) {
      uploadedUrls.push(payload.evidencia_foto_url);
    }

    for (let idx = 0; idx < preparedPhotos.length; idx += 1) {
      const { file, buf } = preparedPhotos[idx];
      const ext = (file.name.split(".").pop() || "jpg").replace(/[^a-zA-Z0-9]/g, "");
      const objectPath = `reports/${clientUuid}/${Date.now()}_${idx}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("report-evidence")
        .upload(objectPath, buf, {
          contentType: file.type || "image/jpeg",
          upsert: true,
        });
      if (!upErr) {
        const { data: pub } = supabase.storage.from("report-evidence").getPublicUrl(objectPath);
        uploadedUrls.push(pub.publicUrl);
      }
    }

    const photoUrl = uploadedUrls[0] ?? null;

    // Cruce autoritativo PostGIS (sector + ground-truth + corroboraciones en 500 m)
    const { data: ctx } = await supabase.rpc("resolve_location_context", {
      p_lat: lat,
      p_lon: lon,
    });

    const gt = ctx?.nearest_ground_truth ?? null;
    const nearby = Number(ctx?.nearby_reports_500m ?? 0);
    const cat = EVENT_CATEGORIES.find((c) => c.id === payload.tipo_evento);

    const aiObj = (payload.ai_classification as Record<string, unknown> | undefined) ?? null;
    const aiPhotoValid =
      aiObj && typeof aiObj.es_evidencia_valida === "boolean"
        ? aiObj.es_evidencia_valida
        : null;

    const reliability = computeReliabilityScore({
      hasPhoto: uploadedUrls.length > 0,
      photoCount: uploadedUrls.length,
      aiPhotoValid,
      precisionGpsM: payload.precision_gps_m != null ? Number(payload.precision_gps_m) : null,
      inCoastalZone: true,
      isSimulatedGps: Boolean(payload.is_simulated_gps),
      timestampCaptura: String(payload.timestamp_captura || new Date().toISOString()),
      nearbyCorroborations: nearby,
      nearGroundTruthM: gt?.dist_m ?? null,
      estadoValidacion: "nuevo",
    });

    const trackingCode =
      String(payload.tracking_code || "").trim() ||
      `MGL-2026-${Math.floor(1000 + Math.random() * 9000)}`;

    const baseExif = (payload.evidencia_exif as Record<string, unknown> | null) ?? {};
    const mergedExif: Record<string, unknown> = {
      ...baseExif,
      fotos_urls: uploadedUrls,
      photo_count: uploadedUrls.length,
      photo_hashes: preparedPhotos.map((p) => p.sha256),
      antispam_verified: true,
    };

    const row = {
      client_uuid: clientUuid,
      tracking_code: trackingCode,
      timestamp_captura: String(payload.timestamp_captura || new Date().toISOString()),
      latitud: lat,
      longitud: lon,
      precision_gps_m: payload.precision_gps_m != null ? Number(payload.precision_gps_m) : null,
      is_simulated_gps: Boolean(payload.is_simulated_gps),
      zona_manglar: String(payload.zona_manglar || ctx?.sector?.nombre || "Atlántico Costero"),
      municipio: String(payload.municipio || "Atlántico"),
      sector_id: Number(payload.sector_id || ctx?.sector?.sector_id || 1),
      accion_plan: payload.accion_plan ? String(payload.accion_plan) : null,
      en_zona_por_revisar: Boolean(payload.en_zona_por_revisar),
      tipo_evento: String(payload.tipo_evento || "otro"),
      descripcion_ciudadana: String(payload.descripcion_ciudadana || ""),
      evidencia_foto_url: photoUrl,
      evidencia_exif: mergedExif,
      perfil_reportante: String(payload.perfil_reportante || "habitante_local"),
      school_name: payload.school_name ? String(payload.school_name) : null,
      qr_station_id: payload.qr_station_id ? String(payload.qr_station_id) : null,
      estado_sincronizacion: "sincronizado",
      estado_validacion: "nuevo",
      attention_status: "pendiente",
      clasificacion_tecnica:
        (payload.ai_classification as { clasificacion_tecnica?: string } | undefined)
          ?.clasificacion_tecnica ||
        cat?.technicalHint ||
        "Observación ciudadana por validar",
      nivel_prioridad: String(payload.nivel_prioridad || cat?.defaultPriority || "media"),
      puntaje_confiabilidad: reliability.score,
      ai_classification: aiObj,
      ground_truth_match: gt,
    };

    const { data, error } = await supabase
      .from("citizen_reports")
      .upsert(row, { onConflict: "client_uuid" })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const dispatcher = createDefaultAlertDispatcher();
    const alertOutcome = await dispatcher
      .evaluateAndDispatch({
        report: {
          id: data.id,
          trackingCode: data.tracking_code,
          tipoEvento: data.tipo_evento,
          subtipoEvento:
            typeof mergedExif.subtipo_evento === "string" ? mergedExif.subtipo_evento : null,
          zonaManglar: data.zona_manglar,
          municipio: data.municipio,
          sectorId: data.sector_id,
          accionPlan: data.accion_plan,
          enZonaPorRevisar: Boolean(data.en_zona_por_revisar),
          nivelPrioridad: data.nivel_prioridad,
          puntajeConfiabilidad: data.puntaje_confiabilidad,
          estadoValidacion: data.estado_validacion,
          attentionStatus: data.attention_status,
          descripcionCiudadana: data.descripcion_ciudadana,
          clasificacionTecnica: data.clasificacion_tecnica,
          evidenciaFotoUrl: data.evidencia_foto_url,
          evidenciaFotosUrls: uploadedUrls,
          latitud: Number(data.latitud),
          longitud: Number(data.longitud),
          isSimulatedGps: Boolean(data.is_simulated_gps),
          aiPhotoValid,
          timestampCaptura: data.timestamp_captura,
        },
        baseUrl: process.env.NEXT_PUBLIC_SITE_URL?.trim() || new URL(request.url).origin,
      })
      .catch(() => null);

    return NextResponse.json(
      {
        report: data,
        context: ctx,
        reliability,
        alertClassification: alertOutcome?.classification ?? null,
        alertDispatches: alertOutcome?.results ?? [],
      },
      { status: 201 }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error inesperado guardando reporte" },
      { status: 500 }
    );
  }
}
