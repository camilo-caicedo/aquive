import { Flag } from 'lucide-react'
import { CabeceraPantalla } from '@/components/cabecera-pantalla'
import { Estado } from '@/components/estado'
import { createClient } from '@/lib/supabase/server'
import type { MotivoReporte, ReporteConContenido, TipoObjetoReporte } from '@/lib/types'
import { AccionesReporte } from '../acciones-reporte'

export const metadata = { title: 'Reportes' }

const MOTIVOS: Record<MotivoReporte, string> = {
  datos_personales: 'Datos personales',
  estafa: 'Estafa',
  contenido_ofensivo: 'Contenido ofensivo',
  informacion_falsa: 'Información falsa',
  menor_de_edad: 'Menor de edad',
  extorsion_resena: 'Amenaza con una calificación',
  discriminacion: 'Discriminación',
  otro: 'Otro',
}

const DONDE: Record<TipoObjetoReporte, string> = {
  solicitud: 'En una solicitud',
  respuesta: 'En una respuesta',
  perfil: 'En un perfil',
  entidad: 'En una entidad del directorio',
  proveedor: 'En una ficha de servicios',
  resena: 'En una calificación',
}

function fecha(iso: string) {
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * La cola más delicada: una de las dos acciones destruye contenido de otra
 * persona.
 *
 * ⚠ Lo que arregla esta pantalla. Antes la tarjeta mostraba el motivo, el
 * tipo de objeto y su uuid crudo — y nada de lo reportado. Se decidía
 * entre «descartar» y «borrar» sin haber visto nunca el contenido, que es
 * firmar a ciegas. Ahora lo denunciado viene dentro
 * (`reportes_con_contenido`), y la confirmación dice qué destruye cada
 * caso, que no es lo mismo en todos.
 */
export default async function ReportesPage() {
  const supabase = await createClient()
  const { data } = await supabase.rpc('reportes_con_contenido')
  const reportes = (data as unknown as ReporteConContenido[] | null) ?? []

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <CabeceraPantalla titulo="Reportes" volver="/admin">
        <p className="mt-1 text-sm text-muted-foreground">
          {reportes.length === 0
            ? 'Nada sin atender'
            : `${reportes.length} sin atender`}
        </p>
      </CabeceraPantalla>

      {reportes.length === 0 ? (
        <Estado
          Icono={Flag}
          titulo="No hay reportes pendientes"
          detalle="Aparecen aquí en cuanto alguien marca algo como problemático."
        />
      ) : (
        <ul className="space-y-3">
          {reportes.map((r) => (
            <li key={r.id} className="rounded-2xl bg-card p-4 shadow-canto">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-base font-bold">{MOTIVOS[r.motivo]}</span>
                <span className="text-sm text-muted-foreground">{fecha(r.creado_at)}</span>
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {DONDE[r.tipo_objeto]}
                {r.titulo && <> · {r.titulo}</>}
              </p>

              {/* Lo reportado, dentro de la tarjeta. Es todo el punto de
                  esta pantalla: sin esto no se puede decidir. */}
              <div className="mt-3 rounded-lg bg-muted p-3">
                <p className="text-sm font-medium text-muted-foreground">Lo reportado</p>
                {r.existe ? (
                  <>
                    {r.contenido ? (
                      <p className="mt-1 text-sm">«{r.contenido}»</p>
                    ) : (
                      <p className="mt-1 text-sm text-muted-foreground">
                        No tiene texto escrito.
                      </p>
                    )}
                    {r.items && r.items.length > 0 && (
                      <ul className="mt-2 flex flex-wrap gap-1.5">
                        {r.items.map((it, i) => (
                          <li
                            key={i}
                            className="rounded-full bg-card px-3 py-1 text-sm shadow-canto"
                          >
                            {it}
                          </li>
                        ))}
                      </ul>
                    )}
                    {r.contexto && (
                      <p className="mt-2 text-sm text-muted-foreground">
                        <span className="font-mono">{r.contexto.codigo}</span> ·{' '}
                        {r.contexto.lugar}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Ya no existe: se borró o venció.
                  </p>
                )}
              </div>

              {r.nota && (
                <p className="mt-3 text-sm text-muted-foreground">
                  Quien reportó escribió: «{r.nota}»
                </p>
              )}

              <AccionesReporte
                reporteId={r.id}
                tipoObjeto={r.tipo_objeto}
                existe={r.existe}
              />
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
