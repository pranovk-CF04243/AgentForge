# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Working conventions

These apply to every change made in this repo, not just this file:

- **Log every prompt.** Append an entry to [prompts.md](prompts.md) for each prompt that results in a code change — the prompt itself and a summary of what changed. Newest entry on top.
- **Add small, targeted unit tests with each change.** A few focused tests (happy path + 1-2 edge cases) in the relevant service's existing framework — `go test` under `backend/`, `unittest` under `agent-runtime/tests/`. Not exhaustive coverage, just meaningful checks that the change actually works and stays working.
- **Update README.md when a new feature ships.** Keep the Architecture Overview, API Reference, and Quickstart sections in sync with reality — don't let the README drift from what the code does.
- **Log every bug in BUGS.md.** When a bug is found (by you, in testing, or reported by the user) and fixed, add an entry to [BUGS.md](BUGS.md): symptom, root cause, fix, affected areas, how it was verified. One doc, newest on top — don't scatter bug write-ups elsewhere.

## What this is

AgentForge is an AI engineering command center: it orchestrates a fleet of 14 simulated AI "digital employees" (agents with roles like Software Architect, Senior Developer, QA, DevOps, SRE) that decompose engineering goals into a dependency-based Task DAG, execute real tool calls (shell, git, tests, GitHub PRs) inside a sandboxed workspace, and stream progress to a 3D/2D visualization frontend in real time.

The system is split into three cooperating services plus infrastructure, matching the directory layout:

- **`backend/`** — Go 1.23 "Coordination Plane". Owns all state (agents, tasks, projects, incidents, approvals), the Task DAG scheduler, a hand-rolled WebSocket/SSE hub, and Zero-Trust API auth. No web framework — plain `net/http`.
- **`agent-runtime/`** — Python 3.12 "Execution Plane". FastAPI service that compiles a per-agent LangGraph ReAct loop (Google Gemini) with a sandboxed tool registry, and streams execution events back to the Go backend via webhook.
- **`frontend/`** — React 18 + TypeScript "Control Plane". Zustand store + WebSocket client driving both a React Three Fiber 3D office view and a 2D pixel-art office view, plus Kanban/DAG, APM, and incident-room UI.
- Infra: PostgreSQL (+ pgvector), Redis, Kafka-compatible Redpanda, wired together via `docker-compose.yml`.

## Commands

### Docker Compose (full stack)
```bash
docker-compose up --build
```
Frontend `:3000`, Backend `:8080`, Agent Runtime `:8000`, Redpanda `:19092`, Postgres `:5432`, Redis `:6379`.

### Backend (Go)
```bash
cd backend
go run .                      # start server (defaults to :8080, needs DATABASE_URL or falls back to localhost postgres)
go test -v ./...              # run all tests
go test -v ./auth/...         # run one package's tests
go test -v -run TestOrchestratorInitialization ./...   # run a single test
```

### Agent Runtime (Python)
```bash
cd agent-runtime
pip install -r requirements.txt
python3 server.py             # start FastAPI on :8000 (uses uvicorn with reload)
python3 -m unittest discover -s tests -v                        # run all tests
python3 -m unittest tests.test_agent_runtime.TestRealToolRegistry -v   # run a single test class
```

### Frontend (React + Three.js)
```bash
cd frontend
npm install
npm run dev        # vite dev server
npm run build       # tsc typecheck + vite build
npm run preview
```
There is no configured frontend test runner — don't assume `npm test` works.

### Config
Copy `.env.example` to `.env` at the repo root before running Docker Compose; it supplies `GEMINI_API_KEY`/`GEMINI_MODEL`, GitHub App credentials, LangSmith tracing vars, and DB/Redis/Kafka URLs. `AGENT_RUNTIME_URL` (backend → runtime) and `BACKEND_URL` (runtime → backend) wire the two services together and default to the Docker service names (`http://agent-runtime:8000`, `http://backend:8080`) — override them for bare-metal runs.

## Architecture

