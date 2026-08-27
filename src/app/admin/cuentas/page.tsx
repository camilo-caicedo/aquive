import { createClient } from '@/lib/supabase/server'
import { listarMunicipios } from '@/lib/municipios'
import { CabeceraPantalla } from '@/components/cabecera-pantalla'
import { FormularioCuenta } from './formulario-cuenta'

export const metadata = {
  title: 'Cuentas',
  robots: { index: false, follow: false },
}

/**
 * Dar de alta a quien no tiene cuenta de Google (ADR 0006).
 *
 * Esta pantalla es la que hace aceptable exigir cuenta para todo: sin ella
 * el cambio deja fuera a buena parte del rebusque, que es a quien la
 * aplicación quiere incluir.
 *
 * ⚠ Quien de verdad decide es el dominio: `cuentas.crear` exige admin y
 * rechaza a quien no lo sea. El layout solo evita enseñar la pantalla.
 */
export default async function CuentasPage() {
  // La puerta de administración la guarda `admin/layout.tsx`, una sola vez
  // para las nueve rutas. Repetirla aquí sería la décima copia, que es la
  // que algún día se olvida.
  const supabase = await createClient()
  const municipios = await listarMunicipios(supabase)

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <CabeceraPantalla titulo="Cuentas" volver="/admin" />

      <p className="text-base text-muted-foreground">
        Para quien no tiene cuenta de Google. Se le crea la suya y se le
        entrega un enlace: es lo único que le permite entrar.
      </p>

      <div className="mt-6">
        <FormularioCuenta municipios={municipios} />
      </div>

      <p className="mt-6 text-sm text-muted-foreground">
        El enlace es como una contraseña en un papel, y es a propósito: quien
        no tiene correo tampoco tiene cómo recuperar una cuenta. Cada persona
        tiene uno solo — darle otro deja el anterior sin servir, y ese es el
        botón para cuando lo pierde o se lo quitan.
      </p>
    </main>
  )
}
