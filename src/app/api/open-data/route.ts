import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";

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
    .select(OPEN_COLUMNS.join(","))
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
  const rows = ((data ?? []) as unknown) as Record<string, unknown>[];

  if (format === "csv") {
    const header = OPEN_COLUMNS.join(",");
    const lines = rows.map((r) => OPEN_COLUMNS.map((c) => csvEscape(r[c])).join(","));
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
      properties: {
        ...r,
      },
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
