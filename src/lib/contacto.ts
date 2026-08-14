/**
 * Arma el enlace de WhatsApp a partir de lo que la persona escribió.
 *
 * wa.me exige el número con indicativo de país y sin signos. Casi todo el
 * mundo escribe su celular colombiano a secas —diez dígitos que empiezan en
 * 3— y para ese caso se asume 57. Cualquier otra cosa (un `+` al frente, o
 * más de diez dígitos) ya trae indicativo y se respeta tal cual.
 *
 * Sin esto, un profesional que ofrece acompañamiento desde fuera del país
 * quedaba con un enlace roto: se le anteponía 57 a un número que ya tenía
 * su propio indicativo.
 */
export function enlaceWhatsapp(contacto: string): string {
  const digitos = contacto.replace(/\D/g, '')
  const celularColombiano = !contacto.trim().startsWith('+') && /^3\d{9}$/.test(digitos)
  return `https://wa.me/${celularColombiano ? '57' : ''}${digitos}`
}
