import type { Metadata, Viewport } from "next";
import { Archivo, Lato } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { SwRegister } from "@/components/SwRegister";
import { SmoothScroll } from "@/components/SmoothScroll";

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
  variable: "--font-archivo",
  display: "swap",
});

const lato = Lato({
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  variable: "--font-lato",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://manglar.arpadura.com"),
  title: {
    default: "Manglar Vivo Atlántico · Ciencia Ciudadana y Alerta Satelital CRA",
    template: "%s · Manglar Vivo Atlántico",
  },
  description:
    "Reporta sin internet, explora con estaciones NFC, audita fotos con IA y monitorea focos de calor NASA en los manglares del Atlántico (CRA).",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/images/favicon-64.png", sizes: "64x64", type: "image/png" },
      { url: "/images/pwa-icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/images/pwa-icon-192.png", sizes: "192x192", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    locale: "es_CO",
    url: "https://manglar.arpadura.com",
    siteName: "Manglar Vivo Atlántico · CRA",
    title: "Manglar Vivo Atlántico · Protege las 828 ha de Manglar",
    description:
      "Ciencia ciudadana sin internet, Pasaporte NFC, WhatsApp interactivo con IA y monitoreo satelital NASA + Sentinel-2 para la CRA Atlántico.",
    images: [
      {
        url: "/api/og",
        width: 1200,
        height: 630,
        alt: "Manglar Vivo Atlántico · CRA",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Manglar Vivo Atlántico · Ciencia Ciudadana CRA",
    description:
      "Reporta en 3 pasos sin internet, explora estaciones NFC y consulta alertas satelitales NASA en vivo.",
    images: ["/api/og"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Manglar Vivo",
  },
};

export const viewport: Viewport = {
  themeColor: "#041A29",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${archivo.variable} ${lato.variable}`}>
      <body className="min-h-screen antialiased">
        <SwRegister />
        <SmoothScroll />
        <Navbar />
        <main className="min-h-screen pb-24 md:pb-0">{children}</main>
      </body>
    </html>
  );
}
