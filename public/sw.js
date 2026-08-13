// Service worker mínimo: solo notificaciones. No cachea nada.
// La plataforma es efímera; un caché agresivo solo serviría para mostrar
// solicitudes que ya se borraron.

self.addEventListener('push', (event) => {
  if (!event.data) return

  let datos
  try {
    datos = event.data.json()
  } catch {
    return
  }

  // El cuerpo nunca incluye el contenido del mensaje, solo el código.
  event.waitUntil(
    self.registration.showNotification('AquíVe', {
      body: datos.body ?? 'Alguien respondió a tu solicitud',
      icon: '/icono-192.png',
      badge: '/icono-192.png',
      tag: datos.tag ?? 'respuesta',
      data: { url: datos.url ?? '/' },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientes) => {
      for (const cliente of clientes) {
        if (cliente.url === url && 'focus' in cliente) return cliente.focus()
      }
      return self.clients.openWindow(url)
    })
  )
})
