---
name: node-api-server
description: Node + Express 5 API server conventions for this pnpm monorepo — contract-first OpenAPI→Zod routes, pino structured logging (never console.log), Express 5 routing quirks, Drizzle DB access, esbuild bundling, and how to run/verify. Use when adding or debugging routes in artifacts/api-server, wiring the OpenAPI contract, or touching any server-side Node code.
---

# Node API Server

Single Express 5 + Node server at `artifacts/api-server/`. It implements the
OpenAPI contract. Layout: `src/index.ts` (entry/listen), `src/app.ts` (middleware),
`src/routes/*` (domain routers + `index.ts` barrel), `src/lib/logger.ts`, built with
esbuild (`build.mjs`) into an ESM bundle (`dist/index.mjs`).

## Logging — NEVER `console.log` / `console.error`

The server uses **pino** structured JSON logging.
- Inside route handlers/middleware: use **`req.log`** (a per-request child logger
  with the request id attached by `pino-http`).
- Outside request context (startup, shutdown, background tasks): use the singleton
  **`logger`** from `src/lib/logger.ts`.
- Pass structured context as an OBJECT FIRST, then the message:
  `req.log.warn({ errors: parsed.error.message }, "Invalid request body")`.
- Request/response logging is automatic via the `pino-http` middleware in `app.ts`
  — do not add manual request logging. Sensitive headers are redacted there.

## Contract-first: OpenAPI → codegen → routes

The OpenAPI spec in `lib/api-spec/` is the source of truth. After editing it:

```
pnpm --filter @workspace/api-spec run codegen
```

This regenerates `@workspace/api-zod` (Zod schemas) and `@workspace/api-client-react`
(React Query hooks). **Do not change the OpenAPI `info.title`** — it controls
generated filenames. Validate every input (params/query/body) AND output (response)
with the generated Zod schemas; status codes must match the contract.

```ts
router.post("/todos", async (req, res): Promise<void> => {
  const parsed = CreateTodoBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [todo] = await db.insert(todosTable).values(parsed.data).returning();
  res.status(201).json(GetTodoResponse.parse(todo));
});
```

Add new routers under `src/routes/`, re-export from `src/routes/index.ts`. The root
router already mounts `/api` — don't re-add it. Keep handlers thin (validate → DB →
respond); push real logic into `src/lib/*`.

## Express 5 quirks (these crash if you use Express 4 habits)

- Wildcards must be NAMED: `app.get("/{*splat}", ...)` (matches `/` too);
  bare `app.get("*", ...)` **crashes**.
- Optional params: `/todos{/:id}` (not `/todos/:id?`).
- Every async handler annotated `: Promise<void>`, or TS errors on early returns.
- Early return: `res.status(404).json({...}); return;` — NEVER
  `return res.status(...).json(...)`.
- Async errors auto-forward to the error handler — no `try/catch + next(err)` just
  for 500s.
- `req.params.id` is `string | string[]` — normalize before parsing:
  `const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;`
- Empty string is valid input: check `content == null` / `typeof content !== "string"`,
  not `!content` (use `!field` only for must-be-non-empty fields like `title`).

## Database (Drizzle)

Import `db` and tables from `@workspace/db`. Schema lives in `lib/db/`. Push dev
schema changes with `pnpm --filter @workspace/db run push`. Dates cast cleanly from
DB rows to Zod schemas; numeric path/query params are coerced by the generated Zod
types.

## Env & ports

- Required: `DATABASE_URL`. The server binds to `process.env.PORT` (injected by the
  workflow; the api-server artifact uses `8080` locally, proxied at `/api`).
- Never hardcode the port. Never manage secrets by hand — use the
  `environment-secrets` skill.
- esbuild bundles to ESM; native/unbundleable deps (sharp, bcrypt, canvas, re2…)
  are `external` in `build.mjs` — add to that list if you introduce one.

## Run & verify

- Run via the workflow, not bare pnpm: `restart_workflow "artifacts/api-server: API Server"`.
- Verify through the shared proxy (never the service port directly):
  `curl localhost:80/api/healthz` → 200.
- Typecheck: `pnpm --filter @workspace/api-server run typecheck`. Prefer typecheck
  over `build` from bash (build needs workflow-injected env).
