import { ImageResponse } from "next/og";

export const runtime = "nodejs";

function latLonToWorldTile(lat: number, lon: number, zoom: number) {
  const n = Math.pow(2, zoom);
  const xFloat = ((lon + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const yFloat =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  return { xFloat, yFloat };
}

async function fetchTileDataUrl(z: number, x: number, y: number): Promise<string | null> {
  const url = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "ManglarVivoAtlanticoCRA/1.0" },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return `data:image/jpeg;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat") ?? "10.8719");
  const lon = Number(searchParams.get("lon") ?? "-75.0972");
  const zoomRaw = Number(searchParams.get("zoom") ?? "14");
  const zoom = Number.isFinite(zoomRaw) ? Math.min(16, Math.max(11, Math.round(zoomRaw))) : 14;
  const label = (searchParams.get("label") || "Atlántico Costero").slice(0, 44);
  const rawColor = (searchParams.get("color") || "C84023").replace(/[^0-9A-Fa-f]/g, "");
  const pinColor = rawColor.length === 6 ? `#${rawColor}` : "#C84023";

  const safeLat = Number.isFinite(lat) ? lat : 10.8719;
  const safeLon = Number.isFinite(lon) ? lon : -75.0972;

  const WIDTH = 600;
  const HEIGHT = 230;
  const TILE_SIZE = 256;

  // Calcular mosaico 3x3 centrado en el punto exacto para que el pin caiga en el centro (300, 115)
  const { xFloat, yFloat } = latLonToWorldTile(safeLat, safeLon, zoom);
  const centerTileX = Math.floor(xFloat);
  const centerTileY = Math.floor(yFloat);
  const offsetXInTile = (xFloat - centerTileX) * TILE_SIZE;
  const offsetYInTile = (yFloat - centerTileY) * TILE_SIZE;

  const tileCoords: Array<{ dx: number; dy: number; x: number; y: number }> = [];
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      tileCoords.push({ dx, dy, x: centerTileX + dx, y: centerTileY + dy });
    }
  }

  const fetched = await Promise.all(
    tileCoords.map(async (t) => ({
      ...t,
      dataUrl: await fetchTileDataUrl(zoom, t.x, t.y),
    }))
  );

  // Posición base de la esquina superior izquierda del tile central para centrar el pin en (WIDTH/2, HEIGHT/2)
  const originLeft = Math.round(WIDTH / 2 - offsetXInTile);
  const originTop = Math.round(HEIGHT / 2 - offsetYInTile);

  const img = new ImageResponse(
    (
      <div
        style={{
          width: `${WIDTH}px`,
          height: `${HEIGHT}px`,
          display: "flex",
          position: "relative",
          overflow: "hidden",
          backgroundColor: "#041A29",
          fontFamily: "sans-serif",
        }}
      >
        {/* Mosaico satelital real Esri World Imagery */}
        {fetched.map((t) =>
          t.dataUrl ? (
            <img
              key={`${t.x}-${t.y}`}
              src={t.dataUrl}
              width={TILE_SIZE}
              height={TILE_SIZE}
              style={{
                position: "absolute",
                left: `${originLeft + t.dx * TILE_SIZE}px`,
                top: `${originTop + t.dy * TILE_SIZE}px`,
                width: `${TILE_SIZE}px`,
                height: `${TILE_SIZE}px`,
              }}
            />
          ) : null
        )}

        {/* Viñeta sutil para legibilidad de etiquetas */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, rgba(4,26,41,0.38) 0%, rgba(4,26,41,0.06) 45%, rgba(4,26,41,0.68) 100%)",
            display: "flex",
          }}
        />

        {/* Anillo de radar + Pin central exacto */}
        <div
          style={{
            position: "absolute",
            left: `${WIDTH / 2 - 34}px`,
            top: `${HEIGHT / 2 - 34}px`,
            width: "68px",
            height: "68px",
            borderRadius: "999px",
            backgroundColor: `${pinColor}40`,
            border: `2px solid ${pinColor}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: "22px",
              height: "22px",
              borderRadius: "999px",
              backgroundColor: pinColor,
              border: "3px solid #FFFFFF",
              boxShadow: "0 4px 12px rgba(0,0,0,0.45)",
              display: "flex",
            }}
          />
        </div>

        {/* Etiqueta superior derecha: Satélite CRA */}
        <div
          style={{
            position: "absolute",
            top: "12px",
            right: "12px",
            backgroundColor: "rgba(4,26,41,0.86)",
            color: "#F8D86F",
            padding: "5px 10px",
            borderRadius: "6px",
            fontSize: "11px",
            fontWeight: 700,
            border: "1px solid rgba(255,255,255,0.22)",
            display: "flex",
          }}
        >
          SATÉLITE CRA · TOCA PARA ABRIR MAPS
        </div>

        {/* Pie izquierdo con ubicación clara */}
        <div
          style={{
            position: "absolute",
            bottom: "12px",
            left: "12px",
            right: "12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              backgroundColor: "rgba(4,26,41,0.88)",
              color: "#FFFFFF",
              padding: "6px 12px",
              borderRadius: "6px",
              fontSize: "13px",
              fontWeight: 700,
              border: "1px solid rgba(255,255,255,0.2)",
              display: "flex",
              alignItems: "center",
            }}
          >
            {label}
          </div>
          <div
            style={{
              backgroundColor: "rgba(4,26,41,0.82)",
              color: "#E2E8F0",
              padding: "5px 9px",
              borderRadius: "6px",
              fontSize: "11px",
              fontWeight: 700,
              display: "flex",
            }}
          >
            {safeLat.toFixed(4)}° N, {Math.abs(safeLon).toFixed(4)}° O
          </div>
        </div>
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
      headers: {
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    }
  );

  return img;
}
