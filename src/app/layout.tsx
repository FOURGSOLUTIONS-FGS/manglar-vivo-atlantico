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
  title: "Manglar Vivo Atlántico · Monitoreo Ciudadano y Satelital CRA",
  description:
    "Plataforma offline-first de ciencia ciudadana, doble validación territorial y gobernanza de manglares del departamento del Atlántico (CRA).",
  manifest: "/manifest.json",
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
