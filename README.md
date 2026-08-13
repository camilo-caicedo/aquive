# AquíVe · Ayuda directa en Colombia

Punto de partida para construir con Claude Code. No es código todavía:
son las especificaciones, el esquema de base de datos y los legales.

## Qué hay aquí

| Archivo | Para qué |
|---|---|
| `CLAUDE.md` | Contexto y **reglas duras**. Claude Code lo lee en cada sesión. Es el archivo más importante. |
| `PLAN.md` | Setup inicial y seis fases con prompts listos para pegar. Empieza aquí. |
| `docs/ESPECIFICACION.md` | Roles, flujos, modelo de datos, catálogo de ítems. |
| `supabase/schema.sql` | Esquema completo con RLS, RPC y expiración. Ejecutar antes de la fase 1. |
| `docs/legal/PLANTILLAS.md` | Aviso de privacidad, términos, autorización y avisos in-app. Rellenar los `[CORCHETES]`. |

## La idea en tres líneas

Un necesitado publica qué insumos le faltan, sin dar ningún dato personal.
Ofertadores y profesionales con matrícula ven las solicitudes y responden.
El contacto ocurre por fuera de la plataforma, y todo se borra a las 72 horas.

No es una app de mapas. Ya existen varias y funcionan.

## Por dónde empezar

1. Lee `CLAUDE.md` completo.
2. Sigue el setup de `PLAN.md`.
3. Ejecuta `supabase/schema.sql` en el SQL Editor de Supabase.
4. Pega el prompt de la Fase 1 en Claude Code.

## Lo que no es negociable

- Las solicitudes describen **cosas, no personas**
- Borrado real a las 72 horas, sin Point-in-Time Recovery
- Sin dinero, sin alojamiento de personas, sin menores, sin transporte
- El contacto nunca pasa por la plataforma

Estas reglas son la protección jurídica del proyecto, no preferencias de
diseño. Ver `CLAUDE.md`.

## Lo que decide si esto sirve

Conseguir que coordinadores de albergues en Cali y Pereira lo usen. Eso
importa más que cualquier línea de código de este repositorio, y hay que
empezarlo antes de terminar de programar.
