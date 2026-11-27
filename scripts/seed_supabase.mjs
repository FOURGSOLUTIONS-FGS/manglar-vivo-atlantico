import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  const p = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].trim();
    }
  }
}

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function seedSectors() {
  const raw = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), "public/data/geo/cra_sectors.geojson"), "utf8")
  );
  const tcBySector = { 1: 270, 2: 255, 3: 250, 4: 262 };
  const rows = raw.features.map((f) => {
    const p = f.properties;
    const ring = f.geometry.coordinates[0].map(([lon, lat]) => `${lon} ${lat}`).join(", ");
    return {
      sector_id: p.sector_id,
      nombre: p.nombre,
      centroid_lat: p.centroid_lat,
      centroid_lon: p.centroid_lon,
      referencia_ha: p.resumen?.referencia_ha ?? 0,
      segura_ha: p.resumen?.segura_ha ?? 0,
      por_revisar_ha: p.resumen?.intermedia_ha ?? 0,
      dosel_seco_ha: p.seco?.ha_seco_010 ?? 0,
      anomalia_dosel: p.seco?.anomalia_mediana ?? 0,
      riesgo_medio: p.riesgo?.riesgo_medio ?? 0,
      vulnerabilidad_media: p.riesgo?.vulnerabilidad_media ?? 0,
      carbono_tc: p.carbono?.tC ?? 0,
      carbono_tc_ha: tcBySector[p.sector_id] ?? 260,
      geom: `SRID=4326;POLYGON((${ring}))`,
    };
  });
  const { error } = await supabase.from("cra_sectors").upsert(rows, { onConflict: "sector_id" });
  if (error) throw error;
  console.log(`✓ cra_sectors: ${rows.length} sectores cargados`);
}

async function seedGroundTruth() {
  const raw = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), "public/data/geo/cra_ground_truth_pts.geojson"), "utf8")
  );
  const rows = raw.features.map((f) => ({
    point_id: f.properties.point_id,
    clase_interpretada: f.properties.clase_interpretada,
    es_manglar_consenso: f.properties.es_manglar_consenso,
    lon: f.geometry.coordinates[0],
    lat: f.geometry.coordinates[1],
  }));
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    const { error } = await supabase.from("cra_ground_truth_points").upsert(chunk, { onConflict: "point_id" });
    if (error) throw error;
  }
  console.log(`✓ cra_ground_truth_points: ${rows.length} puntos CRA cargados`);
}

