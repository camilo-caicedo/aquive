import { oc } from '@orpc/contract'
import { z } from 'zod'

// Centros de acopio (ADR 0008). Un lugar físico donde se dejan y se
// entregan cosas. Lo lleva el rol de aliado, que se mantiene.

export const Acopio = z.object({
  id: z.uuid(),
  nombre: z.string(),
  tipo: z.string(),
  municipios: z.array(z.string()),
  direccion: z.string().nullable(),
  horario: z.string().nullable(),
  telefono: z.string().nullable(),
  /**
   * El punto del mapa.
   *
   * ⚠ Sin casilla de consentimiento, a diferencia de un prestador (ADR
   * 0004): la dirección de una bodega no es el domicilio de una persona,
   * así que no hay una segunda finalidad que autorizar. Es la diferencia
   * que justifica tratarlos distinto.
   */
  latitud: z.number().nullable(),
  longitud: z.number().nullable(),
})

export type Acopio = z.infer<typeof Acopio>

export const contratoAcopios = {
  /** Los que se pueden enseñar, para la lista y el mapa. */
  lista: oc
    .input(
      z.object({
        municipio: z.string().regex(/^[0-9]{5}$/).optional().catch(undefined),
      }),
    )
    .output(z.array(Acopio)),
}
