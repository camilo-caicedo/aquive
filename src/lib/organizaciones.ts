// Lo poco que comparten el panel de administración y el del aliado.

// El código de invitación va en el PATH, no en una query string. La regla
// 6 de CLAUDE.md lo pide para el token de solicitud y el criterio vale
// igual aquí: una query string se cuela en el encabezado `Referer` hacia
// cualquier sitio al que la persona navegue después, y en los registros de
// acceso de cualquier intermediario. PLAN-V2 §5.5 lo escribía como
// `?c=<código>`; esto es lo mismo, por el camino que no se filtra solo.
// ⚠ El origen llega como parámetro, calculado en el servidor a partir de
// las cabeceras. La primera versión lo sacaba de `window.location.origin`,
// que en el servidor no existe: el HTML salía con la ruta relativa, el
// navegador la reemplazaba por la absoluta y React reventaba con un error
// de hidratación. `/solicitud/[token]` ya resolvía esto bien; esto sigue
// ese mismo camino.
export function enlaceInvitacion(origen: string, slug: string, codigo: string) {
  return `${origen}/unirse/${slug}/${codigo}`
}

// Propone la dirección corta a partir del nombre. Es una propuesta: el
// administrador la puede cambiar, y una vez creada la organización no se
// vuelve a tocar sola —el slug ya está impreso en los carteles.
export function proponerSlug(nombre: string) {
  return (
    nombre
      .normalize('NFD')
      // Fuera las tildes: el CHECK del slug solo acepta [a-z0-9-]. Se
      // quitan las marcas combinantes que deja NFD, en vez de escribirlas
      // como caracteres sueltos, que dentro de una expresión regular son
      // invisibles en el editor.
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40)
      .replace(/-+$/, '')
  )
}
