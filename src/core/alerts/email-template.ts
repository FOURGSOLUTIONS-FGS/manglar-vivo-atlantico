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
      ? "ALERTA URGENTE CRA"
      : classification.level === "alta"
      ? "ALERTA PRIORITARIA CRA"
      : classification.level === "verificacion"
      ? "VERIFICACIÓN 828 HA"
      : "REPORTE EN REVISIÓN";
  return `${prefix}${levelTag} · ${report.trackingCode} · ${report.municipio}`;
}

export function buildAlertEmailHtml(payload: DispatchPayload): string {
  const { report, classification, recipientGroup, baseUrl, isManualTest } = payload;
  const mapsUrl = `https://www.google.com/maps?q=${report.latitud},${report.longitud}`;
  const adminUrl = `${baseUrl.replace(/\/$/, "")}/admin?code=${encodeURIComponent(report.trackingCode)}`;
  const craUrl = `${baseUrl.replace(/\/$/, "")}/cra`;

  const recipientsList = classification.recipients
    .map(
      (r) =>
        `<li style="margin:0 0 6px 0;color:#041A29;font-size:13px;"><strong>${escapeHtml(r.name)}</strong> — ${escapeHtml(r.kidRoleLabel)} <span style="color:#005F96;">(${escapeHtml(r.slaLabel)})</span></li>`
    )
    .join("");

  const simulatedBanner = report.isSimulatedGps
    ? `<div style="margin:16px 0;padding:10px 14px;background:#FEF3C7;border:1px solid #EDB512;border-radius:6px;font-size:12px;color:#041A29;font-weight:700;">⚠ PUNTO MARCADO COMO SIMULADO (DEMO) — Reporte de demostración territorial.</div>`
    : "";

  const photoBlock = report.evidenciaFotoUrl
    ? `<div style="margin:18px 0;">
         <img src="${escapeHtml(report.evidenciaFotoUrl)}" alt="Evidencia fotográfica ${escapeHtml(report.trackingCode)}" style="width:100%;max-height:280px;object-fit:cover;border-radius:8px;border:1px solid #CBD5E1;display:block;" />
       </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#EDF2F6;font-family:Lato,'Helvetica Neue',Arial,sans-serif;color:#041A29;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#EDF2F6;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:#FFFFFF;border-radius:12px;overflow:hidden;border:1px solid #CBD5E1;">
          <!-- Cabecera Institucional CRA -->
          <tr>
            <td style="background:#041A29;padding:22px 26px;border-bottom:3px solid #EDB512;">
              <table width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="color:#FFFFFF;font-size:18px;font-weight:900;letter-spacing:-0.02em;">
                    MANGLAR VIVO ATLÁNTICO
                    <div style="color:#F8D86F;font-size:12px;font-weight:700;margin-top:4px;">
                      Sistema de Alerta Temprana y Gobernanza · CRA Atlántico
                    </div>
                  </td>
                  <td align="right" style="vertical-align:top;">
                    <span style="display:inline-block;background:${classification.colorHex};color:#FFFFFF;font-size:11px;font-weight:900;padding:6px 10px;border-radius:4px;letter-spacing:0.04em;">
                      ${escapeHtml(classification.badgeLabel)}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Cuerpo principal -->
          <tr>
            <td style="padding:26px;">
              ${
                isManualTest
                  ? `<div style="margin:0 0 16px 0;padding:10px 14px;background:#E0F2FE;border:1px solid #005F96;border-radius:6px;font-size:12px;color:#041A29;"><strong>Correo de verificación en vivo</strong> enviado desde el Centro de Mando CRA para comprobar la recepción de alertas urgentes.</div>`
                  : ""
              }

              <h1 style="margin:0 0 8px 0;font-size:22px;line-height:1.2;color:#041A29;font-weight:900;">
                ${escapeHtml(classification.kidFriendlyHeadline)}
              </h1>
              <p style="margin:0 0 18px 0;font-size:14px;line-height:1.55;color:#334155;">
                ${escapeHtml(classification.kidFriendlyExplanation)}
              </p>

              ${simulatedBanner}
              ${photoBlock}

              <!-- Ficha técnica resumida -->
              <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:16px 0;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;">
                <tr>
                  <td style="padding:12px 14px;border-bottom:1px solid #E2E8F0;font-size:12px;color:#64748B;width:38%;">Código de seguimiento</td>
                  <td style="padding:12px 14px;border-bottom:1px solid #E2E8F0;font-size:13px;font-weight:900;color:#005F96;font-family:monospace;">${escapeHtml(report.trackingCode)}</td>
                </tr>
                <tr>
                  <td style="padding:12px 14px;border-bottom:1px solid #E2E8F0;font-size:12px;color:#64748B;">Sector y municipio</td>
                  <td style="padding:12px 14px;border-bottom:1px solid #E2E8F0;font-size:13px;font-weight:700;color:#041A29;">${escapeHtml(report.zonaManglar)} · ${escapeHtml(report.municipio)}</td>
                </tr>
                <tr>
                  <td style="padding:12px 14px;border-bottom:1px solid #E2E8F0;font-size:12px;color:#64748B;">Clasificación técnica</td>
                  <td style="padding:12px 14px;border-bottom:1px solid #E2E8F0;font-size:13px;font-weight:700;color:#041A29;">${escapeHtml(report.clasificacionTecnica || report.tipoEvento)}</td>
                </tr>
                <tr>
                  <td style="padding:12px 14px;border-bottom:1px solid #E2E8F0;font-size:12px;color:#64748B;">Semáforo de confiabilidad</td>
                  <td style="padding:12px 14px;border-bottom:1px solid #E2E8F0;font-size:13px;font-weight:900;color:${report.puntajeConfiabilidad >= 75 ? "#16794A" : "#C98206"};">${report.puntajeConfiabilidad}/100 puntos</td>
                </tr>
                <tr>
                  <td style="padding:12px 14px;border-bottom:1px solid #E2E8F0;font-size:12px;color:#64748B;">Plan de Manejo / 828 ha</td>
                  <td style="padding:12px 14px;border-bottom:1px solid #E2E8F0;font-size:13px;color:#041A29;">${escapeHtml(report.accionPlan || "Cobertura costera CRA")}${report.enZonaPorRevisar ? " · Dentro de 828 ha por revisar" : ""}</td>
                </tr>
                <tr>
                  <td style="padding:12px 14px;font-size:12px;color:#64748B;">Coordenadas GPS</td>
                  <td style="padding:12px 14px;font-size:13px;font-family:monospace;color:#041A29;">${report.latitud}, ${report.longitud}</td>
                </tr>
              </table>

              <div style="margin:18px 0;padding:14px 16px;background:#EDF2F6;border-radius:8px;">
                <div style="font-size:12px;font-weight:900;color:#005F96;margin-bottom:8px;">
                  ¿Quién recibe y atiende esta alerta? (${escapeHtml(recipientGroup)})
                </div>
                <ul style="margin:0;padding-left:18px;">
                  ${recipientsList}
                </ul>
              </div>

              ${
                report.descripcionCiudadana
                  ? `<p style="margin:14px 0;font-size:13px;line-height:1.5;color:#334155;"><strong>Relato en campo:</strong> ${escapeHtml(report.descripcionCiudadana)}</p>`
                  : ""
              }

              <!-- Botones de acción -->
              <table cellspacing="0" cellpadding="0" style="margin:24px 0 8px 0;">
                <tr>
                  <td style="padding-right:10px;">
                    <a href="${adminUrl}" style="display:inline-block;background:#005F96;color:#FFFFFF;text-decoration:none;font-size:13px;font-weight:900;padding:12px 20px;border-radius:6px;">
                      Atender en Centro Admin CRA →
                    </a>
                  </td>
                  <td>
                    <a href="${mapsUrl}" style="display:inline-block;background:#EDB512;color:#041A29;text-decoration:none;font-size:13px;font-weight:900;padding:12px 18px;border-radius:6px;">
                      Abrir ubicación GPS
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Pie legal -->
          <tr>
            <td style="background:#041A29;padding:16px 26px;color:#CBD5E1;font-size:11px;line-height:1.5;">
              Enviado automáticamente por <a href="${craUrl}" style="color:#F8D86F;text-decoration:none;font-weight:700;">Manglar Vivo Atlántico</a>. Datos personales de ciudadanos protegidos conforme a la Ley 1581 de 2012. Tiempo objetivo de respuesta: ${classification.slaHours} h.
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
  return [
    `${classification.badgeLabel} — ${report.trackingCode}`,
    classification.kidFriendlyHeadline,
    "",
    `Sector: ${report.zonaManglar} (${report.municipio})`,
    `Clasificación: ${report.clasificacionTecnica || report.tipoEvento}`,
    `Confiabilidad: ${report.puntajeConfiabilidad}/100`,
    `GPS: ${report.latitud}, ${report.longitud}${report.isSimulatedGps ? " [SIMULADO DEMO]" : ""}`,
    `Relato: ${report.descripcionCiudadana || "Sin nota adicional"}`,
    `Siguiente paso: ${classification.nextStepSimple}`,
    "",
    `Panel Admin CRA: ${baseUrl.replace(/\/$/, "")}/admin?code=${report.trackingCode}`,
    `Google Maps: https://www.google.com/maps?q=${report.latitud},${report.longitud}`,
  ].join("\n");
}
