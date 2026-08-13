import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
