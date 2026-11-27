import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";
import { createDefaultAlertDispatcher } from "@/core/alerts/dispatcher";
import { ALERT_ROUTING_MATRIX } from "@/core/alerts/routing";
import type { AlertReportInput } from "@/core/alerts/types";

export async function GET() {
  const supabase = createServerSupabase();
  const { data: dispatches } = await supabase
    .from("alert_dispatches")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(60);

  const hasHostingerSmtp = Boolean(
    process.env.SMTP_HOST?.trim() &&
      process.env.SMTP_USER?.trim() &&
      process.env.SMTP_PASS?.trim()
  );
  const hasResend = Boolean(process.env.RESEND_API_KEY?.trim());
  const activeProvider = hasHostingerSmtp
    ? "smtp_hostinger"
    : hasResend
    ? "resend_api"
    : "smtp_ethereal_preview";

  return NextResponse.json({
    dispatches: dispatches ?? [],
    routingMatrix: ALERT_ROUTING_MATRIX,
    channelStatus: {
      activeProvider,
      smtpHost: process.env.SMTP_HOST?.trim() || "smtp.hostinger.com",
      fromAddress:
        process.env.ALERT_EMAIL_FROM?.trim() ||
        process.env.SMTP_USER?.trim() ||
        "alertas@manglar.fourgsolutions.com",
      defaultRecipient: process.env.ALERT_URGENT_TO?.trim() || "",
      siteUrl:
        process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
        "https://manglar-vivo-atlantico.vercel.app",
      isLiveProductionMail: hasHostingerSmtp || hasResend,
    },
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      reportId?: string;
      recipientEmail?: string;
      isManualTest?: boolean;
      customScenario?: "urgente" | "alta" | "verificacion";
    };

    const recipientEmail = body.recipientEmail?.trim();
    if (!recipientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
      return NextResponse.json(
        { error: "Ingresa un correo electrónico destino válido para enviar la alerta." },
        { status: 400 }
      );
    }

    const supabase = createServerSupabase();
    let reportInput: AlertReportInput | null = null;

    if (body.reportId) {
      const { data: row } = await supabase
        .from("citizen_reports")
        .select("*")
        .eq("id", body.reportId)
        .single();

      if (row) {
        const exif = (row.evidencia_exif as Record<string, unknown> | null) ?? null;
        const ai = (row.ai_classification as Record<string, unknown> | null) ?? null;
        reportInput = {
          id: row.id,
          trackingCode: row.tracking_code,
          tipoEvento: row.tipo_evento,
          subtipoEvento: typeof exif?.subtipo_evento === "string" ? exif.subtipo_evento : null,
          zonaManglar: row.zona_manglar,
          municipio: row.municipio,
          sectorId: row.sector_id,
          accionPlan: row.accion_plan,
          enZonaPorRevisar: row.en_zona_por_revisar,
          nivelPrioridad: row.nivel_prioridad,
          puntajeConfiabilidad: row.puntaje_confiabilidad,
          estadoValidacion: row.estado_validacion,
          attentionStatus: row.attention_status,
          descripcionCiudadana: row.descripcion_ciudadana,
          clasificacionTecnica: row.clasificacion_tecnica,
          evidenciaFotoUrl: row.evidencia_foto_url,
          latitud: Number(row.latitud),
          longitud: Number(row.longitud),
          isSimulatedGps: Boolean(row.is_simulated_gps),
          aiPhotoValid: typeof ai?.es_evidencia_valida === "boolean" ? ai.es_evidencia_valida : null,
          timestampCaptura: row.timestamp_captura,
        };
      }
    }

    if (!reportInput) {
      const scenario = body.customScenario || "urgente";
      const siteOrigin =
        process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
        "https://manglar-vivo-atlantico.vercel.app";

      reportInput =
        scenario === "verificacion"
          ? {
              trackingCode: `MGL-TEST-${Math.floor(1000 + Math.random() * 9000)}`,
              tipoEvento: "otro",
              subtipoEvento: "verificacion_828ha",
              zonaManglar: "Totumo – Astilleros – Galerazamba",
              municipio: "Piojó",
              sectorId: 4,
              accionPlan: "Restauración",
              enZonaPorRevisar: true,
              nivelPrioridad: "baja",
              puntajeConfiabilidad: 92,
              estadoValidacion: "validado_comunitario",
              descripcionCiudadana:
                "Confirmación positiva de manglar sano con plántulas activas en polígono de 828 ha por revisar.",
              clasificacionTecnica: "Etiqueta ground-truth positiva en zona por revisar CRA",
              evidenciaFotoUrl: `${siteOrigin}/dataset/verificacion_828ha.jpg`,
              latitud: 10.7429,
              longitud: -75.2185,
              isSimulatedGps: true,
              aiPhotoValid: true,
            }
          : scenario === "alta"
          ? {
              trackingCode: `MGL-TEST-${Math.floor(1000 + Math.random() * 9000)}`,
              tipoEvento: "cambio_hidrico",
              subtipoEvento: "cano_taponado",
              zonaManglar: "Tubará – Juan de Acosta",
              municipio: "Juan de Acosta",
              sectorId: 3,
              accionPlan: "Restauración",
              enZonaPorRevisar: true,
              nivelPrioridad: "alta",
              puntajeConfiabilidad: 85,
              estadoValidacion: "nuevo",
              descripcionCiudadana:
                "Sedimentos bloqueando el canal mareal principal; agua estancada junto a manglar estresado.",
              clasificacionTecnica: "Obstrucción de conectividad hidrológica e intercambio mareal",
              evidenciaFotoUrl: `${siteOrigin}/dataset/cano_taponado.jpg`,
              latitud: 10.8719,
              longitud: -75.0972,
              isSimulatedGps: true,
              aiPhotoValid: true,
            }
          : {
              trackingCode: `MGL-TEST-${Math.floor(1000 + Math.random() * 9000)}`,
              tipoEvento: "tala_relleno",
              subtipoEvento: "quema_incendio",
              zonaManglar: "Tubará – Juan de Acosta",
              municipio: "Juan de Acosta",
              sectorId: 3,
              accionPlan: "Preservación",
              enZonaPorRevisar: true,
              enDoselSeco2026: true,
              nivelPrioridad: "alta",
              puntajeConfiabilidad: 90,
              estadoValidacion: "alerta_oficial_cra",
              descripcionCiudadana:
                "Quema activa detectada en borde de manglar con anomalía de sequía 2026 (-0.151). Requiere atención inmediata.",
              clasificacionTecnica: "Afectación térmica activa en borde de manglar y liberación de carbono",
              evidenciaFotoUrl: `${siteOrigin}/dataset/quema_incendio.jpg`,
              latitud: 10.8719,
              longitud: -75.0972,
              isSimulatedGps: true,
              aiPhotoValid: true,
            };
    }

    const dispatcher = createDefaultAlertDispatcher();
    const origin = new URL(request.url).origin;
    const outcome = await dispatcher.evaluateAndDispatch({
      report: reportInput,
      recipientEmail,
      baseUrl: process.env.NEXT_PUBLIC_SITE_URL?.trim() || origin,
      forceSend: true,
      isManualTest: body.isManualTest ?? !body.reportId,
    });

    return NextResponse.json(outcome);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error despachando alerta" },
      { status: 500 }
    );
  }
}
