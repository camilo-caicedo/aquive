export function formatearHoras(horas: number): string {
  if (horas < 1) return 'hace menos de 1 hora'
  if (horas < 24) {
    const h = Math.floor(horas)
    return `hace ${h} ${h === 1 ? 'hora' : 'horas'}`
  }
  const dias = Math.floor(horas / 24)
  return `hace ${dias} ${dias === 1 ? 'día' : 'días'}`
}

export type Frescura = 'reciente' | 'activa' | 'antigua'

export function calcularFrescura(horas: number): Frescura {
  if (horas < 6) return 'reciente'
  if (horas < 24) return 'activa'
  return 'antigua'
}
