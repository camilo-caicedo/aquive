# TASK_PLAN: "Ver como cliente" — mensaje claro en vez de 404 cuando la ficha no es pública

**Estado:** LISTO PARA EJECUCIÓN
**Arquitecto:** Claude Code
**Constructor:** Antigravity

## Trazabilidad

- **Fuente:** `aquive-cambios.pdf`, página 6 — bug reportado por la Fundación ("SALE UN
  ERROR EN VER COMO CLIENTE")
- **Sin ADR** — es un arreglo de UX sobre un comportamiento ya correcto de la regla de
  producto 7, no un cambio de regla.

## 1. Análisis de impacto en el sistema

- **Módulo de dominio:** ninguno nuevo — `src/server/servicios/consultas.ts:ficha()` ya
  hace lo correcto (devuelve `null` cuando la ficha no está en `proveedores_publicos`).
- **Archivos a modificar:**
  - `src/app/prestador/[id]/page.tsx` — donde hoy se llama `notFound()` sin distinguir "no
    existe" de "existe pero no es pública".
  - `src/app/servicios/soy-proveedor/page.tsx` (línea ~158-164, botón "Ver como cliente").
  - `src/app/perfil/page.tsx` (línea ~336-341, fila "Ver mi ficha como la ven").
- **Archivos nuevos:** ninguno, salvo que decidas que la solución necesita un pequeño
  componente de "aviso" reusable — no es necesario para el alcance mínimo.
- **Dependencias nuevas:** ninguna.

## 2. Blueprint arquitectónico y contratos

**Causa confirmada:** `ficha()` lee de la vista `proveedores_publicos`, que exige
`telefono_verificado` (además de `acepto_publicacion` y no suspendido). Un prestador recién
creado, sin teléfono verificado, no aparece ahí — `ficha()` devuelve `null` y la página
llama `notFound()`, que es un 404 genérico igual para "esta ficha no existe" que para "esta
ficha es tuya pero todavía no se ve".

**Solución:** en `app/prestador/[id]/page.tsx`, antes de aceptar el `null` como 404 a secas,
distingue el caso donde quien visita es el dueño de esa ficha (o donde el `id` sí existe en
la tabla `proveedores` aunque no en la vista pública) y muestra un mensaje explicativo en
vez del 404 genérico — algo como: *"Tu ficha todavía no se ve como la ven los demás.
Verifica tu teléfono o consigue una referencia confirmada para que se publique."* Reusa el
texto/tono que ya usa `soy-proveedor/page.tsx:133-141` ("Tu ficha todavía no se ve"), no
inventes uno nuevo.

Si distinguir "dueño visitando su propia ficha no publicada" resulta complejo con lo que hay
hoy en el dominio, la alternativa mínima aceptable es: cuando `ficha()` devuelve `null`,
antes de 404, consultar si el `id` existe en `proveedores` (tabla, no vista) y si
`perfil_id` coincide con la sesión actual — si coincide, mostrar el aviso; si no, sí es un
404 real.

## 3. Pasos de implementación (Antigravity)

- [ ] **Paso 1:** En `app/prestador/[id]/page.tsx`, cuando `ficha()` devuelve `null`,
      distinguir "no existe" de "existe pero no es pública para el dueño que la visita".
- [ ] **Paso 2:** Mostrar el mensaje explicativo (no un 404 genérico) en el segundo caso.
- [ ] **Paso 3:** Confirmar que los dos botones "Ver como cliente" siguen apuntando al mismo
      sitio — el arreglo vive en la página de destino, no en los botones.

## 4. Criterios de aceptación

- Un prestador sin teléfono verificado que toca "Ver como cliente" ve un mensaje que explica
  por qué su ficha no es pública todavía, no un error genérico de "esta página no existe".
- Visitar `/prestador/<id-inexistente>` sigue dando 404 real.

## 5. Verificación y puerta de calidad

- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] Probar con una cuenta de prueba sin teléfono verificado.
- [ ] Aprobación del `git diff` por Claude Code.

## 6. Notas y bloqueos

- Si el dominio no expone hoy una forma limpia de saber "esta ficha existe pero no es
  pública, y quien mira es su dueño" sin duplicar lógica de la regla de producto 7,
  repórtalo aquí en vez de inventar una consulta que la esquive.
