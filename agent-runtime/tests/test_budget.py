"""
Unit tests for agent-runtime/budget.py — the token-budget bookkeeping and
crisis-pool top-up logic used to enforce per-task token caps.

No LLM/graph mocking needed: budget.py is pure arithmetic plus one outbound
HTTP call to the Go backend, which is mocked here.
"""

import unittest
from unittest.mock import patch, MagicMock

from budget import (
    BudgetExceededError,
    TaskBudgetState,
    try_draw_from_crisis_pool_sync,
    enforce_budget_or_raise,
)


def make_state(budget=1000, used=0, drawn=0):
    return TaskBudgetState(
        agent_id="agent-backend",
        agent_name="Kaelen Voss",
        task_id="task-1",
        budget_for_this_task=budget,
        tokens_used_so_far=used,
        crisis_pool_drawn_this_task=drawn,
    )


class TestTaskBudgetState(unittest.TestCase):
    def test_is_over_budget_false_when_under(self):
        state = make_state(budget=1000, used=500)
        self.assertFalse(state.is_over_budget())

    def test_is_over_budget_true_when_at_or_over(self):
        self.assertTrue(make_state(budget=1000, used=1000).is_over_budget())
        self.assertTrue(make_state(budget=1000, used=1500).is_over_budget())

    def test_total_available_includes_crisis_draw(self):
        state = make_state(budget=1000, drawn=250)
        self.assertEqual(state.total_available(), 1250)


class TestTryDrawFromCrisisPool(unittest.TestCase):
    @patch("budget.httpx.Client")
    def test_updates_state_on_success(self, mock_client_cls):
        mock_client = MagicMock()
        mock_client_cls.return_value.__enter__.return_value = mock_client
        mock_resp = MagicMock()
        mock_resp.raise_for_status.return_value = None
        mock_resp.json.return_value = {"granted_tokens": 150, "pool_remaining": 850}
        mock_client.post.return_value = mock_resp

        state = make_state()
        granted = try_draw_from_crisis_pool_sync(state, requested=500)

        self.assertEqual(granted, 150)
        self.assertEqual(state.crisis_pool_drawn_this_task, 150)

    @patch("budget.httpx.Client")
    def test_returns_zero_on_http_error(self, mock_client_cls):
        mock_client = MagicMock()
        mock_client_cls.return_value.__enter__.return_value = mock_client
        mock_client.post.side_effect = Exception("connection refused")

        state = make_state()
        granted = try_draw_from_crisis_pool_sync(state, requested=500)

        self.assertEqual(granted, 0)
        self.assertEqual(state.crisis_pool_drawn_this_task, 0)


class TestEnforceBudgetOrRaise(unittest.TestCase):
    def test_no_op_when_under_budget(self):
        state = make_state(budget=1000, used=500)
        granted = enforce_budget_or_raise(state)
        self.assertEqual(granted, 0)
        self.assertEqual(state.crisis_pool_drawn_this_task, 0)

    @patch("budget.try_draw_from_crisis_pool_sync", return_value=0)
    def test_raises_when_over_budget_and_no_draw_available(self, mock_draw):
        state = make_state(budget=800, used=900)
        with self.assertRaises(BudgetExceededError) as ctx:
            enforce_budget_or_raise(state)
        self.assertIn("used 900/800 tokens", str(ctx.exception))

    def test_succeeds_after_granted_draw_brings_it_back_under(self):
        state = make_state(budget=800, used=900)

        def fake_draw(s, requested=0):
            s.crisis_pool_drawn_this_task += 200
            return 200

        with patch("budget.try_draw_from_crisis_pool_sync", side_effect=fake_draw):
            granted = enforce_budget_or_raise(state)

        self.assertEqual(granted, 200)
        self.assertEqual(state.crisis_pool_drawn_this_task, 200)
        self.assertFalse(state.is_over_budget())

    @patch("budget.try_draw_from_crisis_pool_sync")
    def test_does_not_draw_twice_in_same_task(self, mock_draw):
        # Simulate a task that already drew once earlier; a second
        # over-budget check should raise immediately without trying again.
        state = make_state(budget=800, used=1200, drawn=100)
        with self.assertRaises(BudgetExceededError):
            enforce_budget_or_raise(state)
        mock_draw.assert_not_called()

    def test_budget_exceeded_error_message_format(self):
        err = BudgetExceededError("Kaelen Voss", 900, 800)
        self.assertEqual(str(err), "Token budget exceeded for agent Kaelen Voss (used 900/800 tokens)")


if __name__ == "__main__":
    unittest.main()
