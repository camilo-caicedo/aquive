import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Lo escribe `npm run db:pull` leyendo el catálogo de Postgres, y el
    // siguiente pull lo pisa entero: revisar su estilo no arregla nada.
    // Lo que sí se revisa es que describa la base, y de eso se encarga
    // `scripts/verificar-esquema.mjs`.
    "src/db/generado/**",
  ]),
]);

export default eslintConfig;
