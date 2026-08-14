import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { listarMunicipios } from '@/lib/municipios'
import { COLUMNAS_ITEM_PUBLICO, type OfrecimientoResumen } from '@/lib/types'
import { Pestanas } from '@/components/pestanas'
import { FormularioRegistro } from './formulario-registro'
import { AvisosOfertador } from './avisos-ofertador'
import { CerrarSesion } from './cerrar-sesion'
import { BorrarPerfil } from './borrar-perfil'

type Vista = 'perfil' | 'cuenta'

export default async function RegistroPage({
  searchParams,
}: {
  searchParams: Promise<{ ver?: string }>
}) {
  const { ver } = await searchParams
  const vista: Vista = ver === 'cuenta' ? 'cuenta' : 'perfil'

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

  // El catálogo, los servicios y el inventario solo hacen falta para
  // dibujar el formulario. La pestaña de cuenta no los toca.
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

      {/* Solo hay dos pestañas cuando ya hay perfil: mientras se está
          creando, no existe cuenta que administrar y una barra con una
          opción muerta es peor que ninguna barra. */}
      {perfil && (
        <div className="mt-4">
          <Pestanas
            etiqueta="Secciones de tu perfil"
            pestanas={[
              { href: '/registro', etiqueta: 'Mi perfil', activa: vista === 'perfil' },
              {
                href: '/registro?ver=cuenta',
                etiqueta: 'Mi cuenta',
                activa: vista === 'cuenta',
              },
            ]}
          />
        </div>
      )}

      {vista === 'perfil' ? (
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
