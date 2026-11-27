import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";
import { classifyAlert } from "@/core/alerts/classifier";

const DB_SELECT = [
  "tracking_code",
  "timestamp_captura",
  "latitud",
  "longitud",
  "precision_gps_m",
  "is_simulated_gps",
  "zona_manglar",
  "municipio",
  "sector_id",
  "accion_plan",
  "en_zona_por_revisar",
  "tipo_evento",
  "descripcion_ciudadana",
  "perfil_reportante",
  "estado_sincronizacion",
  "estado_validacion",
  "attention_status",
  "clasificacion_tecnica",
  "nivel_prioridad",
  "puntaje_confiabilidad",
  "evidencia_foto_url",
  "evidencia_exif",
  "ai_classification",
];

const OPEN_COLUMNS = [
  "tracking_code",
  "timestamp_captura",
  "latitud",
  "longitud",
  "precision_gps_m",
  "is_simulated_gps",
  "zona_manglar",
  "municipio",
  "sector_id",
  "accion_plan",
  "en_zona_por_revisar",
  "factor_dominio",
  "subtipo_evento",
  "tipo_evento",
  "nivel_alerta",
  "foto_validada_ia",
  "descripcion_ciudadana",
  "perfil_reportante",
  "estado_sincronizacion",
  "estado_validacion",
  "attention_status",
  "clasificacion_tecnica",
  "nivel_prioridad",
  "puntaje_confiabilidad",
  "evidencia_foto_url",
] as const;

function csvEscape(v: unknown): string {
  const s = v == null ? "" : String(v);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const format = (searchParams.get("format") || "geojson").toLowerCase();
  const sector = searchParams.get("sector");
  const prioridad = searchParams.get("prioridad");
  const estado = searchParams.get("estado");

  const supabase = createServerSupabase();
  let query = supabase
    .from("citizen_reports")
    .select(DB_SELECT.join(","))
    .order("timestamp_captura", { ascending: false })
    .limit(1000);

  if (sector) query = query.eq("sector_id", Number(sector));
  if (prioridad) query = query.eq("nivel_prioridad", prioridad);
  if (estado) query = query.eq("estado_validacion", estado);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Anonimización estricta Ley 1581 de 2012 (sin nombres, correos ni teléfonos personales)
  const rawRows = ((data ?? []) as unknown) as Record<string, unknown>[];
  const rows = rawRows.map((r) => {
    const exif = (r.evidencia_exif as Record<string, unknown> | null) ?? null;
    const ai = (r.ai_classification as Record<string, unknown> | null) ?? null;
    const subtipo = typeof exif?.subtipo_evento === "string" ? exif.subtipo_evento : null;
    const dominio = typeof exif?.factor_dominio === "string" ? exif.factor_dominio : null;
    const aiValid =
      ai && typeof ai.es_evidencia_valida === "boolean" ? ai.es_evidencia_valida : true;

    const cls = classifyAlert({
      trackingCode: String(r.tracking_code || ""),
      tipoEvento: String(r.tipo_evento || "otro"),
      subtipoEvento: subtipo,
      zonaManglar: String(r.zona_manglar || ""),
      municipio: String(r.municipio || ""),
      enZonaPorRevisar: Boolean(r.en_zona_por_revisar),
      nivelPrioridad: String(r.nivel_prioridad || "media"),
      puntajeConfiabilidad: Number(r.puntaje_confiabilidad || 0),
      estadoValidacion: String(r.estado_validacion || "nuevo"),
      latitud: Number(r.latitud || 0),
      longitud: Number(r.longitud || 0),
      aiPhotoValid: aiValid,
    });

    return {
      tracking_code: r.tracking_code,
      timestamp_captura: r.timestamp_captura,
      latitud: r.latitud,
      longitud: r.longitud,
      precision_gps_m: r.precision_gps_m,
      is_simulated_gps: r.is_simulated_gps,
      zona_manglar: r.zona_manglar,
      municipio: r.municipio,
      sector_id: r.sector_id,
      accion_plan: r.accion_plan,
      en_zona_por_revisar: r.en_zona_por_revisar,
      factor_dominio: dominio || "general",
      subtipo_evento: subtipo || r.tipo_evento,
      tipo_evento: r.tipo_evento,
      nivel_alerta: cls.level,
      foto_validada_ia: aiValid,
      descripcion_ciudadana: r.descripcion_ciudadana,
      perfil_reportante: r.perfil_reportante,
      estado_sincronizacion: r.estado_sincronizacion,
      estado_validacion: r.estado_validacion,
      attention_status: r.attention_status,
      clasificacion_tecnica: r.clasificacion_tecnica,
      nivel_prioridad: r.nivel_prioridad,
      puntaje_confiabilidad: r.puntaje_confiabilidad,
      evidencia_foto_url: r.evidencia_foto_url,
    };
  });

  if (format === "csv") {
    const header = OPEN_COLUMNS.join(",");
    const lines = rows.map((r) =>
      OPEN_COLUMNS.map((c) => csvEscape((r as Record<string, unknown>)[c])).join(",")
    );
    const csv = [header, ...lines].join("\r\n");
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="manglares_atlantico_datos_abiertos.csv"',
      },
    });
  }

  const featureCollection = {
    type: "FeatureCollection",
    metadata: {
      fuente: "Corporación Autónoma Regional del Atlántico (CRA) · Manglar Vivo Atlántico",
      licencia: "Datos Abiertos Gobierno Digital Colombia · Anonimizado conforme Ley 1581 de 2012",
      generado_en: new Date().toISOString(),
      total_registros: rows.length,
    },
    features: rows.map((r) => ({
      type: "Feature",
      properties: { ...r },
      geometry: {
        type: "Point",
        coordinates: [Number(r.longitud), Number(r.latitud)],
      },
    })),
  };

  return new NextResponse(JSON.stringify(featureCollection, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/geo+json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="manglares_atlantico_datos_abiertos.geojson"',
    },
  });
}
