import { NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export interface IoTStationSpec {
  stationId: string;
  sectorId: number;
  nombre: string;
  municipio: string;
  operador: string;
  fechaInstalacion: string;
  estado: "en_vivo" | "ultima_disponible" | "inactiva_lista_api";
  ultimaLecturaAt: string | null;
  notaRigurosa: string;
  variables: {
    conductividad_us_cm: number | null;
    salinidad_psu: number | null;
    temperatura_c: number | null;
    ph: number | null;
    nivel_agua_m: number | null;
    oxigeno_disuelto_mg_l: number | null;
  };
}

// Estado inicial honesto basado en documentación de Hernando (Ecoparque Mallorquín / Uninorte / CRA, 13/12/2024):
// Las estaciones existen físicamente pero se encuentran inactivas / pendientes de reactivación y conexión API.
// NUNCA inventamos mediciones en vivo cuando no hay telemetría conectada.
const STATION_STORE: Record<string, IoTStationSpec> = {
  "mallorquin-sendero-1": {
    stationId: "mallorquin-sendero-1",
    sectorId: 1,
    nombre: "Estación Ecoparque Ciénaga de Mallorquín (Datalogger #1)",
    municipio: "Barranquilla – Puerto Colombia",
    operador: "Red CRA · Universidad del Norte (instalación 13/12/2024)",
    fechaInstalacion: "2024-12-13",
    estado: "inactiva_lista_api",
    ultimaLecturaAt: null,
    notaRigurosa:
      "Estación documentada en muelle con caja de paso 110 VAC y sensores EC/temperatura, pH y nivel. Actualmente inactiva; lista para recibir lecturas reales por POST /api/telemetry.",
    variables: {
      conductividad_us_cm: null,
      salinidad_psu: null,
      temperatura_c: null,
      ph: null,
      nivel_agua_m: null,
      oxigeno_disuelto_mg_l: null,
    },
  },
  "puerto-velero-muelle": {
    stationId: "puerto-velero-muelle",
    sectorId: 2,
    nombre: "Estación Estuarina Puerto Velero – Balboa",
    municipio: "Puerto Colombia",
    operador: "Red CRA · Monitoreo Costero",
    fechaInstalacion: "Pendiente despliegue",
    estado: "inactiva_lista_api",
    ultimaLecturaAt: null,
    notaRigurosa:
      "Sin datalogger conectado aún. Endpoint abierto para integración de sondas fisicoquímicas (conductividad, salinidad, temperatura, pH y nivel).",
    variables: {
      conductividad_us_cm: null,
      salinidad_psu: null,
      temperatura_c: null,
      ph: null,
      nivel_agua_m: null,
      oxigeno_disuelto_mg_l: null,
    },
  },
  "juan-acosta-estuario": {
    stationId: "juan-acosta-estuario",
    sectorId: 3,
    nombre: "Estación Prioritaria Estuario Juan de Acosta – Tubará",
    municipio: "Tubará – Juan de Acosta",
    operador: "Red CRA · Prioridad Sequía 2026",
    fechaInstalacion: "Pendiente despliegue",
    estado: "inactiva_lista_api",
    ultimaLecturaAt: null,
    notaRigurosa:
      "Sin sensor conectado en vivo. Cuando se reactive la red IoT, cada foto ciudadana tomada en el NFC #03 quedará vinculada automáticamente al timestamp de la lectura.",
    variables: {
      conductividad_us_cm: null,
      salinidad_psu: null,
      temperatura_c: null,
      ph: null,
      nivel_agua_m: null,
      oxigeno_disuelto_mg_l: null,
    },
  },
  "totumo-astilleros": {
    stationId: "totumo-astilleros",
    sectorId: 4,
    nombre: "Estación Ciénaga del Totumo – Astilleros",
    municipio: "Piojó",
    operador: "Red CRA · Validación 828 ha",
    fechaInstalacion: "Pendiente despliegue",
    estado: "inactiva_lista_api",
    ultimaLecturaAt: null,
    notaRigurosa:
      "Sin lectura instrumental en vivo. Lista para recibir paquetes JSON desde dataloggers o repositorios oficiales (INVEMAR/REDCAM/IDEAM) distinguiendo dato histórico vs. actual.",
    variables: {
      conductividad_us_cm: null,
      salinidad_psu: null,
      temperatura_c: null,
      ph: null,
      nivel_agua_m: null,
      oxigeno_disuelto_mg_l: null,
    },
  },
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const stationId = searchParams.get("station_id");

  if (stationId && STATION_STORE[stationId]) {
    return NextResponse.json({
      station: STATION_STORE[stationId],
      schema_version: "cra-iot-v1",
    });
  }

  return NextResponse.json({
    stations: Object.values(STATION_STORE),
    schema_version: "cra-iot-v1",
    supported_variables: [
      { key: "conductividad_us_cm", label: "Conductividad", unit: "µS/cm" },
      { key: "salinidad_psu", label: "Salinidad", unit: "PSU" },
      { key: "temperatura_c", label: "Temperatura", unit: "°C" },
      { key: "ph", label: "pH", unit: "pH" },
      { key: "nivel_agua_m", label: "Nivel de agua", unit: "m" },
      { key: "oxigeno_disuelto_mg_l", label: "Oxígeno disuelto (extensión)", unit: "mg/L" },
    ],
  });
}

export async function POST(request: Request) {
  const rl = checkRateLimit({
    key: `telemetry:${getClientIp(request)}`,
    maxRequests: 60,
    windowMs: 5 * 60 * 1000,
  });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  // Protección simple por token opcional si la CRA configura TELEMETRY_API_KEY
  const expectedKey = process.env.TELEMETRY_API_KEY?.trim();
  if (expectedKey) {
    const provided = request.headers.get("x-telemetry-key") || "";
    if (provided !== expectedKey) {
      return NextResponse.json({ error: "Unauthorized telemetry key" }, { status: 401 });
    }
  }

  try {
    const body = (await request.json()) as {
      station_id?: string;
      conductividad_us_cm?: number | null;
      salinidad_psu?: number | null;
      temperatura_c?: number | null;
      ph?: number | null;
      nivel_agua_m?: number | null;
      oxigeno_disuelto_mg_l?: number | null;
      measured_at?: string;
    };

    const target = body.station_id ? STATION_STORE[body.station_id] : null;
    if (!target) {
      return NextResponse.json(
        { error: "station_id inválido. Usa mallorquin-sendero-1, puerto-velero-muelle, juan-acosta-estuario o totumo-astilleros." },
        { status: 400 }
      );
    }

    const numOrNull = (v: unknown) =>
      typeof v === "number" && Number.isFinite(v) ? Number(v.toFixed(2)) : null;

    target.variables = {
      conductividad_us_cm: numOrNull(body.conductividad_us_cm),
      salinidad_psu: numOrNull(body.salinidad_psu),
      temperatura_c: numOrNull(body.temperatura_c),
      ph: numOrNull(body.ph),
      nivel_agua_m: numOrNull(body.nivel_agua_m),
      oxigeno_disuelto_mg_l: numOrNull(body.oxigeno_disuelto_mg_l),
    };
    target.estado = "en_vivo";
    target.ultimaLecturaAt = body.measured_at || new Date().toISOString();

    return NextResponse.json({ ok: true, station: target }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Payload JSON inválido" }, { status: 400 });
  }
}
