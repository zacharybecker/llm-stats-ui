# Model Stats

A self-hosted dashboard that aggregates LLM data from multiple sources into a unified view. Compare pricing, benchmark scores, context lengths, and capabilities across all your configured models.

## Features

**Dashboard** — At-a-glance overview of all configured models with summary stats (total models, average pricing, largest context window, provider count) and model cards showing key metrics and capabilities.

<img width="1667" height="1275" alt="image" src="https://github.com/user-attachments/assets/4553ad8f-aba4-4f0b-a133-f4c8513206ab" />


**Model Comparison** — Sortable, filterable table comparing models across every dimension: provider, context length, input/output pricing, arena ratings, configuration status, and capabilities. Search by name, filter by provider, and toggle between configured-only or all available models.

<img width="1665" height="1274" alt="image" src="https://github.com/user-attachments/assets/21b4e129-3754-454c-b1ae-d3de6a30ed9a" />


**Pricing** — Dedicated pricing view with per-million-token costs. Supports an inline cost calculator via query parameters (`?input_tokens=1000&output_tokens=2000&requests=10`).

**Rankings** — Interactive scatter chart plotting LMArena benchmark scores against pricing, with bubble size representing vote confidence. Tabs for Text, Code, and Vision arena categories with ranked model lists.

<img width="1664" height="1273" alt="image" src="https://github.com/user-attachments/assets/f4363ea9-717e-43e2-a9e5-40fd98f53b86" />


**Model Detail** — Deep-dive view for individual models showing capabilities, full pricing breakdown, and arena rankings with confidence intervals.

## Network Requirements

This application requires outbound HTTPS (port 443) access to the following domains:

| Domain | Purpose |
|--------|---------|
| `openrouter.ai` | Model catalog, pricing, and metadata |
| `arena.ai` | LMArena ELO ratings for text, code, and vision |

All external calls are read-only GETs (no authentication required). Responses are cached server-side to minimize traffic. The app degrades gracefully if a source is unreachable, displaying warnings for unavailable data.

## Data Sources

The server fetches and merges data from three sources:

| Source | Data Provided | Cache Default |
|--------|--------------|---------------|
| **LiteLLM Config** (`config.yaml`) | Your configured model list | On file change |
| **OpenRouter API** | Metadata, descriptions, pricing, context lengths | 5 min |
| **LMArena** (arena.ai) | ELO ratings for text, code, and vision | 30 min |

Intelligent fuzzy matching handles model ID variations across providers (date suffixes, version numbers, provider prefixes). Ollama models get special matching against OpenRouter metadata.

## Quick Start

### Prerequisites

- Node.js 20+
- A LiteLLM-format `config.yaml` (see [Configuration](#configuration))

### Install & Run

```bash
npm install
npm run dev
```

This starts both the API server (port 3001) and the Vite dev server (port 5173).

```bash
npm run dev -w server     # server only
npm run dev -w client     # client only
```

### Production Build

```bash
npm run build
npm start                 # serves built client as static files on port 3001
```

## Docker

```bash
docker build -t model-stats .

docker run -p 3001:3001 \
  -v $(pwd)/config.yaml:/app/config/config.yaml \
  model-stats
```

The container serves both the API and client at `http://localhost:3001`.

## Configuration

### Environment Variables

Copy `.env.example` and adjust as needed:

```bash
PORT=3001                       # Server port
CONFIG_PATH=/app/config/config.yaml  # Path to LiteLLM config
APP_NAME=Model Stats            # App title shown in the UI

# Cache TTLs (seconds)
OPENROUTER_CACHE_TTL=300        # OpenRouter data (default: 5 min)
ARENA_CACHE_TTL=1800            # LMArena benchmarks (default: 30 min)

OLLAMA_FREE=true                # Show Ollama models as $0 (local inference)
DEBUG=false                     # Verbose model matching logs
```

### Model Config (`config.yaml`)

Standard LiteLLM format. Wildcard patterns like `openai/*` are supported.

```yaml
model_list:
  - model_name: gpt-4o
    litellm_params:
      model: azure/gpt-4o
      api_base: os.environ/AZURE_API_BASE
      api_key: os.environ/AZURE_API_KEY

  - model_name: sonnet-4.5
    litellm_params:
      model: bedrock/anthropic.claude-sonnet-4-5-20250929-v1:0
      aws_region_name: us-east-1

  - model_name: mistral7b
    litellm_params:
      model: ollama/mistral
      api_base: http://localhost:11434
```

## API

All endpoints under `/api/`:

| Endpoint | Description |
|----------|-------------|
| `GET /models` | Merged model list. Query: `?provider=`, `?search=`, `?sort=field:dir`, `?include_unconfigured=true` |
| `GET /models/:id` | Single model detail (ID supports slashes, e.g. `openai/gpt-4`) |
| `GET /pricing` | Pricing data with optional cost calculator: `?input_tokens=&output_tokens=&requests=` |
| `GET /benchmarks` | Arena benchmarks. Query: `?category=text\|code\|vision` |
| `GET /health` | Health check with data source status |
| `POST /config/refresh` | Flush all caches and reload config |

## Tech Stack

**Frontend:** React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Query + Table, Recharts

**Backend:** Express, TypeScript, node-cache, axios

**Monorepo:** npm workspaces (`client/` + `server/`)

## Project Structure

```
client/src/
  components/
    dashboard/        # Dashboard cards and stats
    comparison/       # Comparison table
    pricing/          # Pricing table
    leaderboard/      # Scatter chart and rankings
    detail/           # Model detail view
    layout/           # Navbar, layout wrapper
    ui/               # shadcn/ui primitives
  hooks/              # TanStack Query hooks
  services/           # API client (axios)
  types/              # TypeScript types

server/src/
  routes/             # Express route handlers
  services/
    modelMatcher.ts   # Core merging logic
    configParser.ts   # LiteLLM YAML parsing
    openRouterClient.ts
    lmarenaScraper.ts
    cache.ts          # TTL cache layer
  config/             # Environment config
  types/              # Shared types
```
