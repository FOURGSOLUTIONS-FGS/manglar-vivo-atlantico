export type EventTypeId =
  | "tala_relleno"
  | "contaminacion_residuos"
  | "cambio_hidrico"
  | "dano_fauna_especies"
  | "otro";

export type FactorDomainId =
  | "cobertura_suelo"
  | "agua_dosel"
  | "contaminacion"
  | "fauna_verificacion";

export type SubtypeId =
  | "tala_poda"
  | "relleno_obra"
  | "quema_incendio"
  | "cano_taponado"
  | "dosel_seco"
  | "erosion_costera"
  | "residuos_solidos"
  | "vertimiento_agua"
  | "derrame_combustible"
  | "fauna_amenaza"
  | "avistamiento_fauna"
  | "verificacion_828ha";

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
  satImage: string;
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
    satImage: "/media/sat/z1_img.jpg",
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
    satImage: "/media/sat/z2_img.jpg",
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
    satImage: "/media/sat/z3_img.jpg",
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
    satImage: "/media/sat/z4_img.jpg",
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

export interface FactorSubtypeMeta {
  id: SubtypeId;
  domainId: FactorDomainId;
  eventType: EventTypeId;
  label: string;
  description: string;
  technicalHint: string;
  defaultPriority: "alta" | "media" | "baja";
  quickTags: string[];
}

export interface FactorDomainMeta {
  id: FactorDomainId;
  title: string;
  shortTitle: string;
  summary: string;
  accentHex: string;
  subtypes: FactorSubtypeMeta[];
}

