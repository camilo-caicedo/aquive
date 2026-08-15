# Prompt para Claude Code — ejecutar el plan v2

Copia todo lo que está debajo de la línea y pégalo en Claude Code.

---

Vas a implementar `PLAN-V2.md` en este repositorio. Antes de escribir una
sola línea, lee en este orden y completos: `CLAUDE.md`, `PLAN-V2.md`,
`docs/ESPECIFICACION.md`, `supabase/schema.sql`,
`migracion/01-CONFIGURACION.md` y `migracion/02-DOS-ENTORNOS.md`.

`CLAUDE.md` manda sobre cualquier criterio tuyo por defecto. `PLAN-V2.md`
lo amplía; donde se contradigan, pregunta en vez de elegir.

## Reglas de operación — no negociables

**1. Todo contra el proyecto de PRUEBAS de Supabase.** Nunca contra
producción, ni para leer, ni para "verificar rápido". Antes de la primera
migración confirma a cuál estás conectado con
`select current_database(), (select count(*) from public.perfiles);` — si
devuelve 5 perfiles, estás en producción: detente y avísame.

**2. Nunca ejecutes `migracion/05-datos-cuentas.sql` en pruebas.** Tiene
correos, teléfonos y una matrícula médica de personas reales. Para datos
de prueba está `migracion/98-seed-pruebas.sql`.

**3. Todo el trabajo va en `develop`.** Ya existe y es la rama actual.
Nunca hagas commit ni merge a `main` — `main` es lo que está desplegado en
producción y solo paso yo cuando el bloque esté verificado. Si crees que
algo debe ir a `main`, dímelo y para.

**4. Un commit por unidad coherente**, con mensaje en español y en el
estilo que ya usa el repositorio (`feat:`, `fix:`, `docs:`). Nada de un
commit gigante por fase.

**5. Nunca ejecutes `expirar_solicitudes()` ni ningún borrado global a
mano**, ni siquiera en pruebas. Para probar esa lógica, escribe una
variante acotada a una sola fila y bórrala después. Ver §13.5 del plan.

**6. Los despliegues de preview siempre llevan el alias
`aquive-test.vercel.app`.** Nunca dejes un preview colgando solo de la URL
aleatoria (`aquive-8f1jpwuh3-aqui-ve.vercel.app`): esas cambian en cada
despliegue y no se pueden meter en ninguna lista blanca.

Lo ideal es configurarlo **una sola vez** en Vercel → Settings → Domains,
asignando `aquive-test.vercel.app` a la rama `develop`. Así cada push a
`develop` lo recibe solo y no hay que acordarse de nada. Si eso no está
configurado, dímelo, y mientras tanto tras cada despliegue manual corre:

```bash
vercel alias set <url-del-despliegue> aquive-test.vercel.app
```

Importa porque ese hostname fijo es el que está autorizado en las
*Redirect URLs* del proyecto de pruebas de Supabase. Sin él, **el login con
Google falla en preview** y vas a perder tiempo buscando el error en el
código.

**7. Estilo del proyecto:** español en UI, copy y nombres de tablas y
columnas; inglés en funciones y variables de TypeScript. Server Components
por defecto. Toda escritura por RPC `security definer`, nunca `insert`
directo del cliente. Mobile first de verdad, sin `any`, presupuesto de JS
agresivo.

## Cómo quiero que te organices

Usa subagentes. No hagas todo en un solo hilo: se pierde contexto y se
degradan las decisiones. Reparte así, y **elige el modelo según el costo
de equivocarse**, no según el tamaño de la tarea:

**Opus** — donde un error es caro o difícil de detectar:
- Diseño de esquema, FK, `on delete`, triggers y políticas RLS
- Todo lo que toque `identidades`, cifrado, Vault o `accesos_identidad`
- La lógica de borrado y ciclo de vida (§5.7 del plan)
- Revisión de seguridad antes de cerrar cada fase

**Sonnet** — el grueso del trabajo:
- Componentes de UI, formularios, pantallas
- RPC de negocio sin implicación de seguridad
- Migraciones mecánicas ya especificadas en el plan
- Tipos de TypeScript

**Haiku** — mecánico y verificable de un vistazo:
- Renombrar, mover, reordenar imports
- Rellenar tablas de copy a partir de una lista
- Verificar conteos y correr consultas de comprobación

Después de cada fase, lanza **un agente de revisión independiente con
Opus** que no haya escrito el código, con el encargo de romperlo: que
busque específicamente fugas de PII, políticas RLS que no filtran,
funciones que quedaron con `EXECUTE` para `anon`, y cascadas que borran lo
que no deben. Su salida no es "se ve bien", es una lista de hallazgos
concretos con archivo y línea.

