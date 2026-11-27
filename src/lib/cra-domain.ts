export type EventTypeId =
  | "tala_relleno"
  | "contaminacion_residuos"
  | "cambio_hidrico"
  | "dano_fauna_especies"
  | "otro";

export type ReporterProfileId =
  | "habitante_local"
  | "estudiante_escuela"
  | "turista"
  | "actor_registrado";

export type ValidationStatus =
  | "nuevo"
  | "validado_comunitario"
  | "validado_academico"
  | "alerta_oficial_cra"
  | "descartado";

export type AttentionStatus =
  | "pendiente"
  | "en_revision"
  | "operativo_en_curso"
  | "atendido";

export type ProposalActionType =
  | "Siembra"
  | "Restauración hidrológica"
  | "Solución basada en la naturaleza"
  | "Conservación y vigilancia";

export const PROPOSAL_STATES = [
  "Propuesta",
  "En revisión",
  "Con observaciones",
  "Aprobada",
  "En ejecución",
  "Cerrada",
] as const;

export const PLAN_COLORS: Record<string, string> = {
  Preservación: "#1f78b4",
  Restauración: "#33a02c",
  Recuperación: "#ff7f00",
  Rehabilitación: "#cab2d6",
};

export interface CraSectorInfo {
  id: number;
  nombre: string;
  municipioPrincipal: string;
  referenciaHa: number;
  seguraHa: number;
  porRevisarHa: number;
  doselSecoHa: number;
  anomaliaDosel: number;
  riesgoMedio: number;
  vulnerabilidadMedia: number;
  carbonoTc: number;
  carbonoTcHa: number;
  centroidLat: number;
  centroidLon: number;
}

export const CRA_SECTORS: CraSectorInfo[] = [
  {
    id: 1,
    nombre: "Mallorquín – Bocas de Ceniza",
    municipioPrincipal: "Barranquilla / Puerto Colombia",
    referenciaHa: 347.6,
    seguraHa: 261.7,
    porRevisarHa: 168.3,
    doselSecoHa: 106.1,
    anomaliaDosel: -0.046,
    riesgoMedio: 0.383,
    vulnerabilidadMedia: 0.366,
    carbonoTc: 70659,
    carbonoTcHa: 270,
    centroidLat: 11.038055,
    centroidLon: -74.876041,
  },
  {
    id: 2,
    nombre: "Puerto Colombia – Balboa – Puerto Velero",
    municipioPrincipal: "Puerto Colombia",
    referenciaHa: 91.4,
    seguraHa: 59.7,
    porRevisarHa: 105.8,
    doselSecoHa: 47.4,
    anomaliaDosel: -0.102,
    riesgoMedio: 0.418,
    vulnerabilidadMedia: 0.589,
    carbonoTc: 16119,
    carbonoTcHa: 255,
    centroidLat: 10.945289,
    centroidLon: -75.003661,
  },
  {
    id: 3,
    nombre: "Tubará – Juan de Acosta",
    municipioPrincipal: "Juan de Acosta / Tubará",
    referenciaHa: 45.4,
    seguraHa: 26.9,
    porRevisarHa: 102.3,
    doselSecoHa: 36.7,
    anomaliaDosel: -0.151,
    riesgoMedio: 0.436,
    vulnerabilidadMedia: 0.641,
    carbonoTc: 7263,
    carbonoTcHa: 250,
    centroidLat: 10.866949,
    centroidLon: -75.104856,
  },
  {
    id: 4,
    nombre: "Totumo – Astilleros – Galerazamba",
    municipioPrincipal: "Piojó / Luruaco",
    referenciaHa: 290.5,
    seguraHa: 116.4,
    porRevisarHa: 451.8,
    doselSecoHa: 71.8,
    anomaliaDosel: -0.044,
    riesgoMedio: 0.331,
    vulnerabilidadMedia: 0.512,
    carbonoTc: 31428,
    carbonoTcHa: 262,
    centroidLat: 10.755924,
    centroidLon: -75.210915,
  },
];

