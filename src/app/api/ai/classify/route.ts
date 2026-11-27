import { NextResponse } from "next/server";
import { EVENT_CATEGORIES, type EventTypeId } from "@/lib/cra-domain";

function heuristicClassify(input: {
  tipoEvento?: string;
  descripcion?: string;
  zonaManglar?: string;
  enZonaPorRevisar?: boolean;
}) {
  const txt = (input.descripcion || "").toLowerCase();
  let tipoSugerido: EventTypeId = (input.tipoEvento as EventTypeId) || "otro";
  let clasificacion =
    EVENT_CATEGORIES.find((c) => c.id === tipoSugerido)?.technicalHint ||
    "Observación de ecosistema de manglar";
  let severidad: "alta" | "media" | "baja" = "media";

  if (/tala|corte|motosierra|relleno|quema|maquinaria/.test(txt) || tipoSugerido === "tala_relleno") {
    tipoSugerido = "tala_relleno";
    clasificacion = "Afectación directa de cobertura de manglar (tala/relleno/quema)";
    severidad = "alta";
  } else if (/caño|seco|amarill|tapon|salin|sequía|sequia/.test(txt) || tipoSugerido === "cambio_hidrico") {
    tipoSugerido = "cambio_hidrico";
    clasificacion = "Alteración hidrológica o estrés hídrico en dosel de manglar";
    severidad = "alta";
  } else if (/basura|plástico|plastico|escombro|aceite|vertimiento|aguas negras/.test(txt) || tipoSugerido === "contaminacion_residuos") {
    tipoSugerido = "contaminacion_residuos";
    clasificacion = "Presión antrópica por residuos sólidos o vertimiento costero";
    severidad = "media";
  } else if (/cangrejo|garza|ave|pez|fauna|trampa|red/.test(txt) || tipoSugerido === "dano_fauna_especies") {
    tipoSugerido = "dano_fauna_especies";
    clasificacion = "Perturbación sobre fauna bentónica o avifauna asociada al manglar";
    severidad = "media";
  } else if (input.enZonaPorRevisar) {
    clasificacion = "Etiqueta ciudadana ground-truth en área de 828 ha por revisar";
    severidad = "baja";
  }

  return {
    mode: "heuristic_local_fallback",
    model: "reglas-cra-atlantico-v1",
    tipo_evento_sugerido: tipoSugerido,
    clasificacion_tecnica: clasificacion,
    severidad,
    confianza: 0.78,
    resumen_tecnico: `Preclasificación automática para ${input.zonaManglar || "Atlántico"} (modo offline/fallback local).`,
    recomendacion_cra:
      severidad === "alta"
        ? "Priorizar verificación de mentor comunitario y cruce con dosel seco / alerta temprana."
        : "Integrar a bandeja de revisión territorial y confirmar con mentor académico.",
  };
}

async function callOpenRouterModel(
  apiKey: string,
  model: string,
  userContent: Array<Record<string, unknown>>
) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://manglarvivo.cra.gov.co",
      "X-Title": "Manglar Vivo Atlantico CRA",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 1200,
      messages: [{ role: "user", content: userContent }],
    }),
  });

  if (!res.ok) {
    return { ok: false as const, status: res.status };
  }

  const data = await res.json();
  const rawText: string = data?.choices?.[0]?.message?.content || "";
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { ok: false as const, status: 422 };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return { ok: true as const, parsed };
  } catch {
    return { ok: false as const, status: 422 };
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      imageDataUrl,
      tipoEvento,
      descripcion,
      zonaManglar,
      enZonaPorRevisar,
    } = body as {
      imageDataUrl?: string;
      tipoEvento?: string;
      descripcion?: string;
      zonaManglar?: string;
      enZonaPorRevisar?: boolean;
    };

    const apiKey = process.env.OPENROUTER_API_KEY?.trim();
    const primaryModel = process.env.OPENROUTER_MODEL?.trim() || "google/gemini-2.5-flash";
    const fallbackModel =
      process.env.OPENROUTER_FALLBACK_MODEL?.trim() || "google/gemini-3.5-flash-lite";

    if (!apiKey) {
      return NextResponse.json(
        heuristicClassify({ tipoEvento, descripcion, zonaManglar, enZonaPorRevisar })
      );
    }

    const userContent: Array<Record<string, unknown>> = [
      {
        type: "text",
        text: `Eres asistente técnico ambiental de la Corporación Autónoma Regional del Atlántico (CRA), Colombia.
Analiza este reporte ciudadano de manglar y responde ÚNICAMENTE un JSON válido sin markdown con las claves:
- "tipo_evento_sugerido": uno de ["tala_relleno","cambio_hidrico","contaminacion_residuos","dano_fauna_especies","otro"]
- "clasificacion_tecnica": frase técnica concisa en español (máx 14 palabras)
- "severidad": "alta" | "media" | "baja"
- "confianza": número entre 0 y 1
- "resumen_tecnico": explicación breve (máx 28 palabras) considerando manglar del Atlántico
- "recomendacion_cra": acción sugerida para mentor/CRA (máx 20 palabras)

Datos del ciudadano:
- Sector CRA: ${zonaManglar || "No especificado"}
- En zona de 828 ha por revisar: ${enZonaPorRevisar ? "Sí" : "No"}
- Categoría elegida: ${tipoEvento || "otro"}
- Descripción: ${descripcion || "(sin descripción adicional)"}`,
      },
    ];

    if (imageDataUrl && imageDataUrl.startsWith("data:image/")) {
      userContent.push({
        type: "image_url",
        image_url: { url: imageDataUrl },
      });
    }

    const modelChain = Array.from(
      new Set([primaryModel, fallbackModel, "google/gemini-4-hydrogen"])
    );

    let lastStatus = 0;
    for (const candidate of modelChain) {
      const attempt = await callOpenRouterModel(apiKey, candidate, userContent);
      if (attempt.ok) {
        return NextResponse.json({
          mode: "openrouter_live",
          model: candidate,
          ...attempt.parsed,
        });
      }
      lastStatus = attempt.status;
    }

    const fallback = heuristicClassify({ tipoEvento, descripcion, zonaManglar, enZonaPorRevisar });
    return NextResponse.json({ ...fallback, openrouter_status: lastStatus });
  } catch {
    return NextResponse.json(heuristicClassify({}));
  }
}
