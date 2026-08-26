import { customType, pgSchema, uuid } from 'drizzle-orm/pg-core'

// Lo que la introspección de Drizzle no sabe resolver sola, escrito a mano una
// vez. `scripts/afinar-esquema.mjs` engancha esto al archivo generado después
// de cada `npm run db:pull`.

/**
 * `bytea`. drizzle-kit lo deja como `unknown()` y rompe la compilación.
 *
 * Son cinco columnas y no son cinco cualesquiera: `identidades.nombre_cifrado`,
 * `documento_cifrado` y `telefono_cifrado`, y `referencias.nombre_cifrado` y
 * `telefono_cifrado`. Es la PII cifrada del mínimo legal 4 — la de terceros que
 * no consintieron.
 *
 * Se tipa como `Buffer` a propósito, no como `string`: lo que hay dentro son
 * bytes cifrados, y tratarlos como texto invita a imprimirlos, compararlos o
 * mandarlos a una plantilla. Un `Buffer` en un JSX es un error, que es lo que
 * queremos que pase.
 */
export const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return 'bytea'
  },
})

/**
 * `auth.users` de Supabase, reducida a lo único que necesitamos: el `id` al que
 * apuntan quince llaves foráneas.
 *
 * No se introspecta el esquema `auth` entero a propósito. Esas tablas son del
 * proveedor, cambian cuando él quiera, y traerlas al repo daría la impresión de
 * que son nuestras. Además tienen fecha de salida: el paso 6 del ADR 0001
 * mueve la autenticación a better-auth, y entonces esto se borra.
 */
export const usersInAuth = pgSchema('auth').table('users', {
  id: uuid().primaryKey().notNull(),
})
