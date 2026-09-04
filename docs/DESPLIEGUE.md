# Desplegar

Lo operativo, para no tener que explicarlo otra vez cada sesión.

## Lo que hay que saber antes de tocar nada

**El proyecto NO está conectado a Git en Vercel.** Subir a GitHub **no
despliega nada**. Se comprobó: Vercel no publica ni estados ni check-runs en
este repositorio, y `gitSource` sale en `false` en los despliegues. Todo sale
del CLI, a mano.

| Dato | Valor |
| --- | --- |
| Proyecto | `aqui-ve/aquive` |
| Equipo (`orgId`) | `team_LGKEpv0nh0Gqol6SKo3hslKN` |
| Credencial | `VERCEL_TOKEN`, en `.env.vercel` (ignorado por git) |
| Rama por defecto | `main` |

⚠ El conector de Vercel de Claude está autenticado con **otra** cuenta
—Coffea Origen Co— y contra este proyecto responde `403`. No se pierda tiempo
por ahí: se usa el CLI con el token.

## Los dominios

| Dominio | Qué es |
| --- | --- |
| `aquive.co` | Producción. Lo de verdad |
| `www.aquive.co` | Redirige a `aquive.co` |
| `aquive.vercel.app` | Redirige a `aquive.co`. ⚠ Es de **producción**, no de pruebas |
| **`aquive-test.vercel.app`** | **Vista previa.** Es el alias que se revisa antes de publicar |

⚠ `aquive-test` **no es un dominio de rama**: no se asigna solo. Cada
despliegue nuevo nace con su URL única e irrepetible, y hay que apuntarle el
alias a mano. Sin ese paso, el enlace que se comparte deja de servir al
siguiente despliegue.

## Vista previa

```bash
set -a; . ./.env.vercel; set +a

npx vercel deploy --token "$VERCEL_TOKEN" --yes
# devuelve algo como https://aquive-<hash>-aqui-ve.vercel.app

npx vercel alias set aquive-<hash>-aqui-ve.vercel.app aquive-test.vercel.app \
  --token "$VERCEL_TOKEN" --scope aqui-ve
```

Los dos pasos, siempre. El segundo es el que se olvida.

## Producción

```bash
set -a; . ./.env.vercel; set +a
npx vercel deploy --prod --token "$VERCEL_TOKEN" --yes
```

Sale a `aquive.co` en cuanto termina. Va **con permiso explícito** y desde
`main`, que es la rama por defecto y con la que se integra por PR.

## Comprobar que salió lo que se cree

El despliegue puede quedar `READY` y servir la compilación anterior, así que
se mira el CSS servido y no la consola de Vercel:

```bash
U=https://aquive-test.vercel.app
curl -s -o /dev/null -w "%{http_code}\n" $U/inicio
CSS=$(curl -s $U/inicio | grep -o '/_next/static/[^"]*\.css' | head -1)
curl -s "$U$CSS" | grep -o 'una-regla-que-acabas-de-tocar[^}]*}'
```

## Si hace falta conectar el repositorio

`vercel git connect` haría que cada push despliegue solo y que Vercel
mantenga el alias de rama sin que nadie lo toque. **No está hecho**, y hasta
que se haga, lo de arriba es el procedimiento.
