import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Check } from 'lucide-react'
import { MarcoFlujo } from '@/components/marco-flujo'
import { Carne } from '@/components/carne'
import { createClient } from '@/lib/supabase/server'
import { listarMunicipios, nombreConDepartamento } from '@/lib/municipios'
import { RESPONSABLE_SERVICIOS } from '@/lib/config'
import type { MiProveedor } from '@/lib/types'

export const metadata = { title: 'Tu carné quedó abierto' }

/**
 * Pantalla 04 · Tu carné quedó abierto.
 *
 * La confirmación de haber creado la ficha de prestador. No es la de
 * `/registro/listo`, que es la del ofertador del módulo de emergencia: son
 * dos altas distintas, con otro responsable del tratamiento cada una.
 *
 * El carné se enseña con el sello «Sin verificar» y el texto dice por qué,
 * en vez de callarlo. Es la regla de producto 6 —nada nace verificado— y
 * evita el otro fallo: alguien que publica, no ve sello, y cree que algo
 * le salió mal.
 */
export default async function ListoPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [{ data: mio }, municipios] = await Promise.all([
    supabase.rpc('mi_proveedor', {}),
    listarMunicipios(supabase),
  ])

  const proveedor = (mio as MiProveedor | null) ?? null

  // Sin ficha esta pantalla no dice nada: se llega aquí después de crearla.
  if (!proveedor) redirect('/servicios/soy-proveedor')

  const municipio = municipios?.find((m) => m.codigo_dane === proveedor.municipio)

  return (
    <MarcoFlujo titulo="Listo">
      <div className="flex flex-col items-center text-center">
        <span className="bg-familia-verde flex size-16 items-center justify-center rounded-full text-foreground">
          <Check className="size-8" aria-hidden="true" />
        </span>
        <h2 className="font-heading mt-3 text-3xl leading-tight">
          Tu carné quedó abierto
        </h2>
        <p className="mt-2 text-base text-muted-foreground">
          Ya apareces en el directorio. Alguien de {RESPONSABLE_SERVICIOS} va a
          llamarte para verificar tu teléfono; hasta entonces tu ficha se ve sin
          sello.
        </p>
      </div>

      <div className="mt-6">
        <Carne
          id={proveedor.id}
          nombre={proveedor.nombre_visible}
          municipio={municipio ? nombreConDepartamento(municipio) : null}
          grupo={proveedor.oficios[0]?.grupo ?? null}
          telefonoVerificado={false}
          referenciasConfirmadas={proveedor.referencias_confirmadas}
          serviciosConfirmados={proveedor.servicios_confirmados}
          esMicroempresa={proveedor.tipo === 'microempresa'}
        />
      </div>

      <div className="mt-6 flex flex-col gap-2">
        {/* La única lima de la pantalla es la de completar: ir al inicio es
            salir, y salir no es la acción principal de una confirmación. */}
        <Link
          href="/servicios/soy-proveedor"
          className="flex min-h-12 items-center justify-center rounded-full bg-primary px-5 text-base font-semibold text-primary-foreground"
        >
          Completar mi ficha
        </Link>
        <Link
          href="/"
          className="shadow-canto flex min-h-12 items-center justify-center rounded-full bg-card px-5 text-base font-semibold"
        >
          Ir al inicio
        </Link>
      </div>
    </MarcoFlujo>
  )
}
