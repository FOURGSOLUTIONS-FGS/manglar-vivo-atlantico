import test from "node:test";
import assert from "node:assert/strict";
import { classifyAlert } from "../src/core/alerts/classifier";
import {
  buildAlertEmailHtml,
  buildAlertEmailSubject,
  buildAlertEmailText,
} from "../src/core/alerts/email-template";
import { AlertDispatcher } from "../src/core/alerts/dispatcher";
import { computeReliabilityScore } from "../src/lib/reliability";
import type {
  AlertAuditRecord,
  AlertAuditRepository,
  AlertLevel,
  ChannelSendResult,
  DispatchPayload,
  NotificationChannel,
} from "../src/core/alerts/types";

test("SOLID Classifier: amenaza crítica (quema activa) escala a Nivel 1 Urgente con correo automático", () => {
  const cls = classifyAlert({
    trackingCode: "MGL-TEST-001",
    tipoEvento: "tala_relleno",
    subtipoEvento: "quema_incendio",
    zonaManglar: "Tubará – Juan de Acosta",
    municipio: "Juan de Acosta",
    puntajeConfiabilidad: 85,
    latitud: 10.8719,
    longitud: -75.0972,
    aiPhotoValid: true,
  });

  assert.equal(cls.level, "urgente");
  assert.equal(cls.slaHours, 2);
  assert.equal(cls.autoDispatchEmail, true);
  assert.equal(cls.soundProfile, "urgent");
  assert.ok(cls.recipients.some((r) => r.id === "sala_crisis_cra"));
  assert.ok(cls.recipients.some((r) => r.id === "policia_ambiental"));
});

test("Blindaje Anti-Alucinación: foto rechazada por IA bloquea alerta roja y baja a revisión manual", () => {
  const cls = classifyAlert({
    trackingCode: "MGL-TEST-FAKE",
    tipoEvento: "tala_relleno",
    subtipoEvento: "tala_poda",
    zonaManglar: "Mallorquín – Bocas de Ceniza",
    municipio: "Barranquilla",
    puntajeConfiabilidad: 30,
    latitud: 11.0448,
    longitud: -74.8632,
    aiPhotoValid: false,
  });

  assert.equal(cls.level, "media");
  assert.equal(cls.autoDispatchEmail, false);
  assert.equal(cls.soundProfile, "none");

  const rel = computeReliabilityScore({
    hasPhoto: true,
    aiPhotoValid: false,
    precisionGpsM: 12,
    inCoastalZone: true,
    isSimulatedGps: false,
    timestampCaptura: new Date().toISOString(),
  });
  assert.equal(rel.factors[0].points, 0);
  assert.equal(rel.tier, "baja");
});

test("SOLID Classifier: verificación positiva en 828 ha enruta a Equipo Satelital y Red Escuelas PRAES", () => {
  const cls = classifyAlert({
    trackingCode: "MGL-TEST-828",
    tipoEvento: "otro",
    subtipoEvento: "verificacion_828ha",
    zonaManglar: "Totumo – Astilleros – Galerazamba",
    municipio: "Piojó",
    enZonaPorRevisar: true,
    nivelPrioridad: "baja",
    puntajeConfiabilidad: 90,
    latitud: 10.7429,
    longitud: -75.2185,
    aiPhotoValid: true,
  });

  assert.equal(cls.level, "verificacion");
  assert.equal(cls.autoDispatchEmail, false);
  assert.equal(cls.soundProfile, "success");
  assert.ok(cls.recipients.some((r) => r.id === "equipo_satelital_praes"));
});

