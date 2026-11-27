import fs from "node:fs";
import path from "node:path";

// Carga .env.local
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
  }
}

const API_URL = process.env.TEST_API_URL || "https://manglar-vivo-atlantico.vercel.app/api/ai/classify";

const EXTRA_NEGATIVE =
  "/Users/adrianstivengarzon/.gemini/antigravity/brain/7291fda1-b1c8-4dfb-917f-b4168b9aade1/.user_uploaded/media_1795797258517_6e7a402a.jpg";

function toDataUrl(filePath) {
  const b64 = fs.readFileSync(filePath).toString("base64");
  return `data:image/jpeg;base64,${b64}`;
}

async function run() {
  const manifest = JSON.parse(fs.readFileSync("public/dataset/manifest.json", "utf8"));
  const cases = manifest.map((m) => ({
    id: m.id,
    expectedValid: m.domain !== "invalida",
    expectedSubtype: m.domain !== "invalida" ? m.id : null,
    // Simulamos deliberadamente un usuario que dejó "tala_poda" marcado en TODOS los casos
    // para probar que la IA NO se deja engañar ni sesgar por el botón del usuario!
    userPickedSubtype: "tala_poda",
    filePath: path.join(process.cwd(), "public", m.src),
  }));

  if (fs.existsSync(EXTRA_NEGATIVE)) {
    cases.push({
      id: "control_persona_usuario_real",
      expectedValid: false,
      expectedSubtype: null,
      userPickedSubtype: "tala_poda",
      filePath: EXTRA_NEGATIVE,
    });
  }

  const results = [];
  let validGateOk = 0;
  let subtypeOk = 0;
  let positiveTotal = 0;

  console.log(`\n=== BENCHMARK VISIÓN ANTI-ALUCINACIÓN (${cases.length} FOTOS) ===`);
  console.log(`Endpoint: ${API_URL}\n`);

  for (const c of cases) {
    const t0 = Date.now();
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageDataUrl: toDataUrl(c.filePath),
        tipoEvento: "tala_relleno",
        subtipoEvento: c.userPickedSubtype,
        factorDominio: "Cobertura y Suelo",
        descripcion: "",
        zonaManglar: "Tubará – Juan de Acosta",
        enZonaPorRevisar: true,
      }),
    });
    const ms = Date.now() - t0;
    const json = await res.json();
    const gatePass = Boolean(json.es_evidencia_valida) === c.expectedValid;
    if (gatePass) validGateOk += 1;

    let subPass = null;
    if (c.expectedValid) {
      positiveTotal += 1;
      subPass = json.subtipo_sugerido === c.expectedSubtype;
      if (subPass) subtypeOk += 1;
    }

    const row = {
      id: c.id,
      ms,
      expectedValid: c.expectedValid,
      gotValid: json.es_evidencia_valida,
      gatePass,
      expectedSubtype: c.expectedSubtype,
      gotSubtype: json.subtipo_sugerido,
      subPass,
      privacyFace: json.alerta_privacidad_rostros,
      saw: json.que_muestra_la_foto,
      classification: json.clasificacion_tecnica,
      model: json.model,
    };
    results.push(row);

    const badge = gatePass ? "✓ GATE" : "✗ GATE";
    const subTag = c.expectedValid ? (subPass ? "✓ SUB" : `~ SUB(${json.subtipo_sugerido})`) : "N/A";
    console.log(
      `${badge} | ${subTag.padEnd(28)} | ${c.id.padEnd(28)} | ${ms}ms | vio: ${json.que_muestra_la_foto}`
    );
  }

  const summary = {
    testedAt: new Date().toISOString(),
    endpoint: API_URL,
    totalImages: cases.length,
    validityGateAccuracy: `${validGateOk}/${cases.length} (${Math.round((validGateOk / cases.length) * 100)}%)`,
    exact12SubtypeAccuracy: `${subtypeOk}/${positiveTotal} (${Math.round((subtypeOk / positiveTotal) * 100)}%)`,
    results,
  };

  fs.mkdirSync("docs", { recursive: true });
  fs.writeFileSync("docs/vision_dataset_benchmark.json", JSON.stringify(summary, null, 2));
  console.log(`\nRESUMEN -> Filtro Anti-Falsos: ${summary.validityGateAccuracy} | Exactitud 12 subtipos (con usuario sesgado a tala): ${summary.exact12SubtypeAccuracy}`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
