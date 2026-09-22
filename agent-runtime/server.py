"""
AgentForge Python Agent Runtime Service
Provides dynamic Task Decomposition, LangGraph ReAct task execution,
and direct agent interaction via Google Gemini.
"""

import os
import json
import asyncio
import logging
import httpx
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, Request, BackgroundTasks
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from langchain_core.messages import SystemMessage, HumanMessage

from graph import compile_agent_graph
from budget import TaskBudgetState, BudgetExceededError
from llm_factory import build_chat_model

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("AgentForge.Server")

app = FastAPI(title="AgentForge AI Agent Runtime", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BACKEND_INTERNAL_URL = os.getenv("BACKEND_URL", "http://backend:8080")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")


def extract_text(content: Any) -> str:
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, dict) and "text" in item:
                parts.append(item["text"])
            elif isinstance(item, str):
                parts.append(item)
            elif hasattr(item, "text"):
                parts.append(str(getattr(item, "text")))
            else:
                parts.append(str(item))
        return "".join(parts).strip()
    return str(content).strip()


def strip_codeblock(raw: str) -> str:
    raw = raw.strip()
    if raw.startswith("```json"):
        raw = raw[7:]
    elif raw.startswith("```"):
        raw = raw[3:]
    if raw.endswith("```"):
        raw = raw[:-3]
    return raw.strip()


# --- Pydantic Data Contracts ---

class DecomposeRequest(BaseModel):
    project_id: str
    prompt: str
    provider: Optional[str] = None
    model: Optional[str] = None

class ExecuteTaskRequest(BaseModel):
    task_id: str
    project_id: str
    title: str
    description: str
    required_role: str
    agent_id: str
    agent_name: str
    system_prompt: str
    skills: List[str]
    tools: List[str]
    dependencies: List[str]
    token_budget: int = 1_000_000  # generous fallback if the backend omits it
    provider: Optional[str] = None
    model: Optional[str] = None

class InstructRequest(BaseModel):
    agent_id: str
    agent_name: str
    role: str
    system_prompt: str
    instruction: str
    provider: Optional[str] = None
    model: Optional[str] = None

class AnalyzeBRDRequest(BaseModel):
    project_id: Optional[str] = None
    projectId: Optional[str] = None
    content: str
    title: Optional[str] = "Project Initiative"
    supplementary_notes: Optional[str] = ""
    supplementaryNotes: Optional[str] = ""
    provider: Optional[str] = None
    model: Optional[str] = None

    def get_project_id(self) -> str:
        return self.project_id or self.projectId or "proj-1"

    def get_notes(self) -> str:
        return self.supplementary_notes or self.supplementaryNotes or ""

class ReplanRequest(BaseModel):
    project_id: Optional[str] = None
    projectId: Optional[str] = None
    current_tasks: Optional[List[Dict[str, Any]]] = None
    currentTasks: Optional[List[Dict[str, Any]]] = None
    revision_prompt: Optional[str] = None
    revisionPrompt: Optional[str] = None
    provider: Optional[str] = None
    model: Optional[str] = None

    def get_project_id(self) -> str:
        return self.project_id or self.projectId or "proj-1"

    def get_tasks(self) -> List[Dict[str, Any]]:
        return self.current_tasks or self.currentTasks or []

    def get_revision_prompt(self) -> str:
        return self.revision_prompt or self.revisionPrompt or ""



def normalize_content(content: Any) -> str:
    """Safely normalizes any LLM chunk or message content into a clean string."""
    if content is None:
        return ""
    if isinstance(content, str):
        return content
    if isinstance(content, (int, float, bool)):
        return str(content)
    if isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict):
                if item.get("type") == "text" and "text" in item:
                    parts.append(str(item["text"]))
                elif "text" in item:
                    parts.append(str(item["text"]))
                elif "args" in item:
                    parts.append(f"[{item.get('name', 'tool')}: {json.dumps(item['args'])}]")
                else:
                    parts.append(json.dumps(item))
            else:
                parts.append(str(item))
        return "".join(parts)
    if isinstance(content, dict):
        if "text" in content:
            return str(content["text"])
        return json.dumps(content)
    return str(content)


# --- Helper to notify Go Backend ---

async def send_event_to_backend(payload: Dict[str, Any]):
    """Sends task events (tokens, logs, status) to the Go backend webhook."""
    webhook_url = f"{BACKEND_INTERNAL_URL}/api/internal/task-event"
    if "content" in payload:
        payload["content"] = normalize_content(payload["content"])
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(webhook_url, json=payload)
            if resp.status_code != 200:
                logger.warning(
                    f"Backend webhook returned status {resp.status_code}: {resp.text} for payload type {payload.get('type')}"
                )
    except Exception as e:
        logger.warning(f"Failed to post event to backend webhook {webhook_url}: {e}")


