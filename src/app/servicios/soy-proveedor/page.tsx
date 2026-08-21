import { MarcoFlujo } from '@/components/marco-flujo'
import { CabeceraPantalla } from '@/components/cabecera-pantalla'
import { PestanasLoMio } from '@/components/pestanas-lo-mio'
import { PuertaCerrada } from '@/components/puerta-cerrada'
import { createClient } from '@/lib/supabase/server'
import { listarMunicipios } from '@/lib/municipios'
import { RESPONSABLE_SERVICIOS } from '@/lib/config'
import { FormularioProveedor } from './formulario-proveedor'
import { CamposReferencia, type MiReferencia } from '@/components/campos-referencia'
import {
  PanelServiciosProveedor,
  type MisServicios,
} from '@/components/panel-servicios-proveedor'
import type { MiProveedor } from '@/lib/types'

export const metadata = { title: 'Mi ficha' }

export default async function SoyProveedorPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Esta pantalla ya explicaba por qué hace falta cuenta y ya nombraba la
  // tercera puerta —el alta asistida—, que es lo que el módulo necesita
  // para no dejar fuera a quien no tiene Google. Lo que le faltaba es
  // volver: al entrar caía en la portada y había que buscar esto otra vez.
  if (!user) {
    return (
      <MarcoFlujo titulo="Ofrecer mi trabajo" volver="/servicios">
        <PuertaCerrada
          titulo="Para publicar tu ficha hace falta una cuenta"
          porque="Tu ficha lleva tu nombre y tu teléfono, y se queda publicada hasta que tú la borres: tiene que poder volver a ella solo quien la creó."
          seConserva="Al entrar vuelves justo aquí."
          destino="/servicios/soy-proveedor"
          alternativa={`¿No tienes cuenta de Google o no quieres crear una? Una organización aliada puede registrarte y darte un enlace propio para que manejes tu ficha. Pregunta en el punto de ${RESPONSABLE_SERVICIOS} más cercano.`}
        />
      </MarcoFlujo>
    )
  }

  const [
    { data: mio },
    { data: oficios },
    { data: zonas },
    municipios,
    { data: refs },
    { data: servicios },
  ] = await Promise.all([
      supabase.rpc('mi_proveedor', {}),
      supabase.from('catalogo_oficios').select('*').eq('activo', true).order('orden'),
      // Todas las zonas de una vez y se filtran en el cliente al elegir
      // municipio. Hoy son 37 filas —solo Cali—; si algún día se siembran
      // varias ciudades, esto pasa a una consulta por municipio.
      supabase.from('zonas').select('*').eq('activa', true).order('orden'),
      listarMunicipios(supabase),
      supabase.rpc('mis_referencias', {}),
      supabase.rpc('mis_servicios', {}),
    ])

  const proveedor = (mio as MiProveedor | null) ?? null
  const referencias = (refs as unknown as MiReferencia[]) ?? []
  const misServicios = (servicios as unknown as MisServicios | null) ?? null
  // Solo los oficios que están en su ficha: un código de algo que no
  // ofrece no significa nada.
  const misOficios = (oficios ?? []).filter((o) =>
    proveedor?.oficios.some((p) => p.oficio_id === o.id)
  )

  // Sin ficha todavía: es un flujo y lo envuelve el propio formulario con
  // su MarcoFlujo. Sin <main> ni h1 aquí, o se verían dos títulos.
  if (!proveedor) {
    return (
      <FormularioProveedor
        proveedor={null}
        municipios={municipios ?? []}
        oficios={oficios ?? []}
        zonas={zonas ?? []}
      />
    )
  }

  // Con ficha, esto es la pestaña «Mi ficha» de «Lo mío»: un destino, con
  // su cromo. Antes se llegaba por una tarjeta al final de «Mi perfil», que
  // es donde nadie la buscaba.
  return (
    <main className="mx-auto max-w-lg px-4 py-6">
      <CabeceraPantalla titulo="Lo mío">
        <PestanasLoMio activa="ficha" conSesion />
      </CabeceraPantalla>

      <FormularioProveedor
        proveedor={proveedor}
        municipios={municipios ?? []}
        oficios={oficios ?? []}
        zonas={zonas ?? []}
      />

      {/* Una referencia cuelga de la ficha, así que solo existe cuando la
          ficha existe: pedirla antes obligaría a guardar el dato de un
          tercero para algo que todavía puede no publicarse. */}
      <div className="mt-6">
        <CamposReferencia referencias={referencias} oficios={oficios ?? []} />
      </div>
      {misServicios && (
        <div className="mt-6">
          <PanelServiciosProveedor datos={misServicios} oficios={misOficios} />
        </div>
      )}
    </main>
  )
}