### Task lifecycle & the DAG scheduler (`backend/orchestrator.go`)
`Orchestrator` is the single source of truth, guarded by one `sync.RWMutex`, with in-memory maps (`agents`, `tasks`, `projects`, `incidents`, `approvals`) mirrored to Postgres via GORM (`safeSave`/`safeCreate` — both are no-ops if `db` is nil, so the backend degrades gracefully without a DB). A 5s ticker (`StartEventLoop`) drives `updateRealMetrics`, `checkTaskWatchdogs` (auto-fails tasks stuck `RUNNING` for >10 min), and `drainTaskQueue`.

Flow for a new goal:
1. `DecomposeRequirement` calls the Python runtime's `/api/decompose` (or `/api/analyze-brd` for full BRD documents) to get a dynamic task list from Gemini; on any failure/timeout it falls back to `generateFallbackDAG`, a fixed 4-stage Architect → Developer → QA → DevOps pipeline.
2. Tasks with no unmet `Dependencies` are assigned via `assignTask`, which matches `Task.RequiredRole` against agent roles using fuzzy matching (`matchesRole` — substring/keyword based, not exact-only) and falls back to any idle non-management agent if no role match is free.
3. Assigned tasks are dispatched asynchronously to the Python runtime's `/api/execute` (`dispatchTaskToRuntime`), which returns immediately (fire-and-forget over HTTP) while the runtime streams events back.
4. The runtime posts events to `/api/internal/task-event` (`HandleTaskEvent`): `token` (live LLM stream), `log` (progress/logs), `completion` (marks task done, accumulates `TokenUsage`/`CostUSD` onto both task and agent, triggers `triggerNextTasks` to cascade the DAG), `error` (fails the task, frees the agent).
5. `RequestHumanApproval`/`HandleApprovalDecision` implement a blocking gate — used for `RequiresSign` tasks (e.g. final PR/deploy step) — that pauses a task in `WAITING_APPROVAL` until a human decides via the frontend's `ApprovalModal`.

Every state mutation is pushed to connected clients via `hub.Broadcast` as a typed JSON envelope (`{"action": "AGENT_UPDATE" | "TASK_UPDATE" | "TASK_STREAM" | "EVENT" | "METRICS_UPDATE" | "INCIDENT_ALERT" | "APPROVAL_REQUESTED" | "PROJECT_CREATED", ...}`). The frontend's `useStore.ts` `initWebSocket` switches on this same `action` field — when adding a new event type, both sides must agree on the shape.

Agent roster (14 fixed personas, IDs like `agent-pm`, `agent-backend`, `agent-qa`, `agent-sre`, ...) is seeded once in `seedDigitalEmployees()` and only re-seeded if the `agents` table is empty; changing a persona's skills/tools/system prompt in code won't affect an existing DB until it's wiped.

### Agent execution (`agent-runtime/`)
`graph.py` compiles one LangGraph `StateGraph` per task invocation (`agent` node → conditional route to `tools` node → back to `agent`, terminating on no more tool calls). Tools available to an agent are restricted to `req.tools` filtered through `TOOL_MAP` — this is how a persona's `Tools` list in the Go seed data actually limits what it can do. Every agent gets an injected "NON-NEGOTIABLE ENTERPRISE GUARDRAILS" block appended to its system prompt (anti-hallucination, no stub code, no credential leakage, self-healing on test failure, verify-before-PR) — this is the main lever for steering agent behavior across all personas at once.

`agent.py`'s `RealToolRegistry` executes real shell/file/git operations inside `WORKSPACE_DIR` (defaults to `/workspace`, mounted from the repo root in `docker-compose.yml`), with guardrails: regex-blocked destructive commands (`rm -rf /`, `mkfs`, `dd`, fork bombs, etc.), blocked reads of `SENSITIVE_FILES` (`.env`, `.git/config`, SSH keys), path-traversal checks confining `write_file`/`read_file`/`list_dir` to the workspace, and output truncation (`MAX_OUTPUT_CHARS`) to protect context windows. `git_ops` and `create_github_pr` (via `github_client.py`'s GitHub App integration, using `GITHUB_APP_ID`/`GITHUB_APP_PRIVATE_KEY`) are how agents produce real branches and PRs.

