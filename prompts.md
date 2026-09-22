# Prompts Log

A running log of prompts given to Claude Code that resulted in a code change in this repository. Newest entries at the top.

Format per entry:
```
## YYYY-MM-DD

**Prompt:** <the user's prompt, verbatim or faithfully summarized>

**Result:** <what changed — files touched, feature/fix delivered>
```

---

## 2026-09-21

**Prompt:** I want you to make the agent choosing AI as a configurable, now everything is wired to GCP, instead we can make it configurable in FE as dropdown and use those models to do, i want this both global for all agents and individual agents as well, if not selected defaults to gemini. (Follow-up: use Ollama and NVIDIA as the additional providers, with separate provider+model fields, and a JSON config-driven model catalog.)

**Result:** Replaced the hardcoded Gemini-only LLM wiring with a provider-agnostic factory and a configurable model catalog. New [config/model_catalog.json](config/model_catalog.json) holds the global default `(provider, model)` and the selectable-models list for the frontend dropdowns. Backend: `Agent.Provider` field + `ModelRef`/`AvailableModelEntry`/catalog DTOs (`backend/models.go`), `backend/model_catalog.go` (loader + disk-persisting `SetDefault`), `Orchestrator.EffectiveModelFor`/`SetAgentModelOverride`/`SetGlobalDefaultModel` (`backend/orchestrator.go`), three new endpoints — `GET /api/config/models`, `PATCH /api/agents/:id/model`, `PUT /api/config/models/default` (`backend/handlers.go`, `backend/main.go`) — plus a `withDefaultModel` helper injecting the global default into the BRD-analyze/replan proxy calls. Agent runtime: new `agent-runtime/llm_factory.py` (`build_chat_model`, dispatches to `ChatGoogleGenerativeAI`/`ChatOllama`/`ChatNVIDIA`) replacing 5 direct Gemini instantiations across `agent-runtime/graph.py` and `agent-runtime/server.py`; added `langchain-ollama`/`langchain-nvidia-ai-endpoints` to `requirements.txt`. Frontend: `Agent.provider`/`ModelCatalog` types, `useStore.ts` catalog fetch + `updateAgentModel`/`setGlobalDefaultModel` actions, a per-agent model dropdown in `AgentInspector.tsx`, and a global-default dropdown in `CommandNavbar.tsx`. Added `backend/model_catalog_test.go` (9 tests) and `agent-runtime/tests/test_llm_factory.py` (6 tests); updated `docker-compose.yml` (writable config mount, `MODEL_CATALOG_CONFIG_PATH`, `OLLAMA_BASE_URL`/`NVIDIA_API_KEY`), `.env.example`, and README.md with a new "Configurable AI Models" section and API reference entries.

## 2026-09-21

**Prompt:** I want you to enforce a budget token limiting and token capping to each agent, to prevent the agents from using n number of tokens. Keep this as a separate configurable file in a JSON file.

**Result:** Added per-role token budgets with a shared "crisis pool" overflow mechanism, configured via a new [config/token_budgets.json](config/token_budgets.json). Backend (`backend/budget_config.go` loader, `Agent.BankedSurplus` + `Orchestrator.crisisPool`/`taskAllotments` in `backend/orchestrator.go`, `BudgetPool`/`BudgetTopupRequest`/`BudgetTopupResponse` in `backend/models.go`, new `POST /api/internal/request-budget-topup` handler in `backend/handlers.go`) computes each task's allotment (base budget + banked surplus from underused prior tasks), banks leftover tokens after a task completes, spills banked surplus into the shared pool when an agent goes idle, and grants capped top-up draws from that pool on request. Agent runtime (`agent-runtime/budget.py`, wired into `agent-runtime/graph.py`'s `route_condition` and `agent-runtime/server.py`) enforces the budget before each ReAct loop iteration, requests a top-up when exhausted, and raises `BudgetExceededError` (reported as a normal task failure) if still over budget. Added `backend/budget_test.go` (6 tests) and `agent-runtime/tests/test_budget.py` (10 tests); updated `docker-compose.yml` to mount `./config` into the backend container; updated README.md with a new "Token Budget & Crisis Pool" section and API reference entry.

## 2026-09-21

**Prompt:** Analyse the codebase and create a claude.md file.

**Result:** Added [CLAUDE.md](CLAUDE.md) documenting build/test/run commands for all three services and the cross-service architecture (Task DAG scheduler, agent execution runtime, auth layer, WebSocket transport, frontend state).

## 2026-09-21

**Prompt:** Whenever we are prompting, add a prompts.md file and do small unit testing with proper test cases. Update README.md when a new feature is added. Whenever a bug arises, keep a separate doc for that. Add these as rules in CLAUDE.md.

**Result:** Added this prompts.md file, added [BUGS.md](BUGS.md) for bug tracking, and updated [CLAUDE.md](CLAUDE.md) with a "Working conventions" section codifying all four rules (prompt logging, unit tests per change, README updates on new features, bug doc per bug).
