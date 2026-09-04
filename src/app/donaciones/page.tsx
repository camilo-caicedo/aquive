import Link from 'next/link'
import Image from 'next/image'
import { MessageCircle, Phone, Plus } from 'lucide-react'

import { servidor } from '@/orpc/local'
import { enlaceWhatsapp } from '@/lib/contacto'
import { BotonChat } from '@/components/boton-chat'
import { CabeceraPantalla } from '@/components/cabecera-pantalla'
import { AccionPrincipal } from '@/components/accion-principal'
import { NOMBRE_CATEGORIA_MURO } from '@/contrato/comunidad'
import { CINTA, SOMBRA_CARTEL, TINTA_CINTA, type Familia } from '@/lib/familias'

export const metadata = { title: 'Donaciones' }

// Las categorías de donación no son oficios, así que no tienen familia propia.
// El color rota y NO informa: la palabra de la categoría va siempre escrita
// en la cinta, que es lo que dice de qué se trata.
const COLORES: Familia[] = ['amarillo', 'verde', 'rojo', 'azul']

/**
 * Pantalla 30. Donaciones: lo que sobra, para dar.
 *
 * ⚠ Se llamaba «el muro» y tenía una segunda cara —lo que falta—, retirada
 * por el ADR 0014: era un tablero de pedidos abiertos, el mismo defecto que
 * el tablero de solicitudes de servicio. Esta cara sobrevive porque son
 * donaciones —objetos, no pedidos— y quien busca sigue buscando, no
 * publicando y esperando. El ADR 0014 le dio también el nombre y la ruta que
 * tiene ahora, `/donaciones`: sin la cara «necesita» ya no hay dos caras que
 * un nombre neutro tenga que cubrir.
 *
 * Primera versión, solo tres acciones: ver donaciones (esta pantalla),
 * publicar una donación y contactar a quien la ofrece.
 */
