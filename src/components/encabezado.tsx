import Link from 'next/link'
import { ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Marca } from '@/components/marca'
import { Button } from '@/components/ui/button'
import { BarraInferior, Navegacion } from '@/components/navegacion'
import { BotonAvisos } from '@/components/boton-avisos'
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

  // Quien tiene algo que coordinar ve una celda más en la barra. El valor
  // ya venía en esta misma consulta: antes bajaba a «Lo mío» y ahora
  // vuelve a decidir una celda, esta vez con nombre de contenido.
  const hayCoordinacion = !!(estado?.data as EstadoEncabezado | null)?.coordinacion

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
    ? indice.matriculas + indice.telefonos + indice.hilos_sin_fundacion + indice.reportes
    : 0
  // La campana solo tiene sentido con perfil: los avisos son de hilos y
  // solicitudes donde participa una cuenta, y sin perfil no hay cuenta.
  const tienePerfil = !!perfil?.data
  const encabezado = (estado?.data as EstadoEncabezado | null) ?? null

  return (
    // Fragmento y no un solo `<header>`: la barra del teléfono es hermana
    // del encabezado, no hija. Dentro heredaría su `backdrop-blur`, que
    // convierte al encabezado en bloque contenedor de los descendientes
    // `fixed` y dejaría la barra pegada debajo del logo.
    <>
    <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-2">
        {/* El gato va suelto, sin caja: la identidad dice que no se encierra
            en un cuadro con borde cuando ya hay fondo. Antes había un
            alfiler de mapa aquí, y ese alfiler prometía un mapa que AquíVe
            no es. */}
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <Marca className="size-9 text-primary" />
          <span className="font-heading text-2xl leading-none">AquíVe</span>
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
          {tienePerfil && <BotonAvisos sinVer={encabezado?.avisos_sin_ver ?? 0} />}
          {/* Para quien no tiene sesión, y en relleno terracota por
              decisión del responsable (20 de agosto de 2026).

              ⚠ Es una excepción consciente a la regla 2, no un descuido:
              en una pantalla que además tiene `AccionPrincipal` —la
              portada, el directorio de quien ofrece— un visitante ve dos
              rellenos terracota a la vez. Si algún día hay que elegir uno,
              el de la píldora fija es la acción de la pantalla y este es
              la puerta de la cuenta. Va el último de la fila. */}
          {!user && (
            <Button nativeButton={false} render={<Link href="/login" />}>
              Entrar
            </Button>
          )}
        </div>
      </div>

      <Navegacion coordinacion={hayCoordinacion} />
    </header>

    <BarraInferior coordinacion={hayCoordinacion} />
    </>
  )
}
