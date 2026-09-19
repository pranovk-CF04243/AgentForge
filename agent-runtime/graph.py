"""
AgentForge Dynamic LangGraph ReAct Workflow Engine
Orchestrates autonomous agents with Google Gemini, real-time token streaming,
and isolated per-project sandboxed tool execution.
"""

import os
import json
import logging
from typing import TypedDict, Annotated, Sequence, List, Dict, Any, Optional
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, SystemMessage
from langchain_core.tools import tool
from langgraph.graph import StateGraph, END, START
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode
from langchain_google_genai import ChatGoogleGenerativeAI

from agent import RealToolRegistry, default_tool_registry

logger = logging.getLogger("AgentForge.Graph")


def create_scoped_tools(registry: RealToolRegistry) -> Dict[str, Any]:
    """Dynamically creates LangChain-wrapped tools bound to a specific project's tool registry."""

    @tool
    def run_command(command: str) -> str:
        """Executes a sandboxed terminal shell command in the project workspace."""
        res = registry.run_command(command)
        return json.dumps(res, indent=2)

    @tool
    def write_file(filepath: str, content: str) -> str:
        """Writes source code or documentation to a file in the project workspace."""
        res = registry.write_file(filepath, content)
        return json.dumps(res, indent=2)

    @tool
    def read_file(filepath: str) -> str:
        """Reads the contents of an existing file in the project workspace."""
        res = registry.read_file(filepath)
        if not res.get("success"):
            return f"Error: {res.get('error')}"
        return res.get("content", "")

    @tool
    def list_directory(dirpath: str = ".") -> str:
        """Lists files and directories within the project workspace."""
        res = registry.list_dir(dirpath)
        return json.dumps(res, indent=2)

    @tool
    def git_action(action: str, branch: str = "agent-feature", message: str = "Update code") -> str:
        """Performs git actions: checkout_branch, commit, push in the project workspace."""
        res = registry.git_ops(action=action, branch=branch, message=message)
        return json.dumps(res, indent=2)

    @tool
    def run_test_suite(suite_command: str = "") -> str:
        """Executes the test suite in the project workspace to verify code correctness."""
        res = registry.run_test_suite(suite_command if suite_command else None)
        return json.dumps(res, indent=2)

    @tool
    def create_github_pr(title: str, body: str, branch: str, base_branch: str = "main") -> str:
        """Opens a Pull Request on this project's dedicated GitHub repository."""
        res = registry.create_github_pr(title=title, body=body, branch=branch, base_branch=base_branch)
        return json.dumps(res, indent=2)

    @tool
    def run_kubectl(command: str, environment: str = "dev") -> str:
        """Executes a kubectl command with enterprise guardrails (e.g. apply --dry-run=client, get, describe, logs, rollout)."""
        res = registry.run_kubectl(command, environment=environment)
        return json.dumps(res, indent=2)

    return {
        "run_command": run_command,
        "write_file": write_file,
        "read_file": read_file,
        "list_directory": list_directory,
        "git_ops": git_action,
        "run_test_suite": run_test_suite,
        "create_github_pr": create_github_pr,
        "run_kubectl": run_kubectl,
    }



class AgentWorkflowState(TypedDict):
    task_id: str
    title: str
    description: str
    messages: Annotated[Sequence[BaseMessage], add_messages]
    artifacts: List[str]
    tokens_used: int
    cost_usd: float
    status: str