export const CRA_GLOBAL_METRICS = {
  manglarProbableHa: 775,
  altaProbabilidadHa: 465,
  porRevisarHa: 828,
  doselSeco2026Ha: 262,
  reservaCarbonoTc: 125000,
  co2eFactor: 3.667,
  groundTruthPoints: 524,
  kmzPolygonsTotal: 14732,
  kmzCoastalPolygons: 9408,
  planManglarFueraHa: 221,
};

export interface EventCategoryMeta {
  id: EventTypeId;
  label: string;
  shortDesc: string;
  technicalHint: string;
  defaultPriority: "alta" | "media" | "baja";
}

export const EVENT_CATEGORIES: EventCategoryMeta[] = [
  {
    id: "tala_relleno",
    label: "Tala, quema o relleno",
    shortDesc: "Corte de mangle, maquinaria, rellenos o cercados en el borde.",
    technicalHint: "Pérdida de cobertura arbórea / ocupación ilegal de ronda",
    defaultPriority: "alta",
  },
  {
    id: "cambio_hidrico",
    label: "Caño taponado o sequía",
    shortDesc: "Árboles amarillentos/secos, agua estancada o cierre de caños.",
    technicalHint: "Alteración hidrológica / estrés salino del dosel",
    defaultPriority: "alta",
  },
  {
    id: "contaminacion_residuos",
    label: "Basura o vertimientos",
    shortDesc: "Plásticos, escombros, aceites o aguas residuales en la ciénaga.",
    technicalHint: "Presión antrópica por residuos sólidos o vertimiento",
    defaultPriority: "media",
  },
  {
    id: "dano_fauna_especies",
    label: "Daño a fauna o especies",
    shortDesc: "Aves heridas, extracción ilegal de cangrejo azul o pesca dañina.",
    technicalHint: "Perturbación de fauna asociada al ecosistema de manglar",
    defaultPriority: "media",
  },
  {
    id: "otro",
    label: "Verificación o hallazgo positivo",
    shortDesc: "Confirmar manglar vivo en zona por revisar, regeneración o avistamiento.",
    technicalHint: "Etiqueta ground-truth ciudadana / validación de cobertura",
    defaultPriority: "baja",
  },
];

export const REPORTER_PROFILES: { id: ReporterProfileId; label: string; hint: string }[] = [
  { id: "habitante_local", label: "Habitante o pescador", hint: "Comunidad costera del Atlántico" },
  { id: "estudiante_escuela", label: "Estudiante / Escuela", hint: "Modo Escuelas y PRAES" },
  { id: "turista", label: "Turista / Visitante QR", hint: "Reporte rápido en senderos" },
  { id: "actor_registrado", label: "Actor registrado CRA", hint: "ONG, academia o entidad" },
];

export interface DemoFieldPoint {
  id: string;
  label: string;
  municipio: string;
  sectorId: number;
  lat: number;
  lon: number;
  contextNote: string;
}

export const DEMO_FIELD_POINTS: DemoFieldPoint[] = [
  {
    id: "demo-juan-acosta",
    label: "Juan de Acosta — Borde crítico cerca a escuela",
    municipio: "Juan de Acosta",
    sectorId: 3,
    lat: 10.8719,
    lon: -75.0972,
    contextNote: "Sector con mayor sequía del dosel (-0.151) y mayor riesgo medio (0.436).",
  },
  {
    id: "demo-mallorquin",
    label: "Ciénaga de Mallorquín — Sendero occidental",
    municipio: "Barranquilla",
    sectorId: 1,
    lat: 11.0448,
    lon: -74.8632,
    contextNote: "Mayor reserva de carbono (70,659 tC) y presión urbana (0.776).",
  },
  {
    id: "demo-puerto-velero",
    label: "Puerto Velero / Balboa — Caño estuarino",
    municipio: "Puerto Colombia",
    sectorId: 2,
    lat: 10.9531,
    lon: -75.0021,
    contextNote: "Zona de restauración hidrológica y 105.8 ha por revisar.",
  },
  {
    id: "demo-totumo",
    label: "Ciénaga del Totumo — Zona de 451.8 ha por revisar",
    municipio: "Piojó",
    sectorId: 4,
    lat: 10.7429,
    lon: -75.2185,
    contextNote: "Mayor rezago de verificación en campo del Atlántico (451.8 ha).",
  },
];

