import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // El enrutador de Next reutiliza la respuesta anterior al navegar con
    // Link. Aquí eso es peligroso: las solicitudes se borran de verdad a
    // las 72 horas, y una tarjeta fantasma lleva a alguien a ofrecer ayuda
    // para algo que ya no existe. Se pide siempre al servidor.
    staleTimes: { dynamic: 0, static: 0 },
  },
};

export default nextConfig;