def build_llm(model: Optional[str], tools: List[Any]):
    """
    Builds a tool-bound LLM instance with multi-provider routing:
    1. claude-* models routed via Google Vertex AI (primary) or direct Anthropic API (fallback).
    2. gemini-* models routed via ChatGoogleGenerativeAI.
    """
    raw_model = model or os.getenv("GEMINI_MODEL", "gemini-3.6-flash")

    # Compatibility map: resolve models to verified high-performance Gemini endpoints
    MODEL_ALIASES = {
        "gemini-2.0-flash": "gemini-3.6-flash",
        "gemini-2.0-flash-exp": "gemini-3.6-flash",
        "gemini-2.5-flash": "gemini-3.6-flash",
        "gemini-2.5-flash-lite": "gemini-3.5-flash-lite",
        "gemini-3.0-flash": "gemini-3.6-flash",
        "gemini-3.5-flash": "gemini-3.5-flash",
        "gemini-3.5-flash-lite": "gemini-3.5-flash-lite",
        "gemini-3.6-flash": "gemini-3.6-flash",
        "gemini-flash": "gemini-3.6-flash",
        "gemini-flash-lite": "gemini-3.5-flash-lite",
        "gemini-flash-latest": "gemini-3.6-flash",
        "gemini-flash-lite-latest": "gemini-3.5-flash-lite",
    }
    target_model = MODEL_ALIASES.get(raw_model, raw_model)

    if target_model.startswith("claude"):
        # 1. Try Vertex AI first (uses Google Cloud credentials)
        vertex_project = os.getenv("VERTEX_AI_PROJECT")
        if vertex_project:
            try:
                from langchain_google_vertexai import ChatVertexAI
                location = os.getenv("VERTEX_AI_LOCATION", "us-east5")
                logger.info(f"Initializing Claude via Google Vertex AI (project={vertex_project}, location={location}, model={target_model})")
                llm_instance = ChatVertexAI(
                    model_name=target_model,
                    project=vertex_project,
                    location=location,
                    temperature=0.2,
                    streaming=True,
                )
                return llm_instance.bind_tools(tools)
            except Exception as e:
                logger.warning(f"Vertex AI initialization failed for {target_model}: {e}. Checking direct Anthropic key...")

        # 2. Try direct Anthropic API
        anthropic_key = os.getenv("ANTHROPIC_API_KEY")
        if anthropic_key:
            try:
                from langchain_anthropic import ChatAnthropic
                logger.info(f"Initializing Claude via direct Anthropic API (model={target_model})")
                llm_instance = ChatAnthropic(
                    model=target_model,
                    anthropic_api_key=anthropic_key,
                    temperature=0.2,
                    streaming=True,
                    max_retries=3,
                )
                return llm_instance.bind_tools(tools)
            except Exception as e:
                logger.error(f"ChatAnthropic initialization failed: {e}")
                raise ValueError(f"Failed to initialize Claude with Anthropic API: {e}")

        raise ValueError(
            f"Claude model '{target_model}' requested, but neither VERTEX_AI_PROJECT nor ANTHROPIC_API_KEY is configured."
        )

    # Default to Gemini
    gemini_api_key = os.getenv("GEMINI_API_KEY", "")
    logger.info(f"Initializing Gemini with primary model '{target_model}'")
    primary_bound = ChatGoogleGenerativeAI(
        model=target_model,
        google_api_key=gemini_api_key if gemini_api_key else None,
        temperature=0.2,
        streaming=True,
        max_retries=2,
    ).bind_tools(tools)

    # Configure multi-model fallback across distinct quota pools
    AVAILABLE_FALLBACKS = ["gemini-3.6-flash", "gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite"]
    fallback_candidates = [m for m in AVAILABLE_FALLBACKS if m != target_model]
    fallback_bounds = []
    for fb_model in fallback_candidates:
        try:
            fb = ChatGoogleGenerativeAI(
                model=fb_model,
                google_api_key=gemini_api_key if gemini_api_key else None,
                temperature=0.2,
                streaming=True,
                max_retries=2,
            ).bind_tools(tools)
            fallback_bounds.append(fb)
        except Exception as e:
            logger.warning(f"Could not bind fallback LLM ({fb_model}): {e}")

    if fallback_bounds:
        return primary_bound.with_fallbacks(fallback_bounds)
    return primary_bound


