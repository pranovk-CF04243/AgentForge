"""
Token budget enforcement for a single agent task execution.

Pure, LLM-free bookkeeping: the Go backend computes and hands down the total
token allotment for a task at dispatch time (base per-role budget + any
banked surplus the agent carried over from a previous task that finished
under budget). This module tracks running usage against that allotment
during the ReAct loop in graph.py, and — if the allotment runs out mid-task —
asks the Go backend for a capped top-up from the shared "crisis pool" before
giving up and raising BudgetExceededError.

The crisis pool itself is shared, mutable state owned by the Go orchestrator
(single-writer, guarded by its mutex); this module never mutates it directly,
only requests draws from it over HTTP via /api/internal/request-budget-topup.
"""

import os
import logging
from dataclasses import dataclass

import httpx

logger = logging.getLogger("AgentForge.Budget")

BACKEND_INTERNAL_URL = os.getenv("BACKEND_URL", "http://backend:8080")

# Default amount requested per crisis-pool top-up attempt. The backend may
# grant less than this (or 0), per its own configured per-draw caps.
DEFAULT_TOPUP_REQUEST = 5000


class BudgetExceededError(Exception):
    """Raised when an agent's task-level token budget (including any
    granted crisis-pool top-up) has been exhausted and no further top-up is
    available."""

    def __init__(self, agent_name: str, used: int, budget: int):
        self.agent_name = agent_name
        self.used = used
        self.budget = budget
        super().__init__(
            f"Token budget exceeded for agent {agent_name} (used {used}/{budget} tokens)"
        )


@dataclass
class TaskBudgetState:
    """Tracks one task execution's token budget against its running usage."""

    agent_id: str
    agent_name: str
    task_id: str
    budget_for_this_task: int
    tokens_used_so_far: int = 0
    crisis_pool_drawn_this_task: int = 0

    def total_available(self) -> int:
        return self.budget_for_this_task + self.crisis_pool_drawn_this_task

    def is_over_budget(self) -> bool:
        return self.tokens_used_so_far >= self.total_available()


def try_draw_from_crisis_pool_sync(state: TaskBudgetState, requested: int = DEFAULT_TOPUP_REQUEST) -> int:
    """Ask the Go backend for a capped top-up from the shared crisis pool.

    Returns the number of tokens actually granted (0 on any failure — a
    denied/failed draw should never itself crash the task; the caller
    decides whether to raise BudgetExceededError based on whether the
    top-up was enough).
    """
    granted = 0
    try:
        with httpx.Client(timeout=5.0) as client:
            resp = client.post(
                f"{BACKEND_INTERNAL_URL}/api/internal/request-budget-topup",
                json={
                    "task_id": state.task_id,
                    "agent_id": state.agent_id,
                    "requested_tokens": requested,
                },
            )
            resp.raise_for_status()
            granted = int(resp.json().get("granted_tokens", 0) or 0)
    except Exception as e:
        logger.warning(f"Crisis pool top-up request failed for task {state.task_id}: {e}")
        granted = 0

    if granted > 0:
        state.crisis_pool_drawn_this_task += granted
        logger.info(f"Drew {granted} tokens from shared crisis pool for task {state.task_id}")

    return granted


def enforce_budget_or_raise(state: TaskBudgetState, top_up_ask: int = DEFAULT_TOPUP_REQUEST) -> int:
    """Call before allowing the ReAct loop to continue for another round.

    If usage is within budget, does nothing. If over budget, attempts one
    crisis-pool top-up (only if none has been drawn yet this task) and
    re-checks; raises BudgetExceededError if still over budget afterward.

    Returns the amount of tokens granted from the crisis pool during this
    call (0 if none was needed or none was granted), so callers can surface
    a log event when a draw actually happened.
    """
    if not state.is_over_budget():
        return 0

    granted = 0
    if state.crisis_pool_drawn_this_task == 0:
        granted = try_draw_from_crisis_pool_sync(state, top_up_ask)

    if state.is_over_budget():
        raise BudgetExceededError(state.agent_name, state.tokens_used_so_far, state.total_available())

    return granted
