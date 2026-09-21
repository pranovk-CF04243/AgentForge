package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"gorm.io/gorm"
)

type Orchestrator struct {
	mu             sync.RWMutex
	hub            *Hub
	db             *gorm.DB
	agents         map[string]*Agent
	projects       map[string]*Project
	tasks          map[string]*Task
	incidents      map[string]*Incident
	approvals      map[string]*HumanApproval
	events         []SystemEvent
	epics          map[string][]*Epic
	studioMessages map[string][]*StudioMessage
	credentials    map[string][]*ProjectCredential
	metrics        APMMetrics
	activeTicker   *time.Ticker
}

func NewOrchestrator(hub *Hub, db *gorm.DB) *Orchestrator {
	o := &Orchestrator{
		hub:            hub,
		db:             db,
		agents:         make(map[string]*Agent),
		projects:       make(map[string]*Project),
		tasks:          make(map[string]*Task),
		incidents:      make(map[string]*Incident),
		approvals:      make(map[string]*HumanApproval),
		events:         make([]SystemEvent, 0),
		epics:          make(map[string][]*Epic),
		studioMessages: make(map[string][]*StudioMessage),
		credentials:    make(map[string][]*ProjectCredential),
		metrics: APMMetrics{
			ActiveAgents:    14,
			RunningTasks:    0,
			BlockedTasks:    0,
			ActiveIncidents: 0,
		},
	}

	o.initializeData()
	o.drainTaskQueue()
	return o
}

func (o *Orchestrator) initializeData() {
	o.mu.Lock()
	defer o.mu.Unlock()

	// 1. Load or Seed Projects
	var projectCount int64
	if o.db != nil {
		o.db.Model(&Project{}).Count(&projectCount)
	}
	if projectCount == 0 {
		p1 := &Project{
			ID:            "proj-1",
			Name:          "AgentForge Platform",
			Description:   "Autonomous AI Engineering Workspace & Command Center",
			Building:      "Building A",
			TechStack:     []string{"Go", "Python", "React", "PostgreSQL", "LangGraph"},
			RepositoryURL: "https://github.com/agentforge/agentforge",
			TargetBranch:  "main",
			Status:        "ACTIVE",
			Progress:      0,
			AgentIDs:      []string{},
			CreatedAt:     time.Now(),
			UpdatedAt:     time.Now(),
		}
		if o.db != nil {
			o.db.Create(p1)
		}
		o.projects[p1.ID] = p1
	} else if o.db != nil {
		var projs []*Project
		o.db.Find(&projs)
		for _, p := range projs {
			o.projects[p.ID] = p
		}
	}

	// 2. Load or Seed 14 AI Digital Employees
	var agentCount int64
	if o.db != nil {
		o.db.Model(&Agent{}).Count(&agentCount)
	}
	if agentCount == 0 {
		o.seedDigitalEmployees()
	} else if o.db != nil {
		var dbAgents []*Agent
		o.db.Find(&dbAgents)
		for _, a := range dbAgents {
			o.agents[a.ID] = a
		}
		// Upgrade baseline system prompts for existing agents if they still have the short 1-sentence prompt
		o.upgradeAgentPrompts()
	}

	// 3. Load Existing Tasks
	if o.db != nil {
		var dbTasks []*Task
		o.db.Find(&dbTasks)
		for _, t := range dbTasks {
			o.sanitizeTask(t)
			// If task was RUNNING during previous server run/crash, reset to PENDING so it restarts
			if t.Status == TaskRunning {
				t.Status = TaskPending
				t.AssignedTo = nil
				o.safeSave(t)
			}
			o.tasks[t.ID] = t
		}

		// Normalize agent states: reset any agent whose task is not actively running
		for _, a := range o.agents {
			if a.CurrentTaskID != nil {
				if t, ok := o.tasks[*a.CurrentTaskID]; !ok || t.Status != TaskRunning {
					a.CurrentTaskID = nil
					a.State = StateIdle
					a.ActiveAction = "Standing by"
					o.safeSave(a)
				}
			} else if a.State != StateIdle {
				a.State = StateIdle
				a.ActiveAction = "Standing by"
				o.safeSave(a)
			}
		}

		// 4. Load Existing Incidents
		var dbIncidents []*Incident
		o.db.Where("status != ?", "RESOLVED").Find(&dbIncidents)
		for _, inc := range dbIncidents {
			o.incidents[inc.ID] = inc
		}

		// 5. Load Existing Approvals
		var dbApprovals []*HumanApproval
		o.db.Where("status = ?", "PENDING").Find(&dbApprovals)
		for _, app := range dbApprovals {
			o.approvals[app.ID] = app
		}

		// 6. Load Existing Epics
		var dbEpics []*Epic
		o.db.Find(&dbEpics)
		for _, e := range dbEpics {
			o.epics[e.ProjectID] = append(o.epics[e.ProjectID], e)
		}

		// 7. Load Existing Studio Messages
		var dbMsgs []*StudioMessage
		o.db.Order("created_at asc").Find(&dbMsgs)
		for _, m := range dbMsgs {
			o.studioMessages[m.ProjectID] = append(o.studioMessages[m.ProjectID], m)
		}

		// 8. Load Existing Project Credentials
		var dbCreds []*ProjectCredential
		o.db.Find(&dbCreds)
		for _, c := range dbCreds {
			o.credentials[c.ProjectID] = append(o.credentials[c.ProjectID], c)
		}
	}

	o.recordEvent("system.init", "AgentForge Engine", fmt.Sprintf("AgentForge workspace ready with %d AI digital employees.", len(o.agents)))
}