def compile_agent_graph(
    agent_id: str,
    name: str,
    role: str,
    system_prompt: str,
    skills: List[str],
    allowed_tools: List[str],
    registry: Optional[RealToolRegistry] = None,
    project_id: str = "default",
    project_name: str = "",
    repository_url: str = "",
    tech_stack: Optional[List[str]] = None,
    custom_prompt: str = "",
    model: Optional[str] = None,
):
    """
    Compiles an isolated LangGraph ReAct agent strictly scoped to a project's workspace.
    """
    reg = registry or default_tool_registry
    tool_map = create_scoped_tools(reg)

    # Filter tools for this agent role
    effective_tools = list(allowed_tools)
    if any(k in role.lower() for k in ["devops", "sre", "platform"]) and "run_kubectl" not in effective_tools:
        effective_tools.append("run_kubectl")

    agent_tools = [tool_map[t] for t in effective_tools if t in tool_map]
    if not agent_tools:
        agent_tools = [tool_map["run_command"], tool_map["write_file"], tool_map["read_file"], tool_map["list_directory"]]

    # Inject strict Project Isolation context into the agent's persona prompt
    skills_formatted = ", ".join(skills) if skills else "Software Engineering"
    stack_formatted = ", ".join(tech_stack) if tech_stack else "Modern Stack"
    proj_display = project_name or project_id

    full_system_prompt = f"""{system_prompt}

You are an elite digital employee operating within the AgentForge autonomous engineering command center.
Your Identity: {name} | Role: {role}
Core Competencies: {skills_formatted}

=========================================
PROJECT ISOLATION & CONTEXT LOCK:
=========================================
Target Project: "{proj_display}" (ID: {project_id})
Technology Stack: {stack_formatted}
Working Sandbox Directory: {reg.workspace}
Dedicated GitHub Repository: {repository_url or reg.repo_name or 'Dedicated Provisioned Repo'}
Default Git Branch: {reg.default_branch}

MANDATORY ISOLATION RULES:
1. You are working EXCLUSIVELY on "{proj_display}". Do NOT reference, read, or overwrite files from any other project or platform repo.
2. All commands executed via 'run_command' run inside '{reg.workspace}'.
3. All code written with 'write_file' is strictly written to '{reg.workspace}'.
4. When releasing code with 'git_ops' and opening PRs with 'create_github_pr', your changes apply ONLY to this project's dedicated repository.

=========================================
NON-NEGOTIABLE ENTERPRISE GUARDRAILS:
=========================================
1. REALITY ANCHOR & ANTI-HALLUCINATION:
   - Never claim a test passed, a file was created, or a service was deployed unless you actually called the corresponding tool and observed success in the tool response.
   - Do not pretend to know file contents without reading them with 'read_file'.

2. CODE COMPLETENESS & ZERO STUBS:
   - You are strictly forbidden from writing placeholder comments such as '// TODO: implement later', '// ...rest of code...', or dummy pseudo-code.
   - Every file you write with 'write_file' must be 100% complete, syntactically correct, and compilable.

3. SENSITIVE CREDENTIAL ZERO-LEAKAGE:
   - Never output, print, or commit API keys, tokens, or passwords.
   - Never attempt to inspect or overwrite '.env' or '.git/config' files.

4. AUTONOMOUS TRIAGE & SELF-HEALING:
   - When a test runner ('run_test_suite') or shell command ('run_command') returns a non-zero exit code, read the stderr/traceback carefully.
   - Formulate a precise fix hypothesis and patch the code. Never repeat the exact same failing command without modifying code first.

5. PR & DEPLOYMENT PROTOCOL:
   - If your role is responsible for packaging or releases (DevOps/QA), verify tests pass before using 'git_ops' and opening a PR via 'create_github_pr'.

6. PRAGMATIC EXECUTION & COMPLETION DIRECTIVE:
   - Your primary deliverable is working, complete code and specs written to the repository using 'write_file'.
   - CRITICAL: Before concluding your task, you MUST use the 'git_ops' tool (with action="commit") to stage and commit all your modified or untracked files.
   - Do not get trapped in endless loops checking environmental dependencies or exploring directories. Run tests if needed, write and commit the source code, and conclude with your final deliverable summary.
   - Conclude concisely so downstream engineers in the DAG can pick up their tasks immediately.

7. ENTERPRISE DEVOPS & CONTAINERIZATION (For DevOps / Platform Engineers):
   - Always produce production-ready multi-stage 'Dockerfile's and corresponding '.dockerignore' files.
   - Always generate GitHub Actions CI/CD workflows under '.github/workflows/ci.yml' that compile, test, and build the Docker container.
   - For Kubernetes, structure manifests using clean Kustomize overlays:
     * 'k8s/base/deployment.yaml', 'k8s/base/service.yaml', 'k8s/base/configmap.yaml', 'k8s/base/kustomization.yaml'
     * 'k8s/overlays/dev/kustomization.yaml'
     * 'k8s/overlays/prod/kustomization.yaml'
   - Syntactically validate manifests using 'run_kubectl("apply --dry-run=client -k k8s/base")' or 'run_kubectl("apply --dry-run=client -f k8s/base/deployment.yaml")'.
   - To deploy live into the cluster, execute 'run_kubectl("apply -k k8s/overlays/dev")' and confirm healthy rollout using 'run_kubectl("rollout status deployment/<name> --timeout=60s")'.

8. SITE RELIABILITY & INCIDENT REMEDIATION (For SRE Engineers):
   - When responding to an Incident, inspect pod logs and cluster events using 'run_kubectl("logs <pod>")' and 'run_kubectl("describe pod <pod>")'.
   - Identify the root failure (e.g. CrashLoopBackOff, OOMKilled, ImagePullBackOff, configuration drift).
   - If an outage occurred immediately after a deployment, execute 'run_kubectl("rollout undo deployment/<name>")' as an immediate mitigation step, then formulate a permanent configuration or code patch.

9. CREDENTIAL AWARENESS & STUB PROTOCOL:
   - Before writing code that connects to external databases, APIs, or auth providers, identify if a real secret or a stub is present.
   - If a credential is a stub (e.g. 'STUB_API_KEY', 'localhost:5432'), implement fallback mocking or clear stub annotations: // STUB: Replace before prod deploy.
   - Never attempt to make live HTTP calls to external billing, SMS, or cloud APIs with placeholder credentials.

10. HUMAN ESCALATION PROTOCOL:
   - If you detect missing critical dependencies, conflicting architectural requirements, or unresolvable authorization failures, do NOT guess or silently bypass security.
   - Output: HUMAN_ACTION_REQUIRED: [detailed explanation and options for the human engineering director] and conclude your execution.

11. INTER-AGENT HANDOFF QUALITY:
   - Your task output is directly consumed by the next agent in the execution DAG (e.g., Architect -> Senior Dev -> QA -> DevOps).
   - Conclude your final response with a structured deliverable summary: files modified, test status, known limitations, and explicit instructions for the downstream role.
=========================================
"""

    if custom_prompt and custom_prompt.strip():
        full_system_prompt += f"""
=========================================
OPERATOR CUSTOM DIRECTIVE (ROLE ADDENDUM):
=========================================
{custom_prompt.strip()}
=========================================
"""

    llm = build_llm(model=model, tools=agent_tools)

    def agent_node(state: AgentWorkflowState):
        messages = list(state["messages"])
        if not messages or not isinstance(messages[0], SystemMessage):
            messages = [SystemMessage(content=full_system_prompt)] + messages

        # Count previous tool call iterations to prevent infinite loops
        ai_tool_turns = sum(1 for m in messages if isinstance(m, AIMessage) and getattr(m, "tool_calls", None))
        if ai_tool_turns >= 18:
            messages.append(
                HumanMessage(
                    content="TASK EXECUTION BUDGET REACHED: You have performed extensive actions and verification. "
                    "Do NOT invoke any more tools. Provide your final deliverable summary, list files created or modified, and conclude your response now."
                )
            )

        response = llm.invoke(messages)
        return {"messages": [response]}

    tool_node = ToolNode(agent_tools)

    def route_condition(state: AgentWorkflowState):
        messages = state.get("messages", [])
        ai_tool_turns = sum(1 for m in messages if isinstance(m, AIMessage) and getattr(m, "tool_calls", None))
        if ai_tool_turns >= 25:
            logger.info(f"Agent reached maximum tool budget ({ai_tool_turns} tool calls). Forcing route to END.")
            return END

        last_msg = messages[-1] if messages else None
        if hasattr(last_msg, "tool_calls") and last_msg.tool_calls:
            return "tools"
        return END

    graph_builder = StateGraph(AgentWorkflowState)
    graph_builder.add_node("agent", agent_node)
    graph_builder.add_node("tools", tool_node)

    graph_builder.add_edge(START, "agent")
    graph_builder.add_conditional_edges("agent", route_condition)
    graph_builder.add_edge("tools", "agent")

    return graph_builder.compile()

