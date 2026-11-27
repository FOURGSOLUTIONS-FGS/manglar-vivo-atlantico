import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const envPath = path.join(process.cwd(), ".env.local");
for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BASE_ORIGIN = "https://manglar-vivo-atlantico.vercel.app";

// Enriquecer reportes semilla con fotos reales del dataset y nuevos reportes variados
const SEED_UPDATES = [
  { tracking_code: "MGL-2026-0101", photo: "/dataset/dosel_seco.jpg", subtipo: "Mangle seco o amarillento" },
  { tracking_code: "MGL-2026-0102", photo: "/dataset/residuos_solidos.jpg", subtipo: "Basura y plásticos" },
  { tracking_code: "MGL-2026-0103", photo: "/dataset/relleno_obra.jpg", subtipo: "Relleno, cercado u obra" },
  { tracking_code: "MGL-2026-0104", photo: "/dataset/verificacion_828ha.jpg", subtipo: "Verificar manglar sano (828 ha)" },
  { tracking_code: "MGL-2026-0105", photo: "/dataset/cano_taponado.jpg", subtipo: "Caño o canal taponado" },
];

const EXTRA_REPORTS = [
  {
    client_uuid: "00000000-0000-4000-8000-000000000106",
    tracking_code: "MGL-2026-0106",
    timestamp_captura: new Date(Date.now() - 3 * 3600e3).toISOString(),
    latitud: 11.0412,
    longitud: -74.8695,
    precision_gps_m: 14,
    is_simulated_gps: true,
    zona_manglar: "Mallorquín – Bocas de Ceniza",
    municipio: "Barranquilla",
    sector_id: 1,
    accion_plan: "Preservación",
    en_zona_por_revisar: false,
    tipo_evento: "contaminacion_residuos",
    descripcion_ciudadana: "[Contaminación · Vertimiento o agua turbia] Espuma densa descargando al borde de la ciénaga.",
    evidencia_foto_url: `${BASE_ORIGIN}/dataset/vertimiento_agua.jpg`,
    evidencia_exif: { factor_dominio: "contaminacion", subtipo_evento: "vertimiento_agua", subtipo_label: "Vertimiento o agua turbia" },
    perfil_reportante: "habitante_local",
    estado_sincronizacion: "sincronizado",
    estado_validacion: "validado_comunitario",
    attention_status: "en_revision",
    clasificacion_tecnica: "Vertimiento de aguas residuales y espuma sobre espejo estuarino",
    nivel_prioridad: "alta",
    puntaje_confiabilidad: 82,
  },
  {
    client_uuid: "00000000-0000-4000-8000-000000000107",
    tracking_code: "MGL-2026-0107",
    timestamp_captura: new Date(Date.now() - 5 * 3600e3).toISOString(),
    latitud: 10.9468,
    longitud: -75.0124,
    precision_gps_m: 18,
    is_simulated_gps: true,
    zona_manglar: "Puerto Colombia – Balboa – Puerto Velero",
    municipio: "Puerto Colombia",
    sector_id: 2,
    accion_plan: "Restauración",
    en_zona_por_revisar: true,
    tipo_evento: "otro",
    descripcion_ciudadana: "[Fauna y 828 ha · Avistamiento de fauna silvestre] Garza blanca alimentándose entre raíces vivas en Puerto Velero.",
    evidencia_foto_url: `${BASE_ORIGIN}/dataset/avistamiento_fauna.jpg`,
    evidencia_exif: { factor_dominio: "fauna_verificacion", subtipo_evento: "avistamiento_fauna", subtipo_label: "Avistamiento de fauna silvestre" },
    perfil_reportante: "turista",
    qr_station_id: "puerto-velero-muelle",
    estado_sincronizacion: "sincronizado",
    estado_validacion: "validado_academico",
    attention_status: "atendido",
    clasificacion_tecnica: "Bioindicador positivo de avifauna costera en zona de restauración",
    nivel_prioridad: "baja",
    puntaje_confiabilidad: 90,
  },
  {
    client_uuid: "00000000-0000-4000-8000-000000000108",
    tracking_code: "MGL-2026-0108",
    timestamp_captura: new Date(Date.now() - 2 * 3600e3).toISOString(),
    latitud: 10.7485,
    longitud: -75.2142,
    precision_gps_m: 16,
    is_simulated_gps: true,
    zona_manglar: "Totumo – Astilleros – Galerazamba",
    municipio: "Piojó",
    sector_id: 4,
    accion_plan: "Recuperación",
    en_zona_por_revisar: true,
    tipo_evento: "tala_relleno",
    descripcion_ciudadana: "[Cobertura · Quema o incendio] Quema activa de vegetación seca en borde del humedal del Totumo.",
    evidencia_foto_url: `${BASE_ORIGIN}/dataset/quema_incendio.jpg`,
    evidencia_exif: { factor_dominio: "cobertura_suelo", subtipo_evento: "quema_incendio", subtipo_label: "Quema o incendio" },
    perfil_reportante: "estudiante_escuela",
    school_name: "I.E. El Totumo",
    estado_sincronizacion: "sincronizado",
    estado_validacion: "alerta_oficial_cra",
    attention_status: "operativo_en_curso",
    clasificacion_tecnica: "Afectación térmica activa en borde de manglar y liberación de carbono",
    nivel_prioridad: "alta",
    puntaje_confiabilidad: 95,
  },
];

async function run() {
  for (const u of SEED_UPDATES) {
    const { error } = await supabase
      .from("citizen_reports")
      .update({
        evidencia_foto_url: `${BASE_ORIGIN}${u.photo}`,
        evidencia_exif: { subtipo_label: u.subtipo, source: "dataset_wikimedia" },
      })
      .eq("tracking_code", u.tracking_code);
    console.log(u.tracking_code, error ? `ERR: ${error.message}` : `✓ foto ${u.photo}`);
  }

  for (const r of EXTRA_REPORTS) {
    const { error } = await supabase
      .from("citizen_reports")
      .upsert(r, { onConflict: "client_uuid" });
    console.log(r.tracking_code, error ? `ERR: ${error.message}` : "✓ upserted");
  }
}

run();