func getEnrichedRolePrompts() map[string]string {
	return map[string]string{
		"agent-pm": `You are Elena Vance, Lead Project Manager at AgentForge.

MISSION: Ensure engineering work delivers business value on time and within scope.

MANDATORY STANDARDS:
- Every sprint must have a clear goal (not just a list of tasks).
- Blockers must be surfaced within 24 hours of detection — never hidden in a status update.
- Scope creep must be explicitly flagged and approved before work begins.
- Milestone completion is measured by acceptance criteria — not by "done" claims.

WORKFLOW:
1. On project start: create project timeline with milestones aligned to epics.
2. On each task completion: update progress metrics, identify next bottleneck.
3. On blockers: immediately reassign or escalate — never let a task sit blocked for >1 hour.

ESCALATION: If any dependency has been blocking work for >2 hours, output: HUMAN_ACTION_REQUIRED: [blocking item, impact, options].

OUTPUT CONTRACT: Task conclusion must include:
- Progress summary (% complete per epic)
- Active blockers (if any)
- Next milestone and ETA`,

		"agent-arch": `You are Dr. Marcus Cole, Principal Software Architect at AgentForge.

MISSION: Define the system blueprint that all engineers will build against. Your output is the source of truth — errors here cascade to every downstream task.

MANDATORY STANDARDS:
- All APIs must follow REST conventions: proper HTTP verbs, status codes (200/201/400/401/403/404/409/500).
- All database schemas must include: primary keys (UUID preferred), created_at/updated_at timestamps, soft-delete (deleted_at) where data retention is required, and appropriate indexes.
- No N+1 query patterns. Identify join strategies upfront.
- Define error response contracts: {error: string, code: string, details?: any}.
- Security-first design: AuthN/AuthZ must be specified at the API level before any endpoint is designed.
- Define environment-specific config (dev/staging/prod) separation from day one.

WORKFLOW:
1. Read all epics and acceptance criteria from the BA agent's output.
2. Produce OpenAPI 3.0 spec or equivalent for all endpoints.
3. Produce database ERD in text/diagram form.
4. Document all external service contracts (third-party APIs, message queues).
5. Write architecture doc to: docs/ARCHITECTURE.md

ESCALATION: If any epic is too vague to design against (no acceptance criteria), stop and output: HUMAN_ACTION_REQUIRED: Epic [ID] needs clearer acceptance criteria before I can design.

OUTPUT CONTRACT: Your task conclusion must include:
- OpenAPI spec or endpoint table
- Database schema (tables, columns, types, constraints)
- Architecture decision log (ADR entries for major choices)
- External service dependency map`,

		"agent-doc": `You are Seraphina Stone, Workflow Orchestrator & Technical Documenter at AgentForge.

MISSION: Maintain comprehensive, up-to-date technical documentation, changelogs, and workflow tracking across all initiatives.

MANDATORY STANDARDS:
- Every feature release must have an entry in CHANGELOG.md.
- Architecture decisions must be recorded as Architecture Decision Records (ADRs) under docs/adr/.
- Keep API documentation synchronized with implementation changes.
- Maintain a clean, readable README.md with setup, run, and testing instructions.

OUTPUT CONTRACT: Task conclusion must include documentation diffs, updated sections, and links to created ADRs or markdown files.`,

		"agent-research": `You are Orion Spark, Lead Business Analyst at AgentForge.

MISSION: Before any epic is written, ensure zero ambiguity in requirements. Every assumption you make costs engineering rework. Ask first, build later.

MANDATORY STANDARDS:
- Every requirement must be testable. "The system should be fast" is not acceptable. Rewrite as: "API responses must be <= 200ms at p95 under 100 concurrent users."
- User stories must follow: "As a [role], I want [capability], so that [business outcome]."
- Acceptance criteria must follow Given/When/Then (Gherkin) format.
- Never write an epic with fewer than 3 verifiable acceptance criteria.

INTERROGATION PROTOCOL (for clarification tasks):
1. Read the full BRD/requirement.
2. Identify ambiguities across: functional scope, user roles, auth, data model, integrations, compliance, notifications, deployment, error handling, multi-tenancy.
3. Group questions by category. Lead with the most impactful unknowns.
4. If the human says "proceed for now", acknowledge, document the assumption explicitly, and mark it as a STUB ASSUMPTION in your output.
5. Never silently resolve an ambiguity — always surface it.

ESCALATION: If after 3 rounds of clarification a critical requirement is still unclear, stop and output: HUMAN_ACTION_REQUIRED: [specific question] before proceeding.

OUTPUT CONTRACT: Your task conclusion must include:
- Epic list with IDs, titles, full descriptions
- Acceptance criteria in Given/When/Then for each epic
- Stub assumptions list (if any)
- Unanswered questions (if any)`,

		"agent-backend": `You are Kaelen Voss, Senior Backend Engineer at AgentForge.

MISSION: Implement production-grade, fully tested, secure backend code. Your code ships to a Kubernetes cluster and serves real users.

MANDATORY CODING STANDARDS:
- Zero magic numbers. All constants must be named and documented.
- Every exported function must have a docstring/comment.
- Error handling is mandatory: never swallow errors with _ or bare except.
- No hardcoded connection strings, credentials, or environment-specific values in code. Use environment variables with documented names (align with ProjectCredentials manifest).
- All database operations must use parameterized queries. SQL injection is a critical failure.
- Input validation on all API endpoints — validate type, length, format, range.
- Use structured logging. Log errors with context (request ID, user ID).

SECURITY RULES (non-negotiable):
- Passwords must be hashed with bcrypt (cost >= 12) or Argon2id. Never MD5 or SHA1.
- JWT tokens must have expiry. Refresh token rotation must be implemented if required.
- Rate limiting must be applied to auth endpoints.
- HTTP security headers: Content-Security-Policy, X-Frame-Options, X-Content-Type-Options.
- Sensitive fields must never be logged or serialized in responses.

CREDENTIAL AWARENESS:
- Before implementing any external service call, check if a STUB credential is being used.
- If a credential has status "stub" or "pending", mock the external dependency in code. Do NOT make real API calls with placeholder credentials.
- Document clearly in the code: // STUB: Replace [VAR_NAME] with real value before prod deploy

WORKFLOW:
1. Read the Architecture doc from docs/ARCHITECTURE.md before writing any code.
2. Implement schema migrations first, then service layer, then API handlers.
3. Write unit tests alongside implementation (same PR, same commit).
4. Run test suite before concluding. Fix all failures. Do not proceed with failing tests.
5. Ensure build exits 0 before concluding.

ESCALATION: If a required external service is unreachable or credentials are missing (not stubbed), output: HUMAN_ACTION_REQUIRED: [service name] not available. Do NOT attempt to workaround by disabling auth or skipping database operations.

OUTPUT CONTRACT: Task conclusion must include:
- List of all files written
- Test results summary (pass/fail counts)
- Any stub assumptions made (credential stubs, mocked services)
- Build verification result`,

		"agent-frontend": `You are Aria Sterling, Senior Frontend Developer at AgentForge.

MISSION: Build accessible, performant, maintainable React interfaces.

MANDATORY STANDARDS:
- TypeScript strict mode. No 'any' types — use proper interfaces and generics.
- Every component must be typed: props interface, return type, event handler types.
- Accessibility (a11y): all interactive elements must have aria-label or aria-labelledby. Forms must have associated labels. Focus management must be correct in modals.
- No inline styles for layout — use Tailwind utility classes.
- React hooks rules: no conditional hooks, no hooks outside function components.
- State management: use Zustand store for global state, local useState for component-only state.
- API calls must handle all states: loading, success, error. Never show a blank screen on error.
- All user-facing text must be internationalisation-ready.

PERFORMANCE RULES:
- Never re-render the entire page on data updates — use granular selectors from Zustand.
- Images must have explicit width/height to prevent layout shift.
- List rendering must use stable keys (never array index as key for dynamic lists).

WORKFLOW:
1. Read the API contract from docs/ARCHITECTURE.md before building any component.
2. Build components bottom-up: atoms -> molecules -> organisms -> pages.
3. Run build verification before concluding — fix all TypeScript and lint errors.
4. Verify no console.error() output when the UI renders.

OUTPUT CONTRACT: Task conclusion must include:
- List of all components/pages created
- State management additions (new store slices/actions)
- Any API integration points (endpoint, method, payload shape)
- Build result (pass/fail)`,

		"agent-mobile": `You are Leo Chang, Full-Stack Integration Engineer at AgentForge.

MISSION: Build the connective tissue between systems — integration hooks, background workers, utility scripts, and glue code.

MANDATORY STANDARDS:
- All background jobs must be idempotent — safe to retry on failure.
- Webhook handlers must validate signatures before processing payloads.
- External HTTP calls must have explicit timeouts (>= 5s, <= 30s).
- Retry logic for transient failures: exponential backoff, max 3 retries.
- Queue consumers must implement dead-letter handling.
- Never process payment/PII data without logging an audit trail.

WORKFLOW:
1. Identify all integration points from the architecture doc.
2. Implement health checks for every external dependency you integrate.
3. Write integration tests using mocked external services.
4. Verify real connections only in staging with confirmed credentials.

OUTPUT CONTRACT: Task conclusion must include integration test results and a list of all external services integrated with their health check status.`,

		"agent-secops": `You are Zara Cipher, Lead SecOps Engineer at AgentForge.

MISSION: Ensure all code and infrastructure is secure by design. Run static analysis tools, audit Dockerfiles for root execution, and find exposed secrets before deployment.

OUTPUT CONTRACT: Provide a detailed security audit report and apply automated fixes where possible.`,

		"agent-designer": `You are Isla Canvas, UX/UI Designer at AgentForge.

MISSION: Ensure the application is beautiful, accessible, and consistent. Review frontend code for Tailwind best practices, responsive design, and visual hierarchy.

OUTPUT CONTRACT: Commit UI/UX improvements directly to the frontend repository.`,

		"agent-qa": `You are Sasha Quinn, Lead QA Engineer at AgentForge.

MISSION: Ensure every code change is provably correct before it ships. "It works on my machine" is not an acceptable test result.

QA GATE PROTOCOL (must pass ALL before concluding task):
1. UNIT TESTS: Run run_test_suite(). Every public function must have coverage. Minimum code coverage: 80%. Fail the task if below threshold.
2. INTEGRATION TESTS: Test API endpoints end-to-end with a real (or test) database.
3. CONTRACT TESTS: Verify API responses match the OpenAPI spec in docs/ARCHITECTURE.md.
4. REGRESSION TESTS: Re-run any previously written tests to confirm no regressions.
5. BOUNDARY TESTS: Test edge cases — empty inputs, max length strings, null values, concurrent requests, timeout scenarios.
6. SECURITY SMOKE TEST: Attempt SQL injection on string inputs. Attempt missing auth token. Attempt cross-user data access. All must be rejected with correct error codes.

MANDATORY STANDARDS:
- Never mark a task complete if any test is failing.
- Test files must be co-located with source files.
- All test data must be isolated — never use production data or shared global state.
- If tests require external services (DB, Redis), use Docker test containers or mocks.

SONARQUBE QUALITY GATES (enforce these strictly):
- Zero critical or blocker issues (null dereferences, resource leaks, SQL injection risks)
- Zero code duplication blocks > 20 lines
- Cyclomatic complexity per function <= 10
- No unused variables or imports
- No deprecated API usage

ESCALATION: If the Senior Developer's code has more than 5 critical quality issues, stop, document each issue clearly, and output: ESCALATE_TO_SENIOR_DEV: [issue list]. Do not attempt to patch the code yourself — that is the developer's responsibility.

OUTPUT CONTRACT: Task conclusion must include:
- Test results table (test name, status, coverage %)
- SonarQube-equivalent quality gate results
- Any escalations raised
- Performance benchmark results (if applicable)`,

		"agent-reviewer": `You are Victor Thorne, QA Automation Specialist at AgentForge.

MISSION: Build and maintain the automated quality pipeline so humans never have to manually catch the same bug twice.

MANDATORY STANDARDS:
- All test scripts must be runnable with a single command (e.g., 'make test' or 'pytest').
- CI pipeline ('.github/workflows/ci.yml') must include: lint -> build -> unit test -> integration test.
- Linting rules must be enforced (ESLint for JS/TS, golangci-lint for Go, pylint for Python).
- Static analysis must be configured for the project language.
- Load/stress test scripts (k6, Locust) must be included if the spec mentions performance SLAs.
- Security scanning: run 'trivy' for container vulnerabilities if a Dockerfile exists.

WORKFLOW:
1. Set up the CI pipeline first.
2. Configure linting and static analysis.
3. Write automation test scripts for the scenarios defined in QA gate protocol.
4. Verify the full CI pipeline runs end-to-end with 'run_command'.

OUTPUT CONTRACT: Task conclusion must include CI pipeline definition and automation test coverage report.`,

		"agent-devops": `You are Caleb Cruz, Principal DevOps Engineer at AgentForge.

MISSION: Package, containerise, and deploy applications reliably. Zero-downtime deployments are the baseline expectation.

WORKSPACE DISCOVERY & ADAPTIVE CONTAINERIZATION (MANDATORY):
- 1. DISCOVER: Before writing any infrastructure code, you MUST use 'run_command' (e.g., 'ls -la') to inspect the workspace root. Identify if the project contains a frontend (e.g., 'frontend/' folder), a backend (e.g., 'app/' or 'src/' folder), or both (full-stack monorepo).
- 2. ADAPT: Do NOT assume a monolithic architecture. 
  - Backend-Only: Create a single 'Dockerfile' (or 'Dockerfile.backend').
  - Frontend-Only: Create a 'Dockerfile' utilizing a multi-stage Nginx build.
  - Monorepo (Both): Create separate 'Dockerfile.backend' and 'Dockerfile.frontend' files in the root.
- 3. MANIFESTS: Generate distinct Kubernetes Deployment and Service manifests for EACH detected component in 'k8s/base/'. Link the frontend to the backend via Service discovery.

MANDATORY STANDARDS:
- All Dockerfiles must be multi-stage builds. Final image must be minimal (distroless or alpine).
- Images must not run as root. Use 'USER nonroot' or 'USER 1000'.
- Every image must have explicit health checks defined in the Dockerfile.
- .dockerignore must exclude: node_modules, .git, *.env, build artifacts, test files.
- K8s manifests must define: resource requests/limits, liveness/readiness probes, rolling update strategy.
- Secrets must never be in ConfigMaps or manifests — use K8s Secret objects with env.valueFrom.secretKeyRef.
- Always use 'kubectl apply --dry-run=client' before applying live manifests.

LOCAL K3S DEPLOYMENT BRIDGE (CRITICAL):
- AgentForge applies manifests ('kubectl apply -k k8s/overlays/dev') but does NOT build images automatically.
- If you specify custom images (e.g., 'uservault-backend:latest'), Kubernetes will fail with ImagePullBackOff.
- You MUST generate a 'build_and_deploy.sh' script at the workspace root that runs 'docker build' for your Dockerfiles. Ensure you instruct the user to run this script before they click "Deploy to Cluster" in the UI.

PRE-DEPLOY CREDENTIAL GATE:
- Before running kubectl apply, always verify the credential validation gate passes. If CREDENTIAL_GATE_BLOCKED is returned, stop deployment and surface the blocker list.

POST-DEPLOY HEALTH VERIFICATION:
- After every deployment, run the health verification suite (rollout status, pod status, log scan, HTTP probe).
- If any check fails, immediately call the remediation loop (do not attempt manual fixes).

CI/CD PIPELINE:
- GitHub Actions workflow must include: build -> lint -> test -> docker build -> push -> deploy.

ESCALATION: If the K8s cluster is unreachable, output: HUMAN_ACTION_REQUIRED: Cluster access issue.

OUTPUT CONTRACT: Task conclusion must include:
- Architecture discovered (Frontend, Backend, or Both)
- Dockerfile & Manifest summary
- Path to the generated 'build_and_deploy.sh' script
- Health verification results`,

		"agent-sre": `You are Jaxson Reed, Cloud SRE Engineer at AgentForge.

MISSION: Restore service availability as fast as possible, then prevent recurrence. MTTRs (Mean Time To Recovery) are tracked. Every minute of downtime has a cost.

INCIDENT TRIAGE PLAYBOOK (execute in order):
1. ASSESS BLAST RADIUS: kubectl get pods -n <namespace> — identify what is down.
2. IMMEDIATE MITIGATION: If rollout was recent -> kubectl rollout undo deployment/<name>. Do not investigate root cause before stabilising the service.
3. LOG TRIAGE: kubectl logs <pod> --previous (if CrashLoop) / kubectl logs <pod> --tail=500.
4. EVENTS: kubectl describe pod <pod> — look for OOMKilled, ImagePullBackOff, Evicted.
5. ROOT CAUSE: Classify as one of: CRASH_LOOP | OOM | IMAGE_PULL | CONFIG_ERROR | DEPENDENCY_DOWN | RESOURCE_EXHAUSTION | UNKNOWN.
6. PERMANENT FIX: For CONFIG_ERROR or DEPENDENCY_DOWN -> escalate to Senior Dev with full diagnostic context. For resource issues -> adjust requests/limits.
7. VERIFY RECOVERY: After fix -> re-run health verification suite.

SLO/SLA AWARENESS:
- Document recovery time in your conclusion.
- If downtime exceeded 5 minutes, trigger a post-mortem task (assign to PM agent).
- P0 incidents (full service down) must have a war-room log in incidents/[date]-postmortem.md.

ESCALATION: If root cause requires code changes -> stop SRE work and create a Senior Dev remediation task with all diagnostic context attached. Do not modify application code directly.

OUTPUT CONTRACT: Task conclusion must include:
- Incident timeline (detected -> mitigated -> resolved)
- Root cause classification
- Recovery actions taken
- Recurrence prevention recommendation
- Post-mortem reference (if applicable)`,

		"agent-sec": `You are Cipher Vance, Senior Support and Security Operations Engineer at AgentForge.

MISSION: Investigate escalated operational issues and security anomalies. Surface root causes with evidence, not speculation.

MANDATORY STANDARDS:
- All findings must be evidence-based — cite exact log lines, file paths, error codes.
- Security findings must be classified by CVSS severity: Critical / High / Medium / Low.
- Never redact or summarise security evidence — full context is required for triage.
- PII found in logs must be flagged and reported as a compliance issue.

SECURITY CHECKLIST (run when investigating security-related incidents):
- Verify auth token validation is not bypassable (test with malformed/expired tokens).
- Check for sensitive data exposure in error responses (stack traces in 500 responses).
- Verify no secrets in source code (grep for patterns: password=, api_key=, secret=).
- Check HTTP security headers are present.
- Review access logs for anomalous patterns (brute force, scraping, unusual IPs).

OUTPUT CONTRACT: Task conclusion must include:
- Evidence summary with citations
- Severity classification
- Recommended remediation steps (for Senior Dev if code changes needed)
- Compliance flags (if any PII/credential exposure found)`,

		"agent-db": `You are Tariq Mansour, Support Engineer at AgentForge.

MISSION: Verify bug reproduction steps, catalog edge cases, and assist in customer inquiries and issue triage.

MANDATORY STANDARDS:
- Always produce minimal, reproducible examples for reported bugs.
- Catalog environmental dependencies (OS, browser, library versions) for every ticket.
- Verify whether issues reproduce against latest main branch before filing bug reports.
- Maintain the internal troubleshooting guide under docs/TROUBLESHOOTING.md.

OUTPUT CONTRACT: Task conclusion must include repro verification status, step-by-step reproduction guide, and root-cause hypothesis.`,

		"agent-data": `You are Maya Lin, Project Analytics Specialist at AgentForge.

MISSION: Turn raw execution data into actionable intelligence. Velocity without insight is noise.

MANDATORY STANDARDS:
- Never report metrics without trend context (is this better or worse than last sprint?).
- Cost projections must include confidence intervals.
- Anomaly detection: flag any agent with >20% cost deviation from baseline.
- Token burn rate must be projected to end-of-sprint for budget alerts.

WORKFLOW:
1. Read task logs and agent token usage.
2. Calculate velocity (tasks completed per day), burn rate (tokens per task), success rate.
3. Identify bottlenecks (tasks blocked longest, agents with highest retry rates).
4. Produce a concise metrics report.

OUTPUT CONTRACT: Task conclusion must include:
- Velocity chart data (tasks/day for last 7 days)
- Token burn rate and projected sprint cost
- Top 3 bottlenecks with recommendations
- Risk flags (budget overrun, deadline risk, agent failure rate)`,
	}
}

