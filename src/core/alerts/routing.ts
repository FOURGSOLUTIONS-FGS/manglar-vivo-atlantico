import type { AlertLevel, AlertRecipient } from "./types";

export const OFFICIAL_RECIPIENTS: Record<string, AlertRecipient> = {
  sala_crisis_cra: {
    id: "sala_crisis_cra",
    name: "Sala Operativa y Alerta Temprana CRA Atlántico",
    role: "Autoridad ambiental departamental",
    channel: "correo_urgente",
    slaLabel: "< 2 horas",
    kidRoleLabel: "Equipo de emergencia ambiental CRA",
  },
  policia_ambiental: {
    id: "policia_ambiental",
    name: "Policía Ambiental / Guardacostas del Caribe",
    role: "Control en campo contra tala, quema, relleno y derrames",
    channel: "correo_urgente",
    slaLabel: "< 2 horas",
    kidRoleLabel: "Policía que protege los árboles y el agua",
  },
  supervisor_sector: {
    id: "supervisor_sector",
    name: "Supervisor Técnico del Sector Costero CRA",
    role: "Diagnóstico hidrológico, dosel seco y fauna afectada",
    channel: "sala_cra",
    slaLabel: "< 24 horas",
    kidRoleLabel: "Especialista del manglar en tu municipio",
  },
  mentores_territoriales: {
    id: "mentores_territoriales",
    name: "Red de Mentores Comunitarios y Académicos",
    role: "Doble validación en terreno y clasificación científica",
    channel: "consola_mentores",
    slaLabel: "< 48 horas",
    kidRoleLabel: "Líderes del barrio y profes de universidad",
  },
  equipo_satelital_praes: {
    id: "equipo_satelital_praes",
    name: "Equipo Satelital CRA (828 ha) y Red Escuelas PRAES",
    role: "Actualización de cobertura ground-truth y cierre de ciclo escolar",
    channel: "tablero_escuelas",
    slaLabel: "Seguimiento continuo",
    kidRoleLabel: "Mapa oficial y medallero de colegios",
  },
};

export interface AlertLevelGuide {
  level: AlertLevel;
  title: string;
  simpleTitle: string;
  colorHex: string;
  slaLabel: string;
  whenTriggered: string;
  whoReceives: AlertRecipient[];
  autoEmail: boolean;
}

export const ALERT_ROUTING_MATRIX: AlertLevelGuide[] = [
  {
    level: "urgente",
    title: "Nivel 1 · Urgente / Crítico",
    simpleTitle: "Alerta Roja — Necesita ayuda YA",
    colorHex: "#C84023",
    slaLabel: "< 2 horas",
    whenTriggered:
      "Tala, relleno u obra ilegal, quema activa, derrame de combustible, vertimiento de aguas negras o alerta oficial CRA.",
    whoReceives: [
      OFFICIAL_RECIPIENTS.sala_crisis_cra,
      OFFICIAL_RECIPIENTS.policia_ambiental,
      OFFICIAL_RECIPIENTS.supervisor_sector,
    ],
    autoEmail: true,
  },
  {
    level: "alta",
    title: "Nivel 2 · Alta / Prioritaria",
    simpleTitle: "Alerta Naranja — Revisar hoy mismo",
    colorHex: "#C98206",
    slaLabel: "< 24 horas",
    whenTriggered:
      "Caño taponado, mangle seco o amarillento (anomalía 2026), erosión costera o fauna herida/redes.",
    whoReceives: [
      OFFICIAL_RECIPIENTS.supervisor_sector,
      OFFICIAL_RECIPIENTS.mentores_territoriales,
    ],
    autoEmail: false,
  },
  {
    level: "media",
    title: "Nivel 3 · Media / Validación",
    simpleTitle: "Alerta Azul — Los mentores revisan",
    colorHex: "#005F96",
    slaLabel: "< 48 horas",
    whenTriggered:
      "Acumulación de basura y plásticos en borde, o reportes cuya foto fue observada por el filtro IA y requieren aval humano.",
    whoReceives: [OFFICIAL_RECIPIENTS.mentores_territoriales],
    autoEmail: false,
  },
  {
    level: "verificacion",
    title: "Nivel 4 · Verificación Positiva (828 ha)",
    simpleTitle: "¡Buena Noticia! — Manglar sano o fauna viva",
    colorHex: "#16794A",
    slaLabel: "Cierre de ciclo",
    whenTriggered:
      "Confirmación de manglar sano en las 828 ha por revisar o avistamiento positivo de aves, peces y fauna costera.",
    whoReceives: [OFFICIAL_RECIPIENTS.equipo_satelital_praes],
    autoEmail: false,
  },
];

export function getRecipientsForLevel(level: AlertLevel): AlertRecipient[] {
  const row = ALERT_ROUTING_MATRIX.find((r) => r.level === level);
  return row ? row.whoReceives : [OFFICIAL_RECIPIENTS.mentores_territoriales];
}
