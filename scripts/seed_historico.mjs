import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

// Histórico DEMO de 90 días para dashboards. Todo queda marcado como SIMULADO (DEMO).
const envPath = path.join(process.cwd(), ".env.local");
for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const ORIGIN = "https://manglar.arpadura.com";

let seed = 20260127;
const rng = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const pick = (arr) => arr[Math.floor(rng() * arr.length)];

const SUBTYPES = [
  ["tala_poda", "cobertura_suelo", "tala_relleno", "alta", "Tala o corte de mangle", "Árboles cortados recientemente en el borde del caño."],
  ["relleno_obra", "cobertura_suelo", "tala_relleno", "alta", "Relleno, cercado u obra", "Volquetas descargando arena sobre la ronda del manglar."],
  ["quema_incendio", "cobertura_suelo", "tala_relleno", "alta", "Quema o incendio", "Humo y vegetación quemada junto al sendero."],
  ["cano_taponado", "agua_dosel", "cambio_hidrico", "alta", "Caño o canal taponado", "Sedimento bloqueando el intercambio mareal."],
  ["dosel_seco", "agua_dosel", "cambio_hidrico", "alta", "Mangle seco o amarillento", "Hojas amarillas y árboles secos en pie."],
  ["erosion_costera", "agua_dosel", "cambio_hidrico", "media", "Erosión o caída de borde", "Raíces expuestas por el oleaje."],
  ["residuos_solidos", "contaminacion", "contaminacion_residuos", "media", "Basura y plásticos", "Plásticos atrapados en raíces."],
  ["vertimiento_agua", "contaminacion", "contaminacion_residuos", "alta", "Vertimiento o agua turbia", "Tubería descargando agua oscura."],
  ["derrame_combustible", "contaminacion", "contaminacion_residuos", "alta", "Aceite o combustible", "Mancha iridiscente cerca a lanchas."],
  ["fauna_amenaza", "fauna_verificacion", "dano_fauna_especies", "alta", "Fauna herida, redes o pesca ilegal", "Redes abandonadas con peces atrapados."],
  ["avistamiento_fauna", "fauna_verificacion", "otro", "baja", "Avistamiento de fauna silvestre", "Garzas alimentándose en el caño."],
  ["verificacion_828ha", "fauna_verificacion", "otro", "baja", "Verificar manglar sano (828 ha)", "Cobertura viva confirmada en polígono por revisar."],
];

const SECTORS = [
  { id: 1, nombre: "Mallorquín – Bocas de Ceniza", municipio: "Barranquilla", lat: 11.0448, lon: -74.8632, accion: "Preservación", station: "mallorquin-sendero-1" },
  { id: 2, nombre: "Puerto Colombia – Balboa – Puerto Velero", municipio: "Puerto Colombia", lat: 10.9531, lon: -75.0021, accion: "Restauración", station: "puerto-velero-muelle" },
  { id: 3, nombre: "Tubará – Juan de Acosta", municipio: "Juan de Acosta", lat: 10.8719, lon: -75.0972, accion: "Preservación", station: "juan-acosta-estuario" },
  { id: 4, nombre: "Totumo – Astilleros – Galerazamba", municipio: "Piojó", lat: 10.7429, lon: -75.2185, accion: "Recuperación", station: "totumo-astilleros" },
];

const SCHOOLS = [
  "I.E. Técnica Agropecuaria de Juan de Acosta",
  "I.E. El Totumo",
  "I.E. Eduardo Santos — La Playa (Mallorquín)",
  "I.E. San Nicolás de Tolentino — Puerto Colombia",
];

const HOUR = 3600e3;
const DAY = 24 * HOUR;
const N = 42;

