interface RespuestaSiteverify {
  success: boolean
}

export async function verificarTurnstile(token: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret || !token) return false

  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret, response: token }),
  })

  if (!res.ok) return false
  const data = (await res.json()) as RespuestaSiteverify
  return data.success === true
}
