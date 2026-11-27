import type { Metadata, Viewport } from "next";
import { Fraunces, Lato } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { SwRegister } from "@/components/SwRegister";

const lato = Lato({
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  variable: "--font-lato",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["500", "700", "900"],
  variable: "--font-fraunces",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Manglar Vivo Atlántico — Ciencia Ciudadana CRA",
  description:
    "Plataforma offline-first de ciencia ciudadana, validación territorial y gobernanza para los manglares del departamento del Atlántico (CRA).",
  manifest: "/manifest.json",
  icons: {
    icon: "/images/pwa-icon-192.png",
    apple: "/images/pwa-icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#005F96",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${lato.variable} ${fraunces.variable}`}>
      <body className="coastal-grain min-h-[100dvh] pb-24 md:pb-12">
        <SwRegister />
        <Navbar />
        <main>{children}</main>
      </body>
    </html>
  );
}
