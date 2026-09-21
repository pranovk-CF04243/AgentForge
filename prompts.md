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

**Prompt:** Analyse the codebase and create a claude.md file.

**Result:** Added [CLAUDE.md](CLAUDE.md) documenting build/test/run commands for all three services and the cross-service architecture (Task DAG scheduler, agent execution runtime, auth layer, WebSocket transport, frontend state).

## 2026-09-21

**Prompt:** Whenever we are prompting, add a prompts.md file and do small unit testing with proper test cases. Update README.md when a new feature is added. Whenever a bug arises, keep a separate doc for that. Add these as rules in CLAUDE.md.

**Result:** Added this prompts.md file, added [BUGS.md](BUGS.md) for bug tracking, and updated [CLAUDE.md](CLAUDE.md) with a "Working conventions" section codifying all four rules (prompt logging, unit tests per change, README updates on new features, bug doc per bug).
