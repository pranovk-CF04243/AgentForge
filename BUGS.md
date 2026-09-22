# Bug Log

A running log of bugs found in this repository, how they were diagnosed, and how they were fixed. Newest entries at the top. This complements the known rough edges tracked informally in the `requirements` file — once one of those is actually investigated, give it a real entry here.

Format per entry:
```
## YYYY-MM-DD — <short title>

**Symptom:** what was observed (and by whom/how, if relevant)
**Root cause:** what was actually wrong
**Fix:** what changed — files touched, commit/PR if applicable
**Affected areas:** service(s)/component(s) impacted
**Verification:** how the fix was confirmed (test added, manual repro steps re-run, etc.)
```

---

## 2026-09-21 — Backend panics on 5s metrics tick when running without a database

**Symptom:** Running the Go backend without a reachable Postgres (`DATABASE_URL` unset/unreachable) causes it to crash with a `SIGSEGV: invalid memory address or nil pointer dereference` a few seconds after startup, inside `main.(*Orchestrator).updateRealMetrics`. Found while manually verifying the new configurable-AI-model feature against a locally-run backend with no DB attached.

**Root cause:** `updateRealMetrics` (`backend/orchestrator.go`, called every 5s from `StartEventLoop`) called `o.db.Model(&Task{})...` directly with no nil-check on `o.db`. Nearly every other DB-touching function in the file (`safeSave`, `safeCreate`, `loadOrSeedCrisisPool`, `initializeData`, etc.) guards with `if o.db != nil`, matching the documented "degrades gracefully without a DB" design — this one function was missed.

**Fix:** Wrapped the two `o.db.Model(...)` calls in `updateRealMetrics` with `if o.db != nil { ... }`, matching the existing pattern used elsewhere in the same file. `runningTasks`/`blockedTasks` simply stay `0` when there's no DB, same as other metrics already do in that no-DB path.

**Affected areas:** `backend/orchestrator.go` (`updateRealMetrics`) — backend-only, no cross-service impact.

**Verification:** Ran `go run .` from `backend/` with no Postgres reachable; confirmed the server previously crashed within ~5s (first tick of `StartEventLoop`'s ticker) and now stays up and continues serving requests indefinitely. Full existing test suite (`go test ./...`) still passes — no test exercised this path since `NewOrchestrator(hub, nil)` in tests never calls `StartEventLoop`.

---

_No other bugs logged yet. Add an entry above this line the next time one is found and fixed._
