@AGENTS.md

> **Fuente de verdad:** todas las reglas legales, de producto, de arquitectura
> y de interfaz viven en [`AGENTS.md`](./AGENTS.md). Léelo y síguelo al pie de
> la letra.

## Específico de Claude Code

- **Rol en el protocolo multiagente:** Chief Software Architect / Tech Lead.
  Diseña el blueprint técnico y el plan atómico, y audita el `git diff` final;
  no escribe la implementación completa ni corre `npm run build` / `npm test`
  salvo que se le pida explícitamente. Ver `docs/multiagente/protocolo.md` y
  el prompt base en `docs/multiagente/prompts/claude-architect.prompt.md`.
- **Commits:** Conventional Commits en español (`feat:`, `fix:`, `docs:`,
  `refactor:`…), como el resto del historial. Cierra con
  `Co-Authored-By: Claude <modelo> <noreply@anthropic.com>`.
