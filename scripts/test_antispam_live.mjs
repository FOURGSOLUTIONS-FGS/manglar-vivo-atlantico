/**
 * Pruebas en vivo de los 6 casos de uso anti-spam + correo compacto multi-foto contra producción.
 */
const BASE = process.env.TEST_BASE_URL || "https://manglar-vivo-atlantico.vercel.app";

async function postJson(path, body) {
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function run() {
  console.log(`\n=== SIMULACIÓN DE ATAQUES ANTI-SPAM EN VIVO (${BASE}) ===\n`);

  const basePayload = {
    latitud: 10.8719,
    longitud: -75.0972,
    tipo_evento: "tala_relleno",
    descripcion_ciudadana: "Prueba de control",
    zona_manglar: "Tubará – Juan de Acosta",
    municipio: "Juan de Acosta",
    is_simulated_gps: true,
    form_duration_ms: 8500,
    client_fingerprint: "live-audit-script",
  };

  // 1. Bot Honeypot
  const c1 = await postJson("/api/reports", {
    ...basePayload,
    website_hp: "http://bot-autofill.evil",
  });
  console.log("1. Bot Honeypot        ->", c1.status, c1.json.spamCode, "|", c1.json.error);

  // 2. Script rápido (< 2.5s)
  const c2 = await postJson("/api/reports", {
    ...basePayload,
    form_duration_ms: 400,
  });
  console.log("2. Bot rápido (400ms)  ->", c2.status, c2.json.spamCode, "|", c2.json.error);

  // 3. Coordenadas fuera del Atlántico (Bogotá)
  const c3 = await postJson("/api/reports", {
    ...basePayload,
    latitud: 4.711,
    longitud: -74.0721,
  });
  console.log("3. Fuera del Atlántico ->", c3.status, c3.json.spamCode, "|", c3.json.error);

  // 4. Texto spam / links / insultos
  const c4 = await postJson("/api/reports", {
    ...basePayload,
    descripcion_ciudadana: "gana dinero en https://casino-troll.ru aaaaaaaaaa",
  });
  console.log("4. Texto spam/troll    ->", c4.status, c4.json.spamCode, "|", c4.json.error);

  // 5. Correo compacto multi-foto (3 fotos) real a four4gsolutions@gmail.com vía Hostinger SMTP
  const c5 = await postJson("/api/alerts", {
    recipientEmail: "four4gsolutions@gmail.com",
    customScenario: "urgente",
    isManualTest: true,
  });
  console.log("\n5. Correo compacto 3-fotos a four4gsolutions@gmail.com ->", c5.status, JSON.stringify(c5.json.results));

  const allBlocked =
    c1.status === 422 &&
    c2.status === 422 &&
    c3.status === 400 &&
    c4.status === 422 &&
    c5.status === 200;

  if (!allBlocked) {
    console.error("FAIL: alguno de los casos no devolvió el código esperado.");
    process.exit(1);
  }
  console.log("\n✓ TODOS LOS CASOS ANTI-SPAM BLOQUEADOS Y CORREO COMPACTO MULTI-FOTO ENTREGADO EN PRODUCCIÓN.");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