export const FACTOR_DOMAINS: FactorDomainMeta[] = [
  {
    id: "cobertura_suelo",
    title: "Cobertura y Suelo",
    shortTitle: "Cobertura",
    summary: "Intervenciones directas sobre árboles, raíces o borde costero.",
    accentHex: "#C84023",
    subtypes: [
      {
        id: "tala_poda",
        domainId: "cobertura_suelo",
        eventType: "tala_relleno",
        label: "Tala o corte de mangle",
        description: "Árboles cortados, motosierra o extracción de madera.",
        technicalHint: "Pérdida directa de cobertura arbórea por tala o aprovechamiento no autorizado",
        defaultPriority: "alta",
        quickTags: ["Corte reciente", "Motosierra o herramientas", "Ramas acumuladas"],
      },
      {
        id: "relleno_obra",
        domainId: "cobertura_suelo",
        eventType: "tala_relleno",
        label: "Relleno, cercado u obra",
        description: "Arena, escombros, cercas o maquinaria entrando a la ronda.",
        technicalHint: "Ocupación ilegal de ronda hídrica por relleno o infraestructura",
        defaultPriority: "alta",
        quickTags: ["Relleno con arena/tierra", "Cerca nueva", "Maquinaria en el borde"],
      },
      {
        id: "quema_incendio",
        domainId: "cobertura_suelo",
        eventType: "tala_relleno",
        label: "Quema o incendio",
        description: "Fuego activo, humo denso o suelo calcinado junto al manglar.",
        technicalHint: "Afectación térmica de cobertura y liberación de carbono del suelo",
        defaultPriority: "alta",
        quickTags: ["Humo o fuego activo", "Vegetación quemada", "Riesgo de propagación"],
      },
    ],
  },
  {
    id: "agua_dosel",
    title: "Agua y Salud del Dosel",
    shortTitle: "Agua y Dosel",
    summary: "Flujo mareal, caños, salinidad y sequía observada en 2026.",
    accentHex: "#C98206",
    subtypes: [
      {
        id: "cano_taponado",
        domainId: "agua_dosel",
        eventType: "cambio_hidrico",
        label: "Caño o canal taponado",
        description: "Sedimentos, diques o bloqueos que impiden circular el agua.",
        technicalHint: "Obstrucción de conectividad hidrológica e intercambio mareal",
        defaultPriority: "alta",
        quickTags: ["Agua estancada", "Sedimentos bloqueando", "Dique o barrera"],
      },
      {
        id: "dosel_seco",
        domainId: "agua_dosel",
        eventType: "cambio_hidrico",
        label: "Mangle seco o amarillento",
        description: "Hojas amarillas, ramas secas o árboles muriendo de pie.",
        technicalHint: "Estrés hídrico/salino y desecamiento de dosel (anomalía 2026)",
        defaultPriority: "alta",
        quickTags: ["Hojas amarillas", "Árboles secos en pie", "Suelo agrietado"],
      },
      {
        id: "erosion_costera",
        domainId: "agua_dosel",
        eventType: "cambio_hidrico",
        label: "Erosión o caída de borde",
        description: "Oleaje socavando raíces o retroceso visible de la orilla.",
        technicalHint: "Erosión costera y desestabilización de franja protectora de manglar",
        defaultPriority: "media",
        quickTags: ["Raíces desenterradas", "Árboles caídos", "Avance del mar"],
      },
    ],
  },
  {
    id: "contaminacion",
    title: "Contaminación y Residuos",
    shortTitle: "Contaminación",
    summary: "Presión por basuras, aguas residuales o sustancias químicas.",
    accentHex: "#005F96",
    subtypes: [
      {
        id: "residuos_solidos",
        domainId: "contaminacion",
        eventType: "contaminacion_residuos",
        label: "Basura y plásticos",
        description: "Plásticos atrapados en raíces, escombros o puntos críticos.",
        technicalHint: "Presión antrópica por acumulación de residuos sólidos costeros",
        defaultPriority: "media",
        quickTags: ["Plásticos en raíces", "Escombros", "Botadero en borde"],
      },
      {
        id: "vertimiento_agua",
        domainId: "contaminacion",
        eventType: "contaminacion_residuos",
        label: "Vertimiento o agua turbia",
        description: "Descarga de aguas negras, espumas, mal olor o cambio de color.",
        technicalHint: "Vertimiento de aguas residuales y alteración fisicoquímica del estuario",
        defaultPriority: "alta",
        quickTags: ["Tubería descargando", "Espuma u olor fuerte", "Agua muy oscura"],
      },
      {
        id: "derrame_combustible",
        domainId: "contaminacion",
        eventType: "contaminacion_residuos",
        label: "Aceite o combustible",
        description: "Mancha brillante en el agua cerca a embarcaciones o muelles.",
        technicalHint: "Contaminación por hidrocarburos en espejo de agua estuarino",
        defaultPriority: "alta",
        quickTags: ["Mancha aceitosa", "Olor a combustible", "Zona de lanchas"],
      },
    ],
  },
  {
    id: "fauna_verificacion",
    title: "Fauna y Verificación Viva",
    shortTitle: "Fauna y 828 ha",
    summary: "Protección de especies, bioindicadores y validación de las 828 ha.",
    accentHex: "#16794A",
    subtypes: [
      {
        id: "fauna_amenaza",
        domainId: "fauna_verificacion",
        eventType: "dano_fauna_especies",
        label: "Fauna herida o extracción ilegal",
        description: "Aves o peces afectados, trampas o captura ilegal de cangrejo azul.",
        technicalHint: "Perturbación o extracción ilegal de fauna asociada al ecosistema",
        defaultPriority: "alta",
        quickTags: ["Animal herido", "Redes o trampas", "Extracción de cangrejo azul"],
      },
      {
        id: "avistamiento_fauna",
        domainId: "fauna_verificacion",
        eventType: "otro",
        label: "Avistamiento de fauna viva",
        description: "Registro de aves, cangrejo azul, peces o fauna sana del manglar.",
        technicalHint: "Bioindicador positivo de salud ecosistémica y biodiversidad",
        defaultPriority: "baja",
        quickTags: ["Garza o ave costera", "Cangrejo azul", "Alevinos / peces"],
      },
      {
        id: "verificacion_828ha",
        domainId: "fauna_verificacion",
        eventType: "otro",
        label: "Verificar manglar sano (828 ha)",
        description: "Confirmar cobertura viva o seguimiento de plántulas en campo.",
        technicalHint: "Etiqueta ground-truth ciudadana para las 828 ha por revisar CRA",
        defaultPriority: "baja",
        quickTags: ["Manglar sano", "Plántulas creciendo", "Zona por revisar"],
      },
    ],
  },
];