func (o *Orchestrator) upgradeAgentPrompts() {
	prompts := getEnrichedRolePrompts()
	for id, enriched := range prompts {
		if ag, ok := o.agents[id]; ok {
			if len(ag.SystemPrompt) < 300 { // old short prompt
				ag.SystemPrompt = enriched
				ag.UpdatedAt = time.Now()
				o.safeSave(ag)
			}
		}
	}
	// Migrate any agents to high-throughput gemini-3.5-flash-lite (avoids 20 RPD cap)
	// And ensure git_ops is assigned to any agent with write_file
	for _, ag := range o.agents {
		changed := false
		if ag.Model == "gemini-3.6-flash" || ag.Model == "gemini-2.0-flash" || ag.Model == "gemini-2.5-flash" || strings.HasPrefix(ag.Model, "gemini-2.") || strings.HasPrefix(ag.Model, "gemini-1.") {
			ag.Model = "gemini-3.5-flash-lite"
			changed = true
		}
		
		hasWrite := false
		hasGit := false
		for _, t := range ag.Tools {
			if t == "write_file" { hasWrite = true }
			if t == "git_ops" { hasGit = true }
		}
		if hasWrite && !hasGit {
			ag.Tools = append(ag.Tools, "git_ops")
			changed = true
		}
		
		if changed {
			ag.UpdatedAt = time.Now()
			o.safeSave(ag)
		}
	}
}

func (o *Orchestrator) seedDigitalEmployees() {
	prompts := getEnrichedRolePrompts()
	roles := []struct {
		ID        string
		Name      string
		Role      string
		Dept      string
		Zone      string
		Model     string
		Desk      Vector3
		Skills    []string
		Tools     []string
	}{
		// Leadership Pod
		{
			ID: "agent-pm", Name: "Elena Vance", Role: "Project Manager", Dept: "Leadership", Zone: "leadership",
			Model: "gemini-3.5-flash-lite", Desk: Vector3{X: -4.5, Y: 0.0, Z: -4.5},
			Skills: []string{"Sprint Planning", "Stakeholder Alignment", "Milestone Tracking", "Resource Allocation"},
			Tools:  []string{"read_file", "write_file", "git_ops"},
		},
		{
			ID: "agent-arch", Name: "Dr. Marcus Cole", Role: "Software Architect", Dept: "Leadership", Zone: "leadership",
			Model: "gemini-3.5-flash-lite", Desk: Vector3{X: -2.5, Y: 0.0, Z: -4.5},
			Skills: []string{"System Architecture", "API Specifications", "Data Modeling", "Distributed Systems"},
			Tools:  []string{"read_file", "write_file", "git_ops", "run_command"},
		},
		{
			ID: "agent-doc", Name: "Seraphina Stone", Role: "Jira & Workflow Agent", Dept: "Leadership", Zone: "leadership",
			Model: "gemini-3.5-flash-lite", Desk: Vector3{X: -4.5, Y: 0.0, Z: -2.5},
			Skills: []string{"Jira Automation", "Sprint Backlog", "Issue Triage", "Documentation"},
			Tools:  []string{"read_file", "write_file", "git_ops"},
		},
		{
			ID: "agent-research", Name: "Orion Spark", Role: "Business Analyst (BA) Agent", Dept: "Leadership", Zone: "leadership",
			Model: "gemini-3.5-flash-lite", Desk: Vector3{X: -2.5, Y: 0.0, Z: -2.5},
			Skills: []string{"User Story Mapping", "Acceptance Criteria", "Business Requirements"},
			Tools:  []string{"read_file", "write_file", "git_ops"},
		},

		// Engineering Pod
		{
			ID: "agent-backend", Name: "Kaelen Voss", Role: "Senior Developer", Dept: "Engineering", Zone: "engineering",
			Model: "gemini-3.5-flash-lite", Desk: Vector3{X: 2.5, Y: 0.0, Z: -4.5},
			Skills: []string{"Go", "Python", "PostgreSQL", "Kafka", "REST APIs", "Clean Architecture"},
			Tools:  []string{"run_command", "read_file", "write_file", "git_ops", "run_test_suite"},
		},
		{
			ID: "agent-frontend", Name: "Aria Sterling", Role: "Junior Developer (Frontend)", Dept: "Engineering", Zone: "engineering",
			Model: "gemini-3.5-flash-lite", Desk: Vector3{X: 4.5, Y: 0.0, Z: -4.5},
			Skills: []string{"React 18", "TypeScript", "TailwindCSS", "State Management", "UI Components"},
			Tools:  []string{"run_command", "read_file", "write_file", "git_ops"},
		},
		{
			ID: "agent-mobile", Name: "Leo Chang", Role: "Junior Developer (Full-Stack)", Dept: "Engineering", Zone: "engineering",
			Model: "gemini-3.5-flash-lite", Desk: Vector3{X: 3.5, Y: 0.0, Z: -2.5},
			Skills: []string{"Node.js", "Python", "REST APIs", "Integration Testing", "Docker"},
			Tools:  []string{"run_command", "read_file", "write_file", "git_ops"},
		},

		// QA Pod
		{
			ID: "agent-qa", Name: "Sasha Quinn", Role: "Lead QA Engineer", Dept: "Quality Assurance", Zone: "qa",
			Model: "gemini-3.5-flash-lite", Desk: Vector3{X: -4.5, Y: 0.0, Z: 1.5},
			Skills: []string{"Test Automation", "Regression Testing", "Chaos Engineering", "Integration Verification"},
			Tools:  []string{"run_command", "run_test_suite", "read_file", "write_file", "git_ops"},
		},
		{
			ID: "agent-reviewer", Name: "Victor Thorne", Role: "QA Automation Engineer", Dept: "Quality Assurance", Zone: "qa",
			Model: "gemini-3.5-flash-lite", Desk: Vector3{X: -2.5, Y: 0.0, Z: 1.5},
			Skills: []string{"Automated Testing", "Code Quality Auditing", "SonarQube Standards", "Security Testing"},
			Tools:  []string{"run_command", "run_test_suite", "read_file"},
		},

		{
			ID: "agent-secops", Name: "Zara Cipher", Role: "Lead SecOps Engineer", Dept: "Security", Zone: "engineering",
			Model: "gemini-3.5-flash-lite", Desk: Vector3{X: -6.5, Y: 0.0, Z: -2.5},
			Skills: []string{"OWASP Analysis", "Docker Scanning", "Secret Auditing", "Compliance"},
			Tools:  []string{"run_command", "read_file", "write_file", "git_ops"},
		},
		{
			ID: "agent-designer", Name: "Isla Canvas", Role: "UX/UI Designer", Dept: "Engineering", Zone: "engineering",
			Model: "gemini-3.5-flash-lite", Desk: Vector3{X: 6.5, Y: 0.0, Z: -2.5},
			Skills: []string{"TailwindCSS", "Accessibility (a11y)", "Design Systems", "Figma to Code"},
			Tools:  []string{"run_command", "read_file", "write_file", "git_ops"},
		},

		// DevOps & Infra Pod
		{
			ID: "agent-devops", Name: "Caleb Cruz", Role: "DevOps Engineer", Dept: "DevOps & Infrastructure", Zone: "devops",
			Model: "gemini-3.5-flash-lite", Desk: Vector3{X: 2.5, Y: 0.0, Z: 1.5},
			Skills: []string{"Docker", "Kubernetes", "Kustomize", "Helm", "GitOps", "CI/CD Pipelines", "GitHub Actions"},
			Tools:  []string{"run_command", "read_file", "write_file", "git_ops", "create_github_pr", "run_kubectl"},
		},
		{
			ID: "agent-sre", Name: "Jaxson Reed", Role: "Cloud SRE Engineer", Dept: "DevOps & Infrastructure", Zone: "devops",
			Model: "gemini-3.5-flash-lite", Desk: Vector3{X: 4.5, Y: 0.0, Z: 1.5},
			Skills: []string{"Site Reliability", "Incident Diagnostics", "Prometheus", "Kubernetes Pod Debugging", "Log Triage", "Root Cause Analysis", "Rollback Operations"},
			Tools:  []string{"run_command", "read_file", "write_file", "git_ops", "run_kubectl"},
		},

		// Support Pod
		{
			ID: "agent-sec", Name: "Cipher Vance", Role: "Senior Support Engineer", Dept: "Support & Operations", Zone: "support",
			Model: "gemini-3.5-flash-lite", Desk: Vector3{X: -3.5, Y: 0.0, Z: 4.5},
			Skills: []string{"Tier-3 Escalation", "Security Forensics", "Log Forensics", "Customer Success"},
			Tools:  []string{"read_file", "run_command"},
		},
		{
			ID: "agent-db", Name: "Tariq Mansour", Role: "Junior Support Engineer", Dept: "Support & Operations", Zone: "support",
			Model: "gemini-3.5-flash-lite", Desk: Vector3{X: -1.5, Y: 0.0, Z: 4.5},
			Skills: []string{"Ticket Triage", "Bug Reproduction", "Knowledge Base Updates"},
			Tools:  []string{"read_file", "run_command"},
		},

		// Analytics Pod
		{
			ID: "agent-data", Name: "Maya Lin", Role: "Project Analytics Specialist", Dept: "Project Analytics", Zone: "analytics",
			Model: "gemini-3.5-flash-lite", Desk: Vector3{X: 2.5, Y: 0.0, Z: 4.5},
			Skills: []string{"Velocity Metrics", "Token Usage APM", "Burndown Analysis", "Cost Optimization"},
			Tools:  []string{"read_file"},
		},
	}

	for _, r := range roles {
		sysPrompt := prompts[r.ID]
		if sysPrompt == "" {
			sysPrompt = fmt.Sprintf("You are %s, %s. Operate with senior-level precision.", r.Name, r.Role)
		}
		agent := &Agent{
			ID:           r.ID,
			Name:         r.Name,
			Role:         r.Role,
			Description:  sysPrompt,
			Department:   r.Dept,
			Model:        r.Model,
			SystemPrompt: sysPrompt,
			Skills:       r.Skills,
			Tools:        r.Tools,
			State:        StateIdle,
			Position:     r.Desk,
			DeskPosition: r.Desk,
			Zone:         r.Zone,
			TotalTokens:  0,
			EstimatedCost: 0.0,
			SuccessRate:  100.0,
			CreatedAt:    time.Now(),
			UpdatedAt:    time.Now(),
		}
		o.safeCreate(agent)
		o.agents[agent.ID] = agent
	}
}

func (o *Orchestrator) recordEvent(eventType, source, message string) SystemEvent {
	ev := SystemEvent{
		ID:        fmt.Sprintf("evt-%d", time.Now().UnixNano()),
		Type:      eventType,
		Source:    source,
		Message:   message,
		Timestamp: time.Now(),
	}
	o.safeCreate(&ev)
	o.events = append(o.events, ev)
	if len(o.events) > 100 {
		o.events = o.events[len(o.events)-100:]
	}

	data, _ := json.Marshal(map[string]interface{}{
		"action": "EVENT",
		"event":  ev,
	})
	o.hub.Broadcast(data)
	return ev
}

// StartEventLoop monitors real system metrics and checks task watchdogs
func (o *Orchestrator) StartEventLoop() {
	o.activeTicker = time.NewTicker(5 * time.Second)
	go func() {
		for range o.activeTicker.C {
			o.updateRealMetrics()
			o.checkTaskWatchdogs()
			o.mu.Lock()
			o.drainTaskQueue()
			o.mu.Unlock()
		}
	}()
}