async function run() {
  const now = Date.now();
  const rows = [];
  const plans = [];

  for (let i = 0; i < N; i += 1) {
    const [subId, domain, tipo, prio, label, desc] = pick(SUBTYPES);
    const sector = rng() < 0.32 ? SECTORS[2] : pick(SECTORS);
    const daysAgo = 1 + rng() * 88;
    const ts = now - daysAgo * DAY;
    const pr = rng();
    const perfil = pr < 0.4 ? "habitante_local" : pr < 0.65 ? "estudiante_escuela" : pr < 0.9 ? "turista" : "actor_registrado";
    const urgent = ["tala_poda", "relleno_obra", "quema_incendio", "vertimiento_agua", "derrame_combustible"].includes(subId);
    const positive = ["avistamiento_fauna", "verificacion_828ha"].includes(subId);

    let estado = "nuevo";
    let attention = "pendiente";
    const r = rng();
    if (daysAgo > 21) {
      estado = urgent ? "alerta_oficial_cra" : positive ? "validado_academico" : r < 0.5 ? "validado_academico" : "validado_comunitario";
      attention = r < 0.82 ? "atendido" : "en_revision";
    } else if (daysAgo > 6) {
      estado = urgent && r < 0.7 ? "alerta_oficial_cra" : r < 0.55 ? "validado_comunitario" : "validado_academico";
      attention = urgent ? (r < 0.5 ? "atendido" : "operativo_en_curso") : r < 0.4 ? "atendido" : "en_revision";
    } else {
      estado = r < 0.45 ? "nuevo" : "validado_comunitario";
      attention = urgent && r > 0.6 ? "operativo_en_curso" : "pendiente";
    }

    const photos = rng() < 0.55 ? 2 : 1;
    const base = (photos >= 2 ? 25 : 18) + 15 + 15 + (rng() < 0.7 ? 15 : 0);
    const mentors = estado === "validado_comunitario" ? 10 : estado === "nuevo" ? 0 : 20;
    const score = Math.min(100, base + mentors);
    const lat = Number((sector.lat + (rng() - 0.5) * 0.02).toFixed(6));
    const lon = Number((sector.lon + (rng() - 0.5) * 0.02).toFixed(6));
    const n = String(200 + i).padStart(3, "0");
    const photoUrl = `${ORIGIN}/dataset/${subId}.jpg`;
    const station =
      perfil === "turista" ? (rng() < 0.6 ? `nfc:${sector.station}` : sector.station) : null;

    rows.push({
      client_uuid: `00000000-0000-4000-8000-000000000${n}`,
      tracking_code: `MGL-2026-H${n}`,
      timestamp_captura: new Date(ts).toISOString(),
      created_at: new Date(ts).toISOString(),
      updated_at: new Date(ts).toISOString(),
      latitud: lat,
      longitud: lon,
      precision_gps_m: 12,
      is_simulated_gps: true,
      zona_manglar: sector.nombre,
      municipio: sector.municipio,
      sector_id: sector.id,
      accion_plan: sector.accion,
      en_zona_por_revisar: rng() < 0.45,
      tipo_evento: tipo,
      descripcion_ciudadana: `[Histórico demo · ${label}] ${desc}`,
      evidencia_foto_url: photoUrl,
      evidencia_exif: {
        source: "seed_historico_demo",
        factor_dominio: domain,
        subtipo_evento: subId,
        subtipo_label: label,
        fotos_urls: photos >= 2 ? [photoUrl, `${ORIGIN}/dataset/verificacion_828ha.jpg`] : [photoUrl],
        photo_count: photos,
      },
      perfil_reportante: perfil,
      school_name: perfil === "estudiante_escuela" ? pick(SCHOOLS) : null,
      qr_station_id: station,
      estado_sincronizacion: "sincronizado",
      estado_validacion: estado,
      attention_status: attention,
      clasificacion_tecnica: label,
      nivel_prioridad: prio,
      puntaje_confiabilidad: score,
      ai_classification: { mode: "seed_historico_demo", es_evidencia_valida: true, clasificacion_tecnica: label },
    });
    plans.push({ ts, estado, attention, urgent });
  }

  const { data: inserted, error } = await supabase
    .from("citizen_reports")
    .upsert(rows, { onConflict: "client_uuid" })
    .select("id,tracking_code");
  if (error) throw error;
  console.log(`✓ ${inserted.length} reportes históricos (90 días) upserted`);

  const ids = inserted.map((x) => x.id);
  await supabase.from("report_validations").delete().in("report_id", ids);

  const vals = [];
  inserted.forEach((rep) => {
    const idx = rows.findIndex((r) => r.tracking_code === rep.tracking_code);
    const p = plans[idx];
    if (p.estado === "nuevo") return;
    const tCom = p.ts + (p.urgent ? 0.4 + rng() * 1.4 : 1 + rng() * 9) * HOUR;
    vals.push({ report_id: rep.id, validator_role: "mentor_comunitario", validator_name: "Red de Mentores Comunitarios", decision: "aprobado", notes: "Confirmado en terreno (histórico demo)", created_at: new Date(tCom).toISOString() });
    if (["validado_academico", "alerta_oficial_cra"].includes(p.estado)) {
      const tAca = tCom + (6 + rng() * 30) * HOUR;
      vals.push({ report_id: rep.id, validator_role: "mentor_academico", validator_name: "Mentor Académico · UniAtlántico", decision: "aprobado", notes: "Clasificación técnica validada", created_at: new Date(tAca).toISOString() });
    }
    if (p.estado === "alerta_oficial_cra") {
      const tCra = tCom + (0.3 + rng() * 1.2) * HOUR;
      vals.push({ report_id: rep.id, validator_role: "cra_oficial", validator_name: "Sala Operativa CRA", decision: "alerta_oficial", notes: "Operativo despachado", created_at: new Date(tCra).toISOString() });
    }
    if (p.attention === "atendido") {
      const tAt = tCom + (1 + rng() * 6) * DAY;
      vals.push({ report_id: rep.id, validator_role: "cra_oficial", validator_name: "Sala Operativa CRA", decision: "seguimiento_operativo", notes: "Caso atendido y cerrado", created_at: new Date(tAt).toISOString() });
    }
  });

  const { error: vErr } = await supabase.from("report_validations").insert(vals);
  if (vErr) throw vErr;
  console.log(`✓ ${vals.length} validaciones históricas insertadas`);
}

run().catch((e) => {
  console.error("SEED ERROR:", e.message || e);
  process.exit(1);
});
