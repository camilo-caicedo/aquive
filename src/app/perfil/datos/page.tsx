import Link from 'next/link'
import { nombreConDepartamento } from '@/lib/municipios'
import { etiquetaMedioPago, TIPOS_PROVEEDOR } from '@/lib/servicios'
import { FormularioProveedor } from '@/app/servicios/soy-proveedor/formulario-proveedor'
import { MarcoFlujo } from '@/components/marco-flujo'
import { Button } from '@/components/ui/button'
import { cargarPerfil } from '../cargar'
import { FormularioCuentaPropia } from './formulario-cuenta-propia'

export const metadata = { title: 'Mis datos y contacto' }

/** Los tres sellos posibles. Relleno con palabra: el color nunca informa solo. */
const SELLO = {
  publico: { texto: 'Público', clase: 'bg-ok-suave text-foreground' },
  privado: { texto: 'Privado', clase: 'bg-muted text-foreground' },
  ninguno: { texto: 'No se guarda', clase: 'bg-accent text-accent-foreground' },
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
  const { proveedor, cuenta, municipios, oficios, zonas } = await cargarPerfil()

  // ⚠ Aquí había un `redirect('/servicios/soy-proveedor')`: sin ficha, tocar
  // «Mis datos y contacto» abría «Arma tu carné». Los datos de la CUENTA —el
  // nombre, el municipio, el teléfono— existen desde que alguien entra, y no
  // tenían dónde editarse salvo en el formulario del módulo de insumos.
  //
  // La pantalla crece: siempre la cuenta, y debajo la ficha cuando la hay.
  // Dos ramas y no una, porque el caparazón lo monta `FormularioProveedor`
  // y dos `MarcoFlujo` anidados no existen.
  if (!proveedor) {
    return (
      <MarcoFlujo titulo="Mis datos y contacto" volver="/perfil">
        {cuenta && (
          <FormularioCuentaPropia cuenta={cuenta} municipios={municipios} principal />
        )}

        <section className="shadow-cartel-amarillo mt-5 rounded-2xl bg-card p-4">
          <h2 className="font-heading text-xl leading-tight">
            Todavía no tienes ficha de prestador
          </h2>
          <p className="mt-1 text-base text-muted-foreground">
            La ficha lleva sus propios datos —tu nombre público, tu teléfono,
            tu zona y tus horarios— y su propia autorización. Se arma aparte.
          </p>
          <Button
            variant="outline"
            className="mt-3 w-full"
            nativeButton={false}
            render={<Link href="/servicios/soy-proveedor" />}
          >
            Armar mi carné
          </Button>
        </section>
      </MarcoFlujo>
    )
  }

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
          {cuenta && (
            <FormularioCuentaPropia cuenta={cuenta} municipios={municipios} />
          )}

          {/* ⚠ `proveedores.nombre_visible` y `perfiles.nombre_visible` son
              dos columnas distintas y pueden divergir. Sin decirlo, alguien
              cambia una esperando que cambie la otra. */}
          <p className="text-base text-muted-foreground">
            Lo de abajo es tu <strong>ficha</strong>, y es otra cosa: su nombre
            puede ser distinto del de tu cuenta. Lo marcado como público es lo
            que ve cualquiera que la abra.
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
