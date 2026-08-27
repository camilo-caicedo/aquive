import Image from 'next/image'
import Link from 'next/link'

import isotipo from '@/../docs/marca/isotipo-carrito.png'
import { ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { servidor } from '@/orpc/local'
import { BarraInferior, Navegacion, type Coordinacion } from '@/components/navegacion'
import { BotonAvisos } from '@/components/boton-avisos'
import { BotonInstalar } from '@/components/boton-instalar'
import type { EstadoEncabezado, IndiceAdmin } from '@/lib/types'

export async function Encabezado() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Solo se consulta si hay sesión: para un visitante anónimo no tiene
  // sentido pagar las consultas en cada carga. La RLS de `administradores`
  // solo deja ver la propia fila, así que esto no revela quién más lo es.
  const [admin, perfil, estado] = user
    ? await Promise.all([
        supabase.from('administradores').select('user_id').eq('user_id', user.id).maybeSingle(),
        supabase.from('perfiles').select('id').eq('id', user.id).maybeSingle(),
        // Dos cosas salen de aquí: los avisos sin ver, que pintan la
        // campana, y `coordinacion`, que decide si la barra lleva la
        // quinta celda —«Entregas»— para quien tiene algo que coordinar.
        supabase.rpc('estado_encabezado'),
      ])
    : [null, null, null]

  // Quien tiene algo que coordinar ve una celda más en la barra, y cuál
  // depende de quién sea: el equipo de una fundación va a /aliado y quien
  // solo ofreció ayuda va a /coordinacion. El valor ya venía en esta misma
  // consulta.
  const coordinacion = ((estado?.data as EstadoEncabezado | null)?.coordinacion ??
    null) as Coordinacion

  const esAdmin = !!admin?.data

  // El escudo lleva cuántas personas están esperando, no cuánto trabajo
  // hay: son las cuatro colas del primer grupo del índice. Se paga una
  // consulta más, pero solo la paga quien es administrador —una persona—,
  // y sin el número el escudo obliga a entrar para saber si hay algo.
  const { data: indiceData } = esAdmin
    ? await supabase.rpc('panel_admin_indice')
    : { data: null }
  const indice = indiceData as unknown as IndiceAdmin | null
  const pendientes = indice
    ? indice.matriculas + indice.telefonos + indice.reportes
    : 0
  // La campana solo tiene sentido con perfil: los avisos son de hilos y
  // solicitudes donde participa una cuenta, y sin perfil no hay cuenta.
  const tienePerfil = !!perfil?.data
  const encabezado = (estado?.data as EstadoEncabezado | null) ?? null

  // El punto de «Mensajes». Solo con perfil, por lo mismo que la campana: un
  // hilo tiene dos cuentas de los dos lados, y sin cuenta no hay ninguno.
  const mensajesSinLeer = tienePerfil ? await servidor.chat.sinLeer() : 0

  return (
    // Fragmento y no un solo `<header>`: la barra del teléfono es hermana
    // del encabezado, no hija. Dentro heredaría su `backdrop-blur`, que
    // convierte al encabezado en bloque contenedor de los descendientes
    // `fixed` y dejaría la barra pegada debajo del logo.
    <>
    <header
      data-encabezado
      className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm"
    >
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-2">
        {/* El isotipo suelto y el nombre en píldora lima, como en la
            bienvenida: es la misma marca en los dos sitios y conviene que se
            reconozca igual. El nombre va en TEXTO y no dibujado — el revisor
            de marca de Google lee el DOM.

            El PNG no tiene canal alfa, así que el isotipo va en su círculo
            blanco; suelto sobre el crema se vería un cuadrado. */}
        <Link href="/inicio" className="flex shrink-0 items-center gap-2.5">
          <span className="size-10 shrink-0 overflow-hidden rounded-full bg-card p-1">
            <Image
              src={isotipo}
              alt=""
              width={40}
              height={40}
              className="h-full w-full object-contain"
            />
          </span>
          <span className="bg-primary text-primary-foreground font-heading rounded-full px-3 py-1 text-base leading-none tracking-[0.08em] uppercase">
            Aquí Ve
          </span>
        </Link>

        {/* Arriba solo queda la identidad y lo de la cuenta. «Mi perfil»
            se fue: era un destino, y los destinos están abajo —estaba en
            el encabezado y en la barra a la vez, dos puertas al mismo
            cuarto compitiendo por el sitio más caro de la pantalla—.
            Moderación se queda porque no es un destino del producto sino
            una herramienta de administrador. */}
        <div className="flex shrink-0 items-center gap-2">
          {esAdmin && (
            <Link
              href="/admin"
              aria-label={
                pendientes === 0
                  ? 'Administración'
                  : `Administración · ${pendientes} por atender`
              }
              title="Administración"
              className="relative flex size-12 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ShieldCheck className="size-5" aria-hidden="true" />
              {pendientes > 0 && (
                <span
                  aria-hidden="true"
                  className="absolute top-1 right-1 flex min-w-5 items-center justify-center rounded-full bg-primary px-1 text-sm font-bold text-primary-foreground"
                >
                  {pendientes}
                </span>
              )}
            </Link>
          )}
          {/* Antes de la campana y de «Entrar»: se toca una vez en la
              vida y no puede quedar delante de lo que se toca a diario.
              Se dibuja solo cuando el navegador dice que se puede
              instalar; en iPhone no aparece nunca. */}
          <BotonInstalar />
          {tienePerfil && <BotonAvisos sinVer={encabezado?.avisos_sin_ver ?? 0} />}
          {/* Píldora blanca con canto, no relleno lima. El lima del
              encabezado ya lo gasta la marca, y dos limas en la misma barra
              —la marca y la puerta de la cuenta— se disputan el ojo sin que
              ninguno sea la acción de la pantalla (regla 2). */}
          {!user && (
            <Link
              href="/login"
              className="shadow-canto inline-flex min-h-12 shrink-0 items-center rounded-full bg-card px-5 text-base font-semibold"
            >
              Entrar
            </Link>
          )}
        </div>
      </div>

      <Navegacion coordinacion={coordinacion} sinLeer={mensajesSinLeer} />
    </header>

    <BarraInferior coordinacion={coordinacion} sinLeer={mensajesSinLeer} />
    </>
  )
}