export const ALL_SUBTYPES: FactorSubtypeMeta[] = FACTOR_DOMAINS.flatMap((d) => d.subtypes);

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
    label: "Cobertura y Suelo",
    shortDesc: "Tala, relleno, obra o quema en el manglar.",
    technicalHint: "Pérdida de cobertura arbórea / ocupación ilegal de ronda",
    defaultPriority: "alta",
  },
  {
    id: "cambio_hidrico",
    label: "Agua y Salud del Dosel",
    shortDesc: "Caño taponado, mangle seco o erosión costera.",
    technicalHint: "Alteración hidrológica / estrés salino del dosel",
    defaultPriority: "alta",
  },
  {
    id: "contaminacion_residuos",
    label: "Contaminación y Residuos",
    shortDesc: "Basura, vertimientos o derrames de aceite.",
    technicalHint: "Presión antrópica por residuos sólidos o vertimiento",
    defaultPriority: "media",
  },
  {
    id: "dano_fauna_especies",
    label: "Amenaza a Fauna",
    shortDesc: "Fauna herida, redes o extracción ilegal.",
    technicalHint: "Perturbación de fauna asociada al ecosistema de manglar",
    defaultPriority: "alta",
  },
  {
    id: "otro",
    label: "Verificación y Biodiversidad",
    shortDesc: "Manglar sano (828 ha por revisar) o avistamiento positivo.",
    technicalHint: "Etiqueta ground-truth ciudadana / validación de cobertura",
    defaultPriority: "baja",
  },
];

export const REPORTER_PROFILES: { id: ReporterProfileId; label: string; hint: string }[] = [
  { id: "habitante_local", label: "Vecino / Pescador", hint: "Comunidad costera" },
  { id: "estudiante_escuela", label: "Estudiante", hint: "Modo Escuelas PRAES" },
  { id: "turista", label: "Turista", hint: "Visitante en sendero" },
  { id: "actor_registrado", label: "Entidad / ONG", hint: "Actor registrado CRA" },
];

export interface DemoFieldPoint {
  id: string;
  label: string;
  municipio: string;
  sectorId: number;
  satImage: string;
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
    satImage: "/media/sat/z3_img.jpg",
    lat: 10.8719,
    lon: -75.0972,
    contextNote: "Anomalía de sequía -0.151 · Riesgo 0.436",
  },
  {
    id: "demo-mallorquin",
    label: "Ciénaga de Mallorquín — Sendero occidental",
    municipio: "Barranquilla",
    sectorId: 1,
    satImage: "/media/sat/z1_img.jpg",
    lat: 11.0448,
    lon: -74.8632,
    contextNote: "70,659 tC carbono · Presión urbana 0.776",
  },
  {
    id: "demo-puerto-velero",
    label: "Puerto Velero / Balboa — Caño estuarino",
    municipio: "Puerto Colombia",
    sectorId: 2,
    satImage: "/media/sat/z2_img.jpg",
    lat: 10.9531,
    lon: -75.0021,
    contextNote: "Restauración hidrológica · 105.8 ha por revisar",
  },
  {
    id: "demo-totumo",
    label: "Ciénaga del Totumo — Zona de 451.8 ha por revisar",
    municipio: "Piojó",
    sectorId: 4,
    satImage: "/media/sat/z4_img.jpg",
    lat: 10.7429,
    lon: -75.2185,
    contextNote: "Mayor rezago de verificación en campo",
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
