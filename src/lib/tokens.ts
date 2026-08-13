import { randomBytes, createHash } from 'node:crypto'

// 32 bytes aleatorios en base64url. Se muestra al solicitante una sola vez.
export function generarToken(): string {
  return randomBytes(32).toString('base64url')
}

// Coincide con encode(digest(p_token, 'sha256'), 'hex') en las RPC de Postgres.
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}
