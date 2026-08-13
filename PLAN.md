# Plan de construcción

Seis fases. Cada una termina en algo que funciona. Los prompts están
listos para pegar en Claude Code, uno por uno, sin saltarse ninguno.

> **Estado: las seis fases están implementadas.** Lo que queda antes de
> lanzar no es código: llenar los `[CORCHETES]` (nombre completo y correo
> del proyecto en `src/lib/config.ts`, `.env.local` y las páginas legales),
> restaurar las llaves reales de Turnstile, agendar la revisión jurídica y
> hablar con coordinadores de albergues. Ver la lista al final.

## Antes de empezar

```bash
mkdir aquive && cd aquive
npx create-next-app@latest . --typescript --tailwind --app --eslint
npm i @supabase/supabase-js @supabase/ssr web-push
npm i -D @types/web-push
npx web-push generate-vapid-keys        # guarda las dos llaves
git init && git add -A && git commit -m "init"
```

Copia `CLAUDE.md`, `docs/` y `supabase/` a la raíz del proyecto.

`.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
TURNSTILE_SECRET_KEY=
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
```

En el dashboard de Supabase: ejecuta `supabase/schema.sql`, activa Google
como proveedor de Auth, y **confirma que Point-in-Time Recovery está
desactivado**.

### Skills de usuario disponibles — cuáles usar aquí

Regla general: son auditoría/apoyo, no autoridad. CLAUDE.md manda sobre su
criterio por defecto siempre. Úsalas después de construir cada pantalla,
no antes. Si una sugiere algo vistoso que cueste JS, contraste o peso de
imagen, no lo tomes.

**Buenas, usar sin reparo:**
- `/accesslint` — auditoría WCAG real, encaja con el AA obligatorio
- `/web-design-guidelines` — checklist accesibilidad/UX, no impone estética
- `/minimalist-ui` — plano, monocromo, sin sombras/gradiente pesado; la
  única skill de "taste" cuyo default ya se parece al tono del proyecto
- `/vercel-optimize` — Core Web Vitals, Function Invocations; directo al
  plan Hobby + Android gama baja
- `/vercel-react-best-practices`, `/vercel-composition-patterns` — patrones
  Next.js/React, sin relación con estética
- `/deploy-to-vercel`, `/vercel-cli-with-tokens` — para cuando deployes
- `/full-output-enforcement` — evita código a medias
- `/security-review` — correr antes de lanzar, dado el alcance legal-sensible

**Dudosas, usar solo como auditoría puntual, recortar contra CLAUDE.md:**
- `/impeccable`, `/ui-ux-pro-max` — ver notas por fase abajo
- `design-taste-frontend` — "anti-slop" genérico pero asertivo, revisar
  cada sugerencia
- `redesign-existing-projects` — solo para pulido post-MVP, no antes
- `writing-guidelines`, `typography`, `design-audit`,
  `adaptive-communication`, `relationship-design`, `bencium-*-ux-designer`
  — sin descripción completa revisada; mirar antes de invocar a ciegas
- `dataviz` — solo cuando publiques `metricas` como dato abierto

**Evitar, chocan con reglas del proyecto:**
`apple-design`, `gpt-taste`, `industrial-brutalist-ui`,
`high-end-visual-design`, `stitch-design-taste` (motion pesado o estética
"premium", contra "sin animaciones pesadas" y presupuesto de JS agresivo);
`find-animation-opportunities`, `improve-animations`, `review-animations`
(no hay animación que agregar); `image-to-code`,
`imagegen-frontend-mobile`, `imagegen-frontend-web` (imágenes pesadas,
malo para red lenta); `vercel-react-view-transitions` (transición
innecesaria); `vercel-react-native-skills` (app nativa fuera de alcance).

---

## Fase 1 — Base de datos y tipos

> Lee CLAUDE.md y docs/ESPECIFICACION.md completos.
>
> Ya ejecuté supabase/schema.sql en Supabase. Necesito:
> 1. `lib/supabase/client.ts` y `lib/supabase/server.ts` con @supabase/ssr
> 2. `lib/types.ts` con los tipos TypeScript que corresponden exactamente
>    al esquema, incluyendo las vistas públicas
> 3. `lib/tokens.ts` con generación de token (32 bytes base64url usando
>    crypto de Node) y helper de sha256
>
> No crees UI todavía. No uses `any`. El token en claro nunca debe poder
> llegar a un Client Component.

## Fase 2 — Publicar solicitud

> Implementa el flujo F1 de la especificación.
>
> - `app/publicar/page.tsx`: formulario de 3 pasos (municipio+barrio →
>   categoría+ítems → nota+confirmar). Mobile first, botones de 48px,
>   texto de 16px mínimo.
> - `app/api/solicitudes/route.ts`: valida Turnstile, genera el token,
>   llama a la RPC `crear_solicitud` con el service role, devuelve
>   `{ codigo, token }`.
> - `app/solicitud/[token]/page.tsx`: pantalla de confirmación con el
>   código grande, botón de copiar enlace, y QR generado en cliente.
>
> Reglas de CLAUDE.md que aplican aquí: sin texto libre fuera de la nota,
> validación de PII en cliente y en servidor, aviso permanente sobre el
> formulario con el texto de docs/legal/PLANTILLAS.md sección 4.
>
> Guarda el enlace en localStorage bajo la clave `mis_solicitudes`.

