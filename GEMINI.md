# Route Planner - Project Instructions for Gemini CLI

This repository contains project-specific instructions, conventions, and architectural rules for the Gemini CLI agent.
The master universal instructions are located in [`AGENTS.md`](./AGENTS.md). Always consult `AGENTS.md` for full specifications, database schema, API contracts, and UX rules.

## Quick Summary & Hard Constraints
- **Stack:** Node.js (CommonJS `require`), Express.js, Neon PostgreSQL (`@neondatabase/serverless`), Vanilla HTML/CSS/JS.
- **Zero Build:** Do not introduce React, Tailwind, Vite, Webpack, or TypeScript. Keep vanilla architecture.
- **Language:** All user-facing UI text, buttons, alerts, and toasts must be in Italian.
- **Serverless & Local:** `app.js` supports both local execution via `npm start` and Vercel serverless deployment (`module.exports = app`).
- **Touch & Mobile:** Never hijack page scrolling with touch events. Keep tap detection (< 8px movement) distinct from scroll. Use the range picker (`btn-quick-range`) for multi-day selections.
- **Desktop UI:** Keep the desktop calendar compact (max-width 620px, 40px cell height) so all 62 days fit within one screen without scrolling.

Refer to [`AGENTS.md`](./AGENTS.md) for full documentation on database schema, REST endpoints, and architectural details.
