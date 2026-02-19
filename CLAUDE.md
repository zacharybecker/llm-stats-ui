# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run Commands

This is an npm workspaces monorepo with `client/` and `server/` packages.

```bash
npm install                    # install all deps (root, client, server)
npm run dev                    # start both server (port 3001) and client dev server (port 5173) concurrently
npm run dev -w server          # server only (tsx watch)
npm run dev -w client          # client only (vite)
npm run build                  # build both (server tsc, then client vite)
npm start                      # production server (serves built client as static files)
```

There are no tests or linter configured.

## Architecture

**Express server** (`server/`) aggregates data from multiple external sources, merges it into a unified `MergedModel` type, and serves it via REST API. **React client** (`client/`) consumes the API and renders dashboard views.

### Data Flow (Server)

The core logic is in `server/src/services/modelMatcher.ts`. On each API request, `getAllModels()` fetches from 5 sources in parallel:

1. **Config file** (`configParser.ts`) - reads a LiteLLM-format `config.yaml` (path via `CONFIG_PATH` env var) to get the user's configured model list
2. **OpenRouter API** (`openRouterClient.ts`) - model metadata, descriptions, pricing, context lengths
3. **LiteLLM pricing** (`litellmPricing.ts`) - per-token costs from BerriAI/litellm GitHub repo
4. **Open LLM Leaderboard** (`benchmarkScraper.ts`) - HuggingFace benchmark scores
5. **Chatbot Arena** (`arenaScraper.ts`) - ELO ratings from HuggingFace datasets

Each source is cached independently with configurable TTLs (see `server/src/config/env.ts`). The matcher uses fuzzy model ID normalization (stripping date suffixes, version numbers, provider prefixes) to join data across sources. Ollama models get special fuzzy matching against OpenRouter.

### API Routes

All routes are under `/api/`:
- `GET /api/models` - merged model list (supports `?provider=`, `?search=`, `?sort=field:dir`, `?include_unconfigured=true`)
- `GET /api/models/:id` - single model detail (id can contain slashes like `openai/gpt-4`)
- `GET /api/pricing` - models with pricing (supports cost calculator via `?input_tokens=&output_tokens=&requests=`)
- `GET /api/benchmarks` - benchmark data (supports `?source=arena|openllm|all`, `?category=`)
- `GET /api/health` - health check with data source status
- `GET /api/config/ui` - UI config (app name)
- `POST /api/config/refresh` - flush caches and reload config

### Client

- React 18 + TypeScript + Vite + Tailwind CSS
- Routing: react-router-dom with pages at `/`, `/comparison`, `/pricing`, `/leaderboard`, `/models/*`
- Data fetching: TanStack Query hooks in `client/src/hooks/useModels.ts` wrapping API calls in `client/src/services/api.ts`
- UI components: shadcn/ui pattern in `client/src/components/ui/` (Radix primitives + CVA + tailwind-merge)
- Path alias: `@/` maps to `client/src/`

### Shared Types

`MergedModel` is defined in both `server/src/types/models.ts` and `client/src/types/models.ts`. The client version adds `calculated_cost` and `ModelsResponse` wrapper. These must stay in sync manually.

## Key Configuration

- `config.yaml` - LiteLLM format model list; supports wildcard patterns (e.g., `openai/*`) for matching all models from a provider
- Environment variables are centralized in `server/src/config/env.ts` with defaults; see `.env.example`
- `DEBUG=true` enables verbose matching logs in the server console
- `OLLAMA_FREE=true` (default) marks Ollama models as $0 cost

## Production

Docker multi-stage build. Client builds to static files served by Express. Config is volume-mounted at `/app/config/config.yaml`.