export default async function DonacionesPage({
  searchParams,
}: {
  searchParams: Promise<{ municipio?: string; categoria?: string }>
}) {
  const params = await searchParams

  const publicaciones = await servidor.comunidad.muro({
    municipio: params.municipio,
    categoria: params.categoria,
  })

  return (
    <main className="animar-pantalla mx-auto max-w-2xl px-4 py-6">
      <CabeceraPantalla titulo="Donaciones" volver="/inicio" />
      <p className="text-base text-muted-foreground">
        Lo que alguien tiene y ya no usa. Se acuerda directamente con quien
        publicó y no pasa dinero por aquí.
      </p>

      {publicaciones.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border p-8 text-center">
          <p className="text-base text-muted-foreground">
            Todavía nadie ha publicado algo para dar.
          </p>
        </div>
      ) : (
        <ul className="revelar mt-6 space-y-3">
          {publicaciones.map((p, i) => {
            const familia = COLORES[i % COLORES.length]
            return (
              <li
                key={p.id}
                className={`overflow-hidden rounded-2xl bg-card ${SOMBRA_CARTEL[familia]}`}
              >
                <div
                  className={`flex items-center justify-between gap-2 px-4 py-2 ${CINTA[familia]} ${TINTA_CINTA[familia]}`}
                >
                  <span className="font-heading text-xs tracking-[0.085em] uppercase">
                    {NOMBRE_CATEGORIA_MURO[p.categoria] ?? p.categoria}
                  </span>
                  <span className="text-sm">
                    {[p.zona_nombre, p.municipio_nombre].filter(Boolean).join(' · ')}
                  </span>
                </div>

                {p.imagen && (
                  <Image
                    src={p.imagen}
                    alt=""
                    width={800}
                    height={450}
                    className="h-48 w-full object-cover"
                  />
                )}

                <div className="p-4">
                  <h2 className="font-heading text-lg leading-tight">{p.titulo}</h2>
                  {p.detalle && (
                    <p className="mt-1 line-clamp-3 text-base text-muted-foreground">
                      {p.detalle}
                    </p>
                  )}
                  {/* Solo la cara que ofrece tiene nombre. En la otra ni
                      siquiera existe el campo, así que no hay nada que
                      esconder aquí. */}
                  {p.autor_nombre && (
                    <p className="mt-2 text-base font-medium">
                      {/* Con ficha, el nombre lleva a ella: quien va a
                          recibir algo de alguien puede mirar antes con
                          quién habla. */}
                      {p.proveedor_id ? (
                        <Link
                          href={`/prestador/${p.proveedor_id}`}
                          className="text-enlace underline-offset-4 hover:underline"
                        >
                          {p.autor_nombre}
                        </Link>
                      ) : (
                        p.autor_nombre
                      )}
                    </p>
                  )}

                  {/* El punto de entrega, cuando lo hay: es la respuesta a
                      «¿y dónde lo recojo?», que si no se acuerda por chat
                      dando una dirección. */}
                  {p.acopio_nombre && (
                    <p className="bg-ok-suave text-foreground mt-3 rounded-xl p-3 text-base">
                      Se entrega en <strong>{p.acopio_nombre}</strong>
                      {p.acopio_direccion ? ` · ${p.acopio_direccion}` : ''}.{' '}
                      <Link
                        href="/acopios"
                        className="text-enlace underline underline-offset-4"
                      >
                        Ver el punto
                      </Link>
                    </p>
                  )}

                  {/* El contacto solo existe si esa persona tiene ficha: su
                      autorización de la donación cubre el nombre, no el
                      teléfono. Sin ficha se dice, en vez de dejar un botón
                      muerto. Tercera de las tres acciones de esta primera
                      versión: contactar, ya sea por WhatsApp o por el chat
                      de aquí dentro — nada nuevo, solo con su nombre puesto. */}
                  <p className="mt-3 font-heading text-xs tracking-[0.085em] text-muted-foreground uppercase">
                    Contactar
                  </p>
                  {p.telefono ? (
                    <div className="mt-2 flex items-center gap-2">
                      <a
                        href={enlaceWhatsapp(p.telefono)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-primary text-primary-foreground shadow-boton active:shadow-boton-hundido inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full px-4 text-base font-semibold transition-all active:translate-x-[2px] active:translate-y-[2px]"
                      >
                        <MessageCircle className="size-5" aria-hidden="true" />
                        WhatsApp
                      </a>
                      <a
                        href={`tel:${p.telefono}`}
                        aria-label={`Llamar a ${p.autor_nombre ?? 'quien ofrece'}`}
                        className="pulsable border-enlace text-enlace hover:bg-accent flex size-12 shrink-0 items-center justify-center rounded-full border transition-colors"
                      >
                        <Phone className="size-5" aria-hidden="true" />
                      </a>
                      <BotonChat
                        origen={{ tipo: 'muro', id: p.id }}
                        etiqueta={`Escribir por AquíVe sobre ${p.titulo}`}
                      />
                    </div>
                  ) : (
                    <div className="mt-2 flex items-center gap-2">
                      <BotonChat
                        origen={{ tipo: 'muro', id: p.id }}
                        etiqueta={`Escribir por AquíVe sobre ${p.titulo}`}
                      />
                      <span className="text-sm text-muted-foreground">
                        Esta persona no tiene ficha publicada, así que su
                        teléfono no sale aquí. Escríbele por AquíVe.
                      </span>
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <p className="mt-6 text-sm text-muted-foreground">
        Las donaciones se quedan mientras quien publicó las deje. Tu nombre
        aparece porque lo autorizaste, y puedes borrarlas cuando quieras.
      </p>

      <p className="mt-6 text-base">
        ¿Prefieres dejarlo en un punto?{' '}
        <Link href="/acopios" className="text-enlace underline underline-offset-4">
          Mira dónde entregar
        </Link>
        : lo dejas ahí y no tienes que dar tu dirección.
      </p>

      <AccionPrincipal
        etiqueta="Publicar una donación"
        Icono={Plus}
        href="/donaciones/publicar"
      />
    </main>
  )
}
