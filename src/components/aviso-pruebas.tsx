/**
 * La franja que avisa de que esto no es el sitio de verdad.
 *
 * Solo fuera de producción, por la misma variable que decide el `robots.txt`:
 * si algún día se despliega esto a producción por error, el aviso no
 * aparece y no hay que acordarse de quitarlo.
 *
 * No va `sticky`: el encabezado sí lo es, así que al bajar la franja se va
 * y el encabezado se queda. Se lee al entrar y en cada cambio de página,
 * que es cuando hace falta, sin robarle cuarenta píxeles permanentes a una
 * pantalla de teléfono que ya tiene la barra de abajo.
 */
export function AvisoPruebas() {
  if (process.env.VERCEL_ENV === 'production') return null

  return (
    <div className="bg-primary text-primary-foreground">
      <p className="mx-auto max-w-3xl px-4 py-2 text-center text-sm">
        Solo para pruebas. La aplicación de verdad es{' '}
        <a
          href="https://aquive.co"
          className="font-semibold underline underline-offset-2"
        >
          aquive.co
        </a>
        .
      </p>
    </div>
  )
}
