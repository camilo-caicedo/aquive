import * as React from "react"

import { cn } from "@/lib/utils"

// AquíVe: `bg-muted` y no el `bg-accent` de shadcn. Aquí `--accent`
// (#fef6de) tiene significado asignado —pendiente, por vencer, en cola— y
// lo usa `alert.tsx` en su variante `warning`; un hueco de carga con ese
// color diría algo que no es. `--muted` (#f0e8da) es el que ya usaban a
// mano los placeholders de los mapas.
//
// `animate-pulse` de Tailwind anima SOLO opacidad, así que cumple la regla
// 13 de AGENTS.md, y el bloque global de `prefers-reduced-motion` de
// `globals.css` lo deja quieto sin necesidad de una regla propia.
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("bg-muted animate-pulse rounded-md", className)}
      {...props}
    />
  )
}

export { Skeleton }
