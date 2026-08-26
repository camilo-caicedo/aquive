import { redirect } from 'next/navigation'
import { nombreConDepartamento } from '@/lib/municipios'
import { etiquetaMedioPago, TIPOS_PROVEEDOR } from '@/lib/servicios'
import { FormularioProveedor } from '@/app/servicios/soy-proveedor/formulario-proveedor'
import { cargarPerfil } from '../cargar'

export const metadata = { title: 'Mis datos y contacto' }

/** Los tres sellos posibles. Relleno con palabra: el color nunca informa solo. */
const SELLO = {
  publico: { texto: 'Público', clase: 'bg-primary text-primary-foreground' },
  privado: { texto: 'Privado', clase: 'bg-muted text-foreground' },
  ninguno: { texto: 'No se guarda', clase: 'bg-ok-suave text-foreground' },
} as const

/**
 * Pantalla 17 · Mis datos y contacto.
 *
 * Sale de las secciones «Quién eres» y «Teléfono y pago» del formulario de
 * alta, más el municipio y la presentación. Lo que añade es el sello por
 * campo: qué de esto ve cualquiera que abra la ficha, dicho antes de
 * escribirlo y no en los términos.
 *
 * ⚠ El correo aparece en la lista y dice «No se guarda», que es la verdad
 * —del inicio de sesión se persiste solo el identificador opaco—. Omitirlo
 * dejaría a quien mira la lista suponiendo que sí lo tenemos.
 */
export default async function DatosPage() {
  const { proveedor, municipios, oficios, zonas } = await cargarPerfil()

  // Sin ficha no hay datos de prestador que editar, y `guardar_proveedor`
  // no sabe crear media ficha: el alta es la pantalla 14, entera.
  if (!proveedor) redirect('/servicios/soy-proveedor')

  const municipio = municipios.find((m) => m.codigo_dane === proveedor.municipio)

  const campos: { etiqueta: string; sello: keyof typeof SELLO; valor: string }[] = [
    { etiqueta: 'Nombre visible', sello: 'publico', valor: proveedor.nombre_visible },
    { etiqueta: 'Teléfono / WhatsApp', sello: 'publico', valor: proveedor.telefono },
    {
      etiqueta: 'Cómo trabajas',
      sello: 'publico',
      valor:
        TIPOS_PROVEEDOR.find((t) => t.valor === proveedor.tipo)?.etiqueta ?? proveedor.tipo,
    },
    {
      etiqueta: 'Municipio',
      sello: 'publico',
      valor: municipio ? nombreConDepartamento(municipio) : proveedor.municipio,
    },
    {
      etiqueta: 'Medios de pago',
      sello: 'publico',
      valor:
        proveedor.medios_pago.map(etiquetaMedioPago).join(', ') || 'Sin especificar',
    },
    {
      etiqueta: 'Presentación',
      sello: 'publico',
      valor: proveedor.descripcion ?? 'Sin presentación',
    },
    { etiqueta: 'Correo', sello: 'ninguno', valor: 'De tu cuenta solo queda un identificador interno' },
  ]

  return (
    <FormularioProveedor
      proveedor={proveedor}
      municipios={municipios}
      oficios={oficios}
      zonas={zonas}
      titulo="Mis datos y contacto"
      volver="/perfil"
      secciones={['quien', 'figura', 'contacto', 'ciudad', 'presentacion']}
      encabezado={
        <>
          <p className="text-base text-muted-foreground">
            Lo marcado como público es lo que ve cualquiera que abra tu ficha. El
            resto no sale de aquí.
          </p>

          <ul className="shadow-canto divide-y divide-border rounded-2xl bg-card">
            {campos.map((c) => (
              <li key={c.etiqueta} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-heading text-xs tracking-[0.085em] text-muted-foreground uppercase">
                    {c.etiqueta}
                  </span>
                  <span
                    className={`font-heading rounded-full px-2.5 py-0.5 text-xs tracking-[0.085em] uppercase ${SELLO[c.sello].clase}`}
                  >
                    {SELLO[c.sello].texto}
                  </span>
                </div>
                <p className="mt-1 text-base">{c.valor}</p>
              </li>
            ))}
          </ul>

          <p className="text-base text-muted-foreground">
            Tu teléfono está en tu ficha porque tú lo pusiste ahí, con casilla
            explícita. Puedes cambiarlo cuando quieras, pero si lo cambias la
            verificación se cae y hay que volver a llamarte.
          </p>
        </>
      }
    />
  )
}
