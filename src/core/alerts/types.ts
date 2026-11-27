import type { EventTypeId, SubtypeId, ValidationStatus } from "@/lib/cra-domain";

export type AlertLevel = "urgente" | "alta" | "media" | "verificacion";

export type AlertSoundProfile = "urgent" | "priority" | "success" | "none";

export interface AlertRecipient {
  id: string;
  name: string;
  role: string;
  channel: "correo_urgente" | "sala_cra" | "consola_mentores" | "tablero_escuelas";
  slaLabel: string;
  kidRoleLabel: string;
}

export interface AlertReportInput {
  id?: string;
  trackingCode: string;
  tipoEvento: EventTypeId | string;
  subtipoEvento?: SubtypeId | string | null;
  zonaManglar: string;
  municipio: string;
  sectorId?: number;
  accionPlan?: string | null;
  enZonaPorRevisar?: boolean;
  enDoselSeco2026?: boolean;
  nivelPrioridad?: string;
  puntajeConfiabilidad: number;
  estadoValidacion?: ValidationStatus | string;
  attentionStatus?: string;
  descripcionCiudadana?: string;
  clasificacionTecnica?: string | null;
  evidenciaFotoUrl?: string | null;
  evidenciaFotosUrls?: string[];
  latitud: number;
  longitud: number;
  isSimulatedGps?: boolean;
  aiPhotoValid?: boolean | null;
  timestampCaptura?: string;
}

export interface AlertClassification {
  level: AlertLevel;
  priorityOrder: number;
  slaHours: number;
  badgeLabel: string;
  colorHex: string;
  kidFriendlyHeadline: string;
  kidFriendlyExplanation: string;
  nextStepSimple: string;
  technicalReason: string;
  soundProfile: AlertSoundProfile;
  autoDispatchEmail: boolean;
  recipients: AlertRecipient[];
}

export interface DispatchPayload {
  report: AlertReportInput;
  classification: AlertClassification;
  recipientEmail: string;
  recipientGroup: string;
  baseUrl: string;
  isManualTest?: boolean;
}

export interface ChannelSendResult {
  channel: string;
  status: "enviado" | "preview_sandbox" | "omitido" | "error";
  recipientEmail?: string;
  providerMessageId?: string | null;
  previewUrl?: string | null;
  errorDetail?: string | null;
}

export interface NotificationChannel {
  readonly name: string;
  supports(level: AlertLevel, forceSend?: boolean): boolean;
  send(payload: DispatchPayload): Promise<ChannelSendResult>;
}

export interface AlertAuditRecord {
  report_id?: string | null;
  tracking_code: string;
  alert_level: AlertLevel;
  channel: string;
  recipient_group: string;
  recipient_email?: string | null;
  subject: string;
  status: ChannelSendResult["status"];
  provider_message_id?: string | null;
  preview_url?: string | null;
  error_detail?: string | null;
  metadata?: Record<string, unknown>;
}

export interface AlertAuditRepository {
  save(record: AlertAuditRecord): Promise<void>;
}
