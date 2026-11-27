import test from "node:test";
import assert from "node:assert/strict";
import {
  checkUrgentEmailCooldown,
  computeBufferSha256,
  evaluateReportAntiSpam,
  resetAntiSpamMemoryForTests,
} from "../src/core/security/anti-spam";
import { computeReliabilityScore } from "../src/lib/reliability";
import { buildAlertEmailHtml } from "../src/core/alerts/email-template";
import { classifyAlert } from "../src/core/alerts/classifier";

test("Anti-Spam Caso 1: Bot llena campo Honeypot invisible -> bloqueado 422", () => {
  resetAntiSpamMemoryForTests();
  const res = evaluateReportAntiSpam({
    ip: "190.10.1.1",
    honeypot: "https://spam-bot.example",
    formDurationMs: 8000,
    lat: 10.8719,
    lon: -75.0972,
    description: "Quema en manglar",
  });
  assert.equal(res.allowed, false);
  assert.equal(res.code, "HONEYPOT_TRIGGERED");
  assert.equal(res.httpStatus, 422);
});

test("Anti-Spam Caso 2: Script ultra-rápido (< 2.5s) -> bloqueado 422", () => {
  resetAntiSpamMemoryForTests();
  const res = evaluateReportAntiSpam({
    ip: "190.10.1.2",
    formDurationMs: 320,
    lat: 10.8719,
    lon: -75.0972,
    description: "Tala",
  });
  assert.equal(res.allowed, false);
  assert.equal(res.code, "TOO_FAST_BOT");
  assert.equal(res.httpStatus, 422);
});

test("Anti-Spam Caso 3: Coordenadas fuera del Atlántico (ej. Bogotá / Europa) -> bloqueado 400", () => {
  resetAntiSpamMemoryForTests();
  const res = evaluateReportAntiSpam({
    ip: "190.10.1.3",
    formDurationMs: 9000,
    lat: 4.711,
    lon: -74.0721,
    description: "Reporte falso desde otra ciudad",
  });
  assert.equal(res.allowed, false);
  assert.equal(res.code, "OUT_OF_ATLANTICO_JURISDICTION");
  assert.equal(res.httpStatus, 400);
});

test("Anti-Spam Caso 4: Texto basura, links phishing o insultos -> bloqueado 422", () => {
  resetAntiSpamMemoryForTests();
  const linkSpam = evaluateReportAntiSpam({
    ip: "190.10.1.4",
    formDurationMs: 9000,
    lat: 11.0448,
    lon: -74.8632,
    description: "Gana dinero fácil en https://casino-troll.ru",
  });
  assert.equal(linkSpam.allowed, false);
  assert.equal(linkSpam.code, "SPAM_OR_GIBBERISH_TEXT");

  const gibberish = evaluateReportAntiSpam({
    ip: "190.10.1.5",
    formDurationMs: 9000,
    lat: 11.0448,
    lon: -74.8632,
    description: "aaaaaaaaaa bcdfghjklmnpq",
  });
  assert.equal(gibberish.allowed, false);
  assert.equal(gibberish.code, "SPAM_OR_GIBBERISH_TEXT");
});

test("Anti-Spam Caso 5: Foto idéntica reenviada (hash SHA-256) -> bloqueada 409", () => {
  resetAntiSpamMemoryForTests();
  const hash = computeBufferSha256(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]));

  const first = evaluateReportAntiSpam({
    ip: "190.10.1.6",
    formDurationMs: 9000,
    lat: 10.945,
    lon: -75.003,
    description: "Caño taponado en Puerto Velero",
    photoHashes: [hash],
  });
  assert.equal(first.allowed, true);

  const dup = evaluateReportAntiSpam({
    ip: "190.10.1.7",
    formDurationMs: 9000,
    lat: 10.945,
    lon: -75.003,
    description: "Otra vez la misma foto",
    photoHashes: [hash],
  });
  assert.equal(dup.allowed, false);
  assert.equal(dup.code, "DUPLICATE_PHOTO_RECENT");
  assert.equal(dup.httpStatus, 409);
});

