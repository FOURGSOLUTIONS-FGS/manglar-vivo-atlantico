import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

function loadEnvLocal() {
  const p = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const idx = line.indexOf("=");
    if (idx > 0) {
      const k = line.slice(0, idx).trim();
      const v = line.slice(idx + 1).trim();
      if (k && !process.env[k]) process.env[k] = v;
    }
  }
}

loadEnvLocal();
const apiKey = process.env.OPENROUTER_API_KEY?.trim();
if (!apiKey) {
  console.error("ERROR: OPENROUTER_API_KEY no está definida en .env.local");
  process.exit(1);
}

const CANDIDATES = [
  "anthropic/claude-haiku-5.5",
  "qwen/qwen3.8-omni-flash",
  "qwen/qwen3.7-flash",
  "openai/gpt-5.6-luna",
  "google/gemini-3.5-flash-lite",
  "google/gemini-3.8-flash",
  "google/gemini-2.5-flash",
];

function prepareTestImage(srcPath, tmpPath) {
  execFileSync("sips", ["-Z", "512", "-s", "format", "jpeg", "-s", "formatOptions", "75", srcPath, "--out", tmpPath], {
    stdio: "ignore",
  });
  const b64 = fs.readFileSync(tmpPath).toString("base64");
  return `data:image/jpeg;base64,${b64}`;
}

async function fetchModelPricing() {
  const res = await fetch("https://openrouter.ai/api/v1/models");
  const json = await res.json();
  const map = {};
  for (const m of json.data || []) {
    const p = m.pricing || {};
    map[m.id] = {
      promptPerM: Number(p.prompt || 0) * 1e6,
      completionPerM: Number(p.completion || 0) * 1e6,
    };
  }
  return map;
}

const CASES = [
  {
    id: "caso1_verificacion_positiva",
    src: "public/images/hero-manglar-atlantico.png",
    tmp: "/tmp/bench_manglar_1.jpg",
    zonaManglar: "Totumo – Astilleros – Galerazamba",
    enZonaPorRevisar: true,
    tipoEvento: "otro",
    descripcion: "Manglar rojo sano con raíces zancudas y garza blanca en zona marcada por revisar",
    expectedTipo: "otro",
    expectedSeveridad: "baja",
  },
  {
    id: "caso2_alerta_hidrica",
    src: "public/images/turista-qr-sendero.png",
    tmp: "/tmp/bench_manglar_2.jpg",
    zonaManglar: "Tubará – Juan de Acosta",
    enZonaPorRevisar: true,
    tipoEvento: "cambio_hidrico",
    descripcion: "Caño taponado con sedimentos, agua estancada y hojas amarillentas cerca a la escuela",
    expectedTipo: "cambio_hidrico",
    expectedSeveridad: "alta",
  },
];

async function runSingleCase(modelId, testCase, imageUrl) {
  const prompt = `Eres asistente técnico ambiental de la Corporación Autónoma Regional del Atlántico (CRA), Colombia.
Analiza este reporte ciudadano de manglar y responde ÚNICAMENTE un JSON válido sin markdown con las claves:
- "tipo_evento_sugerido": uno de ["tala_relleno","cambio_hidrico","contaminacion_residuos","dano_fauna_especies","otro"]
- "clasificacion_tecnica": frase técnica concisa en español (máx 14 palabras)
- "severidad": "alta" | "media" | "baja"
- "confianza": número entre 0 y 1
- "resumen_tecnico": explicación breve (máx 28 palabras) considerando manglar del Atlántico
- "recomendacion_cra": acción sugerida para mentor/CRA (máx 20 palabras)

Datos del ciudadano:
- Sector CRA: ${testCase.zonaManglar}
- En zona de 828 ha por revisar: ${testCase.enZonaPorRevisar ? "Sí" : "No"}
- Categoría elegida: ${testCase.tipoEvento}
- Descripción: ${testCase.descripcion}`;

  const t0 = performance.now();
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://manglarvivo.cra.gov.co",
      "X-Title": "Manglar Vivo Atlantico CRA Benchmark",
    },
    body: JSON.stringify({
      model: modelId,
      temperature: 0.2,
      max_tokens: 350,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
    }),
  });
  const latencyMs = Math.round(performance.now() - t0);

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    return {
      ok: false,
      status: res.status,
      error: errText.slice(0, 180),
      latencyMs,
    };
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content || "";
  const usage = data?.usage || {};
  const m = String(content).match(/\{[\s\S]*\}/);
  let parsed = null;
  let jsonValid = false;
  let fieldsComplete = false;
  if (m) {
    try {
      parsed = JSON.parse(m[0]);
      jsonValid = true;
      fieldsComplete = [
        "tipo_evento_sugerido",
        "clasificacion_tecnica",
        "severidad",
        "confianza",
        "resumen_tecnico",
        "recomendacion_cra",
      ].every((k) => parsed[k] !== undefined && parsed[k] !== null && String(parsed[k]).length > 0);
    } catch {}
  }

  const tipoHit = parsed?.tipo_evento_sugerido === testCase.expectedTipo;
  const sevHit = parsed?.severidad === testCase.expectedSeveridad;

  return {
    ok: true,
    status: 200,
    latencyMs,
    jsonValid,
    fieldsComplete,
    tipoHit,
    sevHit,
    promptTokens: Number(usage.prompt_tokens || 0),
    completionTokens: Number(usage.completion_tokens || 0),
    parsed,
  };
}

