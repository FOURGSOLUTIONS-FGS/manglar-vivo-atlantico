"use client";

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { EventTypeId, ReporterProfileId } from "./cra-domain";

export interface OfflineReportPayload {
  client_uuid: string;
  tracking_code: string;
  timestamp_captura: string;
  latitud: number;
  longitud: number;
  precision_gps_m: number | null;
  is_simulated_gps: boolean;
  zona_manglar: string;
  municipio: string;
  sector_id: number;
  accion_plan: string | null;
  en_zona_por_revisar: boolean;
  tipo_evento: EventTypeId;
  descripcion_ciudadana: string;
  perfil_reportante: ReporterProfileId;
  school_name?: string;
  qr_station_id?: string;
  nivel_prioridad: "alta" | "media" | "baja";
  puntaje_confiabilidad: number;
  evidencia_exif?: Record<string, unknown> | null;
  ai_classification?: Record<string, unknown> | null;
  ground_truth_match?: Record<string, unknown> | null;
  website_hp?: string;
  form_duration_ms?: number;
  client_fingerprint?: string;
}

export interface PendingReportRecord {
  client_uuid: string;
  payload: OfflineReportPayload;
  photo_original: Blob | null;
  photo_name: string;
  photo_preview: string | null;
  photos_original?: Blob[];
  photos_names?: string[];
  created_at: number;
  retries: number;
  last_error?: string;
}

export interface ReceiptRecord {
  tracking_code: string;
  client_uuid: string;
  zona_manglar: string;
  tipo_evento: string;
  timestamp_captura: string;
  synced: boolean;
}

interface ManglarOfflineDB extends DBSchema {
  pending_reports: {
    key: string;
    value: PendingReportRecord;
  };
  drafts: {
    key: string;
    value: { id: string; data: Record<string, unknown>; updated_at: number };
  };
  receipts: {
    key: string;
    value: ReceiptRecord;
  };
}

let dbPromise: Promise<IDBPDatabase<ManglarOfflineDB>> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<ManglarOfflineDB>("manglar-vivo-offline", 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("pending_reports")) {
          db.createObjectStore("pending_reports", { keyPath: "client_uuid" });
        }
        if (!db.objectStoreNames.contains("drafts")) {
          db.createObjectStore("drafts", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("receipts")) {
          db.createObjectStore("receipts", { keyPath: "client_uuid" });
        }
      },
    });
  }
  return dbPromise;
}

export async function enqueueOfflineReport(record: PendingReportRecord): Promise<void> {
  const db = await getDb();
  await db.put("pending_reports", record);
  await db.put("receipts", {
    tracking_code: record.payload.tracking_code,
    client_uuid: record.client_uuid,
    zona_manglar: record.payload.zona_manglar,
    tipo_evento: record.payload.tipo_evento,
    timestamp_captura: record.payload.timestamp_captura,
    synced: false,
  });
  window.dispatchEvent(new CustomEvent("manglar-queue-changed"));
}

export async function getPendingReports(): Promise<PendingReportRecord[]> {
  const db = await getDb();
  const list = await db.getAll("pending_reports");
  return list.sort((a, b) => b.created_at - a.created_at);
}

export async function getLocalReceipts(): Promise<ReceiptRecord[]> {
  const db = await getDb();
  const list = await db.getAll("receipts");
  return list.sort((a, b) => (a.timestamp_captura < b.timestamp_captura ? 1 : -1));
}

export async function markReceiptSynced(clientUuid: string): Promise<void> {
  const db = await getDb();
  const rec = await db.get("receipts", clientUuid);
  if (rec) {
    await db.put("receipts", { ...rec, synced: true });
  }
}

export async function uploadReportToServer(record: PendingReportRecord) {
  const fd = new FormData();
  fd.append("payload", JSON.stringify(record.payload));
  const list =
    record.photos_original && record.photos_original.length > 0
      ? record.photos_original
      : record.photo_original
      ? [record.photo_original]
      : [];
  const names =
    record.photos_names && record.photos_names.length > 0
      ? record.photos_names
      : [record.photo_name || "evidencia.jpg"];

  list.slice(0, 3).forEach((blob, idx) => {
    fd.append(idx === 0 ? "photo" : `photo_${idx}`, blob, names[idx] || `evidencia_${idx + 1}.jpg`);
  });

  const res = await fetch("/api/reports", { method: "POST", body: fd });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    const msg = data?.error || `HTTP ${res.status}`;
    const err = new Error(msg) as Error & { status?: number; spamCode?: string };
    err.status = res.status;
    err.spamCode = data?.spamCode;
    throw err;
  }
  return res.json();
}

let flushing = false;
export async function flushOfflineQueue(): Promise<{ synced: number; remaining: number }> {
  if (flushing || (typeof navigator !== "undefined" && !navigator.onLine)) {
    const pending = await getPendingReports();
    return { synced: 0, remaining: pending.length };
  }
  flushing = true;
  let synced = 0;
  try {
    const db = await getDb();
    const pending = await getPendingReports();
    for (const item of pending) {
      try {
        await uploadReportToServer(item);
        await db.delete("pending_reports", item.client_uuid);
        await markReceiptSynced(item.client_uuid);
        synced += 1;
      } catch (err) {
        await db.put("pending_reports", {
          ...item,
          retries: item.retries + 1,
          last_error: err instanceof Error ? err.message : "Error de red",
        });
      }
    }
    const left = await getPendingReports();
    window.dispatchEvent(new CustomEvent("manglar-queue-changed"));
    return { synced, remaining: left.length };
  } finally {
    flushing = false;
  }
}
