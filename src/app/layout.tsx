import type { Metadata, Viewport } from "next";
import { Figtree, Caprasimo, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Encabezado } from "@/components/encabezado";
import { PieDePagina } from "@/components/pie-de-pagina";

// Cuerpo. Reemplaza a Geist: misma legibilidad en Android viejo, curvas
// más humanas.
const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
});

// Solo títulos (h1 y h2). Un solo peso, y nunca en párrafos ni en botones.
const caprasimo = Caprasimo({
  variable: "--font-caprasimo",
  weight: "400",
  subsets: ["latin"],
});

// Se queda: es la que muestra los códigos de solicitud.
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
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icono-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/icono-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#8c491a",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${figtree.variable} ${caprasimo.variable} ${geistMono.variable} h-full antialiased`}
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
