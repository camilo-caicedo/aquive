// Corpus dorado compartido por los dos lados del filtro de PII/contacto:
// `contienePII`/`contieneContacto` aquí y `public.contiene_pii`/
// `public.contiene_contacto` en Postgres. Las pruebas de TS
// (`validacion.test.ts`) y la de SQL (`supabase/pruebas/pii-paridad.sql`)
// leen ESTE mismo conjunto: si los dos gemelos dejan de coincidir, una de
// las dos revienta. Ya se separaron una vez —`/i` de un lado y no del
// otro— y `JUAN@GMAIL.COM` pasó por la base (CLAUDE.md regla 2).
//
// `contacto` es siempre >= `pii`: `contieneContacto` incluye `contienePII`.
// Al agregar un caso, replícalo idéntico en el .sql de paridad.

export interface CasoCorpus {
  texto: string
  pii: boolean
  contacto: boolean
}

export const CORPUS: readonly CasoCorpus[] = [
  // --- PII: correo / arroba con dominio ---
  { texto: 'JUAN@GMAIL.COM', pii: true, contacto: true },
  { texto: 'mi correo es ana@x.co', pii: true, contacto: true },
  // --- PII: teléfonos con separadores ---
  { texto: '+57 300 123 4567', pii: true, contacto: true },
  { texto: '300 123 4567', pii: true, contacto: true },
  { texto: 'placa 1234567', pii: true, contacto: true },
  // --- PII: documento con puntos ---
  { texto: 'cedula 1.234.567.890', pii: true, contacto: true },
  // --- Permitido: lista de cantidades con comas (la salida del filtro) ---
  { texto: 'tallas 38, 40, 42', pii: false, contacto: false },
  { texto: 'Necesito cobijas y agua para 3 personas', pii: false, contacto: false },
  // --- Permitido: menos de 7 dígitos seguidos ---
  { texto: 'referencia 123456', pii: false, contacto: false },
  // --- Solo contacto: mensajería / redes ---
  { texto: 'wa.me/juan', pii: false, contacto: true },
  { texto: 'escribeme por t.me/carlos', pii: false, contacto: true },
  { texto: 'instagram.com/ayuda', pii: false, contacto: true },
  // --- Solo contacto: arroba suelta de un caracter ---
  { texto: 'mi usuario es @x aqui', pii: false, contacto: true },
  // --- Solo contacto: dígitos escritos con letras ---
  { texto: 'llamame tres uno cero dos', pii: false, contacto: true },
]
