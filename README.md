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

3. **Execution Plane (Agent Runtime)**
   - **Language:** Python 3.12.
   - **Pattern:** ReAct (Reason + Act) loop with dynamic Tool Registry (`run_command`, `git_commit_push`, `run_test_suite`, `deploy_service`, `scan_vulnerabilities`).
   - **Memory:** Short-term working context and episodic task summaries with token/cost tracking.

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
- `GET /api/tasks` — List tasks with status, dependencies, and assigned agents.
- `GET /api/metrics` — Real-time CPU, memory, API latency, token usage, and costs.
- `POST /api/incidents` — Trigger an operational incident (wakes SRE agent in 3D).
- `POST /api/incidents/resolve/:id` — Resolve active incident and return SRE to desk.
- `POST /api/approvals` — Submit human approval decision (`APPROVED` / `REJECTED`).
- `GET /ws` — Real-time bidirectional WebSocket event stream.
