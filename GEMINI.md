# Route Planner - Project Instructions for Gemini CLI

This file contains project-specific instructions, conventions, and architectural rules for the Gemini CLI agent.

## Project Overview
- **Name:** route-planner
- **Description:** A simple route planner for a group of people.
- **Environment:** Node.js (CommonJS)
- **Deployment:** Vercel (indicated by `vercel.json` and `@vercel/analytics`)

## Tech Stack
- **Backend:** Express.js (`app.js`), CommonJS (`require`).
- **Database:** PostgreSQL (`pg`, `@neondatabase/serverless`).
- **Frontend:** Vanilla HTML (`views/*.html`), CSS (`public/css/*.css`), and JavaScript (`public/js/*.js`).

## Coding Conventions & Style
- Use **CommonJS** (`require`/`module.exports`) for backend Node.js files unless explicitly instructed otherwise.
- **Express.js:** Ensure routes are clearly defined and follow RESTful principles where applicable. Use `body-parser` for handling incoming request bodies.
- **Frontend:** Maintain the separation of concerns (HTML in `views/`, CSS in `public/css/`, JS in `public/js/`).
- **Database:** Use the configured PostgreSQL clients for DB interactions. Ensure sensitive credentials are only loaded via environment variables (e.g., `dotenv`).

## Workflows
- **Running locally:** Use `npm start` to run the app via `app.js`.
- **Testing:** No automated testing framework is currently configured. Ensure manual verification of features or add appropriate test scripts as needed.

## Agent Guidelines
- Before making significant architectural changes, use `enter_plan_mode` to draft a proposal.
- Keep changes localized, idiomatic, and consistent with the existing CommonJS and Vanilla JS architecture.
- Do not introduce new frameworks (like React, Tailwind) unless explicitly requested by the user.