async function seedActorsAndProposals() {
  const { count: actorCount } = await supabase
    .from("registered_actors")
    .select("*", { count: "exact", head: true });

  let actorIds = [];
  if ((actorCount ?? 0) === 0) {
    const actors = [
      {
        nombre_entidad_o_persona: "Asociación de pescadores de la ciénaga",
        tipo_actor: "Comunidad u organización de base",
        tipo_accion: "conservacion",
        sector_id: 1,
        municipio_ubicacion: "Barranquilla · Ciénaga de Mallorquín",
        papel: ["Proponer y ejecutar acciones", "Monitorear y reportar"],
        periodo_inicio: "2026-01-01",
        periodo_fin: "2027-12-31",
        contacto_privado: "contacto@pescadoresmallorquin.org",
      },
      {
        nombre_entidad_o_persona: "Universidad del Atlántico — Grupo de Ecosistemas Costeros",
        tipo_actor: "Academia",
        tipo_accion: "investigacion",
        sector_id: 2,
        municipio_ubicacion: "Puerto Colombia · Balboa",
        papel: ["Monitorear y reportar", "Coparticipar en acciones de otros"],
        periodo_inicio: "2026-02-01",
        periodo_fin: "2027-06-30",
        contacto_privado: "ecosistemas@mail.uniatlantico.edu.co",
      },
      {
        nombre_entidad_o_persona: "Fundación Manglar Vivo",
        tipo_actor: "Organización no gubernamental",
        tipo_accion: "restauracion",
        sector_id: 4,
        municipio_ubicacion: "Piojó · Totumo – Galerazamba",
        papel: ["Proponer y ejecutar acciones", "Financiar o cooperar"],
        periodo_inicio: "2026-01-15",
        periodo_fin: "2028-01-15",
        contacto_privado: "proyectos@manglarvivo.org",
      },
      {
        nombre_entidad_o_persona: "I.E. Técnica Agropecuaria de Juan de Acosta",
        tipo_actor: "Escuela",
        tipo_accion: "monitoreo",
        sector_id: 3,
        municipio_ubicacion: "Juan de Acosta · Santa Verónica",
        papel: ["Monitorear y reportar", "Coparticipar en acciones de otros"],
        periodo_inicio: "2026-03-01",
        periodo_fin: "2026-12-15",
        contacto_privado: "praes@iejuanacosta.edu.co",
      },
    ];
    const { data, error } = await supabase.from("registered_actors").insert(actors).select("id, nombre_entidad_o_persona");
    if (error) throw error;
    actorIds = data;
    console.log(`✓ registered_actors: ${data.length} actores iniciales`);
  } else {
    const { data } = await supabase.from("registered_actors").select("id, nombre_entidad_o_persona").limit(4);
    actorIds = data ?? [];
    console.log(`= registered_actors ya tiene ${actorCount} registros`);
  }

  const { count: propCount } = await supabase
    .from("citizen_proposals")
    .select("*", { count: "exact", head: true });

  if ((propCount ?? 0) === 0 && actorIds.length > 0) {
    const proposals = [
      {
        actor_id: actorIds[0]?.id ?? null,
        proponente: actorIds[0]?.nombre_entidad_o_persona ?? "Asociación de pescadores",
        titulo_proyecto: "Siembra de mangle rojo en el caño de Mallorquín",
        tipo_accion: "Siembra",
        hectareas: 1.5,
        sector_id: 1,
        ubicacion_objetivo: "Mallorquín – Bocas de Ceniza",
        latitud: 11.0412,
        longitud: -74.8594,
        accion_plan_heredada: "Restauración",
        prioridad_heredada: "Alta",
        resumen_objetivo: "Repoblar borde degradado del caño con propágulos de Rhizophora mangle de vivero local.",
        checklist_cumplimiento: [1, 1, 1, 1, 1, 0],
        estado: "En ejecución",
        monitoreos: [{ fecha: "2026-08-15", sup: 84, alt: 38, fotos: 12 }],
      },
      {
        actor_id: actorIds[2]?.id ?? actorIds[0]?.id ?? null,
        proponente: actorIds[2]?.nombre_entidad_o_persona ?? "Fundación Manglar Vivo",
        titulo_proyecto: "Siembra del caño Balboa",
        tipo_accion: "Siembra",
        hectareas: 0.8,
        sector_id: 2,
        ubicacion_objetivo: "Puerto Colombia – Ciénaga de Balboa",
        latitud: 10.9585,
        longitud: -74.9965,
        accion_plan_heredada: "Recuperación",
        prioridad_heredada: "Media",
        resumen_objetivo: "Recuperación de franja costera en ciénaga de Balboa con seguimiento comunitario.",
        checklist_cumplimiento: [1, 1, 0, 1, 1, 1],
        estado: "Aprobada",
        monitoreos: [],
      },
      {
        actor_id: actorIds[3]?.id ?? actorIds[0]?.id ?? null,
        proponente: actorIds[3]?.nombre_entidad_o_persona ?? "I.E. Juan de Acosta",
        titulo_proyecto: "Vigías escolares de las 102 ha por revisar en Juan de Acosta",
        tipo_accion: "Conservación y vigilancia",
        hectareas: 18.0,
        sector_id: 3,
        ubicacion_objetivo: "Tubará – Juan de Acosta",
        latitud: 10.8714,
        longitud: -75.0982,
        accion_plan_heredada: "Preservación",
        prioridad_heredada: "Alta",
        resumen_objetivo: "Verificación en campo con estudiantes de zonas de manglar con mayor estrés hídrico (-0.151).",
        checklist_cumplimiento: [1, 1, 1, 0, 1, 1],
        estado: "En revisión",
        monitoreos: [],
      },
      {
        actor_id: actorIds[1]?.id ?? actorIds[0]?.id ?? null,
        proponente: actorIds[1]?.nombre_entidad_o_persona ?? "Universidad del Atlántico",
        titulo_proyecto: "Reapertura de caño de intercambio en Puerto Velero",
        tipo_accion: "Restauración hidrológica",
        hectareas: 3.2,
        sector_id: 2,
        ubicacion_objetivo: "Puerto Colombia – Puerto Velero",
        latitud: 10.9355,
        longitud: -75.0258,
        accion_plan_heredada: "Restauración",
        prioridad_heredada: "Alta",
        resumen_objetivo: "Destaponamiento controlado para restablecer flujo mareal y bajar salinidad del dosel.",
        checklist_cumplimiento: [1, 1, 1, 0, 0, 1],
        estado: "Con observaciones",
        monitoreos: [],
      },
    ];
    const { error } = await supabase.from("citizen_proposals").insert(proposals);
    if (error) throw error;
    console.log(`✓ citizen_proposals: ${proposals.length} acciones iniciales`);
  } else {
    console.log(`= citizen_proposals ya tiene ${propCount} registros`);
  }
}

