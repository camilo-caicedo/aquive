import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Las imágenes aprobadas se sirven del bucket público del almacén. El
  // patrón se limita a ese host y a esa ruta: `next/image` optimiza lo que
  // le digan, y una lista abierta lo convierte en un optimizador gratis para
  // cualquiera que le pase una URL.
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lcceoyzmlhmqodnwgmwu.supabase.co',
        pathname: '/storage/v1/object/public/publico/**',
      },
    ],
  },
  // `/servidores` era una pantalla con tres pestañas y ahora cada lista
  // tiene ruta propia. La URL vieja está pegada en WhatsApp y en volantes,
  // así que se redirige.
  //
  // ⚠ Va aquí y no en una página con `permanentRedirect`: un redirect
  // desde un Server Component responde 200 con la instrucción dentro del
  // HTML, así que un rastreador o la vista previa de WhatsApp se lleva una
  // página en blanco. Esto emite un 308 de verdad, y Next arrastra solo el
  // query string a la ruta nueva.
  async redirects() {
    return [
      {
        source: '/servidores',
        has: [{ type: 'query', key: 'ver', value: 'profesionales' }],
        destination: '/profesionales',
        permanent: true,
      },
      { source: '/servidores', destination: '/entidades', permanent: true },
      // La otra puerta vieja: `/servicios` a secas es el directorio, y
      // lleva meses en carteles de albergues. Redirigía a `/` desde una
      // página, y desde que `/` da la bienvenida eso mandaba a la pantalla
      // de entrada a quien venía siguiendo un cartel. Las rutas de debajo
      // —/servicios/[id], /servicios/publicar— no se tocan: `source` sin
      // comodín solo calza la ruta exacta.
      { source: '/servicios', destination: '/directorio', permanent: true },
      // La ficha se mudó de `/servicios/<id>` a `/prestador/<id>`: un
      // segmento dinámico con hermanos estáticos —publicar, confirmar,
      // soy-proveedor, chat…— no se puede interceptar sin tragárselos.
      //
      // ⚠ El patrón es un UUID y no `:id` a secas. Sin él, esta regla se
      // llevaría por delante `/servicios/publicar` y todos los demás, que
      // siguen viviendo donde estaban.
      {
        source:
          '/servicios/:id([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})',
        destination: '/prestador/:id',
        permanent: true,
      },
    ]
  },
  experimental: {
    // El enrutador de Next reutiliza la respuesta anterior al navegar con
    // Link. Aquí eso es peligroso: las solicitudes se borran de verdad a
    // las 72 horas, y una tarjeta fantasma lleva a alguien a ofrecer ayuda
    // para algo que ya no existe. Se pide siempre al servidor.
    // `dynamic: 0` es lo que importa: el tablero de solicitudes nunca se
    // sirve de la caché del cliente. `static` no puede bajar de 30 en
    // Next 16 y, si se pone menos, se descarta todo el bloque y `dynamic`
    // deja de aplicar.
    staleTimes: { dynamic: 0, static: 30 },
  },
};

export default nextConfig;
