import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
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

  const [{ data: municipios }, { data: perfil }, { data: servidor }, { data: servicios }] =
    await Promise.all([
      supabase.from('municipios').select('*').order('nombre'),
      supabase.from('perfiles').select('*').eq('id', user.id).maybeSingle(),
      supabase.from('servidores').select('*').eq('perfil_id', user.id).maybeSingle(),
      supabase.from('catalogo_servicios').select('*').eq('activo', true).order('orden'),
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
      />
      {/* Solo si ya hay perfil: sin municipios guardados no sabríamos de
          qué avisarle. */}
      {perfil && <AvisosOfertador municipios={perfil.municipios.length} />}
      <CerrarSesion />
      <BorrarPerfil tienePerfil={!!perfil} />
    </main>
  )
}