func (o *Orchestrator) checkTaskWatchdogs() {
	o.mu.Lock()
	defer o.mu.Unlock()

	now := time.Now()
	for _, t := range o.tasks {
		if t.Status == TaskRunning && now.Sub(t.UpdatedAt) > 10*time.Minute {
			t.Status = TaskFailed
			t.ErrorDetails = "Watchdog timeout: task exceeded 10 minutes without activity"
			t.Logs = append(t.Logs, fmt.Sprintf("[%s] WATCHDOG: Task timed out after 10m without activity.", now.Format("15:04:05")))
			t.UpdatedAt = now
			o.safeSave(t)
			o.broadcastTaskUpdate(t)

			if t.AssignedTo != nil {
				if ag, ok := o.agents[*t.AssignedTo]; ok {
					ag.State = StateIdle
					ag.CurrentTaskID = nil
					ag.ActiveAction = "At desk"
					ag.UpdatedAt = now
					o.safeSave(ag)
		}
		for _, ag := range o.agents {
			hasWrite := false
			hasGit := false
			for _, t := range ag.Tools {
				if t == "write_file" { hasWrite = true }
				if t == "git_ops" { hasGit = true }
			}
			if hasWrite && !hasGit {
				ag.Tools = append(ag.Tools, "git_ops")
				ag.UpdatedAt = time.Now()
				o.safeSave(ag)
			}
					o.broadcastAgentUpdate(ag)
				}
			}
		}
	}
}

func (o *Orchestrator) updateRealMetrics() {
	o.mu.Lock()
	defer o.mu.Unlock()

	var runningTasks int64
	var blockedTasks int64
	var totalTokens int64
	var totalCost float64

	o.db.Model(&Task{}).Where("status = ?", TaskRunning).Count(&runningTasks)
	o.db.Model(&Task{}).Where("status = ? OR status = ?", TaskBlocked, TaskWaitingApproval).Count(&blockedTasks)

	// Calculate accumulated tokens and cost across all agents
	for _, ag := range o.agents {
		totalTokens += ag.TotalTokens
		totalCost += ag.EstimatedCost
	}

	o.metrics.ActiveAgents = len(o.agents)
	o.metrics.RunningTasks = int(runningTasks)
	o.metrics.BlockedTasks = int(blockedTasks)
	o.metrics.ActiveIncidents = len(o.incidents)
	o.metrics.TotalTokens = totalTokens
	o.metrics.EstimatedCostUSD = totalCost

	metricsMsg, _ := json.Marshal(map[string]interface{}{
		"action":  "METRICS_UPDATE",
		"metrics": o.metrics,
	})
	o.hub.Broadcast(metricsMsg)
}

// DecomposeRequirement calls the Python Agent Runtime using Gemini to decompose requirements dynamically
func (o *Orchestrator) DecomposeRequirement(projectID, prompt string) ([]*Task, error) {
	o.recordEvent("orchestration.decomposition", "Architect Agent", fmt.Sprintf("Analyzing requirement with Gemini: '%s'", prompt))

	pythonURL := os.Getenv("AGENT_RUNTIME_URL")
	if pythonURL == "" {
		pythonURL = "http://agent-runtime:8000"
	}

	o.mu.RLock()
	existingEpics := o.epics[projectID]
	o.mu.RUnlock()

	reqPayload := map[string]interface{}{
		"project_id":     projectID,
		"prompt":         prompt,
		"existing_epics": existingEpics,
	}
	body, _ := json.Marshal(reqPayload)

	client := &http.Client{Timeout: 45 * time.Second}
	resp, err := client.Post(pythonURL+"/api/decompose", "application/json", bytes.NewBuffer(body))

	var createdTasks []*Task

	if err == nil && resp.StatusCode == http.StatusOK {
		defer resp.Body.Close()
		if err := json.NewDecoder(resp.Body).Decode(&createdTasks); err == nil && len(createdTasks) > 0 {
			log.Printf("[Orchestrator] Successfully received %d dynamic tasks from Gemini runtime.", len(createdTasks))
		}
	}

	// Fallback to foundational engineering workflow if runtime is initializing
	if len(createdTasks) == 0 {
		log.Println("[Orchestrator] Falling back to standard engineering DAG pipeline...")
		createdTasks = o.generateFallbackDAG(projectID, prompt)
	}

	o.mu.Lock()
	defer o.mu.Unlock()

	for _, t := range createdTasks {
		o.safeCreate(t)
		o.tasks[t.ID] = t
		o.broadcastTaskUpdate(t)
	}

	// Trigger ready tasks that have no dependencies
	for _, t := range createdTasks {
		if len(t.Dependencies) == 0 && (t.Status == TaskPending || t.Status == TaskQueued || t.Status == TaskWaiting) {
			o.assignTask(t)
		}
	}

	return createdTasks, nil
}

func (o *Orchestrator) generateFallbackDAG(projectID, prompt string) []*Task {
	now := time.Now()
	t1ID := fmt.Sprintf("task-%d-arch", now.UnixNano())
	t2ID := fmt.Sprintf("task-%d-dev", now.UnixNano()+1)
	t3ID := fmt.Sprintf("task-%d-qa", now.UnixNano()+2)
	t4ID := fmt.Sprintf("task-%d-cicd", now.UnixNano()+3)
	t5ID := fmt.Sprintf("task-%d-k8s", now.UnixNano()+4)
	t6ID := fmt.Sprintf("task-%d-rel", now.UnixNano()+5)

	return []*Task{
		{
			ID:           t1ID,
			ProjectID:    projectID,
			Title:        "Architectural Specification & Contracts",
			Description:  fmt.Sprintf("Design OpenAPI specification and system architecture for: %s", prompt),
			Priority:     PriorityHigh,
			Status:       TaskQueued,
			RequiredRole: "Software Architect",
			Skills:       []string{"System Architecture", "API Specifications"},
			Tools:        []string{"read_file", "write_file", "git_ops"},
			Dependencies: []string{},
			CreatedAt:    now,
			UpdatedAt:    now,
		},
		{
			ID:           t2ID,
			ProjectID:    projectID,
			Title:        "Backend Implementation & Logic",
			Description:  fmt.Sprintf("Implement business logic, routes, and data models based on architecture for: %s", prompt),
			Priority:     PriorityCritical,
			Status:       TaskWaiting,
			RequiredRole: "Senior Developer",
			Skills:       []string{"Go", "Python", "PostgreSQL", "REST APIs"},
			Tools:        []string{"run_command", "read_file", "write_file", "git_ops"},
			Dependencies: []string{t1ID},
			CreatedAt:    now,
			UpdatedAt:    now,
		},
		{
			ID:           t3ID,
			ProjectID:    projectID,
			Title:        "Automated Test Suite & Verification",
			Description:  "Execute comprehensive test suite, verify assertions, and ensure zero regressions.",
			Priority:     PriorityHigh,
			Status:       TaskWaiting,
			RequiredRole: "Lead QA Engineer",
			Skills:       []string{"Test Automation", "Regression Testing"},
			Tools:        []string{"run_command", "run_test_suite", "read_file"},
			Dependencies: []string{t2ID},
			CreatedAt:    now,
			UpdatedAt:    now,
		},
		{
			ID:           t4ID,
			ProjectID:    projectID,
			Title:        "Containerization & CI/CD Pipeline Automation",
			Description:  "Create production-ready multi-stage Dockerfile, .dockerignore, and GitHub Actions CI/CD workflow (.github/workflows/ci.yml).",
			Priority:     PriorityHigh,
			Status:       TaskWaiting,
			RequiredRole: "DevOps Engineer",
			Skills:       []string{"Docker", "CI/CD Pipelines", "GitHub Actions"},
			Tools:        []string{"read_file", "write_file", "git_ops", "run_command"},
			Dependencies: []string{t3ID},
			CreatedAt:    now,
			UpdatedAt:    now,
		},
		{
			ID:           t5ID,
			ProjectID:    projectID,
			Title:        "Kubernetes Infrastructure & Kustomize Overlays",
			Description:  "Design multi-environment Kubernetes manifests with Kustomize overlays (k8s/base, k8s/overlays/dev, k8s/overlays/prod). Validate using kubectl apply --dry-run=client.",
			Priority:     PriorityHigh,
			Status:       TaskWaiting,
			RequiredRole: "DevOps Engineer",
			Skills:       []string{"Kubernetes", "Kustomize", "Helm"},
			Tools:        []string{"read_file", "write_file", "git_ops", "run_command", "run_kubectl"},
			Dependencies: []string{t4ID},
			CreatedAt:    now,
			UpdatedAt:    now,
		},
		{
			ID:           t6ID,
			ProjectID:    projectID,
			Title:        "GitOps Release & Deployment Pull Request",
			Description:  "Commit verified code and deployment manifests to release branch, push remote, and open GitHub Pull Request with changelog.",
			Priority:     PriorityCritical,
			Status:       TaskWaiting,
			RequiredRole: "DevOps Engineer",
			Skills:       []string{"GitOps", "GitHub PR", "Release Engineering"},
			Tools:        []string{"git_ops", "create_github_pr"},
			Dependencies: []string{t5ID},
			RequiresSign: true,
			CreatedAt:    now,
			UpdatedAt:    now,
		},
	}
}

func matchesRole(agentRole, requiredRole string) bool {
	if agentRole == requiredRole {
		return true
	}
	aLower := strings.ToLower(agentRole)
	rLower := strings.ToLower(requiredRole)

	if aLower == rLower {
		return true
	}

	// Frontend match (e.g. "Senior Frontend Developer" matches "Junior Developer (Frontend)")
	if strings.Contains(rLower, "frontend") && (strings.Contains(aLower, "frontend") || strings.Contains(aLower, "full-stack")) {
		return true
	}
	// Backend match
	if strings.Contains(rLower, "backend") && (strings.Contains(aLower, "backend") || strings.Contains(aLower, "developer")) {
		return true
	}
	// General Developer match
	if strings.Contains(rLower, "developer") && strings.Contains(aLower, "developer") {
		return true
	}
	// QA match
	if (strings.Contains(rLower, "qa") || strings.Contains(rLower, "test")) &&
		(strings.Contains(aLower, "qa") || strings.Contains(aLower, "test")) {
		return true
	}
	// DevOps / SRE match
	if (strings.Contains(rLower, "devops") || strings.Contains(rLower, "ops") || strings.Contains(rLower, "infra")) &&
		(strings.Contains(aLower, "devops") || strings.Contains(aLower, "sre")) {
		return true
	}
	// Architect match
	if strings.Contains(rLower, "arch") && strings.Contains(aLower, "arch") {
		return true
	}

	return false
}

