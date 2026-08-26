'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  HandHeart,
  Stethoscope,
  PackageCheck,
  MessageSquare,
  UserRound,
} from 'lucide-react'

// Cuatro destinos y siempre los mismos. Los tres primeros son «qué hay»;
// el cuarto es «lo mío», que absorbe las dos bandejas personales, el
// perfil, la ficha de servicios y la coordinación cuando aplica.
//
// La quinta celda vuelve, por decisión del responsable (20 de agosto de
// 2026), y solo para quien tiene algo que coordinar. Se había quitado
// porque la barra cambiaba de forma según quién mirara —la misma app con
// dos mapas, y nadie podía decirle a otro «está en la cuarta celda»—, y
// eso sigue siendo cierto: es el precio que se paga a cambio de que quien
// coordina no tenga que entrar a «Lo mío» para llegar a su panel.
//
// ⚠ Lo que NO se relaja es la regla 8: se llama «Entregas», por lo que hay
// dentro, y no «Mi organización», que es un rol. Y no es capricho de
// estilo — `estado_encabezado.coordinacion` tiene dos valores y esa celda
// la ven los dos públicos: quien trabaja en una fundación y quien solo
// ofreció ayuda y tiene conversaciones abiertas. Al segundo, «Mi
// organización» le mentiría. Lo que los dos vienen a hacer aquí es
// coordinar una entrega.
//
// ⚠ Y tampoco cabía: a 360 px cinco celdas dan 68 px útiles, y «Mi
// organización» a 11,5 px mide unos 86. Con `whitespace-nowrap` se
// desbordaba, y sin él la etiqueta envuelve y los iconos vuelven a subir y
// bajar celda a celda, que es justo lo que ese `nowrap` vino a arreglar.
//
// «Lo mío» apunta a /mis-solicitudes y no a /registro a propósito:
// /registro rebota a /login sin sesión, y quien publicó una solicitud sin
// cuenta —que es el rol central de este sitio— se quedaría fuera de lo
// suyo. /registro cuelga de aquí a través de TAMBIEN.
const ENLACES = [
  // ⚠ Servicios es la portada desde el 20 de agosto de 2026, por decisión
  // del responsable: pasó tiempo desde el sismo y lo que queda vivo es la
  // reactivación económica. El módulo de emergencia no se retira —sigue
  // entero en /solicitudes— pero deja de ser lo primero que se ve.
  //
  // Un solo destino para las tres listas de «quién puede hacer algo por
  // mí»: oficios del rebusque, profesionales con matrícula y entidades.
  // Detrás son módulos distintos —y el primero tiene otro responsable del
  // tratamiento— pero para quien busca es la misma pregunta. Las tres se
  // reparten en `PestanasServicios`.
  { href: '/', etiqueta: 'Inicio', Icono: Stethoscope },
  // Los dos lados del directorio, uno en cada celda: quién presta un
  // servicio y quién está pidiendo uno. Antes el segundo era una sección
  // colgada del primero —/servicios/solicitudes— y no lo encontraba nadie.
  // Comunidad: el muro y «Hecho en el barrio». Son dos destinos nuevos que
  // sin celda propia no los encuentra nadie — se entra por el muro y desde
  // ahí se cruza al otro.
  { href: '/muro', etiqueta: 'Comunidad', Icono: HandHeart },
  // ⚠ Toda la emergencia en una sola celda. Eran dos destinos de la barra
  // —«Solicitudes» y «Quién ofrece»— más un segmentado propio dentro del
  // primero: tres capas de navegación para tres listas de la misma
  // pregunta, y encima compitiendo por sitio con el módulo de servicios,
  // que es el que hoy recibe a la gente. Las tres se reparten ahora en
  // `PestanasAyudas`.
  // ⚠ La emergencia sale de la barra (ADR 0003, decisión del 26 de agosto de
  // 2026): se entra a ella desde el inicio. No se retira nada —/ayudas sigue
  // entero— pero deja de gastar una de las cuatro celdas, que ahora las pide
  // el chat.
  { href: '/mensajes', etiqueta: 'Mensajes', Icono: MessageSquare },
  { href: '/mis-solicitudes', etiqueta: 'Perfil', Icono: UserRound },
]

// La quinta, antes de «Lo mío», y distinta según el público — que son dos
// y no se cruzan nunca:
//
//   · `organizacion` — el equipo de una fundación. Su sitio es /aliado, que
//     además de los hilos tiene el equipo, las solicitudes por atender y
//     los proveedores. Se llama «Entregas» por lo que se hace ahí.
//   · `coordinacion` — quien ofreció ayuda en una solicitud acompañada. No
//     pertenece a ninguna organización: lo suyo son sus conversaciones, y
//     viven en /coordinacion.
//
// Nadie ve las dos, así que la barra no cambia bajo los pies de nadie.
// ⚠ Aquí había DOS celdas llamadas «Mensajes» —esta y la de la barra fija—
// para quien coordinaba una entrega. Dos puertas al mismo cuarto, y ninguna
// con todos sus mensajes dentro. Las conversaciones acompañadas se fueron a
// /mensajes con el resto; queda solo la celda de quien trabaja en una
// fundación, que no es una bandeja sino su panel de trabajo.
const QUINTA = {
  organizacion: { href: '/aliado', etiqueta: 'Entregas', Icono: PackageCheck },
} as const

