import { TOPE_OFICIOS } from '@/lib/servicios'
import { FormularioProveedor } from '@/app/servicios/soy-proveedor/formulario-proveedor'
import { cargarPerfil } from '../cargar'
import { SinCarne } from '../sin-carne'

export const metadata = { title: 'Mis oficios y precios' }

/**
 * Pantalla 18 · Mis oficios y precios.
 *
 * Es la sección «Qué haces y cuánto cobras» del formulario, sacada a su
 * propia pantalla. Lo que añade es el estado por oficio —«Publicado» o
 * «Escondido»— **con su motivo**: la regla de producto 7 esconde los
 * oficios de riesgo alto sin teléfono verificado y sin referencia
 * confirmada, y hasta ahora eso se leía como un aviso general que no decía
 * qué oficio ni qué hacer.
 */
export default async function OficiosPage() {
  const { proveedor, municipios, oficios, oficiosPropuestos, zonas } =
    await cargarPerfil()

  if (!proveedor) {
    return (
      <SinCarne
        titulo="Mis oficios y precios"
        porque="Los oficios y sus precios son lo que se publica en tu ficha. Sin ficha no hay dónde ponerlos."
      />
    )
  }

  const escondidos = proveedor.oficios.filter((o) => !o.publicado)

  return (
    <FormularioProveedor
      proveedor={proveedor}
      municipios={municipios}
      oficios={oficios}
      oficiosPropuestos={oficiosPropuestos}
      zonas={zonas}
      titulo="Mis oficios y precios"
      volver="/perfil"
      secciones={['oficios']}
      encabezado={
        <>
          <p className="text-base text-muted-foreground">
            Hasta {TOPE_OFICIOS}. El precio es un piso, no una tarifa cerrada: en
            tu ficha se lee «desde».
          </p>

          {escondidos.length > 0 && (
            <div className="rounded-2xl bg-accent p-4 text-accent-foreground">
              <p className="text-base font-semibold">
                {escondidos.length === 1
                  ? 'Un oficio no aparece en el directorio'
                  : `${escondidos.length} oficios no aparecen en el directorio`}
              </p>
              <p className="mt-0.5 text-base">
                {proveedor.telefono_verificado
                  ? 'Falta una referencia confirmada. Cuando la fundación llame a tu cliente y confirme, aparecen solos.'
                  : 'Falta que verifiquemos tu teléfono. Cuando alguien de la fundación te llame y confirme, aparecen solos.'}
              </p>
            </div>
          )}
        </>
      }
    />
  )
}
