import { NextResponse } from "next/server";
import { ALL_SUBTYPES, EVENT_CATEGORIES, type EventTypeId, type SubtypeId } from "@/lib/cra-domain";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const VALID_SUBTYPE_IDS = ALL_SUBTYPES.map((s) => s.id);

function heuristicClassify(input: {
  tipoEvento?: string;
  subtipoEvento?: string;
  descripcion?: string;
  zonaManglar?: string;
  enZonaPorRevisar?: boolean;
}) {
  const txt = (input.descripcion || "").toLowerCase();
  const subtypeMeta = ALL_SUBTYPES.find((s) => s.id === input.subtipoEvento);
  let tipoSugerido: EventTypeId =
    subtypeMeta?.eventType || (input.tipoEvento as EventTypeId) || "otro";
  let clasificacion =
    subtypeMeta?.technicalHint ||
    EVENT_CATEGORIES.find((c) => c.id === tipoSugerido)?.technicalHint ||
    "Observación de ecosistema de manglar";
  let severidad: "alta" | "media" | "baja" = subtypeMeta?.defaultPriority || "media";

  if (!subtypeMeta) {
    if (/tala|corte|motosierra|relleno|quema|maquinaria/.test(txt) || tipoSugerido === "tala_relleno") {
      tipoSugerido = "tala_relleno";
      clasificacion = "Afectación directa de cobertura de manglar (tala/relleno/quema)";
      severidad = "alta";
    } else if (/caño|seco|amarill|tapon|salin|sequía|sequia|erosi/.test(txt) || tipoSugerido === "cambio_hidrico") {
      tipoSugerido = "cambio_hidrico";
      clasificacion = "Alteración hidrológica o estrés hídrico en dosel de manglar";
      severidad = "alta";
    } else if (/basura|plástico|plastico|escombro|aceite|vertimiento|aguas negras/.test(txt) || tipoSugerido === "contaminacion_residuos") {
      tipoSugerido = "contaminacion_residuos";
      clasificacion = "Presión antrópica por residuos sólidos o vertimiento costero";
      severidad = "media";
    } else if (/garza|ave|pez|fauna|trampa|red|cangrejo/.test(txt) || tipoSugerido === "dano_fauna_especies") {
      tipoSugerido = "dano_fauna_especies";
      clasificacion = "Perturbación sobre fauna costera o avifauna asociada al manglar";
      severidad = "media";
    } else if (input.enZonaPorRevisar) {
      clasificacion = "Etiqueta ciudadana ground-truth en área de 828 ha por revisar";
      severidad = "baja";
    }
  }

  return {
    mode: "heuristic_local_fallback",
    model: "reglas-cra-atlantico-v2",
    es_evidencia_valida: null,
    pendiente_verificacion_ia: true,
    que_muestra_la_foto: "Sin inspección visual remota (conexión lenta o servicio IA temporalmente ocupado).",
    motivo_rechazo: null,
    alerta_privacidad_rostros: false,
    coincide_con_categoria: null,
    tipo_evento_sugerido: tipoSugerido,
    subtipo_sugerido: (subtypeMeta?.id || input.subtipoEvento || null) as SubtypeId | null,
    clasificacion_tecnica: `${clasificacion} (pendiente de verificación visual)`,
    severidad,
    confianza: 0.45,
    resumen_tecnico: `No se pudo inspeccionar la fotografía en la nube; quedó pendiente de verificación visual o revisión por mentor en ${input.zonaManglar || "Atlántico"}.`,
    recomendacion_cra:
      "Reintentar verificación visual con buena señal o validar en bandeja CRA antes de confirmar evidencia.",
  };
}