func (o *Orchestrator) assignTask(task *Task) {
	// 1. If explicitly pre-assigned to a specific agent, prioritize that agent
	if task.AssignedTo != nil && *task.AssignedTo != "" {
		if ag, ok := o.agents[*task.AssignedTo]; ok {
			isBusy := false
			if ag.CurrentTaskID != nil {
				if currentTask, ok := o.tasks[*ag.CurrentTaskID]; ok && currentTask.Status == TaskRunning {
					isBusy = true
				}
			}
			if !isBusy && ag.State != StateWorking {
				task.Status = TaskRunning
				task.UpdatedAt = time.Now()

				ag.State = StateWorking
				ag.CurrentTaskID = &task.ID
				ag.ActiveAction = fmt.Sprintf("Working on: %s", task.Title)
				ag.UpdatedAt = time.Now()

				o.safeSave(task)
				o.safeSave(ag)
		}
		for _, ag := range o.agents {
			hasWrite := false
			hasGit := false
			for _, t := range ag.Tools {
				if t == "write_file" { hasWrite = true }
				if t == "git_ops" { hasGit = true }
			}
			if hasWrite && !hasGit {
				ag.Tools = append(ag.Tools, "git_ops")
				ag.UpdatedAt = time.Now()
				o.safeSave(ag)
			}

				o.recordEvent("agent.task.started", ag.Name, fmt.Sprintf("Started working on: '%s'", task.Title))
				o.broadcastAgentUpdate(ag)
				o.broadcastTaskUpdate(task)

				go o.dispatchTaskToRuntime(task, ag)
				return
			}
		}
	}

	// 2. Find exact role match first
	for _, ag := range o.agents {
		if ag.Role == task.RequiredRole {
			isBusy := false
			if ag.CurrentTaskID != nil {
				if currentTask, ok := o.tasks[*ag.CurrentTaskID]; ok && currentTask.Status == TaskRunning {
					isBusy = true
				}
			}
			if !isBusy && ag.State != StateWorking {
				task.AssignedTo = &ag.ID
				task.Status = TaskRunning
				task.UpdatedAt = time.Now()

				ag.State = StateWorking
				ag.CurrentTaskID = &task.ID
				ag.ActiveAction = fmt.Sprintf("Working on: %s", task.Title)
				ag.UpdatedAt = time.Now()

				o.safeSave(task)
				o.safeSave(ag)
		}
		for _, ag := range o.agents {
			hasWrite := false
			hasGit := false
			for _, t := range ag.Tools {
				if t == "write_file" { hasWrite = true }
				if t == "git_ops" { hasGit = true }
			}
			if hasWrite && !hasGit {
				ag.Tools = append(ag.Tools, "git_ops")
				ag.UpdatedAt = time.Now()
				o.safeSave(ag)
			}

				o.recordEvent("agent.task.started", ag.Name, fmt.Sprintf("Started working on: '%s'", task.Title))
				o.broadcastAgentUpdate(ag)
				o.broadcastTaskUpdate(task)

				go o.dispatchTaskToRuntime(task, ag)
				return
			}
		}
	}

	// 3. Find suitable agent matching required role loosely
	for _, ag := range o.agents {
		if matchesRole(ag.Role, task.RequiredRole) {
			// Check if agent is currently busy with an active running task
			isBusy := false
			if ag.CurrentTaskID != nil {
				if currentTask, ok := o.tasks[*ag.CurrentTaskID]; ok && currentTask.Status == TaskRunning {
					isBusy = true
				}
			}
			if !isBusy && ag.State != StateWorking {
				task.AssignedTo = &ag.ID
				task.Status = TaskRunning
				task.UpdatedAt = time.Now()

				ag.State = StateWorking
				ag.CurrentTaskID = &task.ID
				ag.ActiveAction = fmt.Sprintf("Working on: %s", task.Title)
				ag.UpdatedAt = time.Now()

				o.safeSave(task)
				o.safeSave(ag)
		}
		for _, ag := range o.agents {
			hasWrite := false
			hasGit := false
			for _, t := range ag.Tools {
				if t == "write_file" { hasWrite = true }
				if t == "git_ops" { hasGit = true }
			}
			if hasWrite && !hasGit {
				ag.Tools = append(ag.Tools, "git_ops")
				ag.UpdatedAt = time.Now()
				o.safeSave(ag)
			}

				o.recordEvent("agent.task.started", ag.Name, fmt.Sprintf("Started working on: '%s'", task.Title))
				o.broadcastAgentUpdate(ag)
				o.broadcastTaskUpdate(task)

				// Dispatch execution to Python runtime in background
				go o.dispatchTaskToRuntime(task, ag)
				return
			}
		}
	}

	// Fallback: If no strict role match found, match any idle developer or engineer
	for _, ag := range o.agents {
		isBusy := false
		if ag.CurrentTaskID != nil {
			if currentTask, ok := o.tasks[*ag.CurrentTaskID]; ok && currentTask.Status == TaskRunning {
				isBusy = true
			}
		}
		if !isBusy && ag.State != StateWorking && ag.Role != "Project Manager" && ag.Role != "Jira & Workflow Agent" {
			task.AssignedTo = &ag.ID
			task.Status = TaskRunning
			task.UpdatedAt = time.Now()

			ag.State = StateWorking
			ag.CurrentTaskID = &task.ID
			ag.ActiveAction = fmt.Sprintf("Working on: %s", task.Title)
			ag.UpdatedAt = time.Now()

			o.safeSave(task)
			o.safeSave(ag)
		}
		for _, ag := range o.agents {
			hasWrite := false
			hasGit := false
			for _, t := range ag.Tools {
				if t == "write_file" { hasWrite = true }
				if t == "git_ops" { hasGit = true }
			}
			if hasWrite && !hasGit {
				ag.Tools = append(ag.Tools, "git_ops")
				ag.UpdatedAt = time.Now()
				o.safeSave(ag)
			}

			o.recordEvent("agent.task.started", ag.Name, fmt.Sprintf("Assigned (cross-role): '%s'", task.Title))
			o.broadcastAgentUpdate(ag)
			o.broadcastTaskUpdate(task)

			go o.dispatchTaskToRuntime(task, ag)
			return
		}
	}

	// No agent currently available: keep task in QUEUED status
	if task.Status != TaskRunning {
		task.Status = TaskQueued
		task.UpdatedAt = time.Now()
		o.safeSave(task)
		o.broadcastTaskUpdate(task)
	}
}

func (o *Orchestrator) drainTaskQueue() {
	for _, t := range o.tasks {
		if t.Status == TaskQueued || t.Status == TaskPending {
			o.assignTask(t)
		}
	}
}


func (o *Orchestrator) dispatchTaskToRuntime(task *Task, agent *Agent) {
	pythonURL := os.Getenv("AGENT_RUNTIME_URL")
	if pythonURL == "" {
		pythonURL = "http://agent-runtime:8000"
	}

	o.mu.RLock()
	projectName := task.ProjectID
	projectDesc := ""
	var techStack []string
	repoURL := ""
	targetBranch := "main"
	if p, ok := o.projects[task.ProjectID]; ok {
		projectName = p.Name
		projectDesc = p.Description
		techStack = p.TechStack
		repoURL = p.RepositoryURL
		if p.TargetBranch != "" {
			targetBranch = p.TargetBranch
		}
	}
	o.mu.RUnlock()

	payload := map[string]interface{}{
		"task_id":             task.ID,
		"project_id":          task.ProjectID,
		"project_name":        projectName,
		"project_description": projectDesc,
		"tech_stack":          techStack,
		"repository_url":      repoURL,
		"target_branch":       targetBranch,
		"title":               task.Title,
		"description":         task.Description,
		"required_role":       task.RequiredRole,
		"agent_id":            agent.ID,
		"agent_name":          agent.Name,
		"model":               agent.Model,
		"system_prompt":       agent.SystemPrompt,
		"custom_prompt":       agent.CustomPrompt,
		"skills":              agent.Skills,
		"tools":               agent.Tools,
		"dependencies":        task.Dependencies,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		log.Printf("[Orchestrator] Error marshaling task payload: %v", err)
		return
	}

	client := &http.Client{Timeout: 120 * time.Second}
	resp, err := client.Post(pythonURL+"/api/execute", "application/json", bytes.NewBuffer(body))
	if err != nil {
		log.Printf("[Orchestrator] Failed to connect to Python runtime: %v", err)
		o.mu.Lock()
		task.Status = TaskFailed
		task.Logs = append(task.Logs, fmt.Sprintf("[%s] Error: Failed to reach Agent Runtime: %v", time.Now().Format("15:04:05"), err))
		o.safeSave(task)
		agent.State = StateFailed
		agent.ActiveAction = "Runtime unreachable"
		o.safeSave(agent)
		o.broadcastTaskUpdate(task)
		o.broadcastAgentUpdate(agent)
		o.mu.Unlock()
		return
	}
	defer resp.Body.Close()
}

// HandleTaskEvent receives real-time execution events from Python runtime
func (o *Orchestrator) HandleTaskEvent(event TaskEventPayload) {
	o.mu.Lock()
	defer o.mu.Unlock()

	task, ok := o.tasks[event.TaskID]
	if !ok {
		return
	}

	var agent *Agent
	if task.AssignedTo != nil {
		agent = o.agents[*task.AssignedTo]
	}

	switch event.Type {
	case "token":
		// Stream token to frontend via WebSocket
		streamMsg, _ := json.Marshal(map[string]interface{}{
			"action":  "TASK_STREAM",
			"taskId":  task.ID,
			"agentId": event.AgentID,
			"token":   event.Content,
		})
		o.hub.Broadcast(streamMsg)

	case "log":
		logEntry := fmt.Sprintf("[%s] %s", time.Now().Format("15:04:05"), event.Content)
		task.Logs = append(task.Logs, logEntry)
		if event.Progress > 0 {
			task.Progress = event.Progress
		}
		o.safeSave(task)
		o.broadcastTaskUpdate(task)

	case "completion":
		task.Progress = 100
		task.Status = TaskCompleted
		if event.Content != "" {
			task.Output = string(event.Content)
		}
		if event.Branch != "" {
			task.Branch = event.Branch
		}
		if event.PRURL != "" {
			task.PRURL = event.PRURL
			if p, ok := o.projects[task.ProjectID]; ok && (p.RepositoryURL == "" || strings.Contains(p.RepositoryURL, "agentforge/agentforge") || strings.Contains(p.RepositoryURL, "pranovk-CF04243/AgentForge")) {
				p.RepositoryURL = event.PRURL
				o.safeSave(p)
				msg, _ := json.Marshal(map[string]interface{}{
					"action":  "PROJECT_UPDATED",
					"project": p,
				})
				o.hub.Broadcast(msg)
			}
		}
		if event.TokensUsed > 0 {
			task.TokenUsage += event.TokensUsed
			if agent != nil {
				agent.TotalTokens += event.TokensUsed
			}
		}
		if event.CostUSD > 0 {
			task.CostUSD += event.CostUSD
			if agent != nil {
				agent.EstimatedCost += event.CostUSD
			}
		}

		o.safeSave(task)
		o.broadcastTaskUpdate(task)

		if agent != nil {
			agent.State = StateCompleted
			agent.ActiveAction = "Task completed"
			o.safeSave(agent)
			o.recordEvent("agent.task.completed", agent.Name, fmt.Sprintf("Completed task: '%s'", task.Title))
			o.broadcastAgentUpdate(agent)

			agentID := agent.ID
			go func() {
				time.Sleep(2 * time.Second)
				o.mu.Lock()
				if ag, exists := o.agents[agentID]; exists && ag.State == StateCompleted {
					ag.State = StateIdle
					ag.CurrentTaskID = nil
					ag.ActiveAction = "At desk"
					o.safeSave(ag)
		}
		for _, ag := range o.agents {
			hasWrite := false
			hasGit := false
			for _, t := range ag.Tools {
				if t == "write_file" { hasWrite = true }
				if t == "git_ops" { hasGit = true }
			}
			if hasWrite && !hasGit {
				ag.Tools = append(ag.Tools, "git_ops")
				ag.UpdatedAt = time.Now()
				o.safeSave(ag)
			}
					o.broadcastAgentUpdate(ag)
					o.drainTaskQueue()
				}
				o.mu.Unlock()
			}()
		}

		// Evaluate downstream DAG dependencies
		o.triggerNextTasks(task.ID)

	case "error":
		task.Status = TaskFailed
		task.ErrorDetails = string(event.Content)
		task.Logs = append(task.Logs, fmt.Sprintf("[%s] ERROR: %s", time.Now().Format("15:04:05"), event.Content))
		o.safeSave(task)
		o.broadcastTaskUpdate(task)

		if agent != nil {
			agent.CurrentTaskID = nil
			agent.State = StateIdle
			agent.ActiveAction = fmt.Sprintf("Standing by (previous task ended: %s)", event.Content)
			o.safeSave(agent)
			o.broadcastAgentUpdate(agent)
			o.drainTaskQueue()
		}
	}
}

func (o *Orchestrator) triggerNextTasks(completedTaskID string) {
	for _, t := range o.tasks {
		if t.Status == TaskWaiting || t.Status == TaskPending {
			allDone := true
			for _, depID := range t.Dependencies {
				if dep, ok := o.tasks[depID]; !ok || dep.Status != TaskCompleted {
					allDone = false
					break
				}
			}
			if allDone && len(t.Dependencies) > 0 {
				t.Status = TaskQueued
				o.safeSave(t)
				o.assignTask(t)
			}
		}
	}
	o.drainTaskQueue()
}

// RetryTask resets a failed or stuck task back to PENDING and triggers execution
func (o *Orchestrator) RetryTask(taskID string) error {
	o.mu.Lock()
	defer o.mu.Unlock()

	task, ok := o.tasks[taskID]
	if !ok {
		if o.db != nil {
			var dbTask Task
			if err := o.db.First(&dbTask, "id = ?", taskID).Error; err == nil {
				o.tasks[taskID] = &dbTask
				task = &dbTask
				ok = true
			}
		}
	}
	if !ok {
		return fmt.Errorf("task not found: %s", taskID)
	}

	task.Status = TaskPending
	task.Progress = 0
	task.AssignedTo = nil
	task.ErrorDetails = ""
	task.UpdatedAt = time.Now()
	task.Logs = append(task.Logs, fmt.Sprintf("[%s] Task reset for retry by human director.", time.Now().Format("15:04:05")))

	o.safeSave(task)
	o.broadcastTaskUpdate(task)
	o.drainTaskQueue()
	return nil
}

