import { NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const ALLOWED_FORMATS = new Set(["webm", "mp4", "m4a", "ogg", "wav", "mp3"]);

function normalizeFormat(mimeType: string | undefined): string {
  const mime = (mimeType || "").toLowerCase();
  if (mime.includes("mp4") || mime.includes("m4a") || mime.includes("aac")) return "mp4";
  if (mime.includes("ogg") || mime.includes("opus")) return "ogg";
  if (mime.includes("wav")) return "wav";
  if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3";
  if (mime.includes("webm")) return "webm";
  return "webm";
}

export async function POST(request: Request) {
  try {
    const rl = checkRateLimit({
      key: `transcribe:${getClientIp(request)}`,
      maxRequests: 30,
      windowMs: 5 * 60 * 1000,
    });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Límite temporal de dictado alcanzado. Reintenta en ${rl.retryAfterSec}s.` },
        { status: 429 }
      );
    }

    const apiKey = process.env.OPENROUTER_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(
        { error: "Servicio de transcripción de voz no configurado en este servidor." },
        { status: 503 }
      );
    }

    const body = (await request.json()) as {
      audioBase64?: string;
      mimeType?: string;
      sectorHint?: string;
    };

    const rawBase64 = (body.audioBase64 || "").replace(/^data:[^;]+;base64,/, "").trim();
    if (!rawBase64 || rawBase64.length < 200) {
      return NextResponse.json(
        { error: "El audio grabado es muy corto o está vacío. Habla al menos 1 segundo." },
        { status: 400 }
      );
    }

    if (rawBase64.length > 6_000_000) {
      return NextResponse.json(
        { error: "El audio supera el máximo permitido (30 segundos)." },
        { status: 413 }
      );
    }

    const format = normalizeFormat(body.mimeType);
    const safeFormat = ALLOWED_FORMATS.has(format) ? format : "webm";
    const model = process.env.OPENROUTER_MODEL?.trim() || "google/gemini-2.5-flash";

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: AbortSignal.timeout(20000),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://manglar.arpadura.com",
        "X-Title": "Manglar Vivo Atlantico CRA",
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 300,
        messages: [
          {
            role: "system",
            content:
              "Transcribe literalmente al español (Colombia) el audio de un reporte ciudadano ambiental sobre manglares del Atlántico (vocabulario frecuente: manglar, ciénaga, caño, Mallorquín, Puerto Velero, Juan de Acosta, Tubará, Totumo, Piojó, tala, relleno, quema, escombros, plástico, vertimiento, agua turbia, garza, cangrejo). Devuelve ÚNICAMENTE el texto transcrito limpio, sin comillas, sin prefijos ni explicaciones. Si solo hay silencio o ruido sin palabras inteligibles, responde exactamente: [SILENCIO]",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: body.sectorHint
                  ? `Transcribe este reporte de voz desde ${body.sectorHint}:`
                  : "Transcribe este reporte de voz ciudadano:",
              },
              {
                type: "input_audio",
                input_audio: {
                  data: rawBase64,
                  format: safeFormat,
                },
              },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "No se pudo transcribir el audio en este momento. Intenta de nuevo o escribe tu nota." },
        { status: 502 }
      );
    }

    const data = await res.json();
    const transcript = String(data?.choices?.[0]?.message?.content || "")
      .replace(/^["'“”]+|["'“”]+$/g, "")
      .trim();

    if (!transcript || transcript.includes("[SILENCIO]")) {
      return NextResponse.json(
        { transcript: "", empty: true, message: "No se escuchó voz clara. Habla más cerca del micrófono." },
        { status: 200 }
      );
    }

    return NextResponse.json({ transcript, model, empty: false });
  } catch {
    return NextResponse.json(
      { error: "Error de conexión al transcribir el audio. Verifica tu señal e intenta de nuevo." },
      { status: 500 }
    );
  }
}
