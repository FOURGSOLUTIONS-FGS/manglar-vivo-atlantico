import { createServerSupabase } from "@/lib/supabase";
import { classifyAlert } from "./classifier";
import { buildAlertEmailSubject } from "./email-template";
import { ResendNotificationChannel } from "./channels/resend-channel";
import { SmtpNotificationChannel } from "./channels/smtp-channel";
import { WebhookNotificationChannel } from "./channels/webhook-channel";
import { checkUrgentEmailCooldown } from "@/core/security/anti-spam";
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
    skipCooldown?: boolean;
  }): Promise<{
    classification: AlertClassification;
    results: ChannelSendResult[];
    deduplicatedByCooldown?: boolean;
  }> {
    const classification = classifyAlert(params.report);
    const recipientEmail =
      params.recipientEmail?.trim() ||
      process.env.ALERT_URGENT_TO?.trim() ||
      "four4gsolutions@gmail.com";
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

    // Anti-bombardeo de correos en el mismo sector/evento (ventana 15 min) para envíos automáticos
    if (
      activeChannels.length > 0 &&
      !params.isManualTest &&
      !params.forceSend &&
      !params.skipCooldown &&
      classification.level === "urgente"
    ) {
      const cd = checkUrgentEmailCooldown({
        sectorId: params.report.sectorId ?? 1,
        tipoEvento: String(params.report.tipoEvento || "otro"),
      });
      if (!cd.shouldSend) {
        const omitRes: ChannelSendResult = {
          channel: "anti_spam_cooldown",
          status: "omitido",
          recipientEmail,
          errorDetail: `Alerta deduplicada: ya se envió aviso urgente de este sector (espera ${cd.remainingSec}s).`,
        };
        if (this.auditRepo) {
          await this.auditRepo
            .save({
              report_id: params.report.id ?? null,
              tracking_code: params.report.trackingCode,
              alert_level: classification.level,
              channel: omitRes.channel,
              recipient_group: recipientGroup,
              recipient_email: recipientEmail,
              subject: buildAlertEmailSubject(payload),
              status: "omitido",
              error_detail: omitRes.errorDetail,
              metadata: { deduplicated: true, remaining_sec: cd.remainingSec },
            })
            .catch(() => {});
        }
        return { classification, results: [omitRes], deduplicatedByCooldown: true };
      }
    }

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
              photos_count:
                params.report.evidenciaFotosUrls?.length ||
                (params.report.evidenciaFotoUrl ? 1 : 0),
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
