import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { listarMunicipios } from '@/lib/municipios'
import type { OfrecimientoResumen } from '@/lib/types'
import { FormularioRegistro } from './formulario-registro'
import { AvisosOfertador } from './avisos-ofertador'
import { CerrarSesion } from './cerrar-sesion'
import { BorrarPerfil } from './borrar-perfil'

export default async function RegistroPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [
    municipios,
    { data: perfil },
    { data: servidor },
    { data: servicios },
    { data: itemsCatalogo },
    { data: ofrecimientos },
  ] = await Promise.all([
    listarMunicipios(supabase),
    supabase.from('perfiles').select('*').eq('id', user.id).maybeSingle(),
    supabase.from('servidores').select('*').eq('perfil_id', user.id).maybeSingle(),
    supabase.from('catalogo_servicios').select('*').eq('activo', true).order('orden'),
    // Sin la categoría `servicios`: esos 36 ítems son los `serv_*` derivados
    // de `catalogo_servicios`, y ofrecerlos requiere matrícula verificable.
    // Un ofertador entrega cosas; quien ofrece servicios se registra como
    // servidor y los declara en su propio bloque.
    supabase
      .from('catalogo_items')
      .select('*')
      .eq('activo', true)
      .neq('categoria', 'servicios')
      .order('orden'),
    supabase.rpc('mis_ofrecimientos'),
  ])

  return (
    <main className="mx-auto max-w-lg px-4 py-6">
      <h1 className="text-2xl font-bold">
        {perfil ? 'Editar mi perfil' : 'Crear mi perfil'}
      </h1>
      <p className="mt-2 text-base text-muted-foreground">
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
      {/* Solo si ya hay perfil: sin municipios guardados no sabríamos de
          qué avisarle. */}
      {perfil && <AvisosOfertador municipios={perfil.municipios.length} />}
      <CerrarSesion />
      <BorrarPerfil tienePerfil={!!perfil} />
    </main>
  )
}
