#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

// Cargar .env.local si existe
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, "");
    }
  }
}

const API_KEY = (process.env.ZERNIO_API_KEY || "").trim();
const BASE = "https://zernio.com/api/v1";
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://manglar.arpadura.com").replace(/\/$/, "");
const PLATFORM = (process.argv[2] || "instagram").toLowerCase();

if (!API_KEY) {
  console.error("Falta ZERNIO_API_KEY en .env.local o en el entorno.");
  console.error("1. Crea o inicia sesión en https://zernio.com");
  console.error("2. Genera una API Key en Dashboard → API Keys");
  console.error("3. Agrégala como ZERNIO_API_KEY=... en .env.local y vuelve a ejecutar.");
  process.exit(1);
}

async function zfetch(ep, init = {}) {
  const res = await fetch(`${BASE}${ep}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function main() {
  console.log("=== 1. Creando o recuperando perfil en Zernio ===");
  const externalId = "cra-atlantico-manglar-vivo";
  let profileId = null;

  const list = await zfetch(`/profiles?externalId=${encodeURIComponent(externalId)}`);
  if (list.ok && list.data.profiles?.length > 0) {
    profileId = list.data.profiles[0]._id;
    console.log(`✓ Perfil existente encontrado: ${list.data.profiles[0].name} (${profileId})`);
  } else {
    const created = await zfetch("/profiles", {
      method: "POST",
      body: JSON.stringify({
        name: "Manglar Vivo Atlántico · CRA",
        description: "Canales ciudadanos de monitoreo de manglares CRA Atlántico",
        color: "#005F96",
        externalId,
      }),
    });
    if (created.ok) {
      profileId = created.data.profile?._id || created.data._id;
      console.log(`✓ Perfil creado: Manglar Vivo Atlántico · CRA (${profileId})`);
    } else if (created.status === 409 && created.data.details?.existingProfileId) {
      profileId = created.data.details.existingProfileId;
      console.log(`✓ Perfil ya existía (${profileId})`);
    } else {
      console.error("✗ Error creando perfil:", created.status, created.data);
      process.exit(1);
    }
  }

  console.log(`\n=== 2. Generando connect link para plataforma: ${PLATFORM} ===`);
  const redirectUrl = `${SITE_URL}/admin?tab=canales&connected=${encodeURIComponent(PLATFORM)}`;
  const conn = await zfetch(
    `/connect/${encodeURIComponent(PLATFORM)}?profileId=${encodeURIComponent(profileId)}&redirect_url=${encodeURIComponent(redirectUrl)}`
  );
  if (conn.ok) {
    console.log(`✓ Connect Link (${PLATFORM}):\n  ${conn.data.authUrl || conn.data.url}`);
  } else {
    console.log(`ℹ Connect ${PLATFORM} respondió ${conn.status}:`, conn.data);
  }

  console.log("\n=== 3. Verificando WhatsApp Sandbox gratuito + números ===");
  const phones = await zfetch("/phone-numbers");
  if (phones.ok && phones.data.sandbox) {
    console.log("✓ WhatsApp Sandbox disponible:", phones.data.sandbox);
  }

  console.log("\n=== 4. Registrando Webhook entrante de reportes ciudadanos ===");
  const webhookUrl = `${SITE_URL}/api/webhooks/zernio`;
  const wh = await zfetch("/webhooks/settings", {
    method: "POST",
    body: JSON.stringify({
      name: "Manglar Vivo Atlántico · Reportes Ciudadanos",
      url: webhookUrl,
      events: ["message.received"],
      isActive: true,
    }),
  });
  if (wh.ok) {
    console.log(`✓ Webhook registrado en ${webhookUrl}`);
    if (wh.data.secret || wh.data.webhook?.secret) {
      console.log("  Guarda este secreto en ZERNIO_WEBHOOK_SECRET (mostrado una vez).");
    }
  } else {
    console.log(`ℹ Webhook status ${wh.status}:`, wh.data?.error || wh.data);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
