// Aparece en el texto de autorización que firma cada ofertador y servidor
// (docs/legal/PLANTILLAS.md sección 3) y en las páginas legales, así que
// tiene efecto legal. Debe coincidir con lo que diga PLANTILLAS.md.
export const RESPONSABLE = 'Juan Camilo Caicedo Sepulveda'
export const CORREO_CONTACTO = 'aquive@coffeaorigen.co'
export const FECHA_LEGALES = '13 de agosto de 2026'

export const ENTIDADES_MATRICULA = [
  { valor: 'COPNIA', etiqueta: 'COPNIA — Ingeniería' },
  { valor: 'CPNAA', etiqueta: 'CPNAA — Arquitectura' },
  { valor: 'COLPSIC', etiqueta: 'COLPSIC — Psicología' },
  { valor: 'ReTHUS', etiqueta: 'ReTHUS — Profesiones de la salud' },
  { valor: 'SIRNA', etiqueta: 'SIRNA — Derecho' },
  { valor: 'OTRA', etiqueta: 'Otra entidad' },
] as const
