import { contratoChat } from './chat'
import { contratoComunidad } from './comunidad'
import { contratoAcopios } from './acopios'
import { contratoCuentas } from './cuentas'
import { contratoModeracion } from './moderacion'
import { contratoPqr } from './pqr'
import { contratoServicios } from './servicios'

// El contrato completo. Es lo único que la aplicación de Expo va a importar:
// tipos y formas, sin una línea de servidor detrás (ADR 0001, regla 2).
export const contrato = {
  servicios: contratoServicios,
  moderacion: contratoModeracion,
  chat: contratoChat,
  comunidad: contratoComunidad,
  acopios: contratoAcopios,
  cuentas: contratoCuentas,
  pqr: contratoPqr,
}

export type Contrato = typeof contrato
