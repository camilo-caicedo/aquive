import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { listarMunicipios } from '@/lib/municipios'
import { RESPONSABLE_SERVICIOS } from '@/lib/config'
import { FormularioProveedor } from './formulario-proveedor'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import type { MiProveedor } from '@/lib/types'

export const metadata = { title: 'Ofrecer mi trabajo' }

export default async function SoyProveedorPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-6">
        <h1 className="font-heading text-3xl">Ofrecer mi trabajo</h1>
        <p className="mt-3 text-base">
          Para publicar tu ficha en el directorio necesitas entrar con una
          cuenta de Google. Es la forma de que solo tú puedas cambiarla o
          borrarla.
        </p>
        <Button className="mt-4" nativeButton={false} render={<Link href="/login" />}>
          Entrar con Google
        </Button>
        {/* El §8 del documento fuente existe justamente por quien no tiene
            cuenta. Decirle «no se puede» y dejarlo ahí sería excluir a la
            población que el módulo quiere incluir. */}
        <Alert className="mt-6">
          <AlertDescription>
            ¿No tienes cuenta de Google o no quieres crear una? Una
            organización aliada puede registrarte y darte un enlace propio
            para que manejes tu ficha. Pregunta en el punto de {RESPONSABLE_SERVICIOS} más
            cercano.
          </AlertDescription>
        </Alert>
      </main>
    )
  }

  const [{ data: mio }, { data: oficios }, { data: zonas }, municipios] = await Promise.all([
    supabase.rpc('mi_proveedor', {}),
    supabase.from('catalogo_oficios').select('*').eq('activo', true).order('orden'),
    // Todas las zonas de una vez y se filtran en el cliente al elegir
    // municipio. Hoy son 37 filas —solo Cali—; si algún día se siembran
    // varias ciudades, esto pasa a una consulta por municipio.
    supabase.from('zonas').select('*').eq('activa', true).order('orden'),
    listarMunicipios(supabase),
  ])

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="font-heading text-3xl">
        {mio ? 'Mi ficha' : 'Ofrecer mi trabajo'}
      </h1>
      <p className="mt-1 text-base text-muted-foreground">
        Tu nombre, tu teléfono y lo que haces quedan públicos en internet para
        que la gente pueda buscarte y llamarte. Tú acuerdas el precio y el
        trabajo con cada persona: AquíVe no cobra nada ni participa.
      </p>

      <FormularioProveedor
        proveedor={(mio as MiProveedor | null) ?? null}
        municipios={municipios ?? []}
        oficios={oficios ?? []}
        zonas={zonas ?? []}
      />
    </main>
  )
}
