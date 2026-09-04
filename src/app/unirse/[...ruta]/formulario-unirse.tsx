'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { contienePII, MENSAJE_PII } from '@/lib/validacion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { ResultadoUnirse } from '@/lib/types'

// El código no puede viajar por el rodeo de Google: `redirectTo` termina
// en los registros de un tercero. Se guarda un momento en la pestaña y se
// recoge al volver. `sessionStorage` y no `localStorage` a propósito: al
// cerrar la pestaña no queda nada.
const CLAVE = 'aquive:invitacion:'

export function FormularioUnirse({
  slug,
  codigo,
  haySesion,
}: {
  slug: string
  codigo: string | null
  haySesion: boolean
}) {
  const router = useRouter()
  const [nombre, setNombre] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultado, setResultado] = useState<ResultadoUnirse | null>(null)

  async function entrar() {
    setEnviando(true)
    if (codigo) sessionStorage.setItem(CLAVE + slug, codigo)

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
          `/unirse/${slug}`
        )}`,
      },
    })
    if (authError) {
      setError('No se pudo abrir la sesión de Google. Intenta de nuevo.')
      setEnviando(false)
    }
  }

  const nombreValido = nombre.trim().length >= 3 && nombre.trim().length <= 60

  async function unirse() {
    if (!nombreValido || enviando) return

    if (contienePII(nombre)) {
      setError(MENSAJE_PII)
      return
    }

    setEnviando(true)
    setError(null)

    // El código se lee aquí y no al montar: si venimos de volver de
    // Google, la URL ya no lo trae y quedó guardado en la pestaña.
    const supabase = createClient()
    const { data, error: rpcError } = await supabase.rpc('unirse_a_organizacion', {
      p_slug: slug,
      p_nombre_visible: nombre.trim(),
      p_codigo: codigo ?? sessionStorage.getItem(CLAVE + slug),
    })

    if (rpcError) {
      setError(rpcError.message)
      setEnviando(false)
      return
    }

    sessionStorage.removeItem(CLAVE + slug)
    setResultado(data as unknown as ResultadoUnirse)
    router.refresh()
  }

  if (resultado) {
    return (
      <div className="mt-6">
        {resultado.estado === 'activo' ? (
          <>
            <Alert>
              <AlertDescription>
                Ya haces parte de {resultado.organizacion}
                {resultado.rol === 'coordinador'
                  ? ', como coordinador.'
                  : '.'}
              </AlertDescription>
            </Alert>
            <Button className="mt-4 w-full" nativeButton={false} render={<Link href="/aliado" />}>
              Ir al panel de la organización
            </Button>
          </>
        ) : (
          <Alert variant="warning">
            <AlertDescription>
              Tu ingreso quedó en la lista de espera de{' '}
              {resultado.organizacion}. Un coordinador tiene que aprobarlo.
              Vuelve a entrar más tarde: no te vamos a escribir, porque no
              tenemos tu correo.
            </AlertDescription>
          </Alert>
        )}
      </div>
    )
  }

  if (!haySesion) {
    return (
      <div className="mt-6">
        <Button className="w-full" disabled={enviando} onClick={entrar}>
          {enviando ? 'Abriendo Google…' : 'Continuar con Google'}
        </Button>
        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>
    )
  }

  return (
    <div className="mt-6 space-y-4">
      <div>
        <Label htmlFor="unirse-nombre" className="mb-1">
          Tu nombre
        </Label>
        <Input
          id="unirse-nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          maxLength={60}
          placeholder="Como te conocen en la organización"
        />
        <p className="mt-1 text-base text-muted-foreground">
          Lo ven los coordinadores de esta organización. No se publica en
          ninguna página del sitio, y no te pedimos teléfono.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Button className="w-full" disabled={!nombreValido || enviando} onClick={unirse}>
        {enviando ? 'Entrando…' : 'Unirme'}
      </Button>
    </div>
  )
}
