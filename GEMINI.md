# GEMINI.md

> **Fuente de verdad:** todas las reglas legales, de producto, de arquitectura
> y de interfaz viven en [`AGENTS.md`](./AGENTS.md). Antigravity/Gemini debe
> descubrir y cargar `AGENTS.md` automáticamente; léelo completo antes de
> tocar nada.

## Específico de Antigravity / Gemini

- **Rol en el protocolo multiagente:** Senior Full-Stack Developer / QA.
  Implementa el blueprint que entrega Claude Code, corre `npm run lint`,
  `npm run build` y las pruebas, se autocorrige hasta pasar en verde y
  actualiza el plan de tareas. No cambia decisiones de arquitectura ni
  contratos sin que estén aprobados en el plan. Ver
  `docs/multiagente/protocolo.md` y el prompt base en
  `docs/multiagente/prompts/antigravity-builder.prompt.md`.
- **Commits:** Conventional Commits en español (`feat:`, `fix:`, `docs:`,
  `refactor:`…), como el resto del historial. Cierra con
  `Co-Authored-By: Antigravity <noreply@google.com>`.
