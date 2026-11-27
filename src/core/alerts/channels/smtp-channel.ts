import nodemailer from "nodemailer";
import { buildAlertEmailHtml, buildAlertEmailSubject, buildAlertEmailText } from "../email-template";
import type { AlertLevel, ChannelSendResult, DispatchPayload, NotificationChannel } from "../types";

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

/**
 * Canal SMTP nativo para Hostinger (smtp.hostinger.com:465 SSL o 587 STARTTLS).
 * Si no hay credenciales SMTP configuradas, genera una cuenta sandbox Ethereal en vivo
 * para entregar un preview real inspeccionable sin romper el flujo.
 */
export class SmtpNotificationChannel implements NotificationChannel {
  readonly name = "smtp_hostinger";
  private readonly config: SmtpConfig | null;

  constructor(config?: SmtpConfig | null) {
    if (config !== undefined) {
      this.config = config;
      return;
    }

    const host = process.env.SMTP_HOST?.trim();
    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_PASS?.trim();
    const port = Number(process.env.SMTP_PORT || 465);
    const from =
      process.env.ALERT_EMAIL_FROM?.trim() ||
      (user ? `Alertas Manglar Vivo CRA <${user}>` : "Alertas Manglar Vivo CRA <alertas@manglar.fourgsolutions.com>");

    this.config =
      host && user && pass
        ? {
            host,
            port,
            secure: port === 465,
            user,
            pass,
            from,
          }
        : null;
  }

  supports(level: AlertLevel, forceSend?: boolean): boolean {
    if (forceSend) return true;
    return level === "urgente";
  }

  async send(payload: DispatchPayload): Promise<ChannelSendResult> {
    const subject = buildAlertEmailSubject(payload);
    const html = buildAlertEmailHtml(payload);
    const text = buildAlertEmailText(payload);

    try {
      if (this.config) {
        const transporter = nodemailer.createTransport({
          host: this.config.host,
          port: this.config.port,
          secure: this.config.secure,
          auth: {
            user: this.config.user,
            pass: this.config.pass,
          },
        });

        const info = await transporter.sendMail({
          from: this.config.from,
          to: payload.recipientEmail,
          subject,
          text,
          html,
        });

        return {
          channel: this.name,
          status: "enviado",
          recipientEmail: payload.recipientEmail,
          providerMessageId: info.messageId || null,
          previewUrl: null,
        };
      }

      // Fallback real TLS sandbox (Ethereal) cuando aún no se cargan credenciales Hostinger SMTP
      const testAccount = await nodemailer.createTestAccount();
      const transporter = nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });

      const info = await transporter.sendMail({
        from: "Alertas Manglar Vivo CRA <alertas@manglar.fourgsolutions.com>",
        to: payload.recipientEmail,
        subject,
        text,
        html,
      });

      const preview = nodemailer.getTestMessageUrl(info);
      return {
        channel: "smtp_ethereal_preview",
        status: "preview_sandbox",
        recipientEmail: payload.recipientEmail,
        providerMessageId: info.messageId || null,
        previewUrl: typeof preview === "string" ? preview : null,
      };
    } catch (err) {
      return {
        channel: this.name,
        status: "error",
        recipientEmail: payload.recipientEmail,
        errorDetail: err instanceof Error ? err.message : "Error enviando SMTP",
      };
    }
  }
}