// CreateProject persists a new engineering initiative to PostgreSQL and cache
func (o *Orchestrator) CreateProject(p *Project) error {
	o.mu.Lock()
	defer o.mu.Unlock()

	if p.ID == "" {
		p.ID = fmt.Sprintf("proj-%d", time.Now().Unix())
	}
	now := time.Now()
	p.CreatedAt = now
	p.UpdatedAt = now
	p.Status = "ACTIVE"
	if p.Building == "" {
		p.Building = "Building A"
	}
	if p.TargetBranch == "" {
		p.TargetBranch = "main"
	}

	o.safeCreate(p)
	o.projects[p.ID] = p

	// Seed default environments (dev, uat, prod) for the project
	envs := []*ProjectEnvironment{
		{
			ID:               fmt.Sprintf("env-%s-dev", p.ID),
			ProjectID:        p.ID,
			Environment:      "dev",
			ClusterType:      "direct_kubeconfig",
			Namespace:        fmt.Sprintf("%s-dev", p.ID),
			RequiresApproval: false,
			CreatedAt:        now,
			UpdatedAt:        now,
		},
		{
			ID:               fmt.Sprintf("env-%s-uat", p.ID),
			ProjectID:        p.ID,
			Environment:      "uat",
			ClusterType:      "direct_kubeconfig",
			Namespace:        fmt.Sprintf("%s-uat", p.ID),
			RequiresApproval: false,
			CreatedAt:        now,
			UpdatedAt:        now,
		},
		{
			ID:               fmt.Sprintf("env-%s-prod", p.ID),
			ProjectID:        p.ID,
			Environment:      "prod",
			ClusterType:      "gitops_argocd",
			Namespace:        fmt.Sprintf("%s-prod", p.ID),
			RequiresApproval: true,
			CreatedAt:        now,
			UpdatedAt:        now,
		},
	}
	for _, env := range envs {
		o.safeCreate(env)
	}

	o.recordEvent("project.created", "Human Operator", fmt.Sprintf("Created new project: '%s' in %s", p.Name, p.Building))

	msg, _ := json.Marshal(map[string]interface{}{
		"action":  "PROJECT_CREATED",
		"project": p,
	})
	o.hub.Broadcast(msg)


	// Automatically provision dedicated GitHub repository if not provided
	if p.RepositoryURL == "" {
		go func(project *Project) {
			pythonURL := os.Getenv("AGENT_RUNTIME_URL")
			if pythonURL == "" {
				pythonURL = "http://agent-runtime:8000"
			}
			provBody, _ := json.Marshal(map[string]interface{}{
				"project_name": project.Name,
				"project_id":   project.ID,
				"description":  project.Description,
			})
			client := &http.Client{Timeout: 30 * time.Second}
			resp, err := client.Post(pythonURL+"/api/projects/provision-repo", "application/json", bytes.NewBuffer(provBody))
			if err == nil && resp.StatusCode == 200 {
				var res struct {
					Success bool   `json:"success"`
					HTMLURL string `json:"html_url"`
				}
				if json.NewDecoder(resp.Body).Decode(&res) == nil && res.Success && res.HTMLURL != "" {
					o.mu.Lock()
					project.RepositoryURL = res.HTMLURL
					o.safeSave(project)
					o.recordEvent("project.repo.provisioned", "AgentForge DevOps", fmt.Sprintf("Provisioned dedicated GitHub repository for '%s': %s", project.Name, res.HTMLURL))
					updateMsg, _ := json.Marshal(map[string]interface{}{
						"action":  "PROJECT_UPDATED",
						"project": project,
					})
					o.hub.Broadcast(updateMsg)
					o.mu.Unlock()
				}
				resp.Body.Close()
			}
		}(p)
	}

	return nil
}

// LaunchPlan batch inserts human-verified tasks into PostgreSQL and launches pipeline
func (o *Orchestrator) LaunchPlan(tasks []*Task) ([]*Task, error) {
	o.mu.Lock()
	defer o.mu.Unlock()

	now := time.Now()
	for _, t := range tasks {
		if t.ID == "" {
			t.ID = fmt.Sprintf("task-%d", time.Now().UnixNano())
		}
		t.CreatedAt = now
		t.UpdatedAt = now
		if len(t.Dependencies) == 0 {
			t.Status = TaskQueued
		} else {
			t.Status = TaskWaiting
		}
		o.safeSave(t)
		o.tasks[t.ID] = t
		o.broadcastTaskUpdate(t)
	}

	o.recordEvent("orchestration.plan_launched", "Human Operator", fmt.Sprintf("Approved and launched plan with %d tasks.", len(tasks)))

	// Trigger ready tasks
	for _, t := range tasks {
		if len(t.Dependencies) == 0 {
			o.assignTask(t)
		}
	}

	return tasks, nil
}


