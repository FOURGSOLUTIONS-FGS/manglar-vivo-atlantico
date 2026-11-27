import type { DispatchPayload } from "./types";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildAlertEmailSubject(payload: DispatchPayload): string {
  const { classification, report, isManualTest } = payload;
  const prefix = isManualTest ? "[PRUEBA] " : "";
  const levelTag =
    classification.level === "urgente"
      ? "URGENTE CRA"
      : classification.level === "alta"
      ? "PRIORITARIA CRA"
      : classification.level === "verificacion"
      ? "828 HA VERIFICADA"
      : "REVISIÓN CRA";
  return `${prefix}${levelTag} · ${report.municipio} · ${report.trackingCode}`;
}

/**
 * Correo ejecutivo compacto (lectura en 5 segundos en celular) con galería multi-foto (hasta 3 ángulos).
 */
export function buildAlertEmailHtml(payload: DispatchPayload): string {
  const { report, classification, baseUrl, isManualTest } = payload;
  const mapsUrl = `https://www.google.com/maps?q=${report.latitud},${report.longitud}`;
  const adminUrl = `${baseUrl.replace(/\/$/, "")}/admin?code=${encodeURIComponent(report.trackingCode)}`;

  const photos = Array.from(
    new Set(
      [
        ...(report.evidenciaFotosUrls || []),
        ...(report.evidenciaFotoUrl ? [report.evidenciaFotoUrl] : []),
      ].filter(Boolean)
    )
  ).slice(0, 3);

  const photoGrid =
    photos.length > 0
      ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:14px 0;">
           <tr>
             ${photos
               .map(
                 (url, i) =>
                   `<td style="padding:${i === 0 ? "0 4px 0 0" : i === photos.length - 1 ? "0 0 0 4px" : "0 4px"};width:${Math.floor(100 / photos.length)}%;">
                      <img src="${escapeHtml(url)}" alt="Evidencia ${i + 1}" style="width:100%;height:${photos.length === 1 ? "210px" : "136px"};object-fit:cover;border-radius:8px;border:1px solid #CBD5E1;display:block;" />
                    </td>`
               )
               .join("")}
           </tr>
         </table>`
      : "";

  const recipientsInline = classification.recipients
    .map((r) => escapeHtml(r.kidRoleLabel))
    .join(" · ");

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#EDF2F6;font-family:Lato,'Helvetica Neue',Arial,sans-serif;color:#041A29;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#EDF2F6;padding:18px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="540" cellspacing="0" cellpadding="0" style="max-width:540px;width:100%;background:#FFFFFF;border-radius:10px;overflow:hidden;border:1px solid #CBD5E1;">
          <!-- Barra superior compacta -->
          <tr>
            <td style="background:#041A29;padding:16px 20px;border-bottom:3px solid #EDB512;">
              <table width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="color:#FFFFFF;font-size:15px;font-weight:900;">
                    MANGLAR VIVO · CRA ATLÁNTICO
                  </td>
                  <td align="right">
                    <span style="display:inline-block;background:${classification.colorHex};color:#FFFFFF;font-size:11px;font-weight:900;padding:4px 9px;border-radius:4px;">
                      ${escapeHtml(classification.badgeLabel)} · &lt;${classification.slaHours}h
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Cuerpo conciso -->
          <tr>
            <td style="padding:20px;">
              <h1 style="margin:0;font-size:19px;line-height:1.25;color:#041A29;font-weight:900;">
                ${escapeHtml(report.clasificacionTecnica || classification.kidFriendlyHeadline)}
              </h1>
              <p style="margin:6px 0 0 0;font-size:13px;color:#475569;">
                <strong style="color:#005F96;font-family:monospace;">${escapeHtml(report.trackingCode)}</strong>
                &nbsp;·&nbsp;${escapeHtml(report.municipio)}
                &nbsp;·&nbsp;Semáforo <strong style="color:${report.puntajeConfiabilidad >= 75 ? "#16794A" : "#C98206"};">${report.puntajeConfiabilidad}/100</strong>
                &nbsp;·&nbsp;${photos.length} foto${photos.length === 1 ? "" : "s"}
                ${report.isSimulatedGps ? `&nbsp;·&nbsp;<span style="background:#FEF3C7;color:#7C4F00;padding:1px 6px;border-radius:3px;font-weight:900;font-size:11px;">SIMULADO (DEMO)</span>` : ""}
                ${isManualTest ? `&nbsp;·&nbsp;<span style="background:#E0F2FE;color:#005F96;padding:1px 6px;border-radius:3px;font-weight:900;font-size:11px;">PRUEBA</span>` : ""}
              </p>

              ${photoGrid}

              <!-- 3 datos esenciales sin relleno -->
              <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:6px;font-size:12px;">
                <tr>
                  <td style="padding:8px 12px;border-bottom:1px solid #E2E8F0;color:#64748B;width:28%;">Sector CRA</td>
                  <td style="padding:8px 12px;border-bottom:1px solid #E2E8F0;font-weight:700;color:#041A29;">${escapeHtml(report.zonaManglar)}${report.accionPlan ? ` · ${escapeHtml(report.accionPlan)}` : ""}</td>
                </tr>
                <tr>
                  <td style="padding:8px 12px;border-bottom:1px solid #E2E8F0;color:#64748B;">Atienden</td>
                  <td style="padding:8px 12px;border-bottom:1px solid #E2E8F0;font-weight:700;color:#005F96;">${recipientsInline}</td>
                </tr>
                <tr>
                  <td style="padding:8px 12px;color:#64748B;">Nota / GPS</td>
                  <td style="padding:8px 12px;color:#041A29;">${escapeHtml((report.descripcionCiudadana || "Sin nota adicional").slice(0, 140))} <span style="font-family:monospace;color:#64748B;">(${report.latitud}, ${report.longitud})</span></td>
                </tr>
              </table>

              <!-- Botones directos -->
              <table cellspacing="0" cellpadding="0" style="margin-top:16px;">
                <tr>
                  <td style="padding-right:8px;">
                    <a href="${adminUrl}" style="display:inline-block;background:#005F96;color:#FFFFFF;text-decoration:none;font-size:13px;font-weight:900;padding:10px 16px;border-radius:6px;">
                      Atender en /admin →
                    </a>
                  </td>
                  <td>
                    <a href="${mapsUrl}" style="display:inline-block;background:#EDB512;color:#041A29;text-decoration:none;font-size:13px;font-weight:900;padding:10px 14px;border-radius:6px;">
                      Ver GPS en Maps
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Pie de 1 línea -->
          <tr>
            <td style="background:#041A29;padding:11px 20px;color:#CBD5E1;font-size:11px;">
              Manglar Vivo Atlántico · Datos anonimizados Ley 1581 de 2012 · Filtro IA anti-falsos activo.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildAlertEmailText(payload: DispatchPayload): string {
  const { report, classification, baseUrl } = payload;
  const photosCount = (report.evidenciaFotosUrls?.length || (report.evidenciaFotoUrl ? 1 : 0));
  return [
    `${classification.badgeLabel} (<${classification.slaHours}h) — ${report.trackingCode}`,
    `${report.clasificacionTecnica || classification.kidFriendlyHeadline}`,
    `Sector: ${report.zonaManglar} (${report.municipio}) | Semáforo: ${report.puntajeConfiabilidad}/100 | Fotos: ${photosCount}`,
    `GPS: ${report.latitud}, ${report.longitud}${report.isSimulatedGps ? " [SIMULADO DEMO]" : ""}`,
    `Atienden: ${classification.recipients.map((r) => r.kidRoleLabel).join(" · ")}`,
    `Admin: ${baseUrl.replace(/\/$/, "")}/admin?code=${report.trackingCode}`,
    `Maps: https://www.google.com/maps?q=${report.latitud},${report.longitud}`,
  ].join("\n");
}
