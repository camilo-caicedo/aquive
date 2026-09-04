import type { Metadata, Viewport } from "next";
import { Poppins, Montserrat, Geist_Mono } from "next/font/google";
import "./globals.css";
import { CORREO_CONTACTO } from "@/lib/config";
import { Encabezado } from "@/components/encabezado";
import { AvisoPruebas } from "@/components/aviso-pruebas";
import { PieDePagina } from "@/components/pie-de-pagina";
import { RastroDeNavegacion } from "@/components/volver";
import { ProveedorDeAvisos } from "@/components/avisos";
import { BarraDeCarga } from "@/components/barra-de-carga";

// Cuerpo (ADR 0002). Reemplaza a Figtree.
//
// PENDIENTE DE PRUEBA: Poppins es geométrica y confunde `I`, `l` y `1` en
// tamaños chicos. El piso del proyecto es 16 px en un teléfono viejo, y eso
// hay que verlo en un aparato real, no en un emulador. Si falla, el
// reemplazo es Archivo —la tercera opción del manual— y es este bloque, no
// más.
const poppins = Poppins({
  variable: "--font-poppins",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

// Titulares y etiquetas (ADR 0002). Reemplaza a Caprasimo. Los pesos altos
// son los que le dan la presencia de cartel que pide el manual; en etiquetas
// va en mayúsculas con letter-spacing, no aquí.
const montserrat = Montserrat({
  variable: "--font-montserrat",
  weight: ["600", "700", "800", "900"],
  subsets: ["latin"],
});

// Se queda: códigos de servicio, ID de carné y valores enmascarados.
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
      "Una red de vecinos donde quien necesita un servicio encuentra a quien lo ofrece, sin intermediarios. Sin comisiones, sin intermediar el pago.",
    url: "https://aquive.co/",
    locale: "es_CO",
  },
  // ⚠ Esta frase es la misma, palabra por palabra, en cinco sitios:
  // `page.tsx` (que es la fuente, porque es lo que se ve), aquí en
  // `metadata.description`, en `openGraph.description`, en
  // `DATOS_ESTRUCTURADOS.description` y en el README. Si dos dejan de
  // coincidir, la revisión de la marca de Google encuentra dos versiones de
  // qué es esto y vuelve a caer. Ya la rechazaron dos veces.
  //
  // Y dejó de hablar del sismo a propósito: la aplicación ya no es
  // temporal, y el módulo de Servicios —el trabajo de quien vive de su
  // oficio— no aparecía en ninguna descripción.
  description:
    "Una red de vecinos donde quien necesita un servicio encuentra a quien lo ofrece, sin intermediarios. Sin comisiones, sin intermediar el pago.",
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
  // Los tirantes de `robots.ts`. Aquel es una petición que un rastreador
  // puede ignorar; esto es una etiqueta en cada página, y se respeta más.
  //
  // Solo fuera de producción, y con spread condicional para que en
  // producción la clave no exista: un `index: true` explícito no aporta
  // nada y es una cosa más que puede quedarse mal puesta.
  ...(process.env.VERCEL_ENV !== "production"
    ? { robots: { index: false, follow: false } }
    : {}),
  appleWebApp: { capable: true, title: "AquíVe", statusBarStyle: "default" },
  // Todos salen del arte del diseñador con `node scripts/iconos.mjs`. Los de
  // 16 y 32 px no son el cuadrado reducido: son dibujos aparte, porque a ese
  // tamaño el completo es una mancha.
  icons: {
    icon: [
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icono-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: { url: "/apple-touch-icon.png", sizes: "180x180" },
  },
};

export const viewport: Viewport = {
  // El crema del fondo, no el lima: esto pinta la barra del sistema, y el
  // lima es la acción de una pantalla, no el color de la aplicación.
  themeColor: "#f5eee2",
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
    "Una red de vecinos donde quien necesita un servicio encuentra a quien lo ofrece, sin intermediarios. Sin comisiones, sin intermediar el pago.",
  publisher: {
    "@type": "Organization",
    name: "AquíVe",
    url: "https://aquive.co/",
    email: CORREO_CONTACTO,
    logo: "https://aquive.co/icono-512.png",
  },
};

export default function RootLayout({ children, modal }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${poppins.variable} ${montserrat.variable} ${geistMono.variable} h-full antialiased`}
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
        {/* El proveedor envuelve TODO lo que puede guardar algo, incluido
            `{modal}`: los formularios de flujo se abren interceptados y
            desde ahí también se guarda. */}
        <ProveedorDeAvisos>
          <RastroDeNavegacion />
          <AvisoPruebas />
          <Encabezado />
          <div id="contenido" className="flex-1">
            {children}
          </div>
          {/* ⚠ Va DESPUÉS de `#contenido` y no arriba del todo, aunque su
              barra sea `fixed` y le dé igual dónde esté: el esqueleto que
              monta al alargarse la espera ocupa el sitio de `#contenido` en
              esta columna, y ahí el encabezado, la barra y el pie le quedan
              donde tienen que quedarle sin una sola medida a mano. */}
          <BarraDeCarga />
          {/* Las pantallas interceptadas: la ficha y los formularios de flujo
              se abren encima de lo que ya estaba, sin desmontarlo. Fuera de
              una intercepción esto es `null`. Ver `hoja-modal.tsx`. */}
          {modal}
          <PieDePagina />
        </ProveedorDeAvisos>
      </body>
    </html>
  );
}
