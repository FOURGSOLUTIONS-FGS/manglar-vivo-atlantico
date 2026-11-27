import type { AlertLevel, ChannelSendResult, DispatchPayload, NotificationChannel } from "../types";

/**
 * Canal Webhook extensible (WhatsApp Business / n8n / Telegram / Slack).
 * Demuestra Open/Closed: sumar un canal nuevo no requiere tocar el clasificador ni la UI.
 */
export class WebhookNotificationChannel implements NotificationChannel {
  readonly name = "webhook_n8n";
  private readonly webhookUrl: string | null;

  constructor(webhookUrl?: string | null) {
    this.webhookUrl =
      webhookUrl !== undefined ? webhookUrl : process.env.ALERT_WEBHOOK_URL?.trim() || null;
  }

  supports(level: AlertLevel, forceSend?: boolean): boolean {
    if (!this.webhookUrl) return false;
    return Boolean(forceSend) || level === "urgente" || level === "alta";
  }

  async send(payload: DispatchPayload): Promise<ChannelSendResult> {
    if (!this.webhookUrl) {
      return { channel: this.name, status: "omitido" };
    }

    try {
      const res = await fetch(this.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "manglar_alert_dispatched",
          level: payload.classification.level,
          tracking_code: payload.report.trackingCode,
          sector: payload.report.zonaManglar,
          municipio: payload.report.municipio,
          reliability: payload.report.puntajeConfiabilidad,
          coords: { lat: payload.report.latitud, lon: payload.report.longitud },
          recipients: payload.classification.recipients.map((r) => r.name),
          is_manual_test: Boolean(payload.isManualTest),
        }),
      });

      return {
        channel: this.name,
        status: res.ok ? "enviado" : "error",
        errorDetail: res.ok ? null : `HTTP ${res.status}`,
      };
    } catch (err) {
      return {
        channel: this.name,
        status: "error",
        errorDetail: err instanceof Error ? err.message : "Error enviando webhook",
      };
    }
  }
}
