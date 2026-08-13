import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Encabezado } from "@/components/encabezado";
import { PieDePagina } from "@/components/pie-de-pagina";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AquíVe · Ayuda directa en Colombia",
  description:
    "Solicita insumos o servicios profesionales tras el sismo del 10 de agosto de 2026, sin dar datos personales.",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, title: "AquíVe", statusBarStyle: "default" },
  icons: { icon: "/icono-192.png", apple: "/icono-192.png" },
};

export const viewport: Viewport = {
  themeColor: "#b45309",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {/* Primer tabulador para quien navega con teclado o lector de pantalla */}
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-3 focus:text-primary-foreground"
        >
          Saltar al contenido
        </a>
        <Encabezado />
        <div id="contenido" className="flex-1">
          {children}
        </div>
        <PieDePagina />
      </body>
    </html>
  );
}