export const QR_STATIONS = [
  {
    id: "mallorquin-sendero-1",
    nombre: "Sendero Ecológico Ciénaga de Mallorquín",
    municipio: "Barranquilla",
    sectorId: 1,
    lat: 11.0448,
    lon: -74.8632,
    datoClave: "Aquí vive la mayor reserva de carbono azul del Atlántico: 70,659 toneladas de carbono.",
    especies: "Mangle rojo (Rhizophora mangle), garza blanca y cangrejo azul.",
  },
  {
    id: "puerto-velero-muelle",
    nombre: "Muelle y Manglar de Puerto Velero",
    municipio: "Puerto Colombia",
    sectorId: 2,
    lat: 10.9412,
    lon: -75.0218,
    datoClave: "Las raíces del mangle amortiguan oleaje y son sala cuna de peces y crustáceos del Caribe.",
    especies: "Mangle negro (Avicennia germinans), pelícano pardo y lisa.",
  },
  {
    id: "juan-acosta-estuario",
    nombre: "Estuario Costero de Juan de Acosta",
    municipio: "Juan de Acosta",
    sectorId: 3,
    lat: 10.8719,
    lon: -75.0972,
    datoClave: "Sector prioritario en 2026: el dosel registró sequía de -0.151 durante El Niño.",
    especies: "Mangle blanco (Laguncularia racemosa) y martín pescador.",
  },
  {
    id: "totumo-astilleros",
    nombre: "Mirador Ciénaga del Totumo – Astilleros",
    municipio: "Piojó",
    sectorId: 4,
    lat: 10.7429,
    lon: -75.2185,
    datoClave: "Este corredor concentra 451.8 hectáreas que requieren validación ciudadana en terreno.",
    especies: "Mangle zaragoza, iguanas verdes y aves migratorias.",
  },
];

export const OFFICIAL_CHECKLISTS: Record<ProposalActionType, string[]> = {
  Siembra: [
    "Especie y procedencia del material vegetal (vivero local o propágulos del mismo sector).",
    "Sitio dentro del manglar probable, de las áreas por revisar o de la zona de restauración del plan.",
    "Temporada: inicio en época de lluvias, salinidad y marea verificadas.",
    "Permiso o concepto de la Corporación según la Resolución 1263 de 2018.",
    "Participación comunitaria acordada por escrito.",
    "Plan de monitoreo: supervivencia a 3, 6 y 12 meses con fotografías ubicadas.",
  ],
  "Restauración hidrológica": [
    "Diagnóstico del flujo de agua: caños taponados, diques, salinidad.",
    "Diseño de la intervención con cotas y volumen de sedimento.",
    "Concepto de la autoridad ambiental y, si aplica, de la autoridad marítima.",
    "Manejo de sedimentos y residuos.",
    "Medidas para no afectar pesca ni acceso de las comunidades.",
    "Línea base de espejo de agua y turbidez del workflow para comparar.",
  ],
  "Solución basada en la naturaleza": [
    "Problema que atiende (erosión, inundación, calidad del agua) y evidencia.",
    "Alternativa gris descartada y por qué.",
    "Diseño con especies nativas y materiales biodegradables.",
    "Mantenimiento previsto a cinco años y responsable.",
    "Indicadores de servicio: retroceso costero, altura del dosel, carbono.",
    "Consulta previa verificada cuando aplique.",
  ],
  "Conservación y vigilancia": [
    "Área de vigilancia definida sobre el mapa.",
    "Protocolo de reporte de tala, relleno o vertimiento.",
    "Vínculo con la Corporación y la Policía Ambiental.",
    "Capacitación de vigías comunitarios.",
    "Registro fotográfico periódico.",
    "Seguimiento trimestral con la capa de cambios del workflow.",
  ],
};

