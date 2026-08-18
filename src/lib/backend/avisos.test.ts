import { test } from 'node:test'
import assert from 'node:assert/strict'
import { drenarAvisos } from './avisos'

// El worker lee esta variable al despachar (no al importar), así que basta
// con fijarla antes de que corran las pruebas.
process.env.NEXT_PUBLIC_SITE_URL = 'https://sitio.test'

type Deps = Parameters<typeof drenarAvisos>[1]
type Aviso = Awaited<ReturnType<NonNullable<Deps>['reclamar']>>[number]

interface Registro {
  respuesta: Array<{ solicitudId: string; codigo: string; url: string }>
  ofertadores: Array<{ mc: string; mn: string; et: string; ids: string[] }>
  conversacion: Array<{
    convId: string
    texto: (codigo: string) => string
    origen: string
    excluir: { perfilId?: string; solicitante?: boolean }
  }>
  acompanamiento: Array<{ sid: string; codigo: string; url: string }>
  marcados: string[]
}

function hacerDeps(avisos: Aviso[]): { deps: NonNullable<Deps>; reg: Registro } {
  const reg: Registro = {
    respuesta: [],
    ofertadores: [],
    conversacion: [],
    acompanamiento: [],
    marcados: [],
  }
  const deps: NonNullable<Deps> = {
    reclamar: async () => avisos,
    marcar: async (id) => {
      reg.marcados.push(id)
    },
    notificarRespuesta: async (solicitudId, codigo, url) => {
      reg.respuesta.push({ solicitudId, codigo, url })
    },
    notificarOfertadores: async (mc, mn, et, ids = []) => {
      reg.ofertadores.push({ mc, mn, et, ids })
    },
    notificarConversacion: async (convId, texto, origen, excluir = {}) => {
      reg.conversacion.push({ convId, texto, origen, excluir })
    },
    notificarAcompanamiento: async (sid, codigo, url) => {
      reg.acompanamiento.push({ sid, codigo, url })
    },
    nombreMunicipio: async () => 'Cali',
  }
  return { deps, reg }
}

test('despacha respuesta con la URL del sitio y marca procesado', async () => {
  const { deps, reg } = hacerDeps([
    { id: 'a1', tipo: 'respuesta', payload: { solicitud_id: 's1', codigo: 'ABC123' } },
  ])
  const r = await drenarAvisos(50, deps)
  assert.equal(r.procesados, 1)
  assert.deepEqual(reg.respuesta[0], {
    solicitudId: 's1',
    codigo: 'ABC123',
    url: 'https://sitio.test/mis-solicitudes',
  })
  assert.deepEqual(reg.marcados, ['a1'])
})

test('despacha ofertadores resolviendo municipio y etiqueta', async () => {
  const { deps, reg } = hacerDeps([
    {
      id: 'a2',
      tipo: 'ofertadores',
      payload: { municipio_codigo: '76001', categoria: 'salud', item_ids: ['agua', 'arroz'] },
    },
  ])
  await drenarAvisos(50, deps)
  assert.deepEqual(reg.ofertadores[0], {
    mc: '76001',
    mn: 'Cali',
    et: 'Salud',
    ids: ['agua', 'arroz'],
  })
})

test('despacha acompanamiento con URL /responder/codigo', async () => {
  const { deps, reg } = hacerDeps([
    { id: 'a3', tipo: 'acompanamiento', payload: { solicitud_id: 's3', codigo: 'XYZ999' } },
  ])
  await drenarAvisos(50, deps)
  assert.deepEqual(reg.acompanamiento[0], {
    sid: 's3',
    codigo: 'XYZ999',
    url: 'https://sitio.test/responder/XYZ999',
  })
})

test('despacha las tres plantillas de conversación con su texto y excluir', async () => {
  const { deps, reg } = hacerDeps([
    { id: 'c1', tipo: 'conversacion', payload: { conversacion_id: 'k1', plantilla: 'mensaje_nuevo', excluir_perfil: 'p1', excluir_solicitante: false } },
    { id: 'c2', tipo: 'conversacion', payload: { conversacion_id: 'k2', plantilla: 'invitacion', excluir_perfil: 'p2', excluir_solicitante: false } },
    { id: 'c3', tipo: 'conversacion', payload: { conversacion_id: 'k3', plantilla: 'entrega_directa', excluir_perfil: null, excluir_solicitante: true } },
  ])
  const r = await drenarAvisos(50, deps)
  assert.equal(r.procesados, 3)
  assert.equal(reg.conversacion[0]!.texto('ABC'), 'Hay un mensaje nuevo en la coordinación de ABC')
  assert.equal(reg.conversacion[1]!.texto('ABC'), 'Te invitaron a coordinar la entrega de ABC')
  assert.equal(reg.conversacion[2]!.texto('ABC'), 'La fundación va a coordinar la entrega de ABC')
  assert.deepEqual(reg.conversacion[0]!.excluir, { perfilId: 'p1', solicitante: false })
  assert.deepEqual(reg.conversacion[2]!.excluir, { perfilId: undefined, solicitante: true })
})

test('un tipo desconocido no lanza, no se marca y sigue con el resto', async () => {
  const { deps, reg } = hacerDeps([
    { id: 'u1', tipo: 'zzz', payload: {} },
    { id: 'u2', tipo: 'respuesta', payload: { solicitud_id: 's', codigo: 'C' } },
  ])
  const r = await drenarAvisos(50, deps)
  assert.equal(r.procesados, 1)
  assert.deepEqual(reg.marcados, ['u2'])
  assert.equal(reg.respuesta.length, 1)
})
