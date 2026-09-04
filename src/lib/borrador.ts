'use client'

import { useEffect, useRef } from 'react'
import { useAviso } from '@/components/avisos'

/** Cuánto espera desde la última tecla antes de volcar a `localStorage`. */
const DEBOUNCE_MS = 500

/**
 * Guarda un formulario largo en `localStorage` mientras se escribe, para
 * que un cierre accidental —recarga, atrás, o que el sistema se coma la
 * pestaña por memoria— no obligue a volver a escribirlo todo. Arregla el
 * mecanismo 1 de CLAUDE.md: el alta de proveedor y el registro guardaban
 * todo en `useState` y en ningún almacenamiento, así que cualquier
 * desmontaje lo borraba entero.
 *
 * Mismo cuidado que `destino.ts` y `volver.tsx` con su `sessionStorage`:
 * todo acceso va en try/catch. El modo privado de iOS tira excepción al
 * tocar `localStorage`, y una excepción aquí no puede tumbar el
 * formulario que esto intenta salvar — sería peor el remedio que la
 * enfermedad.
 *
 * `clave` lleva versión —`aquive:borrador:proveedor:v1`— para poder
 * invalidar borradores viejos el día que cambie la forma de `datos`: basta
 * con subir el número y los anteriores quedan huérfanos, sin que haga
 * falta migrarlos.
 *
 * No guarda nada que no deba vivir en el dispositivo: ni token, ni nada
 * que `datos` no traiga. Eso lo decide quien llama, armando el objeto
 * plano que pasa aquí.
 */
export function useBorrador<T extends Record<string, unknown>>(
  clave: string,
  datos: T,
  alRestaurar: (datos: T) => void,
  opciones?: { habilitado?: boolean },
) {
  const habilitado = opciones?.habilitado ?? true
  const avisar = useAviso()
  const yaRestaurado = useRef(false)
  const esPrimeraEscritura = useRef(true)
  // En un `ref` para que el efecto de restaurar no tenga que llevar la
  // función entera en sus dependencias: cambiaría en cada render y
  // volvería a intentar restaurar.
  const alRestaurarRef = useRef(alRestaurar)
  alRestaurarRef.current = alRestaurar

  // Restaura una sola vez, al montar. Antes que el volcado de abajo:
  // guardar primero pisaría el borrador con el estado inicial (vacío)
  // antes de que nadie llegara a leerlo.
  useEffect(() => {
    if (!habilitado || yaRestaurado.current) return
    yaRestaurado.current = true
    try {
      const guardado = localStorage.getItem(clave)
      if (guardado) {
        alRestaurarRef.current(JSON.parse(guardado) as T)
        avisar('Recuperamos lo que habías escrito')
      }
    } catch {
      // Nada que restaurar: modo privado, cuota llena, o el JSON guardado
      // no es válido. El formulario sigue con lo que traía.
    }
    // Solo al montar: `clave` y `habilitado` no cambian en la vida de un
    // mismo formulario montado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const serializado = JSON.stringify(datos)

  // Vuelca a `localStorage` con debounce: escribir en cada tecla sería
  // demasiado. Se salta la pasada que sigue a la restauración de arriba,
  // que volvería a escribir exactamente lo que se acaba de leer.
  useEffect(() => {
    if (!habilitado) return
    if (esPrimeraEscritura.current) {
      esPrimeraEscritura.current = false
      return
    }
    const temporizador = setTimeout(() => {
      try {
        localStorage.setItem(clave, serializado)
      } catch {
        // Modo privado o cuota llena: se pierde el borrador, no el envío
        // que la persona está a punto de hacer.
      }
    }, DEBOUNCE_MS)
    return () => clearTimeout(temporizador)
  }, [habilitado, clave, serializado])

  return {
    /** Borra el borrador. Se llama cuando el guardado al servidor tuvo éxito. */
    limpiar: () => {
      try {
        localStorage.removeItem(clave)
      } catch {
        // Sin almacenamiento no hay nada que limpiar.
      }
    },
  }
}
