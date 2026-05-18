# RelicForge

RelicForge is a web-first AI-powered text RPG builder and runtime.

The current build is an MVP foundation for:

- creating a text RPG world
- editing rooms, exits, NPCs, items, quests, and lore
- playing a persistent local session
- traversing a MUD-style room graph
- using deterministic engine rules for state changes
- enriching turn narration through an AI director route
- using Bring Your Own Key LLM sessions from the browser
- preparing for MySQL-backed persistence with Prisma

## Current Stack

- Next.js
- React
- TypeScript
- Prisma
- MySQL target database
- OpenAI API integration point
- Vitest

## Local Setup

Install dependencies:

```bash
npm install
```

Create environment values from the example:

```bash
cp .env.example .env
```

For Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

The placeholder `.env` currently uses:

```env
DATABASE_URL="mysql://user:password@localhost:3306/ai_text_rpg"
OPENAI_API_KEY=""
NEXT_PUBLIC_APP_NAME="RelicForge"
```

The app runs without `OPENAI_API_KEY`; the AI director route returns deterministic fallback narration until a key is configured.

## BYOK LLM Sessions

Users can provide their own OpenAI-compatible model settings in the left sidebar.

Current behavior:

- model and base URL are saved as browser preferences
- API keys are stored only in `sessionStorage`
- API keys are not saved to MySQL
- API keys are not included in workspace import/export
- the user must explicitly start a BYOK session before custom AI narration runs
- ending the BYOK session removes the browser-side session key

For OpenAI, leave the base URL empty and use a model like:

```text
gpt-4.1-mini
```

For an OpenAI-compatible provider, set its base URL, for example:

```text
https://openrouter.ai/api/v1
```

## Development

Start the dev server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Verification

Run the main checks:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

Validate Prisma:

```bash
npx prisma validate
```

Generate Prisma Client:

```bash
npx prisma generate
```

## Important Project Files

- `docs/architecture/mysql-schema.md`: database design reference
- `docs/architecture/backend-domain-model.md`: backend domain and engine architecture
- `docs/architecture/mvp-scope-and-roadmap.md`: phased product roadmap
- `prisma/schema.prisma`: implementation schema for MySQL
- `src/components/game-workbench.tsx`: current app workbench
- `src/lib/demo-world.ts`: seed-like demo world
- `src/lib/game-engine.ts`: deterministic turn engine
- `src/app/api/director/narrate/route.ts`: AI narration endpoint

## Current Limitations

- Auth screens are not implemented yet.
- MySQL persistence is scaffolded but not wired into the UI flow yet.
- The builder currently persists to browser local storage and supports JSON import/export.
- BYOK API keys are session-only in the browser until account-level encrypted storage is implemented.
- Multiplayer and collaborative editing are intentionally out of scope for this stage.

## Next Build Priorities

1. Add database-backed world/session persistence.
2. Add basic auth.
3. Move turn submission to a server route.
4. Add world publish/playtest workflow.
5. Expand the modular rule system beyond the hardcoded core engine actions.