> Después: `/impeccable` y `/accesslint scan` sobre el formulario de 3
> pasos (es el flujo más usado, por gente en crisis con celulares viejos).

## Fase 3 — Tablero público

> Implementa F2. `app/page.tsx` como Server Component que lee la vista
> `solicitudes_publicas`.
>
> - Filtros por municipio y categoría vía searchParams (sin JS de cliente)
> - Cada tarjeta: código, municipio, barrio, ítems, tiempo desde la última
>   confirmación, número de respuestas
> - Badge de frescura: verde bajo 6 h, amarillo bajo 24 h, gris por encima
> - Paginación por cursor, 20 por página
> - Debe funcionar con JavaScript desactivado
>
> Verifica que en el HTML servido no aparezca ningún token ni nada
> identificable.

> Después: `/ui-ux-pro-max ui-styling` para el sistema de tarjetas y
> badges de frescura — debe seguir siendo legible sin color (daltonismo)
> y sin JS.

## Fase 4 — Cuentas, ofertadores y servidores

> Implementa F3 y F5.
>
> - Login con Google vía Supabase Auth. En `app/auth/callback/route.ts`
>   crea el perfil usando **solo** el id de usuario. No persistas el
>   correo en ninguna tabla; si aparece en el objeto de sesión, ignóralo.
> - `app/registro/page.tsx`: elegir tipo (ofertador o servidor), nombre
>   visible, municipios, contacto público, y para servidores la entidad y
>   el número de matrícula. Checkbox de autorización con el texto exacto
>   de docs/legal/PLANTILLAS.md sección 3, guardando la marca de tiempo.
> - Botón "Puedo ayudar" en cada solicitud, con mensaje de máximo 200
>   caracteres.
> - `app/servidores/page.tsx`: directorio leyendo `servidores_publicos`,
>   verificados primero, no verificados con la advertencia del documento.

> Después: `/impeccable` sobre registro y directorio — checkbox de
> autorización y sello de verificado son los puntos críticos de claridad.

## Fase 5 — Notificaciones push

> Implementa las notificaciones.
>
> - `public/sw.js`: service worker que maneja `push` y `notificationclick`
> - `lib/push.ts`: suscripción en cliente, envío desde servidor con
>   `web-push` y las llaves VAPID
> - Al responder una solicitud, enviar push a todas las suscripciones de
>   esa solicitud. El cuerpo dice solo "Alguien respondió a tu solicitud
>   [CÓDIGO]" — nunca el contenido del mensaje.
> - En iOS, detectar que no está en modo standalone y mostrar
>   instrucciones para agregar a pantalla de inicio.
> - Si la suscripción devuelve 404 o 410, borrarla.
>
> Fallback obligatorio: todo debe funcionar sin push, volviendo al enlace.

## Fase 6 — Cierre, moderación y legales

> Últimos pendientes:
>
> - Botón "Ya me ayudaron" → RPC `cerrar_solicitud` → pantalla de
>   agradecimiento explicando que los datos se borraron
> - Botón "Renovar 72 horas" en la vista con token
> - Botón de reportar en solicitudes, respuestas y perfiles
> - `app/admin/page.tsx` protegido por la tabla `administradores`: cola de
>   reportes y verificación manual de matrículas
> - Páginas `/privacidad` y `/terminos` con el contenido de
>   docs/legal/PLANTILLAS.md, enlazadas desde el pie
> - Pie de página con las líneas de emergencia
> - Verificar: sin analytics de URL completa, sin PII en logs

---

## Pruebas manuales antes de lanzar

1. Publicar una solicitud y confirmar que en Supabase la fila **no**
   contiene nada identificable
2. Intentar poner un celular en la nota → debe rechazarse
3. Perder el enlace y comprobar que efectivamente no hay recuperación
4. Correr `select public.expirar_solicitudes();` y verificar que las filas
   se **borran**, no se marcan
5. Confirmar que `metricas` no permite reconstruir ninguna solicitud
6. Abrir el tablero sin sesión y revisar el HTML crudo buscando tokens
7. Probar completo en un Android de gama baja con red lenta
8. Probar push en Android y el fallback en iOS
9. Correr `/accesslint scan` y `/security-review` sobre el sitio completo

## Pendientes que NO son código (bloquean el lanzamiento)

1. `src/lib/config.ts` → `RESPONSABLE`: poner el nombre completo real.
   Aparece en el texto de autorización que firma cada ofertador, así que
   tiene efecto legal.
2. `src/app/privacidad/page.tsx` y `src/app/terminos/page.tsx`: reemplazar
   `[CORREO]` y `[FECHA]`.
3. `.env.local`: `VAPID_SUBJECT` con el correo real del proyecto, y
   restaurar las llaves reales de Turnstile (están comentadas arriba de
   las de prueba). Las de prueba dejan pasar a cualquiera.
4. En Cloudflare Turnstile, agregar el dominio de producción a los
   hostnames del widget.
5. Supabase → confirmar Point-in-Time Recovery desactivado.
6. Insertar la primera fila en `administradores` a mano, con el id del
   usuario que va a moderar. Sin eso, `/admin` no es accesible para nadie.

## Después de lanzar

- Llamar a un consultorio jurídico para la revisión
- Contactar coordinadores de albergues en Cali y Pereira. **Esta es la
  tarea de mayor impacto de todas y no es código.** Sin distribución, la
  plataforma queda vacía y no ayuda a nadie.
- Publicar `metricas` como dato abierto
