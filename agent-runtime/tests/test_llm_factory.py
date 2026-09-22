"""
Unit tests for agent-runtime/llm_factory.py — the provider-agnostic LLM
factory that resolves a (provider, model) pair to the right LangChain chat
model instance.

No network calls: each provider's chat-model class is mocked at its source
module (llm_factory.py imports it inline per-branch rather than at module
top, so patches target e.g. "langchain_google_genai.ChatGoogleGenerativeAI",
not "llm_factory.ChatGoogleGenerativeAI").
"""

import os
import sys
import types
import unittest
from unittest.mock import patch, MagicMock

# The provider SDK packages (langchain_google_genai, langchain_ollama,
# langchain_nvidia_ai_endpoints) may not be installed in every environment
# these tests run in (e.g. a bare-metal dev machine without the full
# agent-runtime requirements installed). Install lightweight fake modules
# for any that are missing so `patch(...)` has something to target and
# llm_factory's inline imports succeed either way.
for _mod_name, _cls_name in [
    ("langchain_google_genai", "ChatGoogleGenerativeAI"),
    ("langchain_ollama", "ChatOllama"),
    ("langchain_nvidia_ai_endpoints", "ChatNVIDIA"),
]:
    if _mod_name not in sys.modules:
        fake_module = types.ModuleType(_mod_name)
        setattr(fake_module, _cls_name, MagicMock(name=_cls_name))
        sys.modules[_mod_name] = fake_module

from llm_factory import build_chat_model  # noqa: E402


class TestBuildChatModel(unittest.TestCase):
    @patch("langchain_google_genai.ChatGoogleGenerativeAI")
    def test_defaults_to_gemini_when_provider_omitted(self, mock_cls):
        build_chat_model(provider=None, model=None)
        mock_cls.assert_called_once()
        _, kwargs = mock_cls.call_args
        self.assertIn("model", kwargs)

    @patch.dict(os.environ, {"OLLAMA_BASE_URL": "http://myhost:11434"})
    @patch("langchain_ollama.ChatOllama")
    def test_ollama_reads_base_url_env(self, mock_cls):
        build_chat_model(provider="ollama", model="llama3.1")
        _, kwargs = mock_cls.call_args
        self.assertEqual(kwargs["base_url"], "http://myhost:11434")
        self.assertEqual(kwargs["model"], "llama3.1")

    @patch("langchain_ollama.ChatOllama")
    def test_ollama_defaults_base_url_when_env_unset(self, mock_cls):
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("OLLAMA_BASE_URL", None)
            build_chat_model(provider="ollama", model="llama3.1")
        _, kwargs = mock_cls.call_args
        self.assertEqual(kwargs["base_url"], "http://localhost:11434")

    @patch.dict(os.environ, {"NVIDIA_API_KEY": "test-key"})
    @patch("langchain_nvidia_ai_endpoints.ChatNVIDIA")
    def test_nvidia_reads_api_key_env_and_base_url(self, mock_cls):
        build_chat_model(provider="nvidia", model="meta/llama-3.1-70b-instruct")
        _, kwargs = mock_cls.call_args
        self.assertEqual(kwargs["api_key"], "test-key")
        self.assertEqual(kwargs["base_url"], "https://integrate.api.nvidia.com/v1")
        self.assertEqual(kwargs["model"], "meta/llama-3.1-70b-instruct")

    @patch("langchain_google_genai.ChatGoogleGenerativeAI")
    def test_unknown_provider_falls_back_to_gemini(self, mock_cls):
        build_chat_model(provider="not-a-real-provider", model="x")
        mock_cls.assert_called_once()

    @patch("langchain_google_genai.ChatGoogleGenerativeAI")
    def test_provider_is_case_insensitive(self, mock_cls):
        build_chat_model(provider="GEMINI", model="gemini-2.5-flash")
        mock_cls.assert_called_once()


if __name__ == "__main__":
    unittest.main()