# --- Endpoints ---

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "AgentForge AI Agent Runtime",
        "llm_configured": bool(GEMINI_API_KEY),
        "version": "2.0.0",
    }


@app.post("/api/decompose")
async def decompose_requirement(req: DecomposeRequest):
    """
    Dynamically decomposes a high-level project requirement into a topologically
    ordered Task DAG using Google Gemini.
    """
    logger.info(f"Decomposing project requirement: '{req.prompt}'")
    
    prompt = f"""You are a Lead Software Architect.
Analyze the following engineering project requirement and decompose it into an optimal, production-grade dependency DAG of engineering tasks.

Project Requirement:
"{req.prompt}"

Available Engineering Roles to assign:
1. "Software Architect" (System specs, OpenAPI contracts, architecture)
2. "Senior Developer" (Core backend logic, database migrations, APIs)
3. "Junior Developer (Frontend)" (UI components, user flows, state)
4. "Lead QA Engineer" (Automated test suites, validation, regression tests)
5. "DevOps Engineer" (Docker packaging, CI/CD, Git branch & PR release)

Available Tools:
"read_file", "write_file", "run_command", "git_ops", "run_test_suite", "create_github_pr"

Return ONLY a valid JSON array of Task objects. Each Task object must have:
- "id": a unique string (e.g. "task-1-arch", "task-2-backend")
- "projectId": "{req.project_id}"
- "title": concise task title
- "description": actionable, detailed technical instructions
- "priority": "HIGH" | "CRITICAL" | "MEDIUM"
- "status": "QUEUED" for tasks with no dependencies, or "WAITING" for dependent tasks
- "requiredRole": one of the exact role names listed above
- "skills": array of relevant technical skills
- "tools": array of needed tools from the list above
- "dependencies": array of task IDs that must complete before this task can start
- "requiresApproval": boolean (set true only for final deployment or PR step)

Return ONLY the raw JSON array. Do not include markdown code block quotes.
"""

    try:
        llm = build_chat_model(provider=req.provider, model=req.model, temperature=0.2)
        response = await llm.ainvoke([HumanMessage(content=prompt)])
        raw_content = extract_text(response.content)
        cleaned_json = strip_codeblock(raw_content)

        tasks = json.loads(cleaned_json)
        return JSONResponse(content=tasks)
    except Exception as e:
        logger.error(f"Error during dynamic decomposition: {e}")
        # Return empty list to trigger backend fallback gracefully
        return JSONResponse(content=[], status_code=500)


@app.post("/api/execute")
async def execute_task(req: ExecuteTaskRequest, background_tasks: BackgroundTasks):
    """
    Spawns autonomous agent execution in the background and streams tokens & tool logs to the Go backend.
    """
    logger.info(f"Executing task '{req.title}' ({req.task_id}) with agent '{req.agent_name}' ({req.required_role})")

    # Launch execution as background task so backend HTTP call returns immediately
    background_tasks.add_task(run_agent_execution, req)
    return {"status": "started", "task_id": req.task_id}