async function callOpenRouterModel(
  apiKey: string,
  model: string,
  userContent: Array<Record<string, unknown>>
) {
  let res: Response;
  try {
    res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: AbortSignal.timeout(18000),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://manglar.arpadura.com",
        "X-Title": "Manglar Vivo Atlantico CRA",
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        max_tokens: 1200,
        messages: [
          {
            role: "system",
            content:
              "Eres un auditor técnico estricto de visión por computador de la CRA Atlántico (Colombia). Tu regla número 1 es NUNCA alucinar ni inventar manglares, tala o contaminación si la fotografía no los muestra directamente al aire libre. Si la imagen es un interior, oficina, escritorio, computador, laptop, monitor, pantalla de celular/TV (INCLUSO si esa pantalla muestra una foto o página web de un manglar), teclado, selfie, retrato o cualquier escena ajena a una captura directa en campo natural/costero, DEBES marcar es_evidencia_valida=false con honestidad total. Responde SIEMPRE un único objeto JSON válido sin markdown.",
          },
          { role: "user", content: userContent },
        ],
      }),
    });
  } catch {
    return { ok: false as const, status: 504 };
  }

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
    const rl = checkRateLimit({
      key: `ai:${getClientIp(request)}`,
      maxRequests: 45,
      windowMs: 5 * 60 * 1000,
    });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Límite temporal de análisis IA alcanzado. Reintenta en ${rl.retryAfterSec}s.` },
        { status: 429 }
      );
    }

    const body = await request.json();
    const {
      imageDataUrl,
      imageDataUrls,
      tipoEvento,
      subtipoEvento,
      factorDominio,
      descripcion,
      zonaManglar,
      enZonaPorRevisar,
    } = body as {
      imageDataUrl?: string;
      imageDataUrls?: string[];
      tipoEvento?: string;
      subtipoEvento?: string;
      factorDominio?: string;
      descripcion?: string;
      zonaManglar?: string;
      enZonaPorRevisar?: boolean;
    };

    const images = Array.from(
      new Set(
        [
          ...(Array.isArray(imageDataUrls) ? imageDataUrls : []),
          ...(imageDataUrl ? [imageDataUrl] : []),
        ].filter((u) => typeof u === "string" && u.startsWith("data:image/"))
      )
    ).slice(0, 3);

    const subtypeMeta = ALL_SUBTYPES.find((s) => s.id === subtipoEvento);
    const apiKey = process.env.OPENROUTER_API_KEY?.trim();
    const primaryModel = process.env.OPENROUTER_MODEL?.trim() || "google/gemini-2.5-flash";
    const fallbackModel =
      process.env.OPENROUTER_FALLBACK_MODEL?.trim() || "google/gemini-3.5-flash-lite";

    if (!apiKey) {
      return NextResponse.json(
        heuristicClassify({ tipoEvento, subtipoEvento, descripcion, zonaManglar, enZonaPorRevisar })
      );
    }

    const hasImage = images.length > 0;

    const userContent: Array<Record<string, unknown>> = [
      {
        type: "text",
        text: `Analiza la evidencia ${hasImage ? "FOTOGRÁFICA adjunta" : "textual"} para el sistema de monitoreo de manglares de la CRA Atlántico.

PASO 1 — FILTRO ANTI-FALSOS POSITIVOS (CRÍTICO):
${
  hasImage
    ? `Describe primero objetivamente QUÉ se ve realmente en los píxeles de la foto ("que_muestra_la_foto"), SIN dejarte influenciar por lo que seleccionó el ciudadano.
Evalúa si la foto corresponde realmente a un entorno natural/costero/humedal/manglar/cuerpo de agua/fauna silvestre o amenaza ambiental real al aire libre (tala, relleno, obra en humedal, quema, agua estancada, árboles secos, erosión, basura en costa/agua, vertimiento, mancha de aceite, fauna).
SI la foto muestra un computador, laptop, monitor, pantalla de PC/TV/celular (INCLUSO si en la pantalla se ve una foto de manglar o una web), teclado, mouse, escritorio, oficina, sala, habitación, puerta, persona/selfie/retrato en primer plano, mascota doméstica, comida, vehículo en calle urbana sin relación o cualquier escena que NO sea una fotografía tomada directamente al aire libre en un entorno ambiental/costero:
- Pon "es_evidencia_valida": false
- Pon "tipo_evento_sugerido": "invalida"
- Pon "subtipo_sugerido": null
- Pon "severidad": "nula"
- Pon "coincide_con_categoria": false
- Explica con claridad en "motivo_rechazo" y "clasificacion_tecnica" por qué no es evidencia de campo real (por ejemplo: "Fotografía de computador/pantalla o interior, no captura directa en campo").`
    : `No se adjuntó imagen; clasifica únicamente con el texto indicando que falta evidencia fotográfica.`
}

PASO 2 — PRIVACIDAD LEY 1581:
Si aparece un rostro humano reconocible en primer plano, pon "alerta_privacidad_rostros": true.