## Orden de ejecución y puntos de control

Construye las nueve fases en el orden del plan, **todas contra el proyecto
de pruebas**. Pero hay un punto de control obligatorio y una frontera dura.

### Punto de control: al terminar CADA fase, párate

No encadenes fases. Al cerrar cada una, entrégame:

1. Qué quedó implementado y en qué archivos.
2. El resultado real de las pruebas de esa fase (§15 del plan), pegado, no
   resumido.
3. Los hallazgos del agente revisor con Opus, y cómo quedó cada uno.
4. Qué encontraste que el plan no previó.

Y **espera mi visto bueno** antes de seguir a la siguiente. Nueve fases de
código sensible sin que un humano mire en el medio es demasiada superficie:
un error de RLS o de cascada en la Fase E no se detecta leyendo el resumen
final, se detecta mirando esa fase cuando está fresca.

### La frontera dura: construir sí, desplegar no

- **Fases A, B y C** — mejoran el Flujo 1, no tocan datos personales y son
  desplegables solas. Cuando las tres estén verificadas, te aviso y yo las
  paso a `main`. Eso saca valor a producción en días, sin esperar nada más.

- **Fases D a I** — el Flujo 2. **Puedes construirlas y probarlas en el
  proyecto de pruebas sin restricción**, siempre con documentos falsos
  (`1000000001` en adelante). Lo que **no** puede pasar a producción hasta
  que yo lo confirme es el despliegue: depende de un contrato de
  transmisión de datos con la fundación que aún no está firmado (§12.1).

Dicho corto: el bloqueo legal es sobre **recolectar cédulas reales**, no
sobre que exista el código. Construye en paralelo a lo jurídico.

## Trampas que ya están identificadas — no las redescubras

Están todas en §5.3 y §5.7 del plan con número de línea del esquema. Las
cuatro que más duelen:

- **`crear_solicitud` necesita `DROP`, no `CREATE OR REPLACE`.** Agregarle
  un parámetro crea una sobrecarga y PostgREST devuelve `PGRST203` en cada
  llamada: el Flujo 1 deja de funcionar entero.
- **`es_admin()` no sirve dentro de una política RLS.** Tiene `EXECUTE`
  revocado y falla para todo el mundo. Haz el `EXISTS` a mano contra
  `administradores`, como las políticas que ya existen.
- **Al pasar a `left join` en `solicitudes_publicas` y `leer_solicitud`,
  haz `coalesce` de `nombre`, `unidad` **y** `orden`.** Solo del nombre no
  basta: `describirItem()` renderiza "3 null de Crema dental" en el
  tablero público.
- **Los estados nuevos rompen cuatro objetos a la vez** (§5.3-1). Crea el
  predicado `estado_activo()` y úsalo en los cuatro en la misma migración.

## Trabajo contra una base compartida

El proyecto de pruebas no es desechable: es el único que hay. Marca todo
lo que crees como en §13 del plan —`barrio` y `nombre_visible` con prefijo
`PRUEBA — `, `slug` de organización con `prueba-`— y mantén
`supabase/limpiar-pruebas.sql` al día en cada fase que agregue una tabla.

Ojo con `metricas`: no tiene ninguna FK, así que las filas que deja
`cerrar_solicitud` al borrar una solicitud **no se pueden identificar
después**. Por eso `es_prueba` va en `solicitudes` y en `metricas`, y las
dos RPC tienen que propagarlo. Eso es lo primero de la Fase A.

## Antes de decir que una fase terminó

1. `npm run build` pasa sin errores ni warnings nuevos.
2. Las pruebas de esa fase en §15 del plan, ejecutadas de verdad contra el
   proyecto de pruebas, con el resultado pegado.
3. El agente revisor con Opus pasó y sus hallazgos están resueltos o
   documentados con razón.
4. El preview responde en `https://aquive-test.vercel.app` y el login con
   Google funciona ahí.
5. El tablero público sigue funcionando **con JavaScript desactivado**.
6. Ningún dato de identidad aparece en el HTML servido.
7. `git status` limpio y los commits en `develop`.

## Cuándo pararte a preguntar

- Cualquier cosa que parezca requerir violar una regla dura de `CLAUDE.md`.
- Cualquier duda sobre qué dato guardar. En este proyecto una suposición
  equivocada tiene consecuencias sobre personas reales.
- Si una decisión del plan no cuadra con lo que encuentras en el código.
- Antes de tocar `main`, siempre.
- Al terminar cada fase, sin excepción: ese es el punto de control.

Empieza leyendo los documentos y dame tu lectura del estado actual y el
plan de ataque de la Fase A antes de escribir código.