export function buildMgaDraft(params: {
  titulo: string;
  proponente: string;
  tipoAccion: string;
  hectareas: number;
  sectorId: number;
  accionPlan: string;
  prioridad: string;
}): string {
  const s = CRA_SECTORS.find((x) => x.id === params.sectorId) ?? CRA_SECTORS[0];
  const tcTotal = Math.round(params.hectareas * s.carbonoTcHa);
  return `PROYECTO (Metodología General Ajustada — DNP) · Borrador prellenado
Nombre: ${params.titulo} en el sector ${s.nombre}, departamento del Atlántico.
Localización: polígono marcado en plataforma; acción del Plan de Manejo CRA: ${params.accionPlan}, prioridad ${params.prioridad}.
Problema central: el sector tiene ${s.referenciaHa} ha de manglar probable y ${s.porRevisarHa} ha por revisar; ${s.doselSecoHa} ha mostraron dosel más seco en 2026 durante El Niño; el índice de riesgo medio es ${s.riesgoMedio}.
Objetivo general: ejecutar ${params.tipoAccion.toLowerCase()} sobre ${params.hectareas} ha de manglar con participación de ${params.proponente}.
Objetivos específicos: 1) cumplir los 6 requerimientos de la lista de chequeo CRA; 2) monitorear supervivencia, altura y cobertura a 3, 6 y 12 meses con fotos geolocalizadas; 3) fortalecer gobernanza comunitaria y escolar.
Cadena de valor: insumos (vivero local, mano de obra comunitaria, monitoreo) -> actividades (lista de chequeo) -> productos (${params.hectareas} ha intervenidas) -> resultados (estabilidad de cobertura en workflow Sentinel-2 CRA).
Indicadores: hectáreas intervenidas (meta ${params.hectareas} ha); supervivencia a 12 meses (>= 70 %); carbono potencial ${tcTotal} t C a madurez (${s.carbonoTcHa} t C/ha).
Beneficiarios: [número] familias de ${s.municipioPrincipal}.
Presupuesto indicativo: [por costear por rubros].
Fuentes: Visor del Manglar del Atlántico CRA (Sentinel-2, radar, altura del dosel); KMZ Prioridades de Conservación; inventario IDEAM.`;
}

export function buildCoopConceptDraft(params: {
  titulo: string;
  proponente: string;
  tipoAccion: string;
  hectareas: number;
  sectorId: number;
  accionPlan: string;
}): string {
  const s = CRA_SECTORS.find((x) => x.id === params.sectorId) ?? CRA_SECTORS[0];
  const co2e = Math.round(params.hectareas * s.carbonoTcHa * CRA_GLOBAL_METRICS.co2eFactor);
  return `NOTA CONCEPTUAL PARA COOPERACIÓN · Borrador prellenado
Título: ${params.titulo}.
Solicitante: ${params.proponente}, en articulación con la Corporación Autónoma Regional del Atlántico (CRA).
Contexto: el manglar del Atlántico suma 775 ha probables (465 ha con probabilidad alta) y 828 ha por revisar en terreno; el sector ${s.nombre} concentra ${s.referenciaHa} ha y un índice de riesgo medio de ${s.riesgoMedio} (anomalía de humedad ${s.anomaliaDosel} durante El Niño 2026).
Problema territorial: [detallar presión local: taponamiento de caños, tala, residuos o erosión costera].
Objetivo: implementar ${params.tipoAccion.toLowerCase()} en ${params.hectareas} ha dentro de zona de ${params.accionPlan.toLowerCase()} del Plan de Manejo.
Resultados esperados: R1 ${params.hectareas} ha intervenidas con lista de chequeo CRA aprobada; R2 reportes trimestrales con fotografías geolocalizadas integradas al workflow satelital como etiquetas ground-truth; R3 apropiación comunitaria y escolar.
Contribución climática estimada: hasta ${co2e.toLocaleString("es-CO")} t CO₂e evitadas o capturadas a madurez (${s.carbonoTcHa} t C/ha × factor 3,667).
Duración y presupuesto indicativo: [24 meses; monto por definir].
Riesgos: nuevos episodios de El Niño; cambios en uso del suelo vecino.`;
}