test("Email Template: incluye branding CRA, enlace admin, Google Maps, Ley 1581 y bandera DEMO cuando aplica", () => {
  const report = {
    trackingCode: "MGL-2026-9999",
    tipoEvento: "tala_relleno",
    subtipoEvento: "relleno_obra",
    zonaManglar: "Mallorquín – Bocas de Ceniza",
    municipio: "Barranquilla",
    accionPlan: "Preservación",
    enZonaPorRevisar: true,
    puntajeConfiabilidad: 88,
    descripcionCiudadana: "Maquinaria rellenando borde oeste",
    evidenciaFotoUrl: "https://manglar-vivo-atlantico.vercel.app/dataset/relleno_obra.jpg",
    latitud: 11.0448,
    longitud: -74.8632,
    isSimulatedGps: true,
    aiPhotoValid: true,
  };
  const classification = classifyAlert(report);
  const payload: DispatchPayload = {
    report,
    classification,
    recipientEmail: "test@fourgsolutions.com",
    recipientGroup: "Sala CRA + Policía Ambiental",
    baseUrl: "https://manglar.fourgsolutions.com",
    isManualTest: true,
  };

  const subject = buildAlertEmailSubject(payload);
  const html = buildAlertEmailHtml(payload);
  const text = buildAlertEmailText(payload);

  assert.match(subject, /\[PRUEBA\] URGENTE CRA · Barranquilla · MGL-2026-9999/);
  assert.match(html, /MANGLAR VIVO · CRA ATLÁNTICO/);
  assert.match(html, /SIMULADO \(DEMO\)/);
  assert.match(html, /Ley 1581 de 2012/);
  assert.match(html, /https:\/\/manglar\.fourgsolutions\.com\/admin\?code=MGL-2026-9999/);
  assert.match(html, /https:\/\/manglar\.fourgsolutions\.com\/api\/minimap\?lat=11\.0448/);
  assert.match(html, /https:\/\/www\.google\.com\/maps\?q=11\.0448,-74\.8632/);
  assert.match(text, /MGL-2026-9999/);
});

test("SOLID DIP Dispatcher: inyección de canales y repositorio de auditoría sin dependencias externas", async () => {
  const sentPayloads: DispatchPayload[] = [];
  const auditLogs: AlertAuditRecord[] = [];

  const mockUrgentChannel: NotificationChannel = {
    name: "mock_smtp",
    supports: (level: AlertLevel, forceSend?: boolean) => Boolean(forceSend) || level === "urgente",
    async send(payload: DispatchPayload): Promise<ChannelSendResult> {
      sentPayloads.push(payload);
      return {
        channel: "mock_smtp",
        status: "enviado",
        recipientEmail: payload.recipientEmail,
        providerMessageId: "msg-solid-001",
      };
    },
  };

  const mockRepo: AlertAuditRepository = {
    async save(record: AlertAuditRecord) {
      auditLogs.push(record);
    },
  };

  const dispatcher = new AlertDispatcher([mockUrgentChannel], mockRepo);

  // Caso 1: verificación positiva NO dispara correo automático
  const outPos = await dispatcher.evaluateAndDispatch({
    report: {
      trackingCode: "MGL-POS-1",
      tipoEvento: "otro",
      subtipoEvento: "verificacion_828ha",
      zonaManglar: "Totumo",
      municipio: "Piojó",
      nivelPrioridad: "baja",
      puntajeConfiabilidad: 90,
      latitud: 10.74,
      longitud: -75.21,
      aiPhotoValid: true,
    },
    recipientEmail: "destino@fourgsolutions.com",
  });
  assert.equal(outPos.classification.level, "verificacion");
  assert.equal(sentPayloads.length, 0);
  assert.equal(auditLogs.length, 0);

  // Caso 2: alerta urgente SÍ dispara correo y persiste auditoría
  const outUrg = await dispatcher.evaluateAndDispatch({
    report: {
      trackingCode: "MGL-URG-1",
      tipoEvento: "tala_relleno",
      subtipoEvento: "tala_poda",
      zonaManglar: "Juan de Acosta",
      municipio: "Juan de Acosta",
      puntajeConfiabilidad: 92,
      latitud: 10.87,
      longitud: -75.09,
      aiPhotoValid: true,
    },
    recipientEmail: "cra-emergencias@fourgsolutions.com",
  });
  assert.equal(outUrg.classification.level, "urgente");
  assert.equal(sentPayloads.length, 1);
  assert.equal(auditLogs.length, 1);
  assert.equal(auditLogs[0].provider_message_id, "msg-solid-001");
});
