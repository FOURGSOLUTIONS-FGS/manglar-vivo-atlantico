import { ImageResponse } from "next/og";
import fs from "node:fs";
import path from "node:path";

export const runtime = "nodejs";

function loadFileDataUrl(relPath: string, mime: string): string {
  try {
    const buf = fs.readFileSync(path.join(process.cwd(), "public", relPath));
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return "";
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = (searchParams.get("title") || "Manglar Vivo Atlántico").slice(0, 62);
  const subtitle = (
    searchParams.get("subtitle") ||
    "Reporta sin internet, explora con NFC y protege las 828 ha de manglar con la CRA."
  ).slice(0, 120);
  const badge = (searchParams.get("badge") || "CRA ATLÁNTICO · CIENCIA CIUDADANA").slice(0, 42);

  const backdrop = loadFileDataUrl("images/og-backdrop.jpg", "image/jpeg");
  const logo = loadFileDataUrl("images/pwa-icon-192.png", "image/png");

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          position: "relative",
          display: "flex",
          backgroundColor: "#041A29",
          overflow: "hidden",
          fontFamily: "sans-serif",
        }}
      >
        {backdrop ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={backdrop}
            alt=""
            style={{
              position: "absolute",
              inset: 0,
              width: "1200px",
              height: "630px",
              objectFit: "cover",
            }}
          />
        ) : null}

        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(90deg, rgba(4,26,41,0.96) 0%, rgba(4,26,41,0.88) 48%, rgba(4,26,41,0.35) 100%)",
          }}
        />

        <div
          style={{
            position: "relative",
            zIndex: 2,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%",
            height: "100%",
            padding: "54px 64px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logo}
                alt="Manglar Vivo"
                style={{
                  width: "76px",
                  height: "76px",
                  borderRadius: "18px",
                  border: "3px solid #EDB512",
                }}
              />
            ) : null}
            <div
              style={{
                display: "flex",
                padding: "10px 18px",
                borderRadius: "10px",
                backgroundColor: "rgba(0,95,150,0.85)",
                border: "2px solid #EDB512",
                color: "#F8D86F",
                fontSize: "18px",
                fontWeight: 800,
                letterSpacing: "1px",
              }}
            >
              {badge}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", maxWidth: "740px" }}>
            <div
              style={{
                fontSize: "62px",
                fontWeight: 900,
                lineHeight: 1.02,
                color: "#FFFFFF",
                letterSpacing: "-1px",
              }}
            >
              {title}
            </div>
            <div
              style={{
                marginTop: "20px",
                fontSize: "26px",
                fontWeight: 600,
                lineHeight: 1.35,
                color: "#DCE9F2",
              }}
            >
              {subtitle}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div
              style={{
                display: "flex",
                padding: "12px 24px",
                borderRadius: "10px",
                backgroundColor: "#EDB512",
                color: "#041A29",
                fontSize: "22px",
                fontWeight: 900,
              }}
            >
              manglar.arpadura.com
            </div>
            <div
              style={{
                display: "flex",
                padding: "12px 20px",
                borderRadius: "10px",
                backgroundColor: "rgba(4,26,41,0.82)",
                border: "2px solid rgba(134,239,172,0.5)",
                color: "#86EFAC",
                fontSize: "19px",
                fontWeight: 800,
              }}
            >
              Offline · WhatsApp IA · Satélite NASA
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=86400",
      },
    }
  );
}
