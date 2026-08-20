import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { listarMunicipios } from '@/lib/municipios'
import { CORREO_HABEAS_DATA_SERVICIOS, RESPONSABLE_SERVICIOS } from '@/lib/config'
import { FormularioProveedor } from '../../soy-proveedor/formulario-proveedor'
import { CamposReferencia, type MiReferencia } from '@/components/campos-referencia'
import {
  PanelServiciosProveedor,
  type MisServicios,
} from '@/components/panel-servicios-proveedor'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import type { MiProveedor } from '@/lib/types'

export const metadata = {
  title: 'Mi ficha',
  // El enlace lleva el token en el path. Que no lo indexe nadie.
  robots: { index: false, follow: false },
}

/**
 * La ficha de quien no tiene cuenta de Google.
 *
 * Es la misma pantalla de `/servicios/soy-proveedor`, con el token en vez
 * de la sesión. Existe para que el alta asistida no convierta a la
 * fundación en dueña de los datos de otra persona: con este enlace, quien
 * fue registrado ve lo que se guarda de él, lo corrige y lo borra sin
 * pedirle permiso a nadie.
 *
 * El token va en el path y no en una query string (regla 6), y la página
 * no se indexa.
 */
export default async function MiPerfilPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const supabase = await createClient()

  const [
    { data: mio },
    { data: oficios },
    { data: zonas },
    municipios,
    { data: refs },
    { data: servicios },
  ] = await Promise.all([
    supabase.rpc('mi_proveedor', { p_token: token }),
    supabase.from('catalogo_oficios').select('*').eq('activo', true).order('orden'),
    supabase.from('zonas').select('*').eq('activa', true).order('orden'),
    listarMunicipios(supabase),
    supabase.rpc('mis_referencias', { p_token: token }),
    supabase.rpc('mis_servicios', { p_token: token }),
  ])

  const proveedor = (mio as MiProveedor | null) ?? null
  const referencias = (refs as unknown as MiReferencia[]) ?? []
  const misServicios = (servicios as unknown as MisServicios | null) ?? null
  const misOficios = (oficios ?? []).filter((o) =>
    proveedor?.oficios.some((p) => p.oficio_id === o.id)
  )

  if (!proveedor) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-6">
        <h1 className="font-heading text-3xl">No encontramos esa ficha</h1>
        <p className="mt-3 text-base">
          El enlace puede estar incompleto, o la ficha ya se borró. No podemos
          recuperarlo: no guardamos a quién pertenece cada enlace, y esa es
          justamente la razón por la que nadie más puede entrar al tuyo.
        </p>
        <p className="mt-3 text-base">
          Si te registró una organización, pídeles que te generen la ficha otra
          vez. Si crees que es un error, escribe a {CORREO_HABEAS_DATA_SERVICIOS}.
        </p>
        <Button className="mt-4" nativeButton={false} render={<Link href="/servicios" />}>
          Ir al directorio
        </Button>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="font-heading text-3xl">Mi ficha</h1>
      <p className="mt-1 text-base text-muted-foreground">
        Esto es lo que aparece de ti en el directorio. Puedes cambiarlo o
        borrarlo cuando quieras, sin pedirle permiso a nadie.
      </p>

      <Alert className="mt-4">
        <AlertDescription>
          <strong>Guarda este enlace.</strong> Es la única forma de volver aquí,
          y no lo podemos recuperar porque no guardamos de quién es. Si lo
          pierdes, {RESPONSABLE_SERVICIOS} tiene que registrarte de nuevo.
        </AlertDescription>
      </Alert>

      <FormularioProveedor
        proveedor={proveedor}
        municipios={municipios ?? []}
        oficios={oficios ?? []}
        zonas={zonas ?? []}
        token={token}
      />

      <div className="mt-10">
        <CamposReferencia
          referencias={referencias}
          oficios={oficios ?? []}
          token={token}
        />
      </div>

      {misServicios && (
        <div className="mt-10">
          <PanelServiciosProveedor
            datos={misServicios}
            oficios={misOficios}
            token={token}
          />
        </div>
      )}

      <p className="mt-6 text-sm text-muted-foreground">
        Ver también el{' '}
        <Link href="/privacidad" className="underline">
          aviso de privacidad
        </Link>
        . Responsable del directorio: {RESPONSABLE_SERVICIOS}.
      </p>
    </main>
  )
}