async function main() {
  const pricing = await fetchModelPricing();
  const images = {};
  for (const c of CASES) {
    images[c.id] = prepareTestImage(c.src, c.tmp);
  }

  const results = [];
  // Ejecutar en lotes de 3 modelos para no disparar rate limits
  for (let i = 0; i < CANDIDATES.length; i += 3) {
    const batch = CANDIDATES.slice(i, i + 3);
    const batchOut = await Promise.all(
      batch.map(async (modelId) => {
        const c1 = await runSingleCase(modelId, CASES[0], images[CASES[0].id]);
        const c2 = await runSingleCase(modelId, CASES[1], images[CASES[1].id]);
        const runs = [c1, c2];
        const okRuns = runs.filter((r) => r.ok);
        const avgLatencyMs = okRuns.length
          ? Math.round(okRuns.reduce((s, r) => s + r.latencyMs, 0) / okRuns.length)
          : null;
        const jsonOk = runs.filter((r) => r.jsonValid && r.fieldsComplete).length;
        const tipoHits = runs.filter((r) => r.tipoHit).length;
        const sevHits = runs.filter((r) => r.sevHit).length;
        const avgPromptTok = okRuns.length
          ? okRuns.reduce((s, r) => s + r.promptTokens, 0) / okRuns.length
          : 0;
        const avgCompTok = okRuns.length
          ? okRuns.reduce((s, r) => s + r.completionTokens, 0) / okRuns.length
          : 0;
        const pInfo = pricing[modelId] || { promptPerM: 0, completionPerM: 0 };
        const costPer1kReportsUsd = Number(
          ((avgPromptTok * 1000 * pInfo.promptPerM) / 1e6 +
            (avgCompTok * 1000 * pInfo.completionPerM) / 1e6).toFixed(3)
        );

        return {
          modelId,
          httpOk: `${okRuns.length}/2`,
          avgLatencyMs,
          jsonOk: `${jsonOk}/2`,
          accuracy: `${tipoHits + sevHits}/4`,
          tipoHits,
          sevHits,
          avgPromptTok: Math.round(avgPromptTok),
          avgCompTok: Math.round(avgCompTok),
          costPer1kReportsUsd,
          errors: runs.filter((r) => !r.ok).map((r) => `${r.status}: ${r.error}`),
          sampleCase2: c2.parsed || null,
        };
      })
    );
    results.push(...batchOut);
  }

  fs.mkdirSync(path.resolve(process.cwd(), "docs"), { recursive: true });
  fs.writeFileSync(
    path.resolve(process.cwd(), "docs/benchmark_openrouter_results.json"),
    JSON.stringify({ ranAt: new Date().toISOString(), results }, null, 2)
  );

  console.table(
    results.map((r) => ({
      model: r.modelId,
      http: r.httpOk,
      ms: r.avgLatencyMs ?? "ERR",
      json: r.jsonOk,
      score: r.accuracy,
      tokIn: r.avgPromptTok,
      tokOut: r.avgCompTok,
      "usd/1k": r.costPer1kReportsUsd,
    }))
  );
  for (const r of results) {
    if (r.errors.length) console.log(`ERR ${r.modelId}:`, r.errors);
    if (r.sampleCase2) {
      console.log(`SAMPLE ${r.modelId}:`, JSON.stringify(r.sampleCase2));
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