async function seedReports() {
  const { count } = await supabase.from("citizen_reports").select("*", { count: "exact", head: true });
  if ((count ?? 0) > 0) {
    console.log(`= citizen_reports ya tiene ${count} reportes`);
    return;
  }

  const now = Date.now();
  const hoursAgo = (h) => new Date(now - h * 3600 * 1000).toISOString();

  const reports = [
    {
      client_uuid: "11111111-1111-4111-8111-111111111101",
      tracking_code: "MGL-2026-0101",
      timestamp_captura: hoursAgo(2),
      latitud: 10.8726,
      longitud: -75.0954,
      precision_gps_m: 11.4,
      is_simulated_gps: false,
      zona_manglar: "Tubará – Juan de Acosta",
      municipio: "Juan de Acosta",
      sector_id: 3,
      accion_plan: "Preservación",
      en_zona_por_revisar: true,
      tipo_evento: "cambio_hidrico",
      descripcion_ciudadana: "Caño taponado cerca de la escuela; el mangle se ve amarillento y seco en el borde.",
      evidencia_foto_url: "/images/hero-manglar-atlantico.png",
      evidencia_exif: { source: "seed_campo", camera: "Android Field PWA", hasGpsExif: true },
      perfil_reportante: "estudiante_escuela",
      school_name: "I.E. Técnica Agropecuaria de Juan de Acosta",
      estado_sincronizacion: "sincronizado",
      estado_validacion: "alerta_oficial_cra",
      attention_status: "operativo_en_curso",
      clasificacion_tecnica: "Estrés hídrico agudo por obstrucción de caño en sector de alta vulnerabilidad (0.641)",
      nivel_prioridad: "alta",
      puntaje_confiabilidad: 95,
      ai_classification: {
        mode: "seed_verified",
        clasificacion_tecnica: "Alteración hidrológica y desecamiento de dosel",
        severidad: "alta",
        confianza: 0.91,
        resumen_tecnico: "Coincide con anomalía de humedad -0.151 del workflow CRA 2026.",
      },
      ground_truth_match: { nearest_point_id: 214, dist_m: 340, es_manglar_consenso: true },
    },
    {
      client_uuid: "11111111-1111-4111-8111-111111111102",
      tracking_code: "MGL-2026-0102",
      timestamp_captura: hoursAgo(5),
      latitud: 11.0448,
      longitud: -74.8632,
      precision_gps_m: 8.2,
      is_simulated_gps: false,
      zona_manglar: "Mallorquín – Bocas de Ceniza",
      municipio: "Barranquilla",
      sector_id: 1,
      accion_plan: "Preservación",
      en_zona_por_revisar: false,
      tipo_evento: "contaminacion_residuos",
      descripcion_ciudadana: "Acumulación de plásticos y escombros en la orilla del sendero occidental.",
      evidencia_foto_url: "/images/turista-qr-sendero.png",
      evidencia_exif: { source: "seed_qr", camera: "iPhone Safari", hasGpsExif: true },
      perfil_reportante: "turista",
      qr_station_id: "mallorquin-sendero-1",
      estado_sincronizacion: "sincronizado",
      estado_validacion: "validado_comunitario",
      attention_status: "en_revision",
      clasificacion_tecnica: "Presión antrópica por residuos sólidos en borde urbano de Mallorquín",
      nivel_prioridad: "alta",
      puntaje_confiabilidad: 80,
      ai_classification: {
        mode: "seed_verified",
        clasificacion_tecnica: "Contaminación por residuos sólidos en zona de preservación",
        severidad: "media",
        confianza: 0.87,
        resumen_tecnico: "Sector con presión antrópica más alta del departamento (0.776).",
      },
      ground_truth_match: { nearest_point_id: 88, dist_m: 195, es_manglar_consenso: true },
    },
    {
      client_uuid: "11111111-1111-4111-8111-111111111103",
      tracking_code: "MGL-2026-0103",
      timestamp_captura: hoursAgo(11),
      latitud: 10.9531,
      longitud: -75.0021,
      precision_gps_m: 14.0,
      is_simulated_gps: false,
      zona_manglar: "Puerto Colombia – Balboa – Puerto Velero",
      municipio: "Puerto Colombia",
      sector_id: 2,
      accion_plan: "Restauración",
      en_zona_por_revisar: true,
      tipo_evento: "tala_relleno",
      descripcion_ciudadana: "Corte reciente de ramas de mangle y relleno con arena al costado sur de Balboa.",
      evidencia_foto_url: "/images/hero-manglar-atlantico.png",
      evidencia_exif: { source: "seed_campo", hasGpsExif: true },
      perfil_reportante: "habitante_local",
      estado_sincronizacion: "sincronizado",
      estado_validacion: "nuevo",
      attention_status: "pendiente",
      clasificacion_tecnica: "Posible tala y relleno en área de restauración",
      nivel_prioridad: "alta",
      puntaje_confiabilidad: 65,
      ai_classification: {
        mode: "seed_verified",
        clasificacion_tecnica: "Pérdida de cobertura arbórea / relleno costero",
        severidad: "alta",
        confianza: 0.84,
        resumen_tecnico: "Requiere confirmación de mentor comunitario y académico.",
      },
      ground_truth_match: { nearest_point_id: 4, dist_m: 280, es_manglar_consenso: true },
    },
    {
      client_uuid: "11111111-1111-4111-8111-111111111104",
      tracking_code: "MGL-2026-0104",
      timestamp_captura: hoursAgo(18),
      latitud: 10.7429,
      longitud: -75.2185,
      precision_gps_m: 18.5,
      is_simulated_gps: false,
      zona_manglar: "Totumo – Astilleros – Galerazamba",
      municipio: "Piojó",
      sector_id: 4,
      accion_plan: "Preservación",
      en_zona_por_revisar: true,
      tipo_evento: "otro",
      descripcion_ciudadana: "Verificación de manglar vivo con garzas y cangrejo azul en zona marcada por revisar.",
      evidencia_foto_url: "/images/escuelas-guardianes.png",
      evidencia_exif: { source: "seed_escuela", hasGpsExif: true },
      perfil_reportante: "estudiante_escuela",
      school_name: "I.E. El Totumo",
      estado_sincronizacion: "sincronizado",
      estado_validacion: "validado_academico",
      attention_status: "atendido",
      clasificacion_tecnica: "Validación ground-truth positiva en polígono de 451.8 ha por revisar",
      nivel_prioridad: "media",
      puntaje_confiabilidad: 90,
      ai_classification: {
        mode: "seed_verified",
        clasificacion_tecnica: "Cobertura de manglar confirmada con fauna asociada",
        severidad: "baja",
        confianza: 0.93,
        resumen_tecnico: "Aporta etiqueta independiente para actualizar mapa de 828 ha por revisar.",
      },
      ground_truth_match: { nearest_point_id: 412, dist_m: 410, es_manglar_consenso: true },
    },
    {
      client_uuid: "11111111-1111-4111-8111-111111111105",
      tracking_code: "MGL-2026-0105",
      timestamp_captura: hoursAgo(26),
      latitud: 10.8924,
      longitud: -75.0412,
      precision_gps_m: 16.0,
      is_simulated_gps: false,
      zona_manglar: "Tubará – Juan de Acosta",
      municipio: "Tubará",
      sector_id: 3,
      accion_plan: "Recuperación",
      en_zona_por_revisar: false,
      tipo_evento: "dano_fauna_especies",
      descripcion_ciudadana: "Captura no autorizada de cangrejo azul y redes en la desembocadura del arroyo.",
      evidencia_foto_url: "/images/turista-qr-sendero.png",
      evidencia_exif: { source: "seed_campo", hasGpsExif: true },
      perfil_reportante: "actor_registrado",
      estado_sincronizacion: "sincronizado",
      estado_validacion: "validado_comunitario",
      attention_status: "en_revision",
      clasificacion_tecnica: "Presión sobre fauna bentónica asociada al manglar",
      nivel_prioridad: "media",
      puntaje_confiabilidad: 75,
      ai_classification: {
        mode: "seed_verified",
        clasificacion_tecnica: "Perturbación de fauna asociada (Cardisoma guanhumi)",
        severidad: "media",
        confianza: 0.82,
        resumen_tecnico: "Requiere seguimiento con Policía Ambiental y vigías locales.",
      },
      ground_truth_match: { nearest_point_id: 198, dist_m: 520, es_manglar_consenso: false },
    },
  ];

  const { data: inserted, error } = await supabase
    .from("citizen_reports")
    .insert(reports)
    .select("id, tracking_code, estado_validacion");
  if (error) throw error;

  const validations = [];
  for (const r of inserted) {
    if (r.estado_validacion !== "nuevo") {
      validations.push({
        report_id: r.id,
        validator_role: "mentor_comunitario",
        validator_name: "Líder de Pescadores Atlántico",
        decision: "aprobado",
        technical_label: "Confirmado en territorio",
        notes: "Verificación directa con vigía de la ciénaga.",
      });
    }
    if (r.estado_validacion === "validado_academico" || r.estado_validacion === "alerta_oficial_cra") {
      validations.push({
        report_id: r.id,
        validator_role: "mentor_academico",
        validator_name: "Grupo Ecosistemas Costeros UniAtlántico",
        decision: "aprobado",
        technical_label: "Clasificación técnica validada contra Sentinel-2",
        notes: "Consistente con anomalía hídrica y capa ground-truth CRA.",
      });
    }
    if (r.estado_validacion === "alerta_oficial_cra") {
      validations.push({
        report_id: r.id,
        validator_role: "cra_oficial",
        validator_name: "Sala Operativa CRA",
        decision: "alerta_oficial",
        technical_label: "Operativo activado",
        notes: "Despachado equipo técnico para inspección de caño en Juan de Acosta.",
      });
    }
  }
  if (validations.length > 0) {
    const { error: vErr } = await supabase.from("report_validations").insert(validations);
    if (vErr) throw vErr;
  }
  console.log(`✓ citizen_reports: ${inserted.length} reportes + ${validations.length} validaciones iniciales`);
}

async function main() {
  await seedSectors();
  await seedGroundTruth();
  await seedActorsAndProposals();
  await seedReports();
  console.log("Seed completo finalizado.");
}

main().catch((err) => {
  console.error("Error en seed:", err);
  process.exit(1);
});
