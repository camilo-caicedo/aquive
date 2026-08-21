import Link from 'next/link'
import { Trash2 } from 'lucide-react'
import { CabeceraPantalla } from '@/components/cabecera-pantalla'
import { VueltaAlDestino } from '@/app/auth/vuelta'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { listarMunicipios } from '@/lib/municipios'
import {
  COLUMNAS_ITEM_PUBLICO,
  type MiRespuesta,
  type OfrecimientoResumen,
} from '@/lib/types'
import { PestanasLoMio } from '@/components/pestanas-lo-mio'
import { FormularioRegistro } from './formulario-registro'
import { AvisosOfertador } from './avisos-ofertador'
import { CerrarSesion } from './cerrar-sesion'
import { BorrarPerfil } from './borrar-perfil'
import { MisRespuestas } from './mis-respuestas'

type Vista = 'perfil' | 'respuestas' | 'ajustes'

export const metadata = { title: 'Lo mío' }

export default async function RegistroPage({
  searchParams,
}: {
  searchParams: Promise<{ ver?: string }>
}) {
  const { ver } = await searchParams
  const vista: Vista = ver === 'ajustes' || ver === 'respuestas' ? ver : 'perfil'

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  // Se pide siempre porque el número va en la barra, y son pocas filas:
  // una persona responde un puñado de solicitudes, no cientos.
  const { data: respuestasData } = perfil
    ? await supabase.rpc('mis_respuestas')
    : { data: null }
  const respuestas = (respuestasData as unknown as MiRespuesta[]) ?? []

  // El catálogo, los servicios y el inventario solo hacen falta para
  // dibujar el formulario. Las otras dos pestañas no los tocan.
  const [
    municipios,
    { data: servidor },
    { data: servicios },
    { data: itemsCatalogo },
    { data: ofrecimientos },
  ] =
    vista === 'perfil'
      ? await Promise.all([
          listarMunicipios(supabase),
          supabase.from('servidores').select('*').eq('perfil_id', user.id).maybeSingle(),
          supabase.from('catalogo_servicios').select('*').eq('activo', true).order('orden'),
          // Sin la categoría `servicios`: esos 36 ítems son los `serv_*`
          // derivados de `catalogo_servicios`, y ofrecerlos requiere
          // matrícula verificable. Un ofertador entrega cosas; quien ofrece
          // servicios se registra como servidor y los declara en su bloque.
          supabase
            .from('catalogo_items')
            .select(COLUMNAS_ITEM_PUBLICO)
            .eq('activo', true)
            .neq('categoria', 'servicios')
            .order('orden'),
          supabase.rpc('mis_ofrecimientos'),
        ])
      : [[], { data: null }, { data: null }, { data: null }, { data: null }]


  // Sin perfil, la pantalla ES el asistente: monta su propio MarcoFlujo
  // con el progreso y la barra de acción, y no lleva ni cabecera ni
  // pestañas. Con las pestañas encima, quien está creando su perfil veía
  // cuatro salidas y ninguna señal de cuánto le faltaba.
  if (!perfil && vista === 'perfil') {
    return (
      <>
        <VueltaAlDestino />
        <FormularioRegistro
          municipios={municipios ?? []}
          perfil={null}
          servidor={servidor ?? null}
          servicios={servicios ?? []}
          itemsCatalogo={itemsCatalogo ?? []}
          ofrecimientos={(ofrecimientos as unknown as OfrecimientoResumen[] | null) ?? []}
        />
      </>
    )
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-6">
      <VueltaAlDestino />
      <CabeceraPantalla titulo="Lo mío">
        <PestanasLoMio
          activa={
            vista === 'respuestas' ? 'respuestas' : vista === 'ajustes' ? 'ajustes' : 'perfil'
          }
          conSesion
          respuestas={respuestas.length}
        />
      </CabeceraPantalla>


      {vista === 'respuestas' ? (
        <section className="mt-4">
          <p className="text-base text-muted-foreground">
            Las solicitudes a las que respondiste, mientras sigan abiertas.
            Cuando una se cierra o vence, se borra entera y tu respuesta se
            va con ella.
          </p>
          <MisRespuestas respuestas={respuestas} />
        </section>
      ) : vista === 'perfil' ? (
        <>
          <p className="text-base text-muted-foreground">
            Tu nombre, tu contacto y tus municipios son públicos: así te
            encuentra quien necesita ayuda. Cada sección se guarda por separado.
          </p>
          <FormularioRegistro
            municipios={municipios ?? []}
            perfil={perfil ?? null}
            servidor={servidor ?? null}
            servicios={servicios ?? []}
            itemsCatalogo={itemsCatalogo ?? []}
            ofrecimientos={(ofrecimientos as unknown as OfrecimientoResumen[] | null) ?? []}
          />

        </>
      ) : (
        <div className="mt-6 space-y-8">
          {/* Los avisos son de solicitudes en TUS municipios, así que sin
              perfil guardado no hay municipios y no hay nada que activar. */}
          {perfil && (
            <section>
              <h2 className="font-heading text-2xl">Avisos</h2>
              <AvisosOfertador municipios={perfil.municipios.length} />
            </section>
          )}

          {/* Salir y borrar eran dos secciones seguidas con el mismo peso, y
              una de ellas borra la cuenta entera. Cerrar sesión es una fila
              normal —sales en este teléfono, tu perfil sigue publicado— y
              borrar queda aparte, en rojo, con la consecuencia escrita. */}
          <CerrarSesion />

          <section className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <Trash2 className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-medium text-destructive">
                  Borrar mi cuenta y mis datos
                </h2>
                <p className="text-sm text-muted-foreground">
                  Inmediato y no se puede deshacer.
                </p>
              </div>
            </div>

            <p className="mt-3 text-base">
              Se borra tu perfil, tu matrícula y todas las respuestas que hayas
              enviado. También tu cuenta: no queda nada tuyo, ni el
              identificador de Google. Si alguien estaba esperando tu respuesta,
              dejará de verla.
            </p>

            <div className="mt-3">
              <BorrarPerfil tienePerfil={!!perfil} />
            </div>

            {/* Lo que hoy no se decía en ningún lado, y es la pregunta que
                de verdad se hace quien tiene las dos cosas. */}
            <p className="mt-3 text-sm text-muted-foreground">
              Tu ficha del directorio de servicios se borra aparte: son dos
              cosas distintas.{' '}
              <Link href="/servicios/soy-proveedor" className="underline">
                Mi ficha
              </Link>
            </p>
          </section>
        </div>
      )}
    </main>
  )
}
