// El esquema de la base, tipado. Punto de entrada único: importa de aquí y
// no de `./generado/schema`, para que el día que la introspección cambie de
// forma haya un solo archivo que ajustar.
//
// `generado/schema.ts` y `generado/relations.ts` los escribe
// `npm run db:pull` leyendo el catálogo de Postgres de la base de PRUEBAS.
// NO los edites a mano: el próximo `pull` te los pisa.
//
// Cómo cambia el esquema, que no es por aquí (ADR 0001):
//
//   1. Se escribe el SQL en `supabase/migraciones/`.
//   2. Se aplica con `node migracion/aplicar.mjs test <archivo.sql>`.
//   3. `npm run db:pull` regenera estos tipos.
//
// La base manda y los tipos la siguen, nunca al revés. Por eso Drizzle no
// tiene aquí carpeta de migraciones propia: dos fuentes de verdad sobre el
// esquema de una base con datos de personas es exactamente el problema que
// el ADR 0001 quiere evitar.

export * from './generado/schema'
export * from './generado/relations'
