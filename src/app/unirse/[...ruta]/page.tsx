import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { FormularioUnirse } from './formulario-unirse'

// Una sola ruta atrapatodo en vez de dos páginas: el código de invitación
// va en el path —/unirse/<slug>/<código>— y sin él la misma pantalla
// sirve para entrar a la cola de aprobación.
export const metadata: Metadata = {
  title: 'Unirse a una organización',
  // Un enlace de invitación no tiene por qué acabar indexado.
  robots: { index: false, follow: false },
}

export default async function UnirsePage({
  params,
}: {
  params: Promise<{ ruta: string[] }>
}) {
  const { ruta } = await params
  const [slug, codigo] = ruta

  if (!slug || ruta.length > 2) notFound()

  const supabase = await createClient()

  const [{ data: organizacion }, { data: usuario }] = await Promise.all([
    supabase.rpc('organizacion_por_slug', { p_slug: slug }),
    supabase.auth.getUser(),
  ])

  // Lo único que devuelve esa RPC es el nombre. Ni municipios, ni acopio,
  // ni cuánta gente hay dentro: quien abre el enlace todavía no es nadie.
  const nombre = (organizacion as unknown as { nombre: string } | null)?.nombre

  if (!nombre) notFound()

  return (
    <main className="mx-auto max-w-lg px-4 py-6">
      <h1 className="font-heading text-3xl leading-tight">{nombre}</h1>
      <p className="mt-2 text-base text-muted-foreground">
        Te estás uniendo al equipo de esta organización en AquíVe. Es para
        quienes trabajan ahí: si solo quieres ofrecer insumos, no necesitas
        esto.
      </p>

      {/* El aviso no dice «no traes código» aunque la URL no lo traiga: al
          volver de Google el código ya no está en la dirección, sino
          guardado en la pestaña, y decirle que va a la cola a quien no va
          es peor que no decir nada. El resultado real se muestra después,
          que es cuando se sabe. */}
      {!codigo && (
        <Alert variant="warning" className="mt-4">
          <AlertDescription>
            Si tienes un enlace o un código QR de la organización, ábrelo y
            entras de una vez. Si no, tu ingreso queda en una lista para que
            un coordinador lo apruebe, y mientras tanto no vas a ver nada.
          </AlertDescription>
        </Alert>
      )}

      <Alert className="mt-4">
        <AlertDescription>
          No guardamos tu correo. De tu cuenta de Google solo conservamos un
          identificador interno.
        </AlertDescription>
      </Alert>

      <FormularioUnirse
        slug={slug}
        codigo={codigo ?? null}
        haySesion={!!usuario.user}
      />
    </main>
  )
}
