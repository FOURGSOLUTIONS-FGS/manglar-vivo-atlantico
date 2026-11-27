import { buildAlertEmailHtml, buildAlertEmailSubject, buildAlertEmailText } from "../email-template";
import type { AlertLevel, ChannelSendResult, DispatchPayload, NotificationChannel } from "../types";

/**
 * Canal HTTP transaccional para Resend (dominio verificado ej. fourgsolutions.com).
 * Implementa el mismo contrato NotificationChannel (Principio de Sustitución de Liskov).
 */
export class ResendNotificationChannel implements NotificationChannel {
  readonly name = "resend_api";
  private readonly apiKey: string | null;
  private readonly from: string;

  constructor(apiKey?: string | null, from?: string) {
    this.apiKey = apiKey !== undefined ? apiKey : process.env.RESEND_API_KEY?.trim() || null;
    this.from =
      from ||
      process.env.ALERT_EMAIL_FROM?.trim() ||
      "Alertas Manglar Vivo CRA <alertas@fourgsolutions.com>";
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  supports(level: AlertLevel, forceSend?: boolean): boolean {
    if (!this.apiKey) return false;
    return Boolean(forceSend) || level === "urgente";
  }

  async send(payload: DispatchPayload): Promise<ChannelSendResult> {
    if (!this.apiKey) {
      return {
        channel: this.name,
        status: "omitido",
        recipientEmail: payload.recipientEmail,
      };
    }

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: this.from,
          to: [payload.recipientEmail],
          subject: buildAlertEmailSubject(payload),
          html: buildAlertEmailHtml(payload),
          text: buildAlertEmailText(payload),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return {
          channel: this.name,
          status: "error",
          recipientEmail: payload.recipientEmail,
          errorDetail: data?.message || `HTTP ${res.status}`,
        };
      }

      return {
        channel: this.name,
        status: "enviado",
        recipientEmail: payload.recipientEmail,
        providerMessageId: data?.id || null,
      };
    } catch (err) {
      return {
        channel: this.name,
        status: "error",
        recipientEmail: payload.recipientEmail,
        errorDetail: err instanceof Error ? err.message : "Error enviando vía Resend",
      };
    }
  }
}