async def run_agent_execution(req: ExecuteTaskRequest):
    """Asynchronously runs the compiled LangGraph ReAct agent and emits live webhook events."""
    budget_state = TaskBudgetState(
        agent_id=req.agent_id,
        agent_name=req.agent_name,
        task_id=req.task_id,
        budget_for_this_task=req.token_budget,
    )
    agent_graph = compile_agent_graph(
        agent_id=req.agent_id,
        name=req.agent_name,
        role=req.required_role,
        system_prompt=req.system_prompt,
        skills=req.skills,
        allowed_tools=req.tools,
        budget_state=budget_state,
        provider=req.provider,
        model=req.model,
    )

    initial_state = {
        "task_id": req.task_id,
        "title": req.title,
        "description": req.description,
        "messages": [
            HumanMessage(
                content=f"""TASK ASSIGNMENT:
Title: {req.title}
Specification: {req.description}

Instructions:
1. Review the requirement and execute the necessary actions using your tools.
2. If code or specs need to be written, use 'write_file' to produce complete implementations.
3. Verify your work using 'run_command' or 'run_test_suite'.
4. Once verified, provide your final deliverable summary and conclude. Do not continue redundant directory listings or repetitive scans."""
            )
        ],
        "artifacts": [],
        "tokens_used": 0,
        "cost_usd": 0.0,
        "status": "RUNNING",
    }

    tokens_accumulated = 0
    final_output = ""
    branch_name = f"feature/{req.task_id}"

    try:
        await send_event_to_backend({
            "type": "log",
            "task_id": req.task_id,
            "agent_id": req.agent_id,
            "content": f"Agent {req.agent_name} mobilized: reasoning through task requirements...",
            "progress": 15,
        })

        async for event in agent_graph.astream_events(
            initial_state,
            version="v2",
            config={"recursion_limit": 100},
        ):
            event_type = event.get("event")

            # Streaming LLM tokens
            if event_type == "on_chat_model_stream":
                chunk = event["data"].get("chunk")
                if chunk and chunk.content:
                    tokens_accumulated += 1
                    budget_state.tokens_used_so_far = tokens_accumulated
                    await send_event_to_backend({
                        "type": "token",
                        "task_id": req.task_id,
                        "agent_id": req.agent_id,
                        "content": chunk.content,
                    })

            # Tool started
            elif event_type == "on_tool_start":
                tool_name = event.get("name", "tool")
                tool_input = event["data"].get("input", {})
                await send_event_to_backend({
                    "type": "log",
                    "task_id": req.task_id,
                    "agent_id": req.agent_id,
                    "content": f"Invoking tool: {tool_name} with params: {json.dumps(tool_input)}",
                    "progress": 45,
                })

            # Tool ended
            elif event_type == "on_tool_end":
                tool_name = event.get("name", "tool")
                await send_event_to_backend({
                    "type": "log",
                    "task_id": req.task_id,
                    "agent_id": req.agent_id,
                    "content": f"Tool '{tool_name}' executed successfully.",
                    "progress": 75,
                })

            # Chain ended
            elif event_type == "on_chain_end" and event.get("name") == "LangGraph":
                output_state = event["data"].get("output", {})
                messages = output_state.get("messages", [])
                if messages:
                    final_output = messages[-1].content if hasattr(messages[-1], "content") else str(messages[-1])

        # Estimated cost (Gemini 2.5 Flash: ~$0.075 / 1M tokens)
        cost_usd = (tokens_accumulated / 1000.0) * 0.0001

        # Report task completion
        await send_event_to_backend({
            "type": "completion",
            "task_id": req.task_id,
            "agent_id": req.agent_id,
            "content": final_output or f"Task '{req.title}' completed successfully.",
            "tokens_used": max(tokens_accumulated, 250),
            "cost_usd": cost_usd,
            "branch": branch_name,
            "progress": 100,
        })

    except BudgetExceededError as e:
        # Graceful stop: the agent ran out of its token budget (and any
        # crisis-pool top-up wasn't enough). Reported as a normal task
        # failure, same path as any other execution error.
        logger.warning(f"Task {req.task_id} stopped: {e}")
        await send_event_to_backend({
            "type": "error",
            "task_id": req.task_id,
            "agent_id": req.agent_id,
            "content": str(e),
        })

    except Exception as e:
        logger.error(f"Error executing agent task {req.task_id}: {e}")
        await send_event_to_backend({
            "type": "error",
            "task_id": req.task_id,
            "agent_id": req.agent_id,
            "content": str(e),
        })


@app.post("/api/instruct")
async def instruct_agent(req: InstructRequest):
    """
    Direct interactive chat / instruction to any agent persona.
    """
    logger.info(f"Direct instruction to agent '{req.agent_name}': '{req.instruction}'")

    system_prompt = f"""{req.system_prompt}

You are speaking directly with a Human Engineering Director.
Agent Name: {req.agent_name}
Role: {req.role}

Respond professionally, technically, and concisely to their instruction or question.
"""

    try:
        llm = build_chat_model(provider=req.provider, model=req.model, temperature=0.3)
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=req.instruction),
        ]
        response = await llm.ainvoke(messages)
        content = extract_text(response.content) if hasattr(response, "content") else str(response)

        tokens = len(content.split()) * 2
        cost = (tokens / 1000.0) * 0.0001

        return {
            "response": content,
            "tokens_used": tokens,
            "cost_usd": cost,
        }
    except Exception as e:
        logger.error(f"Error instructing agent {req.agent_id}: {e}")
        return JSONResponse(content={"error": str(e)}, status_code=500)


