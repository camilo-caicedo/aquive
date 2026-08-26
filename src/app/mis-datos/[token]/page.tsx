import Link from 'next/link'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { CORREO_CONTACTO } from '@/lib/config'
import type { MisDatos } from '@/lib/types'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { PedirSupresion } from './pedir-supresion'

// El token va en la URL, como en /solicitud. No se indexa nunca.
export const metadata: Metadata = {
  title: 'Mis datos',
  robots: { index: false, follow: false },
}

function fecha(iso: string) {
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Habeas data (§8-F11). Los artículos 14 y 15 de la Ley 1581 hechos
 * pantalla: qué se guarda, quién lo ha visto y cómo pedir que se borre.
 *
 * En Flujo 1 esta pantalla sobra —no hay nada que consultar— y responde
 * diciendo exactamente eso, que es más útil que un 404.
 */
export default async function MisDatosPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('mis_datos', { p_token: token })

  if (error || !data) {
    return (
      <main className="mx-auto max-w-lg px-4 py-6 text-center">
        <h1 className="font-heading text-3xl">No encontramos esa solicitud</h1>
        <p className="mt-2 text-base text-muted-foreground">
          El enlace no existe, ya venció o la solicitud fue borrada.
        </p>
      </main>
    )
  }

  const datos = data as unknown as MisDatos

  return (
    <main className="mx-auto max-w-lg px-4 py-6">
      <h1 className="font-heading text-3xl leading-tight">Tus datos</h1>
      <p className="mt-2 text-base text-muted-foreground">
        Todo lo que AquíVe guarda sobre la solicitud {datos.codigo}, y quién
        lo ha visto.
      </p>

      <section className="mt-6">
        <h2 className="font-heading text-2xl">De la solicitud</h2>
        <div className="mt-2 rounded-2xl bg-card p-4 text-base shadow-canto">
          <p>
            {datos.municipio} — {datos.barrio}
          </p>
          {datos.nota && <p className="mt-1 text-muted-foreground">{datos.nota}</p>}
          <p className="mt-2 text-muted-foreground">
            Publicada el {fecha(datos.creada_at)} · se borra sola el{' '}
            {fecha(datos.expira_at)}
          </p>
        </div>
      </section>

      {datos.identidad === null ? (
        <Alert className="mt-6">
          <AlertDescription>
            Esta solicitud es anónima: no guardamos tu nombre, ni tu
            documento, ni tu teléfono. No hay nada más que consultar ni que
            suprimir. Cuando la solicitud venza o la cierres, se borra
            entera.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <section className="mt-6">
            <h2 className="font-heading text-2xl">Lo que guardamos de ti</h2>
            <p className="mt-1 text-base text-muted-foreground">
              Tu nombre, cifrado, porque {datos.organizacion ?? 'una fundación'}{' '}
              acompaña tu entrega y necesita saber a quién le entrega. Solo
              ellos lo ven, y queda registrado cada vez que lo miran.
            </p>
            <div className="mt-2 rounded-2xl bg-card p-4 text-base shadow-canto">
              {/* ⚠ Ya no hay documento que enseñar: la plataforma dejó de
                  pedirlo y de guardarlo. La identidad la comprueba la
                  fundación en persona. */}
              <p className="mt-1">
                {datos.identidad.tiene_telefono
                  ? 'Nos diste un teléfono'
                  : 'No nos diste teléfono'}
              </p>
              <p className="mt-2 text-muted-foreground">
                Aceptaste la política del {datos.identidad.autorizacion_version}{' '}
                el {fecha(datos.identidad.autorizacion_at)}
              </p>
            </div>
          </section>

          <section className="mt-6">
            <h2 className="font-heading text-2xl">Quién los ha visto</h2>
            {datos.accesos.length === 0 ? (
              <p className="shadow-canto mt-2 rounded-2xl bg-card p-6 text-center text-base text-muted-foreground">
                Nadie los ha consultado todavía.
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {datos.accesos.map((a, i) => (
                  <li key={i} className="shadow-canto rounded-2xl bg-card p-3 text-base">
                    <p className="font-medium">
                      {a.rol === 'admin' ? 'Moderación de AquíVe' : 'La fundación'}
                    </p>
                    <p className="text-muted-foreground">{a.motivo}</p>
                    <p className="text-base text-muted-foreground">{fecha(a.cuando)}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {datos.entregas.length > 0 && (
            <section className="mt-6">
              <h2 className="font-heading text-2xl">Lo que te entregaron</h2>
              <ul className="mt-2 space-y-1 text-base">
                {datos.entregas.map((e, i) => (
                  <li key={i}>
                    {e.cantidad} {e.unidad} de {e.item}
                    {e.confirmada ? ' · confirmado por ti' : ' · sin confirmar'}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="mt-8">
            <h2 className="font-heading text-2xl">Borrar tus datos</h2>
            <PedirSupresion token={token} />
          </section>
        </>
      )}

      <p className="mt-8 text-base text-muted-foreground">
        Si algo de esto está mal o quieres corregirlo, escríbenos a{' '}
        <a href={`mailto:${CORREO_CONTACTO}`} className="underline">
          {CORREO_CONTACTO}
        </a>
        . Tenemos 10 días hábiles para responder una consulta y 15 para un
        reclamo.
      </p>

      <p className="mt-4 text-base">
        <Link href={`/solicitud/${token}`} className="underline">
          Volver a mi solicitud
        </Link>
      </p>
    </main>
  )
}
