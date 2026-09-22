"""
Provider-agnostic LLM factory.

Given a (provider, model) pair, returns the right LangChain chat-model
instance, reading the correct provider-specific env var(s). This is the
single place a new provider gets added — graph.py and server.py should
never import a provider SDK class directly, they should call
build_chat_model() instead.

Supported providers:
  - "gemini"  (default/fallback) — Google Gemini via GEMINI_API_KEY/GEMINI_MODEL
  - "ollama"  — self-hosted/external Ollama server via OLLAMA_BASE_URL, no API key
  - "nvidia"  — NVIDIA NIM hosted cloud API via NVIDIA_API_KEY
"""

import os
import logging
from typing import Optional

logger = logging.getLogger("AgentForge.LLMFactory")

DEFAULT_PROVIDER = "gemini"


def build_chat_model(
    provider: Optional[str] = None,
    model: Optional[str] = None,
    *,
    temperature: float = 0.2,
    streaming: bool = False,
    max_retries: int = 6,
):
    """
    Returns a LangChain BaseChatModel for the given provider/model.

    provider defaults to "gemini" (and model to the GEMINI_MODEL env var) if
    either is omitted — this preserves fully backward-compatible behavior
    for any caller that doesn't pass provider/model at all.

    Each provider's SDK is imported inside its own branch (not at module
    top), so a missing optional dependency for one provider never breaks
    the others — Gemini keeps working even if the Ollama/NVIDIA packages
    aren't installed in a given deployment.
    """
    provider = (provider or DEFAULT_PROVIDER).lower()

    if provider == "gemini":
        from langchain_google_genai import ChatGoogleGenerativeAI

        api_key = os.getenv("GEMINI_API_KEY", "")
        resolved_model = model or os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")
        logger.info(f"Building Gemini chat model: {resolved_model}")
        return ChatGoogleGenerativeAI(
            model=resolved_model,
            google_api_key=api_key if api_key else None,
            temperature=temperature,
            streaming=streaming,
            max_retries=max_retries,
        )

    if provider == "ollama":
        from langchain_ollama import ChatOllama

        base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
        resolved_model = model or "llama3.1"
        logger.info(f"Building Ollama chat model: {resolved_model} @ {base_url}")
        return ChatOllama(
            model=resolved_model,
            base_url=base_url,
            temperature=temperature,
        )

    if provider == "nvidia":
        from langchain_nvidia_ai_endpoints import ChatNVIDIA

        api_key = os.getenv("NVIDIA_API_KEY", "")
        resolved_model = model or "meta/llama-3.1-70b-instruct"
        logger.info(f"Building NVIDIA NIM chat model: {resolved_model}")
        return ChatNVIDIA(
            model=resolved_model,
            api_key=api_key if api_key else None,
            base_url="https://integrate.api.nvidia.com/v1",
            temperature=temperature,
        )

    logger.warning(f"Unknown provider '{provider}', falling back to Gemini defaults.")
    return build_chat_model(
        provider="gemini",
        model=None,
        temperature=temperature,
        streaming=streaming,
        max_retries=max_retries,
    )
