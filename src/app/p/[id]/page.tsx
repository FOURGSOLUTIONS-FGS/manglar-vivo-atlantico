import { redirect } from "next/navigation";
import { QR_STATIONS } from "@/lib/cra-domain";

const SHORT_ID_MAP: Record<string, string> = {
  "1": "mallorquin-sendero-1",
  "2": "puerto-velero-muelle",
  "3": "juan-acosta-estuario",
  "4": "totumo-astilleros",
  mallorquin: "mallorquin-sendero-1",
  "puerto-velero": "puerto-velero-muelle",
  "juan-acosta": "juan-acosta-estuario",
  totumo: "totumo-astilleros",
};

export default async function NfcPointRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const key = id.trim().toLowerCase();
  const mappedId = SHORT_ID_MAP[key] || key;
  const station = QR_STATIONS.find((s) => s.id === mappedId) ?? QR_STATIONS[0];

  redirect(
    `/reportar?perfil=turista&estacion=${encodeURIComponent(station.id)}&origen=nfc`
  );
}
