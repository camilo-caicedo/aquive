import { BadgeCheck, ExternalLink, TriangleAlert } from 'lucide-react'
import { CabeceraPantalla } from '@/components/cabecera-pantalla'
import { Estado } from '@/components/estado'
import { createClient } from '@/lib/supabase/server'
import { listarMunicipios, mapaDeNombres } from '@/lib/municipios'
import { ENTIDADES_MATRICULA, REGISTROS_MATRICULA } from '@/lib/config'
import type { EntidadMatricula } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { AccionesServidor } from '../acciones-servidor'

export const metadata = { title: 'Matrículas por verificar' }

function etiquetaEntidad(valor: EntidadMatricula) {
  return ENTIDADES_MATRICULA.find((e) => e.valor === valor)?.etiqueta ?? valor
}

/**
 * La cola de matrículas.
 *
 * Dos cosas nuevas frente a la pestaña que reemplaza. El enlace al
 * registro de la entidad, porque verificar es ir a mirar si ese número
 * aparece y hasta ahora eso se buscaba a mano cada vez. Y el caso de
 * `OTRA` dicho de frente: esa entidad no tiene registro consultable, así
 * que no se puede verificar nunca — la salida honesta es dejarlo sin
 * sello, y sin sello el perfil no ha sido revisado en absoluto.
 */
export default async function MatriculasPage() {
  const supabase = await createClient()

  // `perfiles` va en consulta aparte, no embebida: los tipos escritos a
  // mano declaran `Relationships: []`, así que PostgREST no puede resolver
  // `servidores -> perfiles` a nivel de tipos.
  const [{ data: servidores }, { data: perfiles }, municipios] = await Promise.all([
    supabase.from('servidores').select('*').eq('verificado', false),
    // Sin filtrar por tipo: el vínculo real es servidores.perfil_id, y si
    // el tipo del perfil no coincidiera, la cola mostraría «Perfil sin
    // nombre» y no se sabría a quién se está verificando.
    supabase.from('perfiles').select('id, nombre_visible, municipios, suspendido'),
    listarMunicipios(supabase),
  ])

  const porPerfil = new Map((perfiles ?? []).map((p) => [p.id, p]))
  // El código DANE no le dice nada a quien está verificando una matrícula.
  const nombreMunicipio = mapaDeNombres(municipios ?? [])
  const cola = servidores ?? []

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <CabeceraPantalla titulo="Matrículas" volver="/admin">
        <p className="mt-1 text-base text-muted-foreground">
          {cola.length === 0
            ? 'Nada por verificar'
            : `${cola.length} por verificar`}
        </p>
      </CabeceraPantalla>

      <p className="rounded-2xl bg-accent p-4 text-base leading-relaxed text-accent-foreground">
        Consulta el número en el registro de la entidad antes de marcarlo.
        Verificar solo dice que ese número aparece ahí: ni identidad, ni
        experiencia, ni intenciones.
      </p>

      {cola.length === 0 ? (
        <div className="mt-4">
          <Estado
            Icono={BadgeCheck}
            titulo="No hay matrículas pendientes"
            detalle="Aparecen aquí en cuanto alguien publica un perfil con matrícula."
          />
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {cola.map((s) => {
            const perfil = porPerfil.get(s.perfil_id)
            const registro = REGISTROS_MATRICULA[s.entidad_matricula]
            return (
              <li key={s.perfil_id} className="rounded-2xl bg-card p-4 shadow-canto">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-heading text-lg leading-tight">
                    {perfil?.nombre_visible ?? 'Perfil sin nombre'}
                  </span>
                  {perfil?.suspendido && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-enlace/25 bg-accent px-2.5 py-0.5 text-sm font-medium text-accent-foreground">
                      <TriangleAlert className="size-4" aria-hidden="true" />
                      Suspendido
                    </span>
                  )}
                </div>
                <p className="mt-1 text-base">
                  {s.profesion}
                  {perfil && perfil.municipios.length > 0 && (
                    <>
                      {' · '}
                      {perfil.municipios.map((c) => nombreMunicipio.get(c) ?? c).join(' · ')}
                    </>
                  )}
                </p>

                {/* El par que se va a copiar al registro de la entidad, con
                    su etiqueta y en mono: es lo único de la tarjeta que se
                    teclea en otra parte, y equivocar un dígito aquí es
                    poner un sello que no corresponde. */}
                <div className="mt-3 rounded-xl bg-background p-3">
                  <p className="font-heading text-xs tracking-[0.085em] uppercase text-muted-foreground">
                    Entidad
                  </p>
                  <p className="mt-0.5 text-base font-medium">
                    {etiquetaEntidad(s.entidad_matricula)}
                  </p>
                  <p className="mt-2.5 font-heading text-xs tracking-[0.085em] uppercase text-muted-foreground">
                    Matrícula
                  </p>
                  <p className="mt-0.5 font-mono text-lg font-semibold">
                    {s.numero_matricula}
                  </p>
                </div>

                {registro ? (
                  <Button
                    variant="outline"
                    className="mt-3 w-full"
                    nativeButton={false}
                    render={
                      <a href={registro} target="_blank" rel="noopener noreferrer" />
                    }
                  >
                    <ExternalLink className="size-4" aria-hidden="true" />
                    Abrir el registro de {s.entidad_matricula}
                  </Button>
                ) : (
                  // `OTRA`: sin registro consultable no hay nada que mirar,
                  // y fingir que sí lo hay es peor que decirlo.
                  <p className="mt-3 rounded-xl bg-accent p-3 text-base text-accent-foreground">
                    Esa entidad no tiene registro consultable. Sin registro no
                    se puede verificar: el perfil se queda sin sello, y sin
                    sello no ha sido revisado en absoluto.
                  </p>
                )}

                <AccionesServidor
                  perfilId={s.perfil_id}
                  sinRegistro={!registro}
                  suspendido={!!perfil?.suspendido}
                />
              </li>
            )
          })}
        </ul>
      )}

      {cola.length > 0 && (
        <p className="mt-6 text-base leading-relaxed text-muted-foreground">
          Sin sello el perfil se muestra con advertencia visible, no escondido.
          «Sin verificar» y «no aplica» no son lo mismo, y la ficha lo dice.
        </p>
      )}
    </main>
  )
}
