import { NextResponse } from "next/server";
import {
  ZERNIO_SUPPORTED_PLATFORMS,
  createZernioConnectLink,
  ensureCraZernioProfile,
  isZernioConfigured,
  zernioFetch,
} from "@/lib/zernio";

function getSiteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://manglar.arpadura.com").replace(/\/$/, "");
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const country = (searchParams.get("country") || "CO").toUpperCase();
  const configured = isZernioConfigured();
  const siteUrl = getSiteUrl();
  const webhookUrl = `${siteUrl}/api/webhooks/zernio`;

  // Zernio permite buscar números disponibles incluso sin API key (público)
  const availableNumbersRes = await zernioFetch<{
    numbers?: Array<Record<string, unknown>>;
    available?: Array<Record<string, unknown>>;
  }>(`/phone-numbers/available?country=${encodeURIComponent(country)}`, {
    requireAuth: false,
  }).catch(() => ({ ok: false, status: 500, data: {} as Record<string, unknown> }));

  if (!configured) {
    return NextResponse.json({
      configured: false,
      webhookUrl,
      supportedPlatforms: ZERNIO_SUPPORTED_PLATFORMS,
      profiles: [],
      accounts: [],
      webhooks: [],
      whatsappSandbox: null,
      availableNumbers:
        (availableNumbersRes.data as { numbers?: unknown[]; available?: unknown[] }).numbers ||
        (availableNumbersRes.data as { numbers?: unknown[]; available?: unknown[] }).available ||
        [],
      hint: "Configura ZERNIO_API_KEY en .env.local y Vercel para activar perfil, links de conexión y envío de respuestas omnicanal.",
    });
  }

  const [profilesRes, accountsRes, webhooksRes, numbersRes] = await Promise.all([
    zernioFetch<{ profiles?: Array<Record<string, unknown>> }>("/profiles"),
    zernioFetch<{ accounts?: Array<Record<string, unknown>> }>("/accounts"),
    zernioFetch<{ webhooks?: Array<Record<string, unknown>>; settings?: Array<Record<string, unknown>> }>(
      "/webhooks/settings"
    ),
    zernioFetch<{
      numbers?: Array<Record<string, unknown>>;
      connected?: Array<Record<string, unknown>>;
      sandbox?: Record<string, unknown> | null;
    }>("/phone-numbers"),
  ]);

  return NextResponse.json({
    configured: true,
    webhookUrl,
    supportedPlatforms: ZERNIO_SUPPORTED_PLATFORMS,
    profiles: profilesRes.ok ? profilesRes.data.profiles || [] : [],
    accounts: accountsRes.ok ? accountsRes.data.accounts || [] : [],
    webhooks: webhooksRes.ok
      ? webhooksRes.data.webhooks || webhooksRes.data.settings || []
      : [],
    phoneNumbers: numbersRes.ok ? numbersRes.data.numbers || [] : [],
    whatsappSandbox: numbersRes.ok ? numbersRes.data.sandbox || null : null,
    availableNumbers:
      (availableNumbersRes.data as { numbers?: unknown[]; available?: unknown[] }).numbers ||
      (availableNumbersRes.data as { numbers?: unknown[]; available?: unknown[] }).available ||
      [],
  });
}

export async function POST(request: Request) {
  if (!isZernioConfigured()) {
    return NextResponse.json(
      {
        error:
          "ZERNIO_API_KEY no está configurada aún. Inicia sesión en zernio.com, crea tu API key y agrégala al entorno.",
      },
      { status: 503 }
    );
  }

  try {
    const body = (await request.json()) as {
      action?:
        | "bootstrap_profile"
        | "create_connect_link"
        | "register_webhook"
        | "activate_whatsapp_sandbox"
        | "test_webhook";
      platform?: string;
      profileId?: string;
      phone?: string;
    };

    const siteUrl = getSiteUrl();
    const webhookUrl = `${siteUrl}/api/webhooks/zernio`;

    if (body.action === "bootstrap_profile") {
      const prof = await ensureCraZernioProfile();
      if (!prof.ok) {
        return NextResponse.json({ error: prof.error }, { status: prof.status });
      }
      return NextResponse.json({ ok: true, profile: prof.profile, created: prof.created });
    }

    if (body.action === "create_connect_link") {
      const platform = (body.platform || "instagram").toLowerCase();
      let profileId = body.profileId;
      if (!profileId) {
        const prof = await ensureCraZernioProfile();
        if (!prof.ok) return NextResponse.json({ error: prof.error }, { status: prof.status });
        profileId = prof.profile._id;
      }

      const linkRes = await createZernioConnectLink({
        platform,
        profileId,
        redirectUrl: `${siteUrl}/admin?tab=canales&connected=${encodeURIComponent(platform)}`,
      });
      if (!linkRes.ok) {
        return NextResponse.json(
          { error: linkRes.data.error || `No se pudo generar link para ${platform}.`, details: linkRes.data },
          { status: linkRes.status }
        );
      }
      return NextResponse.json({
        ok: true,
        platform,
        profileId,
        authUrl: linkRes.data.authUrl || linkRes.data.url || null,
        telegramCode: (linkRes.data as { code?: string }).code || null,
        telegramBot: (linkRes.data as { botUsername?: string }).botUsername || null,
        state: linkRes.data.state,
      });
    }

    if (body.action === "register_webhook") {
      const reg = await zernioFetch<Record<string, unknown>>("/webhooks/settings", {
        method: "POST",
        body: {
          name: "Manglar Vivo Atlántico · Reportes Ciudadanos",
          url: webhookUrl,
          events: ["message.received"],
          isActive: true,
        },
      });
      if (!reg.ok) {
        return NextResponse.json(
          { error: (reg.data.error as string) || "No se pudo registrar el webhook en Zernio.", details: reg.data },
          { status: reg.status }
        );
      }
      return NextResponse.json({ ok: true, webhookUrl, webhook: reg.data });
    }

    if (body.action === "activate_whatsapp_sandbox") {
      const phone = (body.phone || "").trim();
      if (!/^\+\d{8,15}$/.test(phone)) {
        return NextResponse.json(
          { error: "Ingresa el número de WhatsApp en formato internacional E.164 (ej. +573001234567)." },
          { status: 400 }
        );
      }
      const res = await zernioFetch<Record<string, unknown>>("/whatsapp/sandbox/sessions", {
        method: "POST",
        body: { phone },
      });
      if (!res.ok) {
        return NextResponse.json(
          { error: (res.data.error as string) || "No se pudo iniciar la sesión sandbox de WhatsApp.", details: res.data },
          { status: res.status }
        );
      }
      return NextResponse.json({
        ok: true,
        message: `Te enviamos un mensaje de WhatsApp a ${phone} desde el número sandbox de Zernio. Respóndelo para activar el canal 7 días gratis.`,
        session: res.data,
      });
    }

    return NextResponse.json({ error: "Acción Zernio no reconocida." }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error procesando acción Zernio." },
      { status: 500 }
    );
  }
}
