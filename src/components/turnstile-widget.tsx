'use client'

import { useEffect, useRef, useState } from 'react'

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: { sitekey: string; callback: (token: string) => void; 'expired-callback'?: () => void }
      ) => string
      reset: (widgetId?: string) => void
    }
  }
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js'

export function TurnstileWidget({
  siteKey,
  onToken,
}: {
  siteKey: string
  onToken: (token: string | null) => void
}) {
  const contenedorRef = useRef<HTMLDivElement>(null)
  const [scriptListo, setScriptListo] = useState(() => typeof window !== 'undefined' && !!window.turnstile)

  useEffect(() => {
    if (scriptListo) return
    const existente = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`)
    if (existente) {
      existente.addEventListener('load', () => setScriptListo(true))
      return
    }
    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.onload = () => setScriptListo(true)
    document.body.appendChild(script)
  }, [scriptListo])

  useEffect(() => {
    if (!scriptListo || !contenedorRef.current || !window.turnstile) return
    window.turnstile.render(contenedorRef.current, {
      sitekey: siteKey,
      callback: onToken,
      'expired-callback': () => onToken(null),
    })
  }, [scriptListo, siteKey, onToken])

  return <div ref={contenedorRef} />
}