@app.post("/api/analyze-brd")
async def analyze_brd(req: AnalyzeBRDRequest):
    """
    Parses full BRD/PRD documents with Orion Spark (BA Agent) and Dr. Marcus Cole (Architect).
    Extracts executive summary, epics, acceptance criteria, and returns proposed Task DAG for human verification.
    """
    project_id = req.get_project_id()
    notes = req.get_notes()
    logger.info(f"Analyzing BRD document: '{req.title}' for project '{project_id}' ({len(req.content)} chars)")

    prompt = f"""You are Orion Spark, Lead Business Analyst collaborating with Dr. Marcus Cole (Software Architect).
Analyze this Business Requirements Document (BRD) / Product Specification for Project '{project_id}'.

Document Title: {req.title}
Supplementary Notes: {notes}

=== SPECIFICATION / BRD CONTENT ===
{req.content[:20000]}
===================================

Extract the business goals, identify functional epics, and decompose the requirements into an engineering Task DAG.

Return ONLY a valid JSON object with the following structure:
{{
  "executive_summary": "Concise 2-3 sentence overview of this initiative",
  "epics": [
    {{
      "id": "EPIC-1",
      "title": "Epic Title",
      "description": "Functional scope",
      "acceptance_criteria": [
        "Given X, when Y, then Z",
        "Must satisfy standard..."
      ]
    }}
  ],
  "tech_stack_recommendations": ["Go", "PostgreSQL", "React", "..."],
  "architectural_notes": [
    "Rule 1: ...",
    "Rule 2: ..."
  ],
  "proposed_tasks": [
    {{
      "id": "task-1-arch",
      "projectId": "{project_id}",
      "title": "Architectural Specification & Contracts",
      "description": "Detailed technical deliverable description",
      "priority": "HIGH",
      "status": "QUEUED",
      "requiredRole": "Software Architect",
      "skills": ["System Architecture", "API Specifications"],
      "tools": ["read_file", "write_file"],
      "dependencies": [],
      "requiresApproval": false
    }},
    {{
      "id": "task-2-dev",
      "projectId": "{project_id}",
      "title": "Core Implementation",
      "description": "Implement business logic and data schema",
      "priority": "CRITICAL",
      "status": "WAITING",
      "requiredRole": "Senior Developer",
      "skills": ["Go", "PostgreSQL", "REST APIs"],
      "tools": ["read_file", "write_file", "run_command", "git_ops"],
      "dependencies": ["task-1-arch"],
      "requiresApproval": false
    }},
    {{
      "id": "task-3-qa",
      "projectId": "{project_id}",
      "title": "Automated Quality Assurance Suite",
      "description": "Execute comprehensive unit and integration tests",
      "priority": "HIGH",
      "status": "WAITING",
      "requiredRole": "Lead QA Engineer",
      "skills": ["Test Automation", "Regression Testing"],
      "tools": ["run_command", "run_test_suite", "read_file"],
      "dependencies": ["task-2-dev"],
      "requiresApproval": false
    }},
    {{
      "id": "task-4-ops",
      "projectId": "{project_id}",
      "title": "Git Release & GitHub Pull Request",
      "description": "Commit verified code and open Pull Request for human review",
      "priority": "CRITICAL",
      "status": "WAITING",
      "requiredRole": "DevOps Engineer",
      "skills": ["Docker", "GitOps", "CI/CD Pipelines"],
      "tools": ["run_command", "git_ops", "create_github_pr"],
      "dependencies": ["task-3-qa"],
      "requiresApproval": true
    }}
  ]
}}

Generate real, customized tasks that directly reflect the uploaded BRD requirements!
Return ONLY the raw JSON object. Do not include markdown code block syntax.
"""

    try:
        llm = build_chat_model(provider=req.provider, model=req.model, temperature=0.2)
        response = await llm.ainvoke([HumanMessage(content=prompt)])
        raw_content = extract_text(response.content)
        cleaned = strip_codeblock(raw_content)

        data = json.loads(cleaned)
        return JSONResponse(content=data)
    except Exception as e:
        logger.error(f"Error analyzing BRD: {e}")
        return JSONResponse(content={"error": str(e)}, status_code=500)


@app.post("/api/replan")
async def replan_tasks(req: ReplanRequest):
    """
    Allows human engineering director to dynamically revise a proposed Task DAG.
    """
    tasks = req.get_tasks()
    rev_prompt = req.get_revision_prompt()
    logger.info(f"Re-planning {len(tasks)} tasks with directive: '{rev_prompt}'")

    prompt = f"""You are Dr. Marcus Cole, Principal Software Architect.
The Human Engineering Director has reviewed your proposed engineering task list and requested modifications.

Current Proposed Tasks:
{json.dumps(tasks, indent=2)}

Human Director Revision Instructions:
"{rev_prompt}"

Update, re-order, inject, or remove tasks as instructed while preserving valid dependencies and appropriate engineering roles.
Available Roles: "Software Architect", "Senior Developer", "Junior Developer (Frontend)", "Lead QA Engineer", "DevOps Engineer"
Available Tools: "read_file", "write_file", "run_command", "git_ops", "run_test_suite", "create_github_pr"

Return ONLY a valid JSON array of Task objects. Return raw JSON only, no markdown code block quotes.
"""

    try:
        llm = build_chat_model(provider=req.provider, model=req.model, temperature=0.2)
        response = await llm.ainvoke([HumanMessage(content=prompt)])
        raw_content = extract_text(response.content)
        cleaned = strip_codeblock(raw_content)

        updated_tasks = json.loads(cleaned)
        return JSONResponse(content=updated_tasks)
    except Exception as e:
        logger.error(f"Error replanning tasks: {e}")
        return JSONResponse(content={"error": str(e)}, status_code=500)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)

