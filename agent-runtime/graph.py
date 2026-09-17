"""
AgentForge Dynamic LangGraph ReAct Workflow Engine
Orchestrates autonomous agents with Google Gemini 2.5 Flash, real-time token streaming,
and sandboxed tool execution.
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

from agent import tool_registry

logger = logging.getLogger("AgentForge.Graph")

# --- Define LangChain-wrapped Tools ---

@tool
def run_command(command: str) -> str:
    """Executes a sandboxed terminal shell command in the workspace."""
    res = tool_registry.run_command(command)
    return json.dumps(res, indent=2)

@tool
def write_file(filepath: str, content: str) -> str:
    """Writes source code or documentation to a file in the workspace."""
    res = tool_registry.write_file(filepath, content)
    return json.dumps(res, indent=2)

@tool
def read_file(filepath: str) -> str:
    """Reads the contents of an existing file in the workspace."""
    res = tool_registry.read_file(filepath)
    if not res.get("success"):
        return f"Error: {res.get('error')}"
    return res.get("content", "")

@tool
def list_directory(dirpath: str = ".") -> str:
    """Lists files and directories within the workspace."""
    res = tool_registry.list_dir(dirpath)
    return json.dumps(res, indent=2)

@tool
def git_action(action: str, branch: str = "agent-feature", message: str = "Update code") -> str:
    """Performs git actions: checkout_branch, commit, push."""
    res = tool_registry.git_ops(action=action, branch=branch, message=message)
    return json.dumps(res, indent=2)

@tool
def run_test_suite(suite_command: str = "") -> str:
    """Executes the test suite in the workspace to verify code correctness."""
    res = tool_registry.run_test_suite(suite_command if suite_command else None)
    return json.dumps(res, indent=2)

@tool
def create_github_pr(title: str, body: str, branch: str, base_branch: str = "main") -> str:
    """Opens a GitHub Pull Request using GitHub App credentials."""
    res = tool_registry.create_github_pr(title=title, body=body, branch=branch, base_branch=base_branch)
    return json.dumps(res, indent=2)


TOOL_MAP = {
    "run_command": run_command,
    "write_file": write_file,
    "read_file": read_file,
    "list_directory": list_directory,
    "git_ops": git_action,
    "run_test_suite": run_test_suite,
    "create_github_pr": create_github_pr,
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


def compile_agent_graph(
    agent_id: str,
    name: str,
    role: str,
    system_prompt: str,
    skills: List[str],
    allowed_tools: List[str],
):
    """
    Compiles a LangGraph ReAct agent customized for the specific persona.
    """
    # Filter tools for this agent role
    agent_tools = [TOOL_MAP[t] for t in allowed_tools if t in TOOL_MAP]
    if not agent_tools:
        agent_tools = [run_command, write_file, read_file, list_directory]

    # Create full persona prompt with Enterprise Safety & Quality Guardrails
    skills_formatted = ", ".join(skills) if skills else "Software Engineering"
    full_system_prompt = f"""{system_prompt}

You are an elite digital employee operating within the AgentForge autonomous engineering command center.
Your Identity: {name} | Role: {role}
Core Competencies: {skills_formatted}

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
   - Do not get trapped in endless loops checking environmental dependencies or exploring directories. Run tests if needed, write the complete source code files, and conclude with your final deliverable summary.
   - Conclude concisely so downstream engineers in the DAG can pick up their tasks immediately.
=========================================
"""

    gemini_api_key = os.getenv("GEMINI_API_KEY", "")
    gemini_model = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")

    llm = ChatGoogleGenerativeAI(
        model=gemini_model,
        google_api_key=gemini_api_key if gemini_api_key else None,
        temperature=0.2,
        streaming=True,
        max_retries=12,
    ).bind_tools(agent_tools)

    def agent_node(state: AgentWorkflowState):
        messages = list(state["messages"])
        if not messages or not isinstance(messages[0], SystemMessage):
            messages = [SystemMessage(content=full_system_prompt)] + messages

        response = llm.invoke(messages)
        return {"messages": [response]}

    tool_node = ToolNode(agent_tools)

    def route_condition(state: AgentWorkflowState):
        last_msg = state["messages"][-1]
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
