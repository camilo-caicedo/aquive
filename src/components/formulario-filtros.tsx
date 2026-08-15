'use client'

import { useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

/**
 * Los filtros del tablero, sin recargar y sin volver al principio.
 *
 * Era un `<form method="get">` a secas, y cada «Filtrar» hacía una
 * navegación completa del navegador: la página se recargaba entera y el
 * scroll saltaba al encabezado. Quien estaba mirando la solicitud número
 * doce tenía que volver a bajar cada vez.
 *
 * Ahora el envío lo intercepta el router de Next con `scroll: false`: se
 * repinta solo el servidor de esa ruta y la pantalla se queda donde estaba.
 *
 * Sigue siendo un `<form method="get">` de verdad, con sus `name` y sus
 * valores: si el JavaScript no cargó, el navegador lo envía como siempre y
 * el filtro funciona igual. Lo que se pierde entonces es quedarse en el
 * sitio, que es un lujo, no la función.
 */
export function FormularioFiltros({
  action = '/',
  children,
  className,
  etiqueta = 'Filtrar',
}: {
  /** A dónde van los filtros. La ruta actual, sin query. */
  action?: string
  children: ReactNode
  className?: string
  etiqueta?: string
}) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()

  function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    // Los vacíos no viajan: un `?municipio=` suelto ensucia la URL que la
    // gente comparte y no filtra nada.
    const parametros = new URLSearchParams()
    for (const [clave, valor] of new FormData(e.currentTarget).entries()) {
      if (typeof valor === 'string' && valor !== '') parametros.set(clave, valor)
    }

    const consulta = parametros.toString()
    iniciar(() => router.push(consulta ? `${action}?${consulta}` : action, { scroll: false }))
  }

  return (
    <form
      method="get"
      action={action}
      onSubmit={enviar}
      // Mientras carga, el bloque se atenúa. Sin recarga no hay barra del
      // navegador que avise, y sin ninguna señal la gente toca dos veces.
      aria-busy={pendiente}
      className={`${className ?? ''} ${pendiente ? 'opacity-60' : ''} transition-opacity`}
    >
      {children}
      <Button type="submit" className="w-full sm:w-auto" disabled={pendiente}>
        {pendiente ? 'Buscando…' : etiqueta}
      </Button>
    </form>
  )
}