PASO 3 — CLASIFICACIÓN EXACTA (SOLO SI es_evidencia_valida = true):
Elige el "subtipo_sugerido" que REALMENTE coincide con la foto entre estos 12 IDs exactos:
${VALID_SUBTYPE_IDS.join(", ")}
Reglas de precisión visual importantes:
- Si se ven árboles caídos en la playa/orilla, raíces desenterradas por oleaje, talud o acantilado erosionado junto al mar -> elige "erosion_costera" (NO "verificacion_828ha").
- Usa "verificacion_828ha" únicamente cuando se observe manglar sano en pie con follaje verde y sin daño visible.
- Usa "dosel_seco" cuando predominen árboles muertos en pie, troncos grises o follaje amarillo/seco.
Y mapea "tipo_evento_sugerido" a uno de:
["tala_relleno","cambio_hidrico","contaminacion_residuos","dano_fauna_especies","otro"]
Evalúa "coincide_con_categoria": true si lo que se ve en la foto corresponde al factor elegido por el usuario, o false si la foto muestra claramente otro factor distinto.

Responde ÚNICAMENTE un JSON válido con exactamente estas claves:
{
  "es_evidencia_valida": boolean,
  "que_muestra_la_foto": "descripción objetiva en español (máx 18 palabras)",
  "motivo_rechazo": string | null,
  "alerta_privacidad_rostros": boolean,
  "coincide_con_categoria": boolean,
  "tipo_evento_sugerido": "tala_relleno" | "cambio_hidrico" | "contaminacion_residuos" | "dano_fauna_especies" | "otro" | "invalida",
  "subtipo_sugerido": "${VALID_SUBTYPE_IDS.join('" | "')}" | null,
  "clasificacion_tecnica": "frase concisa en español (máx 15 palabras)",
  "severidad": "alta" | "media" | "baja" | "nula",
  "confianza": number (0 a 1),
  "resumen_tecnico": "explicación clara (máx 28 palabras)",
  "recomendacion_cra": "acción recomendada (máx 22 palabras)"
}

Contexto reportado por el usuario (SOLO referencia; la imagen manda):
- Sector CRA: ${zonaManglar || "No especificado"}
- Zona 828 ha por revisar: ${enZonaPorRevisar ? "Sí" : "No"}
- Dominio elegido: ${factorDominio || "No especificado"}
- Factor elegido: ${subtypeMeta ? `${subtypeMeta.label} (${subtypeMeta.id})` : tipoEvento || "otro"}
- Nota ciudadana: ${descripcion || "(sin nota adicional)"}`,
      },
    ];

    for (const imgUrl of images) {
      userContent.push({
        type: "image_url",
        image_url: { url: imgUrl },
      });
    }

    const modelChain = Array.from(
      new Set([primaryModel, fallbackModel, "google/gemini-4-hydrogen"])
    );

    let lastStatus = 0;
    for (const candidate of modelChain) {
      const attempt = await callOpenRouterModel(apiKey, candidate, userContent);
      if (attempt.ok) {
        const p = attempt.parsed;
        const isValid = p.es_evidencia_valida !== false && p.tipo_evento_sugerido !== "invalida";
        const suggestedSub =
          isValid && typeof p.subtipo_sugerido === "string" && VALID_SUBTYPE_IDS.includes(p.subtipo_sugerido as SubtypeId)
            ? (p.subtipo_sugerido as SubtypeId)
            : null;
        const suggestedMeta = suggestedSub ? ALL_SUBTYPES.find((s) => s.id === suggestedSub) : null;

        return NextResponse.json({
          mode: "openrouter_live",
          model: candidate,
          ...p,
          es_evidencia_valida: isValid,
          subtipo_sugerido: suggestedSub,
          subtipo_sugerido_label: suggestedMeta?.label ?? null,
          dominio_sugerido: suggestedMeta?.domainId ?? null,
          tipo_evento_sugerido: isValid
            ? suggestedMeta?.eventType || p.tipo_evento_sugerido || tipoEvento || "otro"
            : "invalida",
          coincide_con_categoria: isValid
            ? typeof p.coincide_con_categoria === "boolean"
              ? p.coincide_con_categoria
              : !suggestedSub || suggestedSub === subtipoEvento
            : false,
        });
      }
      lastStatus = attempt.status;
    }

    const fallback = heuristicClassify({
      tipoEvento,
      subtipoEvento,
      descripcion,
      zonaManglar,
      enZonaPorRevisar,
    });
    return NextResponse.json({ ...fallback, openrouter_status: lastStatus });
  } catch {
    return NextResponse.json(heuristicClassify({}));
  }
}