export type Coordinacion = keyof typeof QUINTA | null

function celdas(coordinacion: Coordinacion) {
  if (!coordinacion) return ENLACES
  return [...ENLACES.slice(0, -1), QUINTA[coordinacion], ENLACES[ENLACES.length - 1]]
}

// Rutas que marcan una celda sin colgar de ella.
//
// Las tres listas de servicios están repartidas en dos rutas —/servicios
// para los oficios, /servidores para profesionales y entidades— y las dos
// tienen que dejar la misma celda encendida. Sin esto, tocar
// «Profesionales» apaga la navegación entera y parece que uno se salió del
// sitio.
//
// Lo mismo con «Lo mío», que es un destino y no una ruta: el perfil y la
// pantalla de habeas data viven en rutas propias y las dos son «lo mío».
// /aliado ya no cuelga de aquí: tiene celda propia cuando corresponde.
const TAMBIEN: Record<string, string[]> = {
  // La portada es el directorio, así que las otras dos listas de la misma
  // pregunta cuelgan de ella, y también la puerta vieja /servicios y todo
  // lo que hay debajo: publicar una ficha, una ficha concreta, la demanda.
  // Todo lo que se entra a MIRAR cuelga del inicio, incluida la emergencia:
  // sale de la barra pero no del sitio, así que sus pantallas encienden
  // «Inicio» en vez de apagar las cuatro celdas.
  '/': [
    '/servicios',
    '/servidores',
    '/categorias',
    '/zonas',
    '/mapa',
    '/ayudas',
    '/ofertadores',
    '/publicar',
    '/responder',
    '/solicitudes',
  ],
  // Las otras dos listas de la emergencia, y los dos extremos de una
  // solicitud. /solicitud/[token] no está aquí: esa es la propia, y vive
  // en «Lo mío».
  // El muro y los productos son las dos caras de Comunidad.
  '/muro': ['/barrio'],
  // La ruta vieja de la bandeja acompañada redirige aquí, pero alguien puede
  // llegar por un enlace guardado.
  '/mensajes': ['/coordinacion'],
  // /solicitud/[token] es la pantalla de una solicitud propia: se llega
  // desde «Lo mío» y se vuelve ahí. Sin esta línea, abrir la solicitud
  // apagaba las cuatro celdas y la barra parecía de otra aplicación.
  // `/servicios/soy-proveedor` es la pestaña «Mi ficha», aunque su ruta
  // cuelgue del módulo de servicios: quien la abre viene a mirar lo suyo.
  '/mis-solicitudes': [
    '/registro',
    '/mis-datos',
    '/solicitud',
    '/servicios/soy-proveedor',
  ],
}

// Coincidencia exacta para la portada; por prefijo para el resto, para que
// /responder/ABCD siga marcando «Solicitudes».
//
// ⚠ La portada mira TAMBIEN igual que las demás. Antes cortocircuitaba con
// `return ruta === '/'`, y desde que el directorio vive ahí eso apagaba la
// celda entera al entrar a una ficha de servicios o a /servidores: la
// barra parecía de otra aplicación justo al dar el primer paso dentro del
// módulo que ahora recibe a todo el mundo.
// ⚠ Por segmentos y no por `startsWith` a secas. Con la comparación de
// texto pelada, /solicitudes encendía TAMBIÉN «Lo mío», porque de esa celda
// cuelga /solicitud —la solicitud propia— y una es prefijo de la otra. Lo
// mismo pasaría el día que alguien añada /servicio junto a /servicios.
function bajo(ruta: string, base: string) {
  return ruta === base || ruta.startsWith(base + '/')
}

/**
 * Cuánto de específica es la coincidencia de esta celda con la ruta, o -1
 * si no coincide.
 *
 * ⚠ Gana la MÁS LARGA, y eso no es refinamiento: hay rutas que caen bajo
 * dos celdas a la vez. `/servicios/soy-proveedor` está debajo de
 * `/servicios`, que cuelga de la portada, y a la vez es la pestaña «Mi
 * ficha» de «Lo mío». Con un `some` que devuelve al primero que dice que
 * sí, se encendían las dos celdas.
 */
function cuanCalza(ruta: string, href: string) {
  const bases = [...(TAMBIEN[href] ?? []), ...(href === '/' ? [] : [href])]
  let mejor = href === '/' && ruta === '/' ? 1 : -1
  for (const base of bases) {
    if (bajo(ruta, base) && base.length > mejor) mejor = base.length
  }
  return mejor
}

