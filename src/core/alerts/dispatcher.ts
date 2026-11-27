import { createServerSupabase } from "@/lib/supabase";
import { classifyAlert } from "./classifier";
import { buildAlertEmailSubject } from "./email-template";
import { ResendNotificationChannel } from "./channels/resend-channel";
import { SmtpNotificationChannel } from "./channels/smtp-channel";
import { WebhookNotificationChannel } from "./channels/webhook-channel";
import type {
  AlertAuditRecord,
  AlertAuditRepository,
  AlertClassification,
  AlertReportInput,
  ChannelSendResult,
  NotificationChannel,
} from "./types";

class SupabaseAlertAuditRepository implements AlertAuditRepository {
  async save(record: AlertAuditRecord): Promise<void> {
    const supabase = createServerSupabase();
    await supabase.from("alert_dispatches").insert(record);
  }
}

export class AlertDispatcher {
  private readonly channels: NotificationChannel[];
  private readonly auditRepo?: AlertAuditRepository;

  constructor(channels: NotificationChannel[], auditRepo?: AlertAuditRepository) {
    this.channels = channels;
    this.auditRepo = auditRepo;
  }

  async evaluateAndDispatch(params: {
    report: AlertReportInput;
    recipientEmail?: string;
    baseUrl?: string;
    forceSend?: boolean;
    isManualTest?: boolean;
  }): Promise<{
    classification: AlertClassification;
    results: ChannelSendResult[];
  }> {
    const classification = classifyAlert(params.report);
    const recipientEmail =
      params.recipientEmail?.trim() ||
      process.env.ALERT_URGENT_TO?.trim() ||
      "alertas-prueba@manglar.fourgsolutions.com";
    const baseUrl =
      params.baseUrl ||
      process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
      "https://manglar-vivo-atlantico.vercel.app";

    const recipientGroup = classification.recipients.map((r) => r.name).join(" + ");

    const payload = {
      report: params.report,
      classification,
      recipientEmail,
      recipientGroup,
      baseUrl,
      isManualTest: params.isManualTest,
    };

    const activeChannels = this.channels.filter((ch) =>
      ch.supports(classification.level, params.forceSend)
    );

    const results: ChannelSendResult[] = [];
    for (const channel of activeChannels) {
      const res = await channel.send(payload);
      results.push(res);

      if (this.auditRepo) {
        await this.auditRepo
          .save({
            report_id: params.report.id ?? null,
            tracking_code: params.report.trackingCode,
            alert_level: classification.level,
            channel: res.channel,
            recipient_group: recipientGroup,
            recipient_email: res.recipientEmail ?? recipientEmail,
            subject: buildAlertEmailSubject(payload),
            status: res.status,
            provider_message_id: res.providerMessageId ?? null,
            preview_url: res.previewUrl ?? null,
            error_detail: res.errorDetail ?? null,
            metadata: {
              is_manual_test: Boolean(params.isManualTest),
              sla_hours: classification.slaHours,
              municipio: params.report.municipio,
            },
          })
          .catch(() => {});
      }
    }

    return { classification, results };
  }
}

export function createDefaultAlertDispatcher(): AlertDispatcher {
  const hasSmtp = Boolean(
    process.env.SMTP_HOST?.trim() &&
      process.env.SMTP_USER?.trim() &&
      process.env.SMTP_PASS?.trim()
  );
  const resend = new ResendNotificationChannel();

  // Prioridad de canal de correo:
  // 1. Hostinger SMTP si está configurado
  // 2. Resend API si está configurado
  // 3. SmtpNotificationChannel en modo Ethereal sandbox (preview real inspeccionable)
  const channels: NotificationChannel[] = [];
  if (hasSmtp) {
    channels.push(new SmtpNotificationChannel());
  } else if (resend.isConfigured()) {
    channels.push(resend);
  } else {
    channels.push(new SmtpNotificationChannel(null));
  }

  channels.push(new WebhookNotificationChannel());

  return new AlertDispatcher(channels, new SupabaseAlertAuditRepository());
}
