import type { Metadata, Viewport } from "next";
import { Figtree, Caprasimo, Geist_Mono } from "next/font/google";
import "./globals.css";
import { CORREO_CONTACTO } from "@/lib/config";
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
  // El título de la portada es EXACTAMENTE el nombre, sin sufijo. La
  // verificación de la marca de Google está automatizada y compara el
  // nombre de la pantalla de consentimiento con «el nombre de tu portada»,
  // que para una máquina es el <title>, no el encabezado: con
  // «AquíVe · Ayuda directa en Colombia» no coincidía.
  //
  // El resto de páginas conserva el sufijo por la plantilla, así que en una
  // pestaña se sigue sabiendo de qué sitio se trata.
  title: {
    default: "AquíVe",
    template: "%s · AquíVe",
  },
  applicationName: "AquíVe",
  openGraph: {
    type: "website",
    siteName: "AquíVe",
    title: "AquíVe",
    description:
      "AquíVe conecta a quien necesita insumos tras el sismo del 10 de agosto de 2026 en Colombia con quien puede entregarlos.",
    url: "https://aquive.co/",
    locale: "es_CO",
  },
  // Empieza por el nombre y dice qué es, no solo qué se puede hacer. Es la
  // misma frase de la portada: si quien lee esto es un revisor automático,
  // encuentra lo mismo en los dos sitios.
  description:
    "AquíVe conecta a quien necesita insumos tras el sismo del 10 de agosto de 2026 en Colombia con quien puede entregarlos. Pedir ayuda no exige dar datos personales.",
  manifest: "/manifest.json",
  // Verificación de propiedad del dominio ante Google. Hace falta para que
  // Google apruebe la marca de la pantalla de consentimiento OAuth: sin
  // ella, quien entra con Google ve el identificador del proyecto de
  // Supabase en vez de "AquíVe", que parece phishing.
  //
  // NO LA QUITES una vez verificado. Google revalida cada tanto y si la
  // etiqueta desaparece se pierde la verificación, y con ella la marca.
  //
  // El código sale de Search Console → propiedad `https://aquive.co` →
  // método "Etiqueta HTML". Va sin el `<meta>`, solo el valor del content.
  verification: { google: "T8UgXRMUCyiQScl5ukVyVg5oLL6tkv38cYDv7GKdIEQ" },
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

// Datos estructurados: el nombre y el propósito en el formato que lee una
// máquina, que es quien está revisando la marca de Google. Dicen lo mismo
// que el <title>, la descripción y el encabezado de la portada — si alguna
// vez dejan de coincidir, el que manda es lo que se ve en pantalla.
const DATOS_ESTRUCTURADOS = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "AquíVe",
  url: "https://aquive.co/",
  inLanguage: "es-CO",
  description:
    "AquíVe conecta a quien necesita insumos tras el sismo del 10 de agosto de 2026 en Colombia con quien puede entregarlos: alimentos, agua, aseo, abrigo y servicios de profesionales con matrícula.",
  publisher: {
    "@type": "Organization",
    name: "AquíVe",
    url: "https://aquive.co/",
    email: CORREO_CONTACTO,
    logo: "https://aquive.co/icono-512.png",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${figtree.variable} ${caprasimo.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/* El hueco de abajo es para `BarraInferior`, que va fija en el
          teléfono: sin él tapa el final de cada página y el pie entero. */}
      <body className="flex min-h-full flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] sm:pb-0">
        <script
          type="application/ld+json"
          // El objeto lo escribimos nosotros y no lleva nada de nadie: no
          // hay entrada de usuario que pueda escaparse por aquí.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(DATOS_ESTRUCTURADOS) }}
        />
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