function celdaActiva(ruta: string, lista: readonly { href: string }[]) {
  let ganadora: string | null = null
  let mejor = -1
  for (const c of lista) {
    const cuanto = cuanCalza(ruta, c.href)
    if (cuanto > mejor) {
      mejor = cuanto
      ganadora = c.href
    }
  }
  return ganadora
}

/**
 * Cliente a propósito, pese al presupuesto de JS.
 *
 * Marcar la pestaña desde el servidor no funciona: el layout no se vuelve
 * a renderizar al navegar con Link, así que el encabezado se quedaba con
 * la ruta de la primera carga y subrayaba la pestaña equivocada.
 *
 * Solo para pantallas medianas y grandes. En un teléfono la navegación es
 * `BarraInferior`, aquí abajo.
 */
export function Navegacion({ coordinacion = null }: { coordinacion?: Coordinacion }) {
  const ruta = usePathname()
  const cual = celdaActiva(ruta, celdas(coordinacion))

  return (
    <nav aria-label="Secciones" className="mx-auto hidden max-w-3xl px-4 sm:block">
      <ul className="flex gap-1">
        {celdas(coordinacion).map(({ href, etiqueta, Icono }) => {
          const activa = href === cual
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={activa ? 'page' : undefined}
                // Color Y barra inferior: el subrayado se ve aunque no se
                // distinga el color, y sobrevive al alto contraste.
                className={`flex min-h-12 shrink-0 items-center gap-1.5 rounded-t-lg border-b-2 px-3 text-base transition-colors ${
                  activa
                    ? 'border-enlace font-semibold text-foreground'
                    : 'border-transparent text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <Icono className="size-4" aria-hidden="true" />
                {etiqueta}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

/**
 * La navegación del teléfono, abajo y fija.
 *
 * Antes esto era la misma fila de arriba con `overflow-x-auto`. Las
 * pestañas suman 747 px y en un teléfono de 360 no caben ni las cuatro
 * básicas: había que arrastrar para encontrarlas, y nada en pantalla decía
 * que hubiera algo más a la derecha. Una navegación que hay que descubrir
 * no es una navegación.
 *
 * Abajo por dos razones, no por moda: se ve entera de una vez, y queda
 * donde llega el pulgar de quien sostiene el teléfono con una mano —que es
 * como se usa esto, de pie y con prisa—. De paso le devuelve 62 px de alto
 * al contenido, que en una pantalla de 640 es una línea y media de texto.
 *
 * Cuatro destinos fijos. Moderación no está aquí ni en la fila de arriba:
 * es una herramienta de administrador, no un destino del producto, y vive
 * junto a la campana en el encabezado.
 *
 * ⚠ Va en el layout, FUERA del encabezado. El encabezado tiene
 * `backdrop-blur`, y `backdrop-filter` convierte al elemento en bloque
 * contenedor de sus descendientes `fixed`: dentro de él, esta barra se
 * anclaría al encabezado en vez de a la ventana.
 *
 * ⚠ `data-barra-inferior` no es decorativo: es el gancho de la regla de
 * `globals.css` que la esconde mientras hay un `MarcoFlujo` montado (regla
 * 10 del sistema de diseño). Sin el atributo, un formulario de pantalla
 * completa vuelve a ofrecer cuatro salidas a medio llenar.
 */
export function BarraInferior({ coordinacion = null }: { coordinacion?: Coordinacion }) {
  const ruta = usePathname()
  const lista = celdas(coordinacion)
  const cual = celdaActiva(ruta, lista)

  return (
    <nav
      aria-label="Secciones"
      data-barra-inferior
      // `env(safe-area-inset-bottom)` por el indicador de inicio del
      // iPhone: sin esto la última fila de etiquetas queda debajo de la
      // barra negra.
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur-sm pb-[env(safe-area-inset-bottom)] sm:hidden"
    >
      <ul className={lista.length === 5 ? 'grid grid-cols-5' : 'grid grid-cols-4'}>
        {lista.map(({ href, etiqueta, Icono }) => {
          const activa = href === cual
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={activa ? 'page' : undefined}
                // La línea va ARRIBA de la celda, apuntando al contenido,
                // igual que la de la fila de escritorio apunta hacia abajo.
                className={`flex min-h-16 flex-col items-center justify-center gap-1 border-t-2 px-1 pt-0.5 transition-colors ${
                  activa
                    ? 'border-enlace text-enlace'
                    : 'border-transparent text-muted-foreground'
                }`}
              >
                <Icono className="size-[1.375rem] shrink-0" aria-hidden="true" />
                {/* Antes esto era una caja de dos líneas fija, para que los
                    iconos no subieran y bajaran celda a celda cuando una
                    etiqueta envolvía. Con cuatro destinos ninguna etiqueta
                    pasa de dos palabras cortas, así que basta con prohibir
                    el salto de línea: el mismo arreglo, sin el hueco. */}
                <span
                  className={`text-center text-[0.71875rem] leading-[1.05] whitespace-nowrap ${
                    activa ? 'font-semibold' : ''
                  }`}
                >
                  {etiqueta}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
