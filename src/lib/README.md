# Runtime Library Notes

The first implementation keeps the playable engine in `src/lib` so it can be reused by:

- client-side demo runtime
- future API routes
- future reducer tests

Important files:

- `demo-world.ts`: seed-like world data for local MVP play
- `game-types.ts`: shared runtime domain types
- `game-engine.ts`: deterministic turn reducer
- `ai-director.ts`: AI director request contract and fallback narration
- `prisma.ts`: Prisma client singleton for server code

The engine remains deterministic. AI may rewrite or enrich narration, but state changes should continue to come from validated reducer output.