test("Anti-Spam Caso 6: Ráfaga flood desde misma IP/dispositivo (>4 reportes en 10 min) -> 429", () => {
  resetAntiSpamMemoryForTests();
  const ip = `190.99.${Math.floor(Math.random() * 200)}.1`;
  for (let i = 1; i <= 4; i += 1) {
    const ok = evaluateReportAntiSpam({
      ip,
      fingerprint: "troll-device-1",
      formDurationMs: 6000,
      lat: 10.8719,
      lon: -75.0972,
      description: `Reporte de prueba ${i}`,
    });
    assert.equal(ok.allowed, true);
  }

  const fifth = evaluateReportAntiSpam({
    ip,
    fingerprint: "troll-device-1",
    formDurationMs: 6000,
    lat: 10.8719,
    lon: -75.0972,
    description: "Quinto intento en ráfaga",
  });
  assert.equal(fifth.allowed, false);
  assert.equal(fifth.code, "RATE_LIMIT_BURST");
  assert.equal(fifth.httpStatus, 429);
});

test("Anti-Spam Caso 7: Cooldown anti-bombardeo de correos urgentes en el mismo sector (15 min)", () => {
  resetAntiSpamMemoryForTests();
  const first = checkUrgentEmailCooldown({ sectorId: 3, tipoEvento: "tala_relleno" });
  assert.equal(first.shouldSend, true);

  const second = checkUrgentEmailCooldown({ sectorId: 3, tipoEvento: "tala_relleno" });
  assert.equal(second.shouldSend, false);
  assert.ok(second.remainingSec > 0);
});

test("Multi-Foto Evidencia: 1 foto da 18/25 pts y 2-3 fotos válidas dan 25/25 pts + galería en correo compacto", () => {
  const onePhoto = computeReliabilityScore({
    hasPhoto: true,
    photoCount: 1,
    aiPhotoValid: true,
    precisionGpsM: 12,
    inCoastalZone: true,
    isSimulatedGps: false,
  });
  const multiPhoto = computeReliabilityScore({
    hasPhoto: true,
    photoCount: 3,
    aiPhotoValid: true,
    precisionGpsM: 12,
    inCoastalZone: true,
    isSimulatedGps: false,
  });

  assert.equal(onePhoto.factors[0].points, 18);
  assert.equal(multiPhoto.factors[0].points, 25);
  assert.ok(multiPhoto.score > onePhoto.score);

  const report = {
    trackingCode: "MGL-MULTI-3",
    tipoEvento: "tala_relleno",
    subtipoEvento: "quema_incendio",
    zonaManglar: "Tubará – Juan de Acosta",
    municipio: "Juan de Acosta",
    puntajeConfiabilidad: multiPhoto.score,
    evidenciaFotoUrl: "https://manglar.arpadura.com/dataset/quema_incendio.jpg",
    evidenciaFotosUrls: [
      "https://manglar.arpadura.com/dataset/quema_incendio.jpg",
      "https://manglar.arpadura.com/dataset/dosel_seco.jpg",
      "https://manglar.arpadura.com/dataset/tala_poda.jpg",
    ],
    latitud: 10.8719,
    longitud: -75.0972,
    aiPhotoValid: true,
  };
  const html = buildAlertEmailHtml({
    report,
    classification: classifyAlert(report),
    recipientEmail: "four4gsolutions@gmail.com",
    recipientGroup: "CRA + Policía Ambiental",
    baseUrl: "https://manglar.arpadura.com",
  });

  assert.match(html, /3 fotos/);
  assert.match(html, /quema_incendio\.jpg/);
  assert.match(html, /dosel_seco\.jpg/);
  assert.match(html, /tala_poda\.jpg/);
  assert.ok(html.length < 6200, "El correo HTML debe mantenerse compacto y ligero");
});