`server.py` is stateless per-request: `/api/execute` launches `run_agent_execution` as a FastAPI background task and returns immediately; all progress is pushed out-of-band to the Go backend via `send_event_to_backend`, not returned in the HTTP response. `/api/decompose`, `/api/analyze-brd`, `/api/replan` are synchronous single-shot Gemini calls that expect strict JSON back (`strip_codeblock` strips markdown fences defensively) and return `500`/`[]` on any parse failure so the Go side can fall back gracefully.

### Auth & security (`backend/auth/`, `backend/ratelimit/`, `backend/secured_api.go`)
A separate "Zero-Trust" layer exists alongside the main unauthenticated `/api/*` routes registered in `main.go`: `SetupSecuredRouter` wires `/api/v1/keys` (key generation) and `/api/v1/protected/*` (API-key + Bearer auth via `ZeroTrustAuthMiddleware`, wrapped in `ratelimit.RateLimitMiddleware`, backed by an in-memory token bucket). Keys are `af_live_<64 hex chars>`, stored as salted SHA-256 hashes. `MockAPIKeyStore` in `secured_api.go` is a hardcoded in-memory store (not wired to Postgres) — check whether this is still a stub or has been connected to real persistence before assuming it's production-ready. Note this secured router is defined but not obviously mounted into the main `mux` in `main.go` — confirm wiring before relying on it being live.

### WebSocket/SSE transport (`backend/websocket.go`)
Hand-rolled RFC 6455 implementation (frame parsing, masking, ping/pong) with no external dependency — there is no gorilla/websocket or similar. `Hub` fans out one `Broadcast([]byte)` call to every registered `WSConn` (goroutine per client per message) and every registered SSE channel (non-blocking send, drops the frame if the channel is full). Frontend reconnects with a fixed backoff (`ws.onclose` → retry after 3s) in `useStore.ts`.

### Frontend state (`frontend/src/store/`)
`useStore.ts` (Zustand) is the single client-side state container: it owns the WebSocket connection, applies the same `action`-tagged messages the backend broadcasts, and exposes REST-calling actions (`createProject`, `analyzeBRD`, `replanTasks`, `launchPlan`, `decomposeGoal`, `triggerIncident`, `decideApproval`, `sendAgentInstruction`). The BRD → staged plan → human review → launch flow (`analyzeBRD` → `stagedTasks` → `PlanVerificationModal` → `launchPlan`) is a distinct pipeline from the quick `decomposeGoal` one-shot path — both end up populating the same `tasks` map. `useGamificationStore.ts` and `useServiceAccountStore.ts` are separate, more self-contained stores for the pixel-office gamification HUD and the service-accounts dashboard respectively.

Two parallel office visualizations read from the same `agents`/`tasks` state: `components/3d/` (React Three Fiber, desk positions in `seatCoordinates.ts`) and `components/pixel/` (2D pixel-art canvas rendering). Keep agent state semantics (see `AgentState`/`TaskStatus` enums in `backend/models.go`, mirrored in `frontend/src/types/index.ts`) consistent across both when adding new states.

### Data model
Go structs in `backend/models.go` are the canonical schema (GORM `AutoMigrate`d against Postgres on startup in `initDB()`; `backend/migrations/001_initial_schema.sql` exists but auto-migrate is what actually runs). `Skills`, `Tools`, `Dependencies`, `Position`, etc. are stored via GORM's JSON serializer, not normalized tables. `FlexibleString` (used for `TaskEventPayload.Content`) tolerates the Python side sending a string, a list of content blocks, or an arbitrary object — needed because LangChain message content isn't always a plain string.

## Known rough edges (see `requirements` file at repo root)
Several tracked, unresolved items worth checking before assuming a subsystem works end-to-end: token/cost usage doesn't always reflect in the task orchestration UI (QA agent case noted), the Infrastructure page's actual utility is unclear, Kubernetes-sandbox integration crashes intermittently, and there's a known UI flicker issue. Treat these areas as unverified rather than working reference implementations.
