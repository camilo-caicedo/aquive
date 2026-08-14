import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { listarMunicipios } from '@/lib/municipios'
import {
  COLUMNAS_ITEM_PUBLICO,
  type MiRespuesta,
  type OfrecimientoResumen,
} from '@/lib/types'
import { Pestanas } from '@/components/pestanas'
import { FormularioRegistro } from './formulario-registro'
import { AvisosOfertador } from './avisos-ofertador'
import { CerrarSesion } from './cerrar-sesion'
import { BorrarPerfil } from './borrar-perfil'
import { MisRespuestas } from './mis-respuestas'

type Vista = 'perfil' | 'respuestas' | 'ajustes'

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
  const [municipios, { data: servidor }, { data: servicios }, { data: itemsCatalogo }, { data: ofrecimientos }] =
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

  return (
    <main className="mx-auto max-w-lg px-4 py-6">
      <h1 className="font-heading text-3xl">
        {perfil ? 'Mi perfil' : 'Crear mi perfil'}
      </h1>

      {/* La barra solo aparece con perfil ya creado: mientras se está
          creando no hay respuestas ni nada que ajustar, y una barra con
          opciones muertas es peor que ninguna barra. */}
      {perfil && (
        <div className="mt-4">
          <Pestanas
            etiqueta="Secciones de tu perfil"
            pestanas={[
              { href: '/registro', etiqueta: 'Mi perfil', activa: vista === 'perfil' },
              {
                href: '/registro?ver=respuestas',
                etiqueta: 'Mis respuestas',
                activa: vista === 'respuestas',
                cuenta: respuestas.length,
              },
              {
                href: '/registro?ver=ajustes',
                etiqueta: 'Ajustes',
                activa: vista === 'ajustes',
              },
            ]}
          />
        </div>
      )}

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
