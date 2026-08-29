import Link from 'next/link'

import { ENTIDADES_MATRICULA } from '@/lib/config'
import { enlaceWhatsapp } from '@/lib/contacto'
import { AVISO_CONTACTO, AVISO_CONTACTO_VERIFICADO } from '@/lib/honestidad'
import { BotonReportar } from '@/components/boton-reportar'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import type { Profesional } from '@/contrato/servicios'

export function etiquetaEntidad(valor: string) {
  return ENTIDADES_MATRICULA.find((e) => e.valor === valor)?.etiqueta ?? valor
}

/**
 * Un profesional con matrícula, entero.
 *
 * El mismo bloque en los dos sitios donde aparece: la fila del directorio y
 * su propia pantalla. No es ahorro de líneas — es que el aviso de contacto,
 * el sello de matrícula y la advertencia de «sin verificar» son lo que esta
 * pantalla promete, y dos copias se corrigen una sola vez.
 *
 * `mostrarNombre` en falso cuando el nombre ya está arriba, en el título del
 * flujo: repetirlo dos veces seguidas hace dudar de si son dos personas.
 */
export function FichaProfesional({
  profesional: p,
  mostrarNombre = true,
}: {
  profesional: Profesional
  mostrarNombre?: boolean
}) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {mostrarNombre && <span className="text-lg font-bold">{p.nombre_visible}</span>}
        {p.verificado ? (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-ok/30 bg-ok-suave px-2.5 py-0.5 text-sm font-medium text-foreground">
            <span aria-hidden="true">✓</span> Matrícula verificada
          </span>
        ) : (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-enlace/25 bg-accent px-2.5 py-0.5 text-sm font-medium text-accent-foreground">
            <span aria-hidden="true">!</span> Sin verificar
          </span>
        )}
      </div>

      <p className="mt-1 text-base">{p.profesion}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {etiquetaEntidad(p.entidad_matricula)} · Matrícula {p.numero_matricula}
      </p>

      {p.servicios.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {p.servicios.map((nombre) => (
            <li key={nombre} className="rounded-full bg-muted px-3.5 py-1.5 text-sm">
              {nombre}
            </li>
          ))}
        </ul>
      )}

      {p.descripcion && <p className="mt-2 text-base">{p.descripcion}</p>}

      {!p.verificado && (
        <Alert variant="warning" className="mt-3">
          <AlertDescription>
            Esta persona no ha verificado su matrícula profesional. Verifica su
            identidad antes de recibir cualquier servicio.
          </AlertDescription>
        </Alert>
      )}

      {/* Pegado al botón, no en el aviso del final de la lista: cada
          profesional es una decisión distinta y en un teléfono ese aviso
          queda a varias pantallas de aquí. */}
      <p className="mt-3 text-sm text-muted-foreground">
        {p.verificado ? AVISO_CONTACTO_VERIFICADO : AVISO_CONTACTO}{' '}
        <Link href="/seguridad" className="text-enlace underline underline-offset-4">
          Cómo cuidarte
        </Link>
      </p>

      {/* Arena y no lima, aunque sea la acción de la tarjeta: en una lista de
          veinte fichas ninguna de las veinte es la acción principal de la
          pantalla (regla 1). */}
      <Button
        variant="secondary"
        className="mt-3 w-full"
        nativeButton={false}
        render={
          <a
            href={
              p.contacto_tipo === 'whatsapp'
                ? enlaceWhatsapp(p.contacto_publico)
                : `tel:${p.contacto_publico}`
            }
            target={p.contacto_tipo === 'whatsapp' ? '_blank' : undefined}
            rel={p.contacto_tipo === 'whatsapp' ? 'noopener noreferrer' : undefined}
          />
        }
      >
        {p.contacto_tipo === 'whatsapp' ? 'Escribir por WhatsApp' : 'Llamar'}
      </Button>

      <div className="mt-2">
        <BotonReportar tipoObjeto="perfil" objetoId={p.id} />
      </div>
    </>
  )
}
