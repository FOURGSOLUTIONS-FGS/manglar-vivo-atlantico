"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  Link2,
  MessageSquare,
  Phone,
  Radio,
  Send,
  Webhook,
} from "lucide-react";

interface ZernioOverview {
  configured: boolean;
  webhookUrl: string;
  supportedPlatforms: Array<{ id: string; label: string; hint: string }>;
  profiles: Array<{ _id: string; name: string; externalId?: string | null }>;
  accounts: Array<{
    _id: string;
    platform?: string;
    username?: string;
    displayName?: string;
    isActive?: boolean;
  }>;
  webhooks: Array<{ _id?: string; url?: string; events?: string[]; isActive?: boolean }>;
  whatsappSandbox: {
    phoneNumber?: string;
    accountId?: string;
    template?: { name?: string };
  } | null;
  availableNumbers: Array<{
    phoneNumber?: string;
    maskedNumber?: string;
    country?: string;
    monthlyPrice?: number;
    claimUrl?: string;
  }>;
  hint?: string;
}

export function AdminZernioChannels() {
  const [data, setData] = useState<ZernioOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string; url?: string } | null>(null);
  const [waPhone, setWaPhone] = useState("+57");
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  const loadOverview = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/zernio?country=US");
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, []);

  const runAction = async (
    action: string,
    extra: Record<string, unknown> = {}
  ) => {
    setBusyAction(action + String(extra.platform || ""));
    setFeedback(null);
    try {
      const res = await fetch("/api/zernio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const json = await res.json();
      if (!res.ok) {
        setFeedback({ ok: false, text: json.error || "Error ejecutando acción Zernio." });
        return;
      }
      if (json.authUrl) {
        setFeedback({
          ok: true,
          text: `Link de conexión generado para ${json.platform}. Ábrelo para autorizar la cuenta:`,
          url: json.authUrl,
        });
      } else if (json.profile) {
        setFeedback({
          ok: true,
          text: `Perfil activo: ${json.profile.name} (${json.profile._id})`,
        });
      } else if (json.message) {
        setFeedback({ ok: true, text: json.message });
      } else if (json.webhookUrl) {
        setFeedback({ ok: true, text: `Webhook registrado en ${json.webhookUrl}` });
      }
      loadOverview();
    } finally {
      setBusyAction(null);
    }
  };

  const copyWebhook = () => {
    if (!data?.webhookUrl) return;
    navigator.clipboard?.writeText(data.webhookUrl);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 1800);
  };

  return (
    <div className="space-y-6 text-white">
      {/* Cabecera estado Zernio */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/14 bg-[#082438] p-6">
        <div>
          <h2 className="font-display text-2xl font-black text-white">
            Canales Omnicanal Zernio (WhatsApp · Telegram · Instagram · SMS)
          </h2>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-white/75">
            Permite que ciudadanos, turistas y escuelas reporten amenazas enviando una foto por WhatsApp, Telegram, Instagram DM o SMS. El webhook procesa la foto con IA anti-falsos, registra el caso en Supabase y devuelve automáticamente el código de seguimiento.
          </p>
        </div>

        <span
          className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 font-mono text-xs font-black ${
            data?.configured
              ? "bg-[#16794A]/35 text-[#86EFAC]"
              : "border border-[#EDB512]/50 bg-[#EDB512]/15 text-[#F8D86F]"
          }`}
        >
          <Radio className="h-3.5 w-3.5" />
          {loading
            ? "VERIFICANDO ZERNIO..."
            : data?.configured
            ? `CONECTADO · ${data.accounts.length} CANALES`
            : "FALTA ZERNIO_API_KEY"}
        </span>
      </div>

      {feedback && (
        <div
          className={`rounded-xl border p-4 text-xs font-bold ${
            feedback.ok
              ? "border-[#22C55E]/50 bg-[#16794A]/25 text-white"
              : "border-[#C84023]/60 bg-[#C84023]/20 text-[#FCA5A5]"
          }`}
        >
          <p>{feedback.text}</p>
          {feedback.url && (
            <a
              href={feedback.url}
              target="_blank"
              rel="noreferrer"
              className="mt-2.5 inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-[#EDB512] px-4 text-xs font-black text-[#041A29] hover:bg-[#F8D86F]"
            >
              Abrir enlace de conexión Zernio
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      )}

      {/* Webhook listo + Paso 1 Perfil */}
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="space-y-4 rounded-xl border border-white/14 bg-[#082438] p-5 lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="inline-flex items-center gap-2 font-display text-lg font-black text-white">
              <Webhook className="h-4 w-4 text-[#F8D86F]" />
              Webhook entrante activo (`message.received`)
            </h3>
            <button
              type="button"
              disabled={!data?.configured || Boolean(busyAction)}
              onClick={() => runAction("register_webhook")}
              className="min-h-[36px] rounded-lg bg-[#005F96] px-3 text-xs font-black text-white transition hover:bg-[#EDB512] hover:text-[#041A29] disabled:opacity-50"
            >
              Registrar webhook en Zernio
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <code className="flex-1 rounded-lg border border-white/15 bg-[#041A29] px-3.5 py-2.5 font-mono text-xs text-[#86EFAC]">
              {data?.webhookUrl || "https://manglar.arpadura.com/api/webhooks/zernio"}
            </code>
            <button
              type="button"
              onClick={copyWebhook}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-white/20 px-3 text-xs font-bold text-[#F8D86F] hover:border-[#EDB512]"
            >
              <Copy className="h-3.5 w-3.5" />
              {copiedWebhook ? "Copiado" : "Copiar"}
            </button>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            {[
              { t: "1. Foto + sector", d: "El ciudadano envía foto por WhatsApp, Telegram o IG." },
              { t: "2. IA + Supabase", d: "Filtra falsos positivos y dispara alerta CRA si es urgente." },
              { t: "3. Respuesta auto", d: "Responde código MGL-ZN-XXXX y consulta con 'estado'." },
            ].map((s) => (
              <div key={s.t} className="rounded-lg border border-white/10 bg-[#041A29]/65 p-3">
                <p className="text-xs font-black text-[#F8D86F]">{s.t}</p>
                <p className="mt-1 text-[11px] text-white/75">{s.d}</p>
              </div>
            ))}
          </div>
        </div>

        {/* WhatsApp Sandbox Instantáneo (Gratis, 0 trámites Meta) */}
        <div className="flex flex-col justify-between space-y-4 rounded-xl border border-[#22C55E]/35 bg-[#082438] p-5 lg:col-span-5">
          <div>
            <h3 className="inline-flex items-center gap-2 font-display text-lg font-black text-white">
              <MessageSquare className="h-4 w-4 text-[#86EFAC]" />
              WhatsApp Sandbox inmediato (sin comprar número)
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-white/75">
              Activa pruebas reales de WhatsApp en 30 segundos usando el número compartido de Zernio (7 días gratis, 50 mensajes/día) o compra un número dedicado abajo.
            </p>
            {data?.whatsappSandbox?.phoneNumber && (
              <p className="mt-2 font-mono text-xs font-bold text-[#86EFAC]">
                Número sandbox: {data.whatsappSandbox.phoneNumber}
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <input
              type="tel"
              value={waPhone}
              onChange={(e) => setWaPhone(e.target.value)}
              placeholder="+573001234567"
              className="min-h-[42px] flex-1 rounded-lg border border-white/20 bg-[#041A29] px-3 font-mono text-xs text-white"
            />
            <button
              type="button"
              disabled={!data?.configured || Boolean(busyAction)}
              onClick={() => runAction("activate_whatsapp_sandbox", { phone: waPhone })}
              className="inline-flex min-h-[42px] items-center gap-1.5 rounded-lg bg-[#16794A] px-4 text-xs font-black text-white transition hover:bg-[#22C55E] hover:text-[#041A29] disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
              Activar WA
            </button>
          </div>
        </div>
      </div>

      {/* Conectar plataformas con 1 clic (Perfil + Connect Links) */}
      <div className="rounded-xl border border-white/14 bg-[#082438] p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="inline-flex items-center gap-2 font-display text-lg font-black text-white">
              <Link2 className="h-4 w-4 text-[#EDB512]" />
              Conectar canales oficiales al perfil CRA (primeras 2 cuentas gratis)
            </h3>
            <p className="text-xs text-white/65">
              {data?.profiles?.length
                ? `Perfil activo: ${data.profiles[0].name} (${data.profiles[0]._id})`
                : "Primero crea el perfil oficial y luego genera el enlace de conexión de cada red."}
            </p>
          </div>

          <button
            type="button"
            disabled={!data?.configured || Boolean(busyAction)}
            onClick={() => runAction("bootstrap_profile")}
            className="min-h-[40px] rounded-lg bg-[#EDB512] px-4 text-xs font-black text-[#041A29] transition hover:bg-[#F8D86F] disabled:opacity-50"
          >
            {data?.profiles?.length ? "Verificar perfil CRA" : "1. Crear perfil en Zernio"}
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(data?.supportedPlatforms || []).map((pl) => {
            const connectedAcc = data?.accounts?.find(
              (a) => (a.platform || "").toLowerCase() === pl.id
            );
            return (
              <div
                key={pl.id}
                className="flex flex-col justify-between rounded-xl border border-white/12 bg-[#041A29]/70 p-4"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display text-base font-black text-white">
                      {pl.label}
                    </span>
                    {connectedAcc && (
                      <span className="inline-flex items-center gap-1 rounded bg-[#16794A]/35 px-2 py-0.5 font-mono text-[10px] font-black text-[#86EFAC]">
                        <CheckCircle2 className="h-3 w-3" />
                        ACTIVO
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-white/65">{pl.hint}</p>
                </div>

                <button
                  type="button"
                  disabled={!data?.configured || Boolean(busyAction)}
                  onClick={() =>
                    runAction("create_connect_link", {
                      platform: pl.id,
                      profileId: data?.profiles?.[0]?._id,
                    })
                  }
                  className="mt-3.5 inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg border border-white/20 bg-white/5 px-3 text-xs font-black text-[#F8D86F] transition hover:border-[#EDB512] hover:bg-[#EDB512] hover:text-[#041A29] disabled:opacity-45"
                >
                  Generar Connect Link
                  <ExternalLink className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Números dedicados disponibles (SMS + Voz + WhatsApp) */}
      {data?.availableNumbers && data.availableNumbers.length > 0 && (
        <div className="rounded-xl border border-white/14 bg-[#082438] p-5">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="inline-flex items-center gap-2 font-display text-lg font-black text-white">
              <Phone className="h-4 w-4 text-[#F8D86F]" />
              Números dedicados disponibles en Zernio (WhatsApp + SMS + Voz)
            </h3>
            <span className="text-xs text-white/60">Un solo número soporta los 3 canales</span>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {data.availableNumbers.slice(0, 4).map((num, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between gap-2 rounded-lg border border-white/12 bg-[#041A29]/75 px-3.5 py-3"
              >
                <div>
                  <p className="font-mono text-xs font-black text-white">
                    {num.phoneNumber || num.maskedNumber || "Número disponible"}
                  </p>
                  <p className="text-[11px] text-white/60">
                    {num.country || "US"} {num.monthlyPrice ? `· $${num.monthlyPrice}/mes` : ""}
                  </p>
                </div>
                {num.claimUrl && (
                  <a
                    href={num.claimUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md bg-[#EDB512] px-2.5 py-1.5 text-[11px] font-black text-[#041A29] hover:bg-[#F8D86F]"
                  >
                    Adquirir
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
