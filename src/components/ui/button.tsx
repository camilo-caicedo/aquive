import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  // AquíVe: `rounded-full` en vez de `rounded-lg` — la identidad usa
  // píldoras. Los altos no cambian: el mínimo táctil de 48px sigue igual.
  "group/button inline-flex shrink-0 items-center justify-center rounded-full border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-[transform,box-shadow,background-color,border-color,color,opacity] duration-[var(--dur-toque)] ease-[var(--curva-suave)] outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // AquíVe: el prensado de cartel. La sombra dura de 3 px baja a 1 px
        // mientras el botón se desplaza 2 px hacia ella — el gesto de un
        // sello sobre papel, que es de donde sale la identidad (ADR 0002).
        //
        // ⚠ Estaba copiado a mano en nueve archivos y el botón compartido
        // hacía un `translate-y-px` de UN píxel, así que un puñado de
        // botones tenía el gesto bueno y todos los demás uno que no se ve.
        // Vive aquí, y de aquí lo hereda toda la aplicación.
        //
        // Solo en la lima, que es la acción principal —una por pantalla,
        // regla de interfaz 2—: veinte sombras duras en una pantalla no son
        // una identidad, son ruido.
        default:
          "bg-primary text-primary-foreground shadow-boton hover:bg-primary/80 active:not-aria-[haspopup]:translate-x-[2px] active:not-aria-[haspopup]:translate-y-[2px] active:not-aria-[haspopup]:shadow-boton-hundido",
        // Las secundarias se hunden encogiendo, sin sombra: dan la misma
        // respuesta al dedo sin competir con la principal.
        outline:
          "border-border bg-background hover:bg-muted hover:text-foreground active:not-aria-[haspopup]:scale-[0.97] aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] active:not-aria-[haspopup]:scale-[0.97] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        // `ghost` y `link` se quedan solo con color. Son lo secundario de lo
        // secundario y un gesto ahí compite con la acción de la pantalla.
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 active:not-aria-[haspopup]:scale-[0.97] focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-enlace underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        // AquíVe: mínimo táctil 48px / texto 16px (CLAUDE.md, accesibilidad).
        // Es el tamaño por defecto del proyecto — usar los demás solo si el
        // control es secundario y no necesita cumplir ese mínimo.
        touch: "h-12 gap-2 rounded-full px-4 text-base",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "touch",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "touch",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
