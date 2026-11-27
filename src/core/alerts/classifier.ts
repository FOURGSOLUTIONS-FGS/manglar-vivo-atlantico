import { getRecipientsForLevel } from "./routing";
import type { AlertClassification, AlertReportInput } from "./types";

const URGENT_SUBTYPES = new Set([
  "tala_poda",
  "relleno_obra",
  "quema_incendio",
  "derrame_combustible",
  "vertimiento_agua",
]);

const HIGH_SUBTYPES = new Set([
  "cano_taponado",
  "dosel_seco",
  "erosion_costera",
  "fauna_amenaza",
]);

const POSITIVE_SUBTYPES = new Set([
  "verificacion_828ha",
  "avistamiento_fauna",
]);

/**
 * Clasificador determinístico puro (Single Responsibility + Open/Closed).
 * Evalúa evidencia IA, factor ambiental, sensibilidad espacial y estado de gobernanza.
 */
export function classifyAlert(input: AlertReportInput): AlertClassification {
  const subtype = input.subtipoEvento || null;

  // Regla de blindaje: una foto rechazada por filtro IA NUNCA dispara alerta roja automática
  if (input.aiPhotoValid === false && input.estadoValidacion !== "alerta_oficial_cra") {
    return {
      level: "media",
      priorityOrder: 3,
      slaHours: 48,
      badgeLabel: "REVISIÓN IA · FOTO OBSERVADA",
      colorHex: "#005F96",
      kidFriendlyHeadline: "Necesitamos otra foto clara del manglar",
      kidFriendlyExplanation:
        "El filtro automático notó que la foto no muestra un manglar. Un mentor la revisará antes de avisar a emergencias.",
      nextStepSimple: "Un mentor confirma el caso sin generar falsas alarmas.",
      technicalReason:
        "Foto rechazada por filtro visual multimodal (0/25 pts); escalamiento automático bloqueado por protocolo anti-falsos positivos.",
      soundProfile: "none",
      autoDispatchEmail: false,
      recipients: getRecipientsForLevel("media"),
    };
  }

  // Nivel 1: URGENTE / CRÍTICO
  const isOfficialEscalation = input.estadoValidacion === "alerta_oficial_cra";
  const isUrgentThreat =
    (subtype != null && URGENT_SUBTYPES.has(subtype)) ||
    input.tipoEvento === "tala_relleno" ||
    (input.enDoselSeco2026 && input.tipoEvento !== "otro");

  if (isOfficialEscalation || isUrgentThreat) {
    return {
      level: "urgente",
      priorityOrder: 1,
      slaHours: 2,
      badgeLabel: "URGENTE · NIVEL 1",
      colorHex: "#C84023",
      kidFriendlyHeadline: "¡Alerta roja! Avisamos de una vez a la CRA y Policía Ambiental",
      kidFriendlyExplanation:
        "Este daño puede crecer rápido (tala, fuego, relleno o químicos en el agua). Por eso suena alarma y enviamos correo urgente.",
      nextStepSimple: "La Sala Operativa CRA coordina respuesta en menos de 2 horas.",
      technicalReason: isOfficialEscalation
        ? "Reporte elevado a Alerta Oficial CRA con despacho prioritario inmediato."
        : `Amenaza crítica (${subtype || input.tipoEvento}) en ${input.zonaManglar} con impacto directo sobre cobertura o calidad de agua.`,
      soundProfile: "urgent",
      autoDispatchEmail: true,
      recipients: getRecipientsForLevel("urgente"),
    };
  }

  // Nivel 4: VERIFICACIÓN POSITIVA (828 ha / avistamiento de fauna)
  const isPositiveVerification =
    (subtype != null && POSITIVE_SUBTYPES.has(subtype)) ||
    (input.tipoEvento === "otro" && input.nivelPrioridad === "baja");

  if (isPositiveVerification) {
    return {
      level: "verificacion",
      priorityOrder: 4,
      slaHours: 72,
      badgeLabel: "VERIFICACIÓN VIVA · 828 HA",
      colorHex: "#16794A",
      kidFriendlyHeadline: "¡Excelente noticia! Ayudaste a cuidar el mapa del manglar",
      kidFriendlyExplanation:
        "Tu foto confirma manglar sano o fauna viva. No es una emergencia, sino un dato valioso para el mapa oficial de las 828 ha.",
      nextStepSimple: "Suma al mapa satelital CRA y al tablero de escuelas guardianas.",
      technicalReason:
        "Etiqueta ground-truth positiva para actualización de cobertura y seguimiento de biodiversidad.",
      soundProfile: "success",
      autoDispatchEmail: false,
      recipients: getRecipientsForLevel("verificacion"),
    };
  }

  // Nivel 2: ALTA / ATENCIÓN PRIORITARIA
  const isHighPriority =
    (subtype != null && HIGH_SUBTYPES.has(subtype)) ||
    input.tipoEvento === "cambio_hidrico" ||
    input.tipoEvento === "dano_fauna_especies" ||
    input.nivelPrioridad === "alta";

  if (isHighPriority) {
    return {
      level: "alta",
      priorityOrder: 2,
      slaHours: 24,
      badgeLabel: "ALTA · NIVEL 2",
      colorHex: "#C98206",
      kidFriendlyHeadline: "Alerta naranja: el equipo del sector la revisa hoy mismo",
      kidFriendlyExplanation:
        "El agua, las hojas o la fauna necesitan atención pronta para que el manglar no se enferme ni se seque.",
      nextStepSimple: "El supervisor del sector y el mentor local verifican el punto en menos de 24 h.",
      technicalReason: `Estrés hídrico, erosión o afectación de fauna (${subtype || input.tipoEvento}) priorizado para inspección territorial.`,
      soundProfile: "priority",
      autoDispatchEmail: false,
      recipients: getRecipientsForLevel("alta"),
    };
  }

  // Nivel 3: MEDIA / REVISIÓN TERRITORIAL
  return {
    level: "media",
    priorityOrder: 3,
    slaHours: 48,
    badgeLabel: "REVISIÓN · NIVEL 3",
    colorHex: "#005F96",
    kidFriendlyHeadline: "Recibido: los mentores revisan tu reporte paso a paso",
    kidFriendlyExplanation:
      "Líderes comunitarios y mentores universitarios confirman tu foto para programar jornada de limpieza o seguimiento.",
    nextStepSimple: "Entra a la consola de doble validación y luego al plan de atención local.",
    technicalReason: `Presión antrópica moderada (${subtype || input.tipoEvento}) asignada a flujo de doble validación comunitaria-académica.`,
    soundProfile: "priority",
    autoDispatchEmail: false,
    recipients: getRecipientsForLevel("media"),
  };
}