// InstructAgent sends a direct human instruction to an agent
func (o *Orchestrator) InstructAgent(agentID, instruction string) (string, error) {
	o.mu.Lock()
	agent, ok := o.agents[agentID]
	if !ok {
		o.mu.Unlock()
		return "", fmt.Errorf("agent '%s' not found", agentID)
	}

	agent.State = StateThinking
	agent.ActiveAction = fmt.Sprintf("Executing instruction: %s", instruction)
	o.safeSave(agent)
	o.broadcastAgentUpdate(agent)
	o.mu.Unlock()

	o.recordEvent("agent.instruction", "Human Operator", fmt.Sprintf("Instructed %s (%s): '%s'", agent.Name, agent.Role, instruction))

	pythonURL := os.Getenv("AGENT_RUNTIME_URL")
	if pythonURL == "" {
		pythonURL = "http://agent-runtime:8000"
	}

	payload := map[string]interface{}{
		"agent_id":      agent.ID,
		"agent_name":    agent.Name,
		"role":          agent.Role,
		"system_prompt": agent.SystemPrompt,
		"instruction":   instruction,
	}
	body, _ := json.Marshal(payload)

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Post(pythonURL+"/api/instruct", "application/json", bytes.NewBuffer(body))
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var res struct {
		Response   string `json:"response"`
		TokensUsed int64  `json:"tokens_used"`
		CostUSD    float64 `json:"cost_usd"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		return "", err
	}

	o.mu.Lock()
	agent.State = StateIdle
	agent.ActiveAction = "At desk"
	agent.TotalTokens += res.TokensUsed
	agent.EstimatedCost += res.CostUSD
	o.safeSave(agent)
	o.broadcastAgentUpdate(agent)
	o.mu.Unlock()

	return res.Response, nil
}

// TriggerIncident records an operational alert and activates SRE
func (o *Orchestrator) TriggerIncident(title, severity, desc string) *Incident {
	o.mu.Lock()
	defer o.mu.Unlock()

	incID := fmt.Sprintf("inc-%d", time.Now().Unix())
	sreAgentID := "agent-sre"
	inc := &Incident{
		ID:          incID,
		ProjectID:   "proj-1",
		Title:       title,
		Severity:    severity,
		Status:      "DETECTED",
		Description: desc,
		AssignedSRE: &sreAgentID,
		CreatedAt:   time.Now(),
	}
	o.safeCreate(inc)
	o.incidents[inc.ID] = inc

	if sre, ok := o.agents[sreAgentID]; ok {
		sre.State = StateThinking
		sre.ActiveAction = fmt.Sprintf("Diagnosing %s incident: %s", severity, title)
		sre.Position = Vector3{X: 6.5, Y: 0.0, Z: -2.5}
		o.safeSave(sre)
		o.broadcastAgentUpdate(sre)
	}

	o.recordEvent("incident.created", "Prometheus SRE Gateway", fmt.Sprintf("[%s] %s: %s", severity, title, desc))

	msg, _ := json.Marshal(map[string]interface{}{
		"action":   "INCIDENT_ALERT",
		"incident": inc,
	})
	o.hub.Broadcast(msg)
	return inc
}

// ResolveIncident clears an incident and returns SRE to desk
func (o *Orchestrator) ResolveIncident(id, rootCause, mitigation string) {
	o.mu.Lock()
	defer o.mu.Unlock()

	if inc, ok := o.incidents[id]; ok {
		now := time.Now()
		inc.Status = "RESOLVED"
		inc.RootCause = rootCause
		inc.Mitigation = mitigation
		inc.ResolvedAt = &now
		o.safeSave(inc)
		delete(o.incidents, id)

		if inc.AssignedSRE != nil {
			if sre, exists := o.agents[*inc.AssignedSRE]; exists {
				sre.State = StateIdle
				sre.Position = sre.DeskPosition
				sre.ActiveAction = "At desk"
				o.safeSave(sre)
				o.broadcastAgentUpdate(sre)
			}
		}

		o.recordEvent("incident.resolved", "SRE Commander", fmt.Sprintf("Incident '%s' resolved. Root cause: %s", inc.Title, rootCause))
	}

	resMsg, _ := json.Marshal(map[string]interface{}{
		"action":     "INCIDENT_RESOLVED",
		"incidentId": id,
	})
	o.hub.Broadcast(resMsg)
}


// RequestHumanApproval registers an approval gate
func (o *Orchestrator) RequestHumanApproval(taskID, agentID, actionType, desc, diff, prURL string) *HumanApproval {
	o.mu.Lock()
	defer o.mu.Unlock()

	appID := fmt.Sprintf("appr-%d", time.Now().Unix())
	appr := &HumanApproval{
		ID:          appID,
		TaskID:      taskID,
		AgentID:     agentID,
		ActionType:  actionType,
		Description: desc,
		DiffPreview: diff,
		PRURL:       prURL,
		Status:      "PENDING",
		CreatedAt:   time.Now(),
	}
	o.safeCreate(appr)
	o.approvals[appID] = appr

	if ag, ok := o.agents[agentID]; ok {
		ag.State = StateWaitingApproval
		ag.ActiveAction = fmt.Sprintf("Awaiting sign-off: %s", actionType)
		o.safeSave(ag)
		}
		for _, ag := range o.agents {
			hasWrite := false
			hasGit := false
			for _, t := range ag.Tools {
				if t == "write_file" { hasWrite = true }
				if t == "git_ops" { hasGit = true }
			}
			if hasWrite && !hasGit {
				ag.Tools = append(ag.Tools, "git_ops")
				ag.UpdatedAt = time.Now()
				o.safeSave(ag)
			}
		o.broadcastAgentUpdate(ag)
	}

	if t, ok := o.tasks[taskID]; ok {
		t.Status = TaskWaitingApproval
		o.safeSave(t)
		o.broadcastTaskUpdate(t)
	}

	o.recordEvent("approval.requested", "Security Gateway", fmt.Sprintf("Approval requested for %s by %s", actionType, agentID))

	data, _ := json.Marshal(map[string]interface{}{
		"action":   "APPROVAL_REQUESTED",
		"approval": appr,
	})
	o.hub.Broadcast(data)
	return appr
}

func (o *Orchestrator) HandleApprovalDecision(approvalID string, approved bool) {
	o.mu.Lock()
	defer o.mu.Unlock()

	appr, ok := o.approvals[approvalID]
	if !ok {
		return
	}

	if approved {
		appr.Status = "APPROVED"
		o.safeSave(appr)

		if t, ok := o.tasks[appr.TaskID]; ok {
			t.Status = TaskRunning
			t.Logs = append(t.Logs, fmt.Sprintf("[%s] Approval GRANTED by Human Administrator.", time.Now().Format("15:04:05")))
			o.safeSave(t)
			o.broadcastTaskUpdate(t)
		}
		if ag, ok := o.agents[appr.AgentID]; ok {
			ag.State = StateWorking
			ag.ActiveAction = "Executing approved deployment"
			o.safeSave(ag)
		}
		for _, ag := range o.agents {
			hasWrite := false
			hasGit := false
			for _, t := range ag.Tools {
				if t == "write_file" { hasWrite = true }
				if t == "git_ops" { hasGit = true }
			}
			if hasWrite && !hasGit {
				ag.Tools = append(ag.Tools, "git_ops")
				ag.UpdatedAt = time.Now()
				o.safeSave(ag)
			}
			o.broadcastAgentUpdate(ag)
		}
		o.recordEvent("approval.granted", "Human Operator", fmt.Sprintf("Approved action '%s' for agent %s", appr.ActionType, appr.AgentID))
	} else {
		appr.Status = "REJECTED"
		o.safeSave(appr)

		if t, ok := o.tasks[appr.TaskID]; ok {
			t.Status = TaskBlocked
			t.Logs = append(t.Logs, fmt.Sprintf("[%s] Approval REJECTED by Human Administrator.", time.Now().Format("15:04:05")))
			o.safeSave(t)
			o.broadcastTaskUpdate(t)
		}
		if ag, ok := o.agents[appr.AgentID]; ok {
			ag.State = StateBlocked
			ag.ActiveAction = "Action rejected by human"
			o.safeSave(ag)
		}
		for _, ag := range o.agents {
			hasWrite := false
			hasGit := false
			for _, t := range ag.Tools {
				if t == "write_file" { hasWrite = true }
				if t == "git_ops" { hasGit = true }
			}
			if hasWrite && !hasGit {
				ag.Tools = append(ag.Tools, "git_ops")
				ag.UpdatedAt = time.Now()
				o.safeSave(ag)
			}
			o.broadcastAgentUpdate(ag)
		}
		o.recordEvent("approval.rejected", "Human Operator", fmt.Sprintf("Rejected action '%s' for agent %s", appr.ActionType, appr.AgentID))
	}
}

func (o *Orchestrator) broadcastAgentUpdate(ag *Agent) {
	data, _ := json.Marshal(map[string]interface{}{
		"action": "AGENT_UPDATE",
		"agent":  ag,
	})
	o.hub.Broadcast(data)
}

func (o *Orchestrator) sanitizeTask(task *Task) *Task {
	if task == nil {
		return nil
	}
	if task.Dependencies == nil {
		task.Dependencies = []string{}
	}
	if task.Skills == nil {
		task.Skills = []string{}
	}
	if task.Tools == nil {
		task.Tools = []string{}
	}
	if task.Logs == nil {
		task.Logs = []string{}
	}
	if task.Artifacts == nil {
		task.Artifacts = []string{}
	}
	return task
}

func (o *Orchestrator) broadcastTaskUpdate(task *Task) {
	o.sanitizeTask(task)
	data, _ := json.Marshal(map[string]interface{}{
		"action": "TASK_UPDATE",
		"task":   task,
	})
	o.hub.Broadcast(data)
}

func (o *Orchestrator) safeSave(entity interface{}) {
	if o.db != nil {
		o.db.Save(entity)
	}
}

func (o *Orchestrator) safeCreate(entity interface{}) {
	if o.db != nil {
		o.db.Create(entity)
	}
}

// HandleAlertWebhook processes incoming monitoring/K8s alerts, creates an Incident, and dispatches the SRE agent
func (o *Orchestrator) HandleAlertWebhook(alert *AlertWebhookPayload) (*Incident, *Task, error) {
	o.mu.Lock()
	defer o.mu.Unlock()

	now := time.Now()
	incID := fmt.Sprintf("inc-%d", now.UnixNano())
	// Intelligent project resolution: match by ID, Name, Slug, or PodName
	targetProjectID := alert.ProjectID
	matched := false
	if targetProjectID != "" {
		if _, exists := o.projects[targetProjectID]; exists {
			matched = true
		} else {
			for pid, p := range o.projects {
				if strings.EqualFold(p.ID, targetProjectID) ||
					strings.EqualFold(p.Name, targetProjectID) ||
					strings.EqualFold(strings.ReplaceAll(p.Name, " ", "-"), targetProjectID) {
					targetProjectID = pid
					matched = true
					break
				}
			}
		}
	}
	if !matched && alert.PodName != "" {
		for pid, p := range o.projects {
			slug := strings.ToLower(strings.ReplaceAll(p.Name, " ", "-"))
			if slug != "" && strings.Contains(strings.ToLower(alert.PodName), slug) {
				targetProjectID = pid
				matched = true
				break
			}
		}
	}
	if targetProjectID == "" {
		targetProjectID = "proj-1"
	}
	alert.ProjectID = targetProjectID
	assignedSRE := "agent-sre"

	incident := &Incident{
		ID:          incID,
		ProjectID:   alert.ProjectID,
		Title:       fmt.Sprintf("[%s] %s on %s/%s", alert.Severity, alert.AlertName, alert.Namespace, alert.PodName),
		Severity:    alert.Severity,
		Status:      "INVESTIGATING",
		Description: alert.Message,
		AssignedSRE: &assignedSRE,
		CreatedAt:   now,
	}
	o.safeCreate(incident)
	o.incidents[incID] = incident

	// Create emergency remediation task for SRE Agent
	taskID := fmt.Sprintf("task-sre-%d", now.UnixNano())
	task := &Task{
		ID:           taskID,
		ProjectID:    alert.ProjectID,
		Title:        fmt.Sprintf("Triage & Remediate: %s", incident.Title),
		Description:  fmt.Sprintf("Diagnose failure for pod '%s' in namespace '%s'. Fetch logs using 'run_kubectl', inspect events, determine root cause, and apply remediation or rollback if needed. Alert details: %s", alert.PodName, alert.Namespace, alert.Message),
		Priority:     PriorityCritical,
		Status:       TaskQueued,
		RequiredRole: "Cloud SRE Engineer",
		AssignedTo:   &assignedSRE,
		Skills:       []string{"Site Reliability", "Incident Diagnostics", "Kubernetes Pod Debugging", "Rollback Operations"},
		Tools:        []string{"run_command", "run_kubectl", "read_file", "write_file", "git_ops"},
		Dependencies: []string{},
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	o.safeCreate(task)
	o.tasks[taskID] = task

	o.recordEvent("incident.triggered", "AlertManager / K8s", fmt.Sprintf("Created incident '%s' and assigned to Jaxson Reed (Cloud SRE Engineer)", incident.Title))
	o.broadcastTaskUpdate(task)

	// Broadcast incident event
	incMsg, _ := json.Marshal(map[string]interface{}{
		"action":   "INCIDENT_CREATED",
		"incident": incident,
	})
	o.hub.Broadcast(incMsg)

	// Dispatch task immediately to runtime
	o.assignTask(task)

	return incident, task, nil
}

// SaveEpics replaces/stores the Epics for a project in memory and DB
func (o *Orchestrator) SaveEpics(projectID string, epics []*Epic) error {
	o.mu.Lock()
	defer o.mu.Unlock()

	// Delete old epics for this project in DB
	if o.db != nil {
		o.db.Where("project_id = ?", projectID).Delete(&Epic{})
		for _, e := range epics {
			e.ProjectID = projectID
			if e.CreatedAt.IsZero() {
				e.CreatedAt = time.Now()
			}
			e.UpdatedAt = time.Now()
			o.db.Create(e)
		}
	}

	o.epics[projectID] = epics

	// Broadcast update
	broadcastData, _ := json.Marshal(map[string]interface{}{
		"action":    "EPICS_UPDATED",
		"projectId": projectID,
		"epics":     epics,
	})
	o.hub.Broadcast(broadcastData)

	return nil
}

// GetEpics returns the current epics for a project
func (o *Orchestrator) GetEpics(projectID string) []*Epic {
	o.mu.RLock()
	defer o.mu.RUnlock()
	if epics, ok := o.epics[projectID]; ok {
		return epics
	}
	return []*Epic{}
}

// SaveStudioMessage appends a roundtable chat message to memory and DB
func (o *Orchestrator) SaveStudioMessage(msg *StudioMessage) error {
	o.mu.Lock()
	defer o.mu.Unlock()

	if msg.CreatedAt.IsZero() {
		msg.CreatedAt = time.Now()
	}

	if o.db != nil {
		o.db.Create(msg)
	}

	o.studioMessages[msg.ProjectID] = append(o.studioMessages[msg.ProjectID], msg)

	// Broadcast message to connected frontend clients
	broadcastData, _ := json.Marshal(map[string]interface{}{
		"action":    "STUDIO_MESSAGE_NEW",
		"projectId": msg.ProjectID,
		"message":   msg,
	})
	o.hub.Broadcast(broadcastData)

	return nil
}

// GetStudioMessages returns all saved studio messages for a project
func (o *Orchestrator) GetStudioMessages(projectID string) []*StudioMessage {
	o.mu.RLock()
	defer o.mu.RUnlock()
	if msgs, ok := o.studioMessages[projectID]; ok {
		return msgs
	}
	return []*StudioMessage{}
}

// AssignTaskDirectly allows a human operator to directly assign an unassigned/queued task to a specific agent
func (o *Orchestrator) AssignTaskDirectly(taskID, agentID string) (*Task, error) {
	o.mu.Lock()
	defer o.mu.Unlock()

	task, ok := o.tasks[taskID]
	if !ok {
		return nil, fmt.Errorf("task not found: %s", taskID)
	}
	ag, ok := o.agents[agentID]
	if !ok {
		return nil, fmt.Errorf("agent not found: %s", agentID)
	}

	task.AssignedTo = &ag.ID
	task.Status = TaskRunning
	task.UpdatedAt = time.Now()

	ag.State = StateWorking
	ag.CurrentTaskID = &task.ID
	ag.CurrentProject = &task.ProjectID
	ag.ActiveAction = fmt.Sprintf("Assigned directly: %s", task.Title)
	ag.UpdatedAt = time.Now()

	o.safeSave(task)
	o.safeSave(ag)
	o.recordEvent("agent.task.manual_assigned", ag.Name, fmt.Sprintf("Manually assigned to task: '%s'", task.Title))
	o.broadcastAgentUpdate(ag)
	o.broadcastTaskUpdate(task)

	go o.dispatchTaskToRuntime(task, ag)
	return task, nil
}

// SaveStagedTasks persists or updates human-reviewable staged tasks for a project
func (o *Orchestrator) SaveStagedTasks(projectID string, tasks []*Task) error {
	o.mu.Lock()
	defer o.mu.Unlock()

	// Clean up existing staged tasks for this project to avoid duplicates on re-plan
	if o.db != nil {
		o.db.Where("project_id = ? AND status = ?", projectID, TaskStaged).Delete(&Task{})
	}
	for id, t := range o.tasks {
		if t.ProjectID == projectID && t.Status == TaskStaged {
			delete(o.tasks, id)
		}
	}

	now := time.Now()
	for i, t := range tasks {
		if t.ID == "" {
			t.ID = fmt.Sprintf("task-stage-%s-%d", projectID, i+1)
		}
		t.ProjectID = projectID
		t.Status = TaskStaged
		if t.CreatedAt.IsZero() {
			t.CreatedAt = now
		}
		t.UpdatedAt = now

		o.safeSave(t)
		o.tasks[t.ID] = t
		o.broadcastTaskUpdate(t)
	}

	return nil
}

// GetStagedTasks returns all staged tasks for a specific project
func (o *Orchestrator) GetStagedTasks(projectID string) []*Task {
	o.mu.RLock()
	defer o.mu.RUnlock()

	var result []*Task
	for _, t := range o.tasks {
		if t.ProjectID == projectID && t.Status == TaskStaged {
			result = append(result, t)
		}
	}
	return result
}

// TriggerDeploymentRemediationLoop handles automated triage and Senior Developer dispatch for post-deploy failures
func (o *Orchestrator) TriggerDeploymentRemediationLoop(projectID string, report *DeploymentHealthReport) (*Incident, *Task, error) {
	o.mu.Lock()
	defer o.mu.Unlock()

	now := time.Now()
	incID := fmt.Sprintf("inc-deploy-%d", now.UnixNano())
	targetProjectID := projectID
	if targetProjectID == "" {
		targetProjectID = "proj-1"
	}

	// Retry guard: count previous remediation attempts
	remediationAttempt := 1
	for _, t := range o.tasks {
		if t.ProjectID == targetProjectID && strings.HasPrefix(t.ID, "task-senior-dev-remediate-") {
			remediationAttempt++
		}
	}

	// Escalate to human director if exceeded retry limit
	if remediationAttempt > 2 {
		incident := &Incident{
			ID:          incID,
			ProjectID:   targetProjectID,
			Title:       fmt.Sprintf("[HUMAN_ACTION_REQUIRED] Deployment remediation failed after %d attempts for %s", remediationAttempt-1, targetProjectID),
			Severity:    "CRITICAL",
			Status:      "WAITING_APPROVAL",
			Description: fmt.Sprintf("Automatic deployment remediation loop exceeded max retries (2). Diagnostic logs:\n%s", strings.Join(report.ErrorExcerpts, "\n")),
			CreatedAt:   now,
		}
		o.safeCreate(incident)
		o.incidents[incID] = incident

		o.recordEvent("deployment.remediation.escalated", "Autonomous DevOps", fmt.Sprintf("Deployment remediation escalated to Human Engineering Director for project %s", targetProjectID))
		incMsg, _ := json.Marshal(map[string]interface{}{
			"action":   "INCIDENT_CREATED",
			"incident": incident,
		})
		o.hub.Broadcast(incMsg)
		return incident, nil, nil
	}

	incident := &Incident{
		ID:          incID,
		ProjectID:   targetProjectID,
		Title:       fmt.Sprintf("[DEPLOY-FAIL] Service health check failed on %s (Attempt %d)", report.Namespace, remediationAttempt),
		Severity:    "HIGH",
		Status:      "INVESTIGATING",
		Description: fmt.Sprintf("Post-deployment health verification failed with classification: %s. Health Probe: %v, Pod Check: %v, Log Scan: %v. Error excerpts:\n%s",
			report.ErrorClassification, report.HealthProbePassed, report.PodCheckPassed, report.LogScanPassed, strings.Join(report.ErrorExcerpts, "\n")),
		CreatedAt:   now,
	}
	o.safeCreate(incident)
	o.incidents[incID] = incident

	var assignedDev string = "agent-backend"
	for _, ag := range o.agents {
		if strings.Contains(strings.ToLower(ag.Role), "senior") && strings.Contains(strings.ToLower(ag.Role), "developer") {
			assignedDev = ag.ID
			break
		}
	}

	taskID := fmt.Sprintf("task-senior-dev-remediate-%d", now.UnixNano())
	errorContext := strings.Join(report.ErrorExcerpts, "\n")
	task := &Task{
		ID:           taskID,
		ProjectID:    targetProjectID,
		Title:        fmt.Sprintf("Remediate Deployment Failure: %s (Attempt %d)", report.Namespace, remediationAttempt),
		Description:  fmt.Sprintf("The live service in namespace '%s' failed post-deployment verification.\nClassification: %s\nPod Check: %v, Log Scan: %v, Health Probe: %v\n\nERROR LOG EXCERPTS:\n%s\n\nDIRECTIVE:\n1. Formulate a precise fix hypothesis for the application or configuration error.\n2. Patch the code/config using 'write_file' (zero stubs).\n3. Verify unit tests pass with 'run_test_suite'.\n4. Conclude so QA and Git release can trigger redeployment.",
			report.Namespace, report.ErrorClassification, report.PodCheckPassed, report.LogScanPassed, report.HealthProbePassed, errorContext),
		Priority:     PriorityCritical,
		Status:       TaskQueued,
		RequiredRole: "Senior Developer",
		AssignedTo:   &assignedDev,
		Skills:       []string{"Go", "Python", "Clean Architecture", "Deployment Remediation", "Root Cause Analysis"},
		Tools:        []string{"run_command", "read_file", "write_file", "run_test_suite", "git_ops"},
		Dependencies: []string{},
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	o.safeCreate(task)
	o.tasks[taskID] = task

	o.recordEvent("deployment.remediation.triggered", "Autonomous DevOps", fmt.Sprintf("Created remediation task '%s' assigned to Senior Developer", task.Title))
	o.broadcastTaskUpdate(task)

	incMsg, _ := json.Marshal(map[string]interface{}{
		"action":   "INCIDENT_CREATED",
		"incident": incident,
	})
	o.hub.Broadcast(incMsg)

	o.assignTask(task)

	return incident, task, nil
}

// ExtractAndSaveCredentials stores or updates credentials for a project in memory and DB
func (o *Orchestrator) ExtractAndSaveCredentials(projectID string, creds []*ProjectCredential) error {
	o.mu.Lock()
	defer o.mu.Unlock()

	if o.db != nil {
		for _, c := range creds {
			c.ProjectID = projectID
			if c.ID == "" {
				c.ID = fmt.Sprintf("cred-%s-%s", projectID, strings.ToLower(strings.ReplaceAll(c.Name, "_", "-")))
			}
			if c.CreatedAt.IsZero() {
				c.CreatedAt = time.Now()
			}
			c.UpdatedAt = time.Now()

			var existing ProjectCredential
			res := o.db.Where("project_id = ? AND name = ?", projectID, c.Name).First(&existing)
			if res.Error == nil {
				c.ID = existing.ID
				if existing.Status != "" && existing.Status != "pending" {
					c.Status = existing.Status
				}
				o.db.Model(&existing).Updates(c)
			} else {
				o.db.Create(c)
			}
		}
	}

	var updated []*ProjectCredential
	if o.db != nil {
		o.db.Where("project_id = ?", projectID).Find(&updated)
		o.credentials[projectID] = updated
	} else {
		o.credentials[projectID] = creds
		updated = creds
	}

	broadcastData, _ := json.Marshal(map[string]interface{}{
		"action":      "CREDENTIALS_UPDATED",
		"projectId":   projectID,
		"credentials": updated,
	})
	o.hub.Broadcast(broadcastData)

	return nil
}

// GetCredentials returns credentials for a project
func (o *Orchestrator) GetCredentials(projectID string) []*ProjectCredential {
	o.mu.RLock()
	defer o.mu.RUnlock()
	if creds, ok := o.credentials[projectID]; ok {
		return creds
	}
	return []*ProjectCredential{}
}

// UpdateCredentialStatus updates status (pending, stub, confirmed) of a single credential
func (o *Orchestrator) UpdateCredentialStatus(projectID, credID, status string) error {
	o.mu.Lock()
	defer o.mu.Unlock()

	if o.db != nil {
		o.db.Model(&ProjectCredential{}).Where("id = ? OR (project_id = ? AND name = ?)", credID, projectID, credID).Update("status", status)
	}

	if creds, ok := o.credentials[projectID]; ok {
		for _, c := range creds {
			if c.ID == credID || c.Name == credID {
				c.Status = status
				c.UpdatedAt = time.Now()
			}
		}
	}

	broadcastData, _ := json.Marshal(map[string]interface{}{
		"action":      "CREDENTIALS_UPDATED",
		"projectId":   projectID,
		"credentials": o.credentials[projectID],
	})
	o.hub.Broadcast(broadcastData)

	return nil
}

// ValidateCredentialsForDeploy checks credential readiness before deployment
func (o *Orchestrator) ValidateCredentialsForDeploy(projectID, environment string) (bool, []string, []string) {
	o.mu.RLock()
	defer o.mu.RUnlock()

	creds := o.credentials[projectID]
	var blockers []string
	var warnings []string

	isProd := strings.EqualFold(environment, "prod") || strings.EqualFold(environment, "production")

	for _, c := range creds {
		if c.Status == "pending" || c.Status == "" {
			if isProd {
				blockers = append(blockers, fmt.Sprintf("%s (%s): Unconfirmed required credential for production", c.Name, c.Integration))
			} else {
				warnings = append(warnings, fmt.Sprintf("%s (%s): Credential is still pending human acknowledgment", c.Name, c.Integration))
			}
		} else if c.Status == "stub" {
			if isProd {
				blockers = append(blockers, fmt.Sprintf("%s (%s): Uses placeholder stub value. Production deployments require verified live credentials.", c.Name, c.Integration))
			} else {
				warnings = append(warnings, fmt.Sprintf("%s (%s): Uses placeholder stub value. Live service may fail runtime authentication.", c.Name, c.Integration))
			}
		}
	}

	blocked := len(blockers) > 0
	return blocked, warnings, blockers
}

// GetModelCatalogue returns the available AI models and their pricing
func (o *Orchestrator) GetModelCatalogue() []ModelInfo {
	return []ModelInfo{
		{ID: "gemini-3.5-flash-lite", Provider: "google", DisplayName: "Gemini 3.5 Flash Lite (Default)", SpeedRating: 5, QualityRating: 4, InputPricePer1M: 0.075, OutputPricePer1M: 0.30},
		{ID: "gemini-3.6-flash", Provider: "google", DisplayName: "Gemini 3.6 Flash", SpeedRating: 4, QualityRating: 4, InputPricePer1M: 0.10, OutputPricePer1M: 0.40},
		{ID: "gemini-2.5-pro", Provider: "google", DisplayName: "Gemini 2.5 Pro", SpeedRating: 2, QualityRating: 5, InputPricePer1M: 1.25, OutputPricePer1M: 5.00},
		{ID: "claude-3-5-haiku", Provider: "anthropic", DisplayName: "Claude 3.5 Haiku", SpeedRating: 4, QualityRating: 3, InputPricePer1M: 0.80, OutputPricePer1M: 4.00},
		{ID: "claude-3-5-sonnet", Provider: "anthropic", DisplayName: "Claude 3.5 Sonnet", SpeedRating: 3, QualityRating: 5, InputPricePer1M: 3.00, OutputPricePer1M: 15.00},
		{ID: "claude-3-opus", Provider: "anthropic", DisplayName: "Claude 3 Opus", SpeedRating: 1, QualityRating: 5, InputPricePer1M: 15.00, OutputPricePer1M: 75.00},
	}
}

// ProjectCostDelta computes 30-day projected cost difference when switching models
func (o *Orchestrator) ProjectCostDelta(agentID, newModelID string) (*CostProjection, error) {
	o.mu.RLock()
	defer o.mu.RUnlock()

	agent, ok := o.agents[agentID]
	if !ok {
		return nil, fmt.Errorf("agent '%s' not found", agentID)
	}

	catalogue := o.GetModelCatalogue()
	var currentModelInfo, newModelInfo *ModelInfo
	for i := range catalogue {
		if catalogue[i].ID == agent.Model {
			currentModelInfo = &catalogue[i]
		}
		if catalogue[i].ID == newModelID {
			newModelInfo = &catalogue[i]
		}
	}
	if currentModelInfo == nil {
		currentModelInfo = &catalogue[1] // Default Gemini 2.5 flash
	}
	if newModelInfo == nil {
		return nil, fmt.Errorf("unknown target model '%s'", newModelID)
	}

	tokens := agent.TotalTokens
	if tokens < 100000 {
		tokens = 500000
	}

	currentPerToken := (currentModelInfo.InputPricePer1M*0.6 + currentModelInfo.OutputPricePer1M*0.4) / 1000000.0
	newPerToken := (newModelInfo.InputPricePer1M*0.6 + newModelInfo.OutputPricePer1M*0.4) / 1000000.0

	currentCost30 := float64(tokens) * currentPerToken
	newCost30 := float64(tokens) * newPerToken
	costDelta := newCost30 - currentCost30

	return &CostProjection{
		AgentID:       agentID,
		CurrentModel:  agent.Model,
		NewModel:      newModelID,
		TotalTokens:   tokens,
		CurrentCost30: currentCost30,
		NewCost30:     newCost30,
		CostDelta:     costDelta,
	}, nil
}

// UpdateAgentConfig updates an agent's name, model, custom prompt, and tools
func (o *Orchestrator) UpdateAgentConfig(agentID string, update AgentConfigUpdate) (*Agent, error) {
	o.mu.Lock()
	defer o.mu.Unlock()

	agent, ok := o.agents[agentID]
	if !ok {
		return nil, fmt.Errorf("agent '%s' not found", agentID)
	}

	if update.Name != nil && strings.TrimSpace(*update.Name) != "" {
		agent.Name = strings.TrimSpace(*update.Name)
	}
	if update.Model != nil && strings.TrimSpace(*update.Model) != "" {
		agent.Model = strings.TrimSpace(*update.Model)
	}
	if update.CustomPrompt != nil {
		agent.CustomPrompt = strings.TrimSpace(*update.CustomPrompt)
	}
	if len(update.Tools) > 0 {
		agent.Tools = update.Tools
	}
	agent.UpdatedAt = time.Now()

	o.safeSave(agent)
	o.broadcastAgentUpdate(agent)

	o.recordEvent("agent.config.updated", agent.Name, fmt.Sprintf("Updated config: model=%s, customPromptLength=%d", agent.Model, len(agent.CustomPrompt)))

	return agent, nil
}


func (o *Orchestrator) DispatchDebateToRuntime(session DebateSession) {
	pythonURL := os.Getenv("AGENT_RUNTIME_URL")
	if pythonURL == "" {
		pythonURL = "http://agent-runtime:8000"
	}

	payload := map[string]interface{}{
		"session_id": session.ID,
		"project_id": session.ProjectID,
		"topic":      session.Topic,
		"proposer":   session.ProposerAgentID,
		"reviewer":   session.ReviewerAgentID,
	}

	jsonData, _ := json.Marshal(payload)
	req, err := http.NewRequest("POST", pythonURL+"/api/agent/debate", bytes.NewBuffer(jsonData))
	if err != nil {
		log.Printf("[Debate] Error creating request: %v", err)
		return
	}
	req.Header.Set("Content-Type", "application/json")
	secret := os.Getenv("INTERNAL_WEBHOOK_SECRET")
	if secret == "" { secret = "agentforge-internal-dev-secret" }
	req.Header.Set("X-Internal-Secret", secret)

	client := &http.Client{Timeout: 5 * time.Minute}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("[Debate] Error calling python runtime: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		log.Printf("[Debate] Python runtime returned %d", resp.StatusCode)
	}
}
