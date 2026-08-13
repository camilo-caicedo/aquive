# Plan de construcción

Seis fases. Cada una termina en algo que funciona. Los prompts están
listos para pegar en Claude Code, uno por uno, sin saltarse ninguno.

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

## Después de lanzar

- Llamar a un consultorio jurídico para la revisión
- Contactar coordinadores de albergues en Cali y Pereira. **Esta es la
  tarea de mayor impacto de todas y no es código.** Sin distribución, la
  plataforma queda vacía y no ayuda a nadie.
- Publicar `metricas` como dato abierto
