# AgentForge — AI Engineering Command Center

> **Build projects. Deploy AI teams. Watch them work.**

AgentForge is a production-grade AI-powered engineering command center that allows software organizations to orchestrate autonomous AI agents, assign complex engineering workflows, monitor infrastructure, and visualize the entire software lifecycle inside an interactive **3D virtual engineering office**.

---

## Architecture Overview

AgentForge is built around four decoupled planes:

1. **Control Plane (Frontend & 3D Engine)**
   - **Framework:** React 18, TypeScript, TailwindCSS, Zustand.
   - **3D Visualization:** React Three Fiber (Three.js) with real-time zone rendering, procedural lighting, and 14 digital employees with animated states.
   - **Command Hub:** Real-time Task DAG / Kanban board, APM telemetry dashboard, Agent Inspector drawer, and Human-in-the-Loop approval modal.

2. **Coordination Plane (Backend Engine)**
   - **Language:** Go 1.23 with zero external dependencies.
   - **Protocol:** Standard RFC 6455 WebSockets, Server-Sent Events (SSE), and REST APIs.
   - **Task DAG Engine:** Decomposes user goals into dependent engineering milestones, schedules tasks to qualified agents, and evaluates dependencies dynamically.
   - **Incident War Room:** Automatically assigns SRE agents to operational alerts with automated and manual remediation.
   - **Token Budgeting:** Enforces a per-role token budget for every agent, with unused allotment banked forward and a shared crisis-pool overflow mechanism (see [Token Budget & Crisis Pool](#token-budget--crisis-pool)).

3. **Execution Plane (Agent Runtime)**
   - **Language:** Python 3.12.
   - **Pattern:** ReAct (Reason + Act) loop with dynamic Tool Registry (`run_command`, `git_commit_push`, `run_test_suite`, `deploy_service`, `scan_vulnerabilities`).
   - **Memory:** Short-term working context and episodic task summaries with token/cost tracking.
   - **Budget Enforcement:** Respects the per-task token budget handed down by the backend at dispatch, requesting a capped top-up from the shared crisis pool when it runs out mid-task before gracefully failing the task.
   - **Configurable LLM:** Each agent's LLM is provider-configurable (Gemini, Ollama, or NVIDIA NIM) rather than hardcoded — see [Configurable AI Models](#configurable-ai-models).

4. **Telemetry & Infrastructure Plane**
   - **Streaming:** Apache Kafka / Redpanda.
   - **Storage:** PostgreSQL (relational + pgvector) & Redis 7.
   - **Telemetry:** OpenTelemetry Collector, Prometheus, and APM gauges.

---

## 3D Virtual Engineering Office

The office represents your AI engineering organization in real-time:

| Zone | Primary Agents | 3D Visual Cues |
| :--- | :--- | :--- |
| **Management & Product** | Product Manager, Documentation Agent | Executive workstations, roadmap monitors |
| **Architecture** | Software Architect, Research Agent | System blueprint displays, thinking aura |
| **Development** | Backend, Frontend, Mobile Developers, Code Reviewer | Multi-monitor desks, typing animations |
| **QA & Security Lab** | QA Automation Engineer, Security Engineer | Test suite monitors, vulnerability scanner displays |
| **Infrastructure Matrix** | DevOps Engineer, Database & Data Engineers | Server racks with live pulsing LED status |
| **Incident War Room** | Site Reliability Engineer (SRE) | Holographic table with red emergency strobe lighting |

### Agent Lifecycle States & Animations
- **`IDLE`**: Seated at workstation, awaiting assignment.
- **`THINKING`**: Glowing purple aura, hand to chin, reasoning through task specifications.
- **`WORKING`**: Rapid typing animations, blue screen glow, active tool execution.
- **`WAITING_APPROVAL`**: Pulsing amber warning beacon; blocked until human signs off.
- **`BLOCKED / FAILED`**: Red alert beacon, warning icon, automated reviewer triage.
- **`COMPLETED`**: Green success pulse, output summary logged to DAG.

---

## Token Budget & Crisis Pool

Every digital employee has a per-task token budget, configured in
[`config/token_budgets.json`](config/token_budgets.json) — a plain JSON file
keyed by agent **role** (with a `"default"` fallback for any role not
listed), loaded once at backend startup (no hot reload in v1). It also
tunes a shared **crisis pool** that all 14 agents can draw a capped top-up
from as a last resort.

How it works:

1. **Base allotment.** At dispatch time, the Go backend computes an agent's
   token budget for its next task as `base allotment (by role, from the
   config) + banked surplus` (see below), and hands that single number down
   to the Python agent runtime along with the task.
2. **Banked surplus.** If a task finishes using fewer tokens than it was
   allotted, the unused amount is banked onto that same agent and added on
   top of the base allotment for its *next* task.
3. **Crisis pool spill.** When an agent goes idle with no next task queued,
   any banked surplus it's still holding spills into one shared crisis pool
   instead of sitting idle on that agent.
4. **Crisis pool draw.** If an agent exhausts its own budget mid-task, the
   Python runtime automatically requests a top-up from the shared crisis
   pool (via `POST /api/internal/request-budget-topup`), capped by
   `crisis_pool.max_draw_per_task` and `crisis_pool.max_draw_pct_of_pool` in
   the config. The draw is logged on the task.
5. **Graceful failure.** If the crisis pool can't cover the shortfall (empty,
   or the draw cap is hit) and the agent is still over budget, the task
   fails cleanly with a `"Token budget exceeded for agent <name> (used
   X/Y tokens)"` error — the same path as any other execution failure — and
   the agent is freed.

v1 enforces **tokens only**; a `cost_budget_usd` field is accepted per role
for reporting/display but is not itself enforced.

---

## Configurable AI Models

Which LLM powers each digital employee is no longer hardcoded to Gemini —
it's configurable both **globally** (one default for the whole fleet) and
**per agent** (an individual override), via
[`config/model_catalog.json`](config/model_catalog.json).

- **Providers supported:** `gemini` (default/fallback), `ollama`
  (self-hosted/external server), `nvidia` (NVIDIA NIM hosted cloud API).
- **Global default + per-agent override.** Every agent uses the global
  default unless it has its own `(provider, model)` override set. If the
  catalog config is missing or broken, the backend falls back to Gemini.
- **Setting it:**
  - Per agent — pick from the model dropdown in the Agent Inspector drawer
    (calls `PATCH /api/agents/:id/model`; clearing the selection reverts to
    the global default).
  - Globally — pick from the dropdown in the top navbar (calls
    `PUT /api/config/models/default`). This **persists back to
    `config/model_catalog.json` on disk**, so it survives a backend restart.
- **Env vars per provider:**
  - Gemini: `GEMINI_API_KEY`, `GEMINI_MODEL`.
  - Ollama: `OLLAMA_BASE_URL` (default `http://localhost:11434`) — no API
    key; AgentForge does not run an Ollama container itself, point this at
    wherever you already run one.
  - NVIDIA NIM: `NVIDIA_API_KEY`.
- The catalog is loaded once at backend startup (no hot reload for the
  `available_models` list itself, only the default can be changed live).

---

## Quickstart Guide

### 1. Run with Docker Compose
```bash
docker-compose up --build
```
- Frontend: `http://localhost:3000`
- Backend API & WebSockets: `http://localhost:8080`
- Kafka / Redpanda: `localhost:19092`

### 2. Run Local Development (Bare-Metal)

#### Backend (Go):
```bash
cd backend
go test -v ./...
go run .
```

#### Python Agent Runtime:
```bash
cd agent-runtime
python3 -m unittest discover -s tests -v
```

#### Frontend (React + Three.js):
```bash
cd frontend
npm install
npm run dev
```

---

## API Reference

- `GET /api/health` — System status and heartbeat.
- `GET /api/projects` — List active projects and building mappings.
- `POST /api/projects/decompose` — Decompose high-level engineering prompt into a Task DAG.
- `GET /api/agents` — List all 14 digital employees with current coordinates, states, and metrics.
- `GET /api/config/models` — Fetch the global default model and the full selectable model catalog.
- `PATCH /api/agents/:id/model` — Set or clear (empty `provider`/`model` fields) a per-agent LLM provider/model override.
- `PUT /api/config/models/default` — Update the global default LLM provider/model (persists to `config/model_catalog.json`).
- `GET /api/tasks` — List tasks with status, dependencies, and assigned agents.
- `GET /api/metrics` — Real-time CPU, memory, API latency, token usage, and costs.
- `POST /api/incidents` — Trigger an operational incident (wakes SRE agent in 3D).
- `POST /api/incidents/resolve/:id` — Resolve active incident and return SRE to desk.
- `POST /api/approvals` — Submit human approval decision (`APPROVED` / `REJECTED`).
- `POST /api/internal/request-budget-topup` — Internal endpoint called by the agent runtime to request a capped top-up from the shared crisis pool when an agent's task-level token budget is exhausted mid-execution.
- `GET /ws` — Real-time bidirectional WebSocket event stream.

---

## Project Docs

- [CLAUDE.md](CLAUDE.md) — architecture guide and working conventions for AI-assisted development in this repo.
- [prompts.md](prompts.md) — log of prompts that drove code changes.
- [BUGS.md](BUGS.md) — log of bugs found and how they were fixed.

This README's Architecture Overview and API Reference are updated whenever a new feature ships.
