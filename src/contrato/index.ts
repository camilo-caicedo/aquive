import { contratoServicios } from './servicios'

// El contrato completo. Es lo único que la aplicación de Expo va a importar:
// tipos y formas, sin una línea de servidor detrás (ADR 0001, regla 2).
export const contrato = {
  servicios: contratoServicios,
}

export type Contrato = typeof contrato
