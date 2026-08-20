import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { listarMunicipios } from '@/lib/municipios'
import {
  COLUMNAS_ITEM_PUBLICO,
  type MiRespuesta,
  type OfrecimientoResumen,
} from '@/lib/types'
import { PestanasLoMio } from '@/components/pestanas-lo-mio'
import { Button } from '@/components/ui/button'
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
  searchParams: Promise<{ ver?: string; nuevo?: string }>
}) {
  const { ver, nuevo } = await searchParams
  const vista: Vista = ver === 'ajustes' || ver === 'respuestas' ? ver : 'perfil'
  const recienCreado = nuevo === '1'

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
    { data: mio },
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
          // Solo para saber si ya tiene ficha en el directorio de
          // servicios y decirle por dónde volver a ella.
          supabase.rpc('mi_proveedor', {}),
        ])
      : [[], { data: null }, { data: null }, { data: null }, { data: null }, { data: null }]

  const miFicha = mio as { id: string } | null

  return (
    <main className="mx-auto max-w-lg px-4 py-6">
      <h1 className="font-heading text-3xl">Lo mío</h1>

      <PestanasLoMio
        activa={
          vista === 'respuestas' ? 'respuestas' : vista === 'ajustes' ? 'ajustes' : 'perfil'
        }
        conSesion
        respuestas={respuestas.length}
      />


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
          <p className="mt-4 text-base text-muted-foreground">
            Estos datos se muestran públicamente para que quien necesita ayuda
            pueda contactarte.
          </p>
          <FormularioRegistro
            municipios={municipios ?? []}
            perfil={perfil ?? null}
            servidor={servidor ?? null}
            servicios={servicios ?? []}
            itemsCatalogo={itemsCatalogo ?? []}
            ofrecimientos={(ofrecimientos as unknown as OfrecimientoResumen[] | null) ?? []}
          />

          {/* El puente al otro módulo. Esta pantalla es el perfil de la
              ayuda de emergencia; la ficha del directorio de servicios es
              otra cosa, con otro responsable y otra vida útil. Pero quien
              entró con su cuenta y ofreció su trabajo viene a buscar «lo
              mío» aquí, que es donde vive todo lo demás suyo. */}
          <div className="mt-8 rounded-xl border border-border p-4">
            <h2 className="font-heading text-2xl">
              {miFicha ? 'Mi ficha de servicios' : '¿Vives de un oficio?'}
            </h2>
            <p className="mt-1 text-base text-muted-foreground">
              {miFicha
                ? 'Tu ficha del directorio de servicios se maneja aparte de este perfil: son dos cosas distintas y se borran por separado.'
                : 'El directorio de servicios es otra parte del sitio: ahí publicas tu oficio, tu precio y tu teléfono para que te contraten. No se borra sola como las solicitudes.'}
            </p>
            <Button
              variant="outline"
              className="mt-3"
              nativeButton={false}
              render={<Link href="/servicios/soy-proveedor" />}
            >
              {miFicha ? 'Ver mi ficha' : 'Ofrecer mi trabajo'}
            </Button>
          </div>
        </>
      ) : (
        <div className="mt-6 space-y-8">
          {/* Los avisos son de solicitudes en TUS municipios, así que sin
              perfil guardado no hay municipios y no hay nada que activar. */}
          {perfil && (
            <section>
              {/* Recién guardado el perfil se dice para qué sirve esto antes
                  de pedirlo. Es el momento en que la persona acaba de decir
                  que quiere ayudar, y sin avisos no se entera de ninguna
                  solicitud: tendría que entrar al tablero por su cuenta. */}
              {recienCreado && (
                <div className="mb-3 rounded-xl border border-primary/30 bg-accent p-4">
                  <p className="text-base font-medium text-accent-foreground">
                    Tu perfil quedó guardado
                  </p>
                  <p className="mt-1 text-base text-accent-foreground/80">
                    Falta lo que hace que sirva: que te avisemos cuando alguien
                    de tus municipios pida ayuda. Si no, tendrías que entrar a
                    mirar el tablero cada rato.
                  </p>
                </div>
              )}
              <h2 className="font-heading text-2xl">Avisos</h2>
              <AvisosOfertador municipios={perfil.municipios.length} />
            </section>
          )}

          <section>
            <h2 className="font-heading text-2xl">Sesión</h2>
            <CerrarSesion />
          </section>

          <section>
            <h2 className="font-heading text-2xl">Borrar mi perfil</h2>
            <BorrarPerfil tienePerfil={!!perfil} />
          </section>
        </div>
      )}
    </main>
  )
}
