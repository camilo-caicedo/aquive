'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import qrcode from 'qrcode-generator'
import { createClient } from '@/lib/supabase/client'
import { enlaceInvitacion } from '@/lib/organizaciones'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { HojaGestion, FilaPermiso } from '@/components/hoja-gestion'
import type { AccionMiembro, InvitacionResumen, MiembroEquipo } from '@/lib/types'

function fecha(iso: string) {
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function Invitacion({
  invitacion,
  slug,
  origen,
  onCambio,
}: {
  invitacion: InvitacionResumen
  slug: string
  origen: string
  onCambio: () => void
}) {
  const [copiado, setCopiado] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [verQr, setVerQr] = useState(false)
  const enlace = enlaceInvitacion(origen, slug, invitacion.codigo)

  // Mismo QR que la pantalla de confirmación de una solicitud: se genera
  // en el navegador, no viaja a ningún servicio de terceros.
  const qrDataUrl = useMemo(() => {
    const qr = qrcode(0, 'M')
    qr.addData(enlace)
    qr.make()
    return qr.createDataURL(6, 12)
  }, [enlace])

  async function copiar() {
    try {
      await navigator.clipboard.writeText(enlace)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      // Sin permiso de portapapeles: el enlace está a la vista para copiarlo a mano.
    }
  }

  async function anular() {
    setEnviando(true)
    const supabase = createClient()
    await supabase.rpc('desactivar_invitacion', { p_id: invitacion.id })
    onCambio()
  }

  return (
    // Una fila, no una tarjeta con el QR desplegado. Cada invitación viva
    // pintaba un QR de 160 px más la URL entera más tres botones: con tres
    // invitaciones abiertas había que bajar tres pantallas para llegar al
    // equipo, que es a lo que se entra.
    <li className="rounded-2xl bg-card p-4 shadow-canto">
      <p className="text-base font-medium">
        {invitacion.rol_otorgado === 'coordinador' ? 'Coordinador' : 'Miembro'} ·{' '}
        {invitacion.usos}/{invitacion.usos_max} usos · vence el{' '}
        {fecha(invitacion.expira_at)}
      </p>

      {/* El aviso va pegado a la invitación de pared, que es la que lo
          necesita: un QR de 25 usos pegado en un muro lo escanea cualquiera
          que pase. */}
      {invitacion.usos_max > 1 && (
        <p className="mt-1 text-sm text-muted-foreground">
          Este es de pared: piensa quién más pasa por ahí antes de pegarlo.
        </p>
      )}

      {verQr && (
        <>
          <div className="mt-2 rounded-lg bg-muted p-3 text-sm break-all">{enlace}</div>
          {/* eslint-disable-next-line @next/next/no-img-element -- data URI generada en cliente, no aplica optimización de next/image */}
          <img
            src={qrDataUrl}
            alt={`Código QR para unirse como ${invitacion.rol_otorgado}`}
            className="mx-auto mt-3 h-40 w-40"
            width={160}
            height={160}
          />
        </>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setVerQr((v) => !v)}>
          {verQr ? 'Ocultar el QR' : 'Ver el QR'}
        </Button>
        <Button variant="outline" onClick={copiar}>
          {copiado ? 'Copiado' : 'Copiar enlace'}
        </Button>
        <Button
          variant="outline"
          nativeButton={false}
          render={<a href={qrDataUrl} download={`aquive-${slug}.gif`} />}
        >
          Descargar QR
        </Button>
        <Button variant="destructive" disabled={enviando} onClick={anular}>
          {enviando ? 'Anulando…' : 'Anular'}
        </Button>
      </div>
    </li>
  )
}

function Miembro({
  organizacionId,
  miembro,
  esYo,
  onCambio,
}: {
  organizacionId: string
  miembro: MiembroEquipo
  /** Nadie se aplica acciones a sí mismo: la RPC lo rechaza, y aquí ni
      siquiera se dibujan los botones. Es lo que evita que el único
      coordinador se degrade solo y deje la organización muda. */
  esYo: boolean
  onCambio: () => void
}) {
  const [enviando, setEnviando] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function accion(p_accion: AccionMiembro) {
    setEnviando(true)
    setError(null)
    const supabase = createClient()
    const { error: rpcError } = await supabase.rpc('gestionar_miembro', {
      p_organizacion_id: organizacionId,
      p_perfil_id: miembro.perfil_id,
      p_accion,
    })
    if (rpcError) {
      setError(rpcError.message)
      setEnviando(false)
      return
    }
    setConfirmando(false)
    onCambio()
  }

  async function permiso(p_permiso: 'puede_ver_identidad' | 'puede_moderar', p_valor: boolean) {
    setEnviando(true)
    setError(null)
    const supabase = createClient()
    const { error: rpcError } = await supabase.rpc('otorgar_permiso_miembro', {
      p_organizacion_id: organizacionId,
      p_perfil_id: miembro.perfil_id,
      p_permiso,
      p_valor,
    })
    if (rpcError) {
      setError(rpcError.message)
      setEnviando(false)
      return
    }
    onCambio()
  }

  const etiquetaEstado =
    miembro.estado === 'activo'
      ? miembro.rol === 'coordinador'
        ? 'Coordinador'
        : 'En el equipo'
      : miembro.estado === 'pendiente'
        ? 'Por aprobar'
        : 'Fuera del equipo'

  return (
    // Fila, no tarjeta con seis botones: quien coordina mira el equipo
    // entero de un vistazo y solo entra a uno cuando va a cambiarle algo.
    <li
      className={
        miembro.estado === 'activo'
          ? 'flex items-center gap-3 rounded-2xl bg-card p-4 shadow-canto'
          : miembro.estado === 'pendiente'
            ? 'flex items-center gap-3 rounded-2xl border border-enlace/40 bg-accent p-4'
            : 'flex items-center gap-3 rounded-2xl border border-dashed border-border p-4'
      }
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-bold">
          {miembro.nombre_visible}
          {esYo && <span className="font-normal text-muted-foreground"> · eres tú</span>}
        </p>
        <p className="truncate text-sm text-muted-foreground">
          {etiquetaEstado}
          {miembro.estado === 'activo' && miembro.rol === 'coordinador'
            ? ' · coordinador'
            : ''}
          {miembro.puede_ver_identidad ? ' · ve identidades' : ''}
        </p>
      </div>

      {esYo ? null : (
        <div className="shrink-0">
          <HojaGestion
            id={`gestionar-${miembro.perfil_id}`}
            titulo={miembro.nombre_visible}
            resumen={`${etiquetaEstado} · ${
              miembro.rol === 'coordinador' ? 'Coordinador' : 'Miembro'
            }`}
            permisos={
              miembro.estado === 'activo' ? (
                <>
                  {/* Interruptores, no botones: un botón que dice «Dar
                      permiso» y otro que dice «Quitar» son la misma cosa
                      dicha de dos formas, y quien mira rápido no sabe cuál
                      es el estado actual. */}
                  <FilaPermiso
                    etiqueta="Ver identidades"
                    explicacion="Puede abrir los datos de quien pide ayuda para coordinar una entrega."
                    advertencia="Abre nombres, documentos y teléfonos de personas reales. Cada lectura queda en la bitácora con su nombre, la hora y el motivo."
                    activo={miembro.puede_ver_identidad}
                    disabled={enviando}
                    onChange={(v) => permiso('puede_ver_identidad', v)}
                  />
                  <FilaPermiso
                    etiqueta="Moderar"
                    explicacion="Puede retirar mensajes de las conversaciones de la organización."
                    activo={miembro.puede_moderar}
                    disabled={enviando}
                    onChange={(v) => permiso('puede_moderar', v)}
                  />
                </>
              ) : undefined
            }
            papeles={
              miembro.estado === 'pendiente' ? (
                <Button className="w-full" disabled={enviando} onClick={() => accion('aprobar')}>
                  Aprobar
                </Button>
              ) : miembro.estado === 'activo' ? (
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={enviando}
                  onClick={() => accion(miembro.rol === 'coordinador' ? 'degradar' : 'ascender')}
                >
                  {miembro.rol === 'coordinador' ? 'Quitar coordinación' : 'Hacer coordinador'}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={enviando}
                  onClick={() => accion('activar')}
                >
                  Volver a incluir
                </Button>
              )
            }
            destructivo={
              miembro.estado === 'pendiente' ? (
                <Button
                  variant="destructive"
                  className="w-full"
                  disabled={enviando}
                  onClick={() => accion('rechazar')}
                >
                  Rechazar
                </Button>
              ) : miembro.estado === 'activo' ? (
                <Button
                  variant="destructive"
                  className="w-full"
                  disabled={enviando}
                  onClick={() => accion('desactivar')}
                >
                  Sacar del equipo
                </Button>
              ) : confirmando ? (
                <Button
                  variant="destructive"
                  className="w-full"
                  disabled={enviando}
                  onClick={() => accion('sacar')}
                >
                  {enviando ? 'Borrando…' : 'Sí, borrar de la lista'}
                </Button>
              ) : (
                <Button
                  variant="destructive"
                  className="w-full"
                  disabled={enviando}
                  onClick={() => setConfirmando(true)}
                >
                  Borrar de la lista
                </Button>
              )
            }
          />
        </div>
      )}

      {error && (
        <Alert variant="destructive" className="mt-2">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </li>
  )
}

export function PanelEquipo({
  organizacionId,
  slug,
  origen,
  miId,
  equipo,
  invitaciones,
}: {
  organizacionId: string
  slug: string
  /** Calculado en el servidor: un cliente no puede sin romper la hidratación. */
  origen: string
  miId: string
  equipo: MiembroEquipo[]
  invitaciones: InvitacionResumen[]
}) {
  const router = useRouter()
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pendientes = equipo.filter((m) => m.estado === 'pendiente')
  const resto = equipo.filter((m) => m.estado !== 'pendiente')

  async function invitar(usos: number, horas: number) {
    setEnviando(true)
    setError(null)
    const supabase = createClient()
    const { error: rpcError } = await supabase.rpc('crear_invitacion', {
      p_organizacion_id: organizacionId,
      p_rol: 'miembro',
      p_horas: horas,
      p_usos_max: usos,
    })
    if (rpcError) {
      setError(rpcError.message)
      setEnviando(false)
      return
    }
    setEnviando(false)
    router.refresh()
  }

  return (
    <div className="mt-6 space-y-6">
      <div>
        <h3 className="text-lg font-bold">Invitar a alguien</h3>
        <p className="mt-1 text-base text-muted-foreground">
          Quien abra el enlace o escanee el código entra al equipo de una vez,
          sin que nadie lo apruebe. Un QR para pegar en la pared sirve para
          varias personas: piensa quién más pasa por ahí antes de dejarlo un
          mes colgado.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button variant="outline" disabled={enviando} onClick={() => invitar(1, 24)}>
            Enlace para una persona
          </Button>
          <Button variant="outline" disabled={enviando} onClick={() => invitar(25, 720)}>
            QR de pared (25 usos, 30 días)
          </Button>
        </div>

        {error && (
          <Alert variant="destructive" className="mt-2">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {invitaciones.length > 0 && (
          <ul className="mt-3 space-y-3">
            {invitaciones.map((i) => (
              <Invitacion
                key={i.id}
                invitacion={i}
                slug={slug}
                origen={origen}
                onCambio={() => router.refresh()}
              />
            ))}
          </ul>
        )}
      </div>

      {pendientes.length > 0 && (
        <div>
          <h3 className="text-lg font-bold">Por aprobar</h3>
          <ul className="mt-3 space-y-3">
            {pendientes.map((m) => (
              <Miembro
                key={m.perfil_id}
                organizacionId={organizacionId}
                miembro={m}
                esYo={m.perfil_id === miId}
                onCambio={() => router.refresh()}
              />
            ))}
          </ul>
        </div>
      )}

      <div>
        <h3 className="text-lg font-bold">Equipo</h3>
        <ul className="mt-3 space-y-3">
          {resto.map((m) => (
            <Miembro
              key={m.perfil_id}
              organizacionId={organizacionId}
              miembro={m}
              esYo={m.perfil_id === miId}
              onCambio={() => router.refresh()}
            />
          ))}
        </ul>
      </div>
    </div>
  )
}
