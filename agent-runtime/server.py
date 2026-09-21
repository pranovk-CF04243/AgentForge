import subprocess
subprocess.run(['git', 'config', '--global', 'http.sslVerify', 'false'], check=False)
"""
AgentForge Python Agent Runtime Service
Provides dynamic Task Decomposition, LangGraph ReAct task execution,
and direct agent interaction via Google Gemini.
"""

import os
import re
import json
import asyncio
import logging
import httpx
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, Request, BackgroundTasks
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage

from graph import compile_agent_graph
from debate_graph import build_debate_graph, DebateState

from agent import RealToolRegistry
from github_client import github_client

project_locks: Dict[str, asyncio.Lock] = {}

def get_project_lock(project_id: str) -> asyncio.Lock:
    if project_id not in project_locks:
        project_locks[project_id] = asyncio.Lock()
    return project_locks[project_id]

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
INTERNAL_WEBHOOK_SECRET = os.getenv("INTERNAL_WEBHOOK_SECRET", "agentforge-internal-dev-secret")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.6-flash")


def extract_retry_delay(err_msg: str, default: float = 35.0) -> float:
    try:
        m = re.search(r"['\"]?retryDelay['\"]?:\s*['\"]?(\d+)s?['\"]?", err_msg)
        if m:
            return float(m.group(1)) + 2.0
        m2 = re.search(r"[Pp]lease retry in\s*([\d\.]+)s", err_msg)
        if m2:
            return float(m2.group(1)) + 2.0
        m3 = re.search(r"retry\s+in\s+([\d\.]+)\s*s", err_msg, re.IGNORECASE)
        if m3:
            return float(m3.group(1)) + 2.0
    except Exception:
        pass
    return default


def get_llm(model: Optional[str] = None, temperature: float = 0.2):
    raw = model or GEMINI_MODEL
    models_pool = ["gemini-3.8-flash", "gemini-flash-latest", "gemini-3.6-flash", "gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite"]
    target = raw if raw in models_pool else "gemini-3.8-flash"
    fallbacks = [m for m in models_pool if m != target]

    primary = ChatGoogleGenerativeAI(
        model=target,
        google_api_key=GEMINI_API_KEY if GEMINI_API_KEY else None,
        temperature=temperature,
        max_retries=2,
    )
    fallback_llms = []
    for fb in fallbacks:
        try:
            fallback_llms.append(
                ChatGoogleGenerativeAI(
                    model=fb,
                    google_api_key=GEMINI_API_KEY if GEMINI_API_KEY else None,
                    temperature=temperature,
                    max_retries=2,
                )
            )
        except Exception:
            pass
    if fallback_llms:
        return primary.with_fallbacks(fallback_llms)
    return primary


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
    existing_epics: Optional[List[Dict[str, Any]]] = None
    existingEpics: Optional[List[Dict[str, Any]]] = None

    def get_existing_epics(self) -> List[Dict[str, Any]]:
        return self.existing_epics or self.existingEpics or []

class ExecuteTaskRequest(BaseModel):
    task_id: str
    project_id: str
    project_name: Optional[str] = None
    projectName: Optional[str] = None
    project_description: Optional[str] = None
    projectDescription: Optional[str] = None
    tech_stack: Optional[List[str]] = None
    techStack: Optional[List[str]] = None
    repository_url: Optional[str] = None
    repositoryUrl: Optional[str] = None
    target_branch: Optional[str] = "main"
    targetBranch: Optional[str] = "main"
    title: str
    description: str
    required_role: str
    agent_id: str
    agent_name: str
    system_prompt: str
    skills: List[str]
    tools: List[str]
    dependencies: List[str]
    custom_prompt: Optional[str] = ""
    customPrompt: Optional[str] = ""
    model: Optional[str] = None

    def get_project_name(self) -> str:
        return self.project_name or self.projectName or self.project_id

    def get_repo_url(self) -> str:
        return self.repository_url or self.repositoryUrl or ""

    def get_target_branch(self) -> str:
        return self.target_branch or self.targetBranch or "main"

    def get_tech_stack(self) -> List[str]:
        return self.tech_stack or self.techStack or []

    def get_custom_prompt(self) -> str:
        return self.custom_prompt or self.customPrompt or ""

class ProvisionRepoRequest(BaseModel):
    project_name: str
    project_id: Optional[str] = None
    description: Optional[str] = ""
    private: Optional[bool] = True

class InstructRequest(BaseModel):
    agent_id: str
    agent_name: str
    role: str
    system_prompt: str
    instruction: str

class AnalyzeBRDRequest(BaseModel):
    project_id: Optional[str] = None
    projectId: Optional[str] = None
    content: str
    title: Optional[str] = "Project Initiative"
    supplementary_notes: Optional[str] = ""
    supplementaryNotes: Optional[str] = ""
    phase: Optional[str] = "discovery" # discovery | clarification | summary | generate
    clarification_answers: Optional[Dict[str, Any]] = None
    clarificationAnswers: Optional[Dict[str, Any]] = None
    approved_context: Optional[Dict[str, Any]] = None
    approvedContext: Optional[Dict[str, Any]] = None
    existing_epics: Optional[List[Dict[str, Any]]] = None
    existingEpics: Optional[List[Dict[str, Any]]] = None
    existing_tasks: Optional[List[Dict[str, Any]]] = None
    existingTasks: Optional[List[Dict[str, Any]]] = None

    def get_project_id(self) -> str:
        return self.project_id or self.projectId or "proj-1"

    def get_notes(self) -> str:
        return self.supplementary_notes or self.supplementaryNotes or ""

    def get_answers(self) -> Dict[str, Any]:
        return self.clarification_answers or self.clarificationAnswers or {}

    def get_approved_context(self) -> Dict[str, Any]:
        return self.approved_context or self.approvedContext or {}

    def get_existing_epics(self) -> List[Dict[str, Any]]:
        return self.existing_epics or self.existingEpics or []

    def get_existing_tasks(self) -> List[Dict[str, Any]]:
        return self.existing_tasks or self.existingTasks or []

class ReplanRequest(BaseModel):
    project_id: Optional[str] = None
    projectId: Optional[str] = None
    current_tasks: Optional[List[Dict[str, Any]]] = None
    currentTasks: Optional[List[Dict[str, Any]]] = None
    revision_prompt: Optional[str] = None
    revisionPrompt: Optional[str] = None

    def get_project_id(self) -> str:
        return self.project_id or self.projectId or "proj-1"

    def get_tasks(self) -> List[Dict[str, Any]]:
        return self.current_tasks or self.currentTasks or []

    def get_revision_prompt(self) -> str:
        return self.revision_prompt or self.revisionPrompt or ""

class ProvisionNamespaceRequest(BaseModel):
    project_id: str
    projectId: Optional[str] = None
    environment: Optional[str] = "dev"
    cpu_limit: Optional[str] = "2"
    cpuLimit: Optional[str] = "2"
    memory_limit: Optional[str] = "4Gi"
    memoryLimit: Optional[str] = "4Gi"

    def get_project_id(self) -> str:
        return self.project_id or self.projectId or "proj-1"

class DeployClusterRequest(BaseModel):
    project_id: str
    projectId: Optional[str] = None
    environment: Optional[str] = "dev"
    timeout: Optional[int] = 90

    def get_project_id(self) -> str:
        return self.project_id or self.projectId or "proj-1"

class ConnectClusterRequest(BaseModel):
    project_id: Optional[str] = "default"
    environment: Optional[str] = "dev"
    kubeconfig_yaml: str



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
    headers = {
        "X-Internal-Secret": INTERNAL_WEBHOOK_SECRET,
        "Content-Type": "application/json",
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(webhook_url, json=payload, headers=headers)
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
    
    epics_context = ""
    existing_epics = req.get_existing_epics()
    if existing_epics:
        epics_summary = json.dumps([{"id": e.get("id"), "title": e.get("title"), "description": e.get("description")} for e in existing_epics], indent=2)
        epics_context = f"\nExisting Project Epics & Architectural Boundaries:\n{epics_summary}\nAlign the generated tasks with these epics where appropriate, and include an 'epicId' field (referencing the matching epic ID) on relevant tasks.\n"

    prompt = f"""You are a Lead Software Architect.
Analyze the following engineering project requirement and decompose it into an optimal, production-grade dependency DAG of engineering tasks.

Project Requirement:
"{req.prompt}"
{epics_context}
Available Engineering Roles to assign:
1. "Software Architect" (System specs, OpenAPI contracts, architecture)
2. "Senior Developer" (Core backend logic, database migrations, APIs)
3. "Junior Developer (Frontend)" (UI components, user flows, state)
4. "Lead QA Engineer" (Automated test suites, validation, regression tests)
5. "DevOps Engineer" (Docker multi-stage packaging, GitHub Actions CI/CD, K8s Kustomize manifests, GitOps/PR release)
6. "Cloud SRE Engineer" (Cluster health verification, pod observability, rollback triage)

Available Tools:
"read_file", "write_file", "run_command", "git_ops", "run_test_suite", "create_github_pr", "run_kubectl"

Return ONLY a valid JSON array of Task objects. Each Task object must have:
- "id": a unique string (e.g. "task-1-arch", "task-2-backend")
- "projectId": "{req.project_id}"
- "epicId": ID of the associated Epic if applicable, or null
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
        llm = get_llm(temperature=0.2)
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


@app.post("/api/projects/provision-repo")
async def provision_repo(req: ProvisionRepoRequest):
    """
    Explicitly provisions a dedicated GitHub repository for a project.
    """
    logger.info(f"Provisioning dedicated repository for project: '{req.project_name}'")
    info = github_client.ensure_repository(
        project_name=req.project_name,
        description=req.description or f"Dedicated repository for {req.project_name}",
        private=req.private if req.private is not None else True,
    )
    return JSONResponse(content=info)


# --- Kubernetes Live Cluster & Provisioning Endpoints ---

@app.get("/api/cluster/status")
async def cluster_status(project_id: Optional[str] = "default"):
    """Returns the live status, nodes, version, and health of the Kubernetes cluster."""
    registry = RealToolRegistry(project_id=project_id or "default")
    return JSONResponse(content=registry.get_cluster_status())


@app.get("/api/cluster/workloads")
async def cluster_workloads(project_id: Optional[str] = "default", namespace: Optional[str] = None):
    """Returns live Pods, Deployments, and Services in the project namespace."""
    pid = project_id or "default"
    registry = RealToolRegistry(project_id=pid)
    ns = namespace or f"agentforge-{pid}-dev".lower()
    return JSONResponse(content=registry.get_live_workloads(namespace=ns))


@app.get("/api/cluster/logs")
async def cluster_logs(pod_name: str, namespace: Optional[str] = None, tail: Optional[int] = 100, project_id: Optional[str] = "default"):
    """Fetches real container terminal logs for a live pod."""
    pid = project_id or "default"
    registry = RealToolRegistry(project_id=pid)
    ns = namespace or f"agentforge-{pid}-dev".lower()
    return JSONResponse(content=registry.get_pod_logs(pod_name=pod_name, namespace=ns, tail=tail or 100))


@app.post("/api/cluster/provision")
async def cluster_provision(req: ProvisionNamespaceRequest):
    """Provisions a dedicated Kubernetes namespace with resource quotas and limits."""
    pid = req.get_project_id()
    registry = RealToolRegistry(project_id=pid)
    ns = f"agentforge-{pid}-{req.environment or 'dev'}".lower()
    cpu = req.cpu_limit or req.cpuLimit or "2"
    mem = req.memory_limit or req.memoryLimit or "4Gi"
    res = registry.provision_namespace(namespace=ns, cpu_limit=cpu, mem_limit=mem)
    return JSONResponse(content=res)


@app.post("/api/cluster/deploy")
async def cluster_deploy(req: DeployClusterRequest):
    """Deploys verified project manifests directly to the live Kubernetes cluster."""
    pid = req.get_project_id()
    registry = RealToolRegistry(project_id=pid)
    res = registry.deploy_project_manifests(environment=req.environment or "dev", timeout=req.timeout or 90)

    health_report = res.get("health_report")
    if health_report and health_report.get("remediationRequired"):
        logger.warning(f"Post-deployment verification degraded/failed for project {pid}. Triggering remediation loop...")
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                await client.post(
                    f"{BACKEND_INTERNAL_URL}/api/internal/deployment-failure",
                    json={"project_id": pid, "health_report": health_report},
                    headers={"X-Internal-Secret": INTERNAL_WEBHOOK_SECRET, "Content-Type": "application/json"},
                )
        except Exception as e:
            logger.error(f"Failed to post deployment failure to backend: {e}")

    return JSONResponse(content=res)


@app.get("/api/cluster/health-check")
async def cluster_health_check(projectId: str = "default", namespace: Optional[str] = None, environment: str = "dev"):
    """Executes 3-stage post-deploy health verification suite on a project namespace."""
    ns = namespace or f"agentforge-{projectId}-{environment}".lower()
    registry = RealToolRegistry(project_id=projectId)
    report = registry.run_health_verification_suite(namespace=ns)
    return JSONResponse(content=report)


@app.post("/api/cluster/connect-external")
async def cluster_connect_external(req: ConnectClusterRequest):
    """Connects an external cluster by saving its Kubeconfig."""
    pid = req.project_id or "default"
    dest = f"/tmp/kubeconfig-{pid}-{req.environment or 'dev'}.yaml"
    with open(dest, "w") as f:
        f.write(req.kubeconfig_yaml)
    os.chmod(dest, 0o600)
    registry = RealToolRegistry(project_id=pid)
    status = registry.get_cluster_status()
    return JSONResponse(content={"success": True, "path": dest, "cluster_status": status})


async def run_agent_execution(req: ExecuteTaskRequest):
    """Asynchronously runs the compiled LangGraph ReAct agent and emits live webhook events."""
    project_id = req.project_id or "default"
    project_name = req.get_project_name()
    target_branch = req.get_target_branch()
    repo_url = req.get_repo_url()
    tech_stack = req.get_tech_stack()

    # 1. Automatic Dedicated GitHub Repo Provisioning
    dedicated_repo_name = None
    dedicated_clone_url = None
    dedicated_html_url = None

    # Provision dedicated repository if repo_url is empty or points to the main AgentForge repo
    if not repo_url or "agentforge/agentforge" in repo_url or "placeholder" in repo_url or "pranovk-CF04243/AgentForge" in repo_url:
        repo_info = github_client.ensure_repository(
            project_name=project_name,
            description=f"Autonomous Workspace Repository for {project_name}",
            private=True,
        )
        if repo_info.get("success"):
            dedicated_repo_name = repo_info.get("full_name")
            dedicated_clone_url = repo_info.get("clone_url")
            dedicated_html_url = repo_info.get("html_url")
            logger.info(f"Project '{project_name}' provisioned dedicated repo: {dedicated_html_url}")
            await send_event_to_backend({
                "type": "log",
                "task_id": req.task_id,
                "agent_id": req.agent_id,
                "content": f"Provisioned and linked dedicated GitHub repository: {dedicated_html_url}",
                "progress": 5,
            })
    else:
        # Use existing custom repo
        dedicated_repo_name = repo_url.replace("https://github.com/", "").rstrip("/").removesuffix(".git")
        token = os.getenv("GITHUB_TOKEN", "").strip()
        if token:
            dedicated_clone_url = f"https://x-access-token:{token}@github.com/{dedicated_repo_name}.git"
        dedicated_html_url = repo_url

    # 2. Instantiate isolated project tool registry
    project_registry = RealToolRegistry(
        project_id=project_id,
        project_name=project_name,
        repo_name=dedicated_repo_name,
        clone_url=dedicated_clone_url,
        default_branch=target_branch,
    )

    # 3. Compile agent graph with isolated tools and anchored prompt
    agent_graph = compile_agent_graph(
        agent_id=req.agent_id,
        name=req.agent_name,
        role=req.required_role,
        system_prompt=req.system_prompt,
        skills=req.skills,
        allowed_tools=req.tools,
        registry=project_registry,
        project_id=project_id,
        project_name=project_name,
        repository_url=dedicated_html_url or repo_url,
        tech_stack=tech_stack,
        custom_prompt=req.get_custom_prompt(),
        model=req.model,
    )

    initial_state = {
        "task_id": req.task_id,
        "title": req.title,
        "description": req.description,
        "messages": [
            HumanMessage(
                content=f"""ACTIVE PROJECT INITIATIVE: {project_name} (ID: {project_id})
DEDICATED GITHUB REPOSITORY: {dedicated_html_url or repo_url or 'Dedicated Sandbox'}
SANDBOX WORKSPACE DIRECTORY: {project_registry.workspace}

TASK ASSIGNMENT:
Title: {req.title}
Specification: {req.description}

Instructions:
1. Review the requirement and execute actions using your tools inside '{project_registry.workspace}'.
2. Write complete, compilable, 100% production-ready source code using 'write_file'.
3. Verify your work using 'run_command' or 'run_test_suite'.
4. If your role is responsible for version control or releases, commit your code and open a Pull Request using 'create_github_pr'.
5. Once verified, provide your final deliverable summary and conclude concisely."""
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

    max_rate_limit_retries = 3
    for attempt in range(1, max_rate_limit_retries + 1):
        try:
            if attempt == 1:
                await send_event_to_backend({
                    "type": "log",
                    "task_id": req.task_id,
                    "agent_id": req.agent_id,
                    "content": f"Agent {req.agent_name} mobilized: executing task inside dedicated workspace '{project_registry.workspace}'...",
                    "progress": 15,
                })

            async for event in agent_graph.astream_events(
                initial_state,
                version="v2",
                config={"recursion_limit": 150},
            ):
                event_type = event.get("event")

                # Streaming LLM tokens
                if event_type == "on_chat_model_stream":
                    chunk = event["data"].get("chunk")
                    if chunk and chunk.content:
                        tokens_accumulated += 1
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

            # Estimated cost (Gemini Flash: ~$0.075 / 1M tokens)
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
                "pr_url": dedicated_html_url or "",
                "progress": 100,
            })
            return

        except Exception as e:
            err_str = str(e)
            is_recursion_limit = (
                "recursion limit" in err_str.lower()
                or "graph_recursion_limit" in err_str.lower()
            )
            if is_recursion_limit:
                logger.warning(
                    f"Task {req.task_id} reached recursion limit. Gracefully concluding with existing workspace deliverables."
                )
                cost_usd = (tokens_accumulated / 1000.0) * 0.0001
                await send_event_to_backend({
                    "type": "log",
                    "task_id": req.task_id,
                    "agent_id": req.agent_id,
                    "content": "Execution step limit reached. Finalizing deliverables and completing task.",
                    "progress": 95,
                })
                await send_event_to_backend({
                    "type": "completion",
                    "task_id": req.task_id,
                    "agent_id": req.agent_id,
                    "content": final_output or f"Task '{req.title}' completed: deliverables written and verified in project workspace.",
                    "tokens_used": max(tokens_accumulated, 250),
                    "cost_usd": cost_usd,
                    "branch": branch_name,
                    "pr_url": dedicated_html_url or "",
                    "progress": 100,
                })
                return

            is_rate_limit = (
                "RESOURCE_EXHAUSTED" in err_str
                or "429" in err_str
                or "quota exceeded" in err_str.lower()
                or "rate-limit" in err_str.lower()
            )
            if is_rate_limit and attempt < max_rate_limit_retries:
                delay = extract_retry_delay(err_str, default=36.0)
                logger.warning(
                    f"Task {req.task_id} hit rate limit (attempt {attempt}/{max_rate_limit_retries}). Pausing {delay:.1f}s for quota reset..."
                )
                await send_event_to_backend({
                    "type": "log",
                    "task_id": req.task_id,
                    "agent_id": req.agent_id,
                    "content": f"⚠️ Gemini API rate limit reached (429 RESOURCE_EXHAUSTED). Free tier quota resets in {int(delay)}s. Auto-pausing and will automatically resume (attempt {attempt}/{max_rate_limit_retries})...",
                    "progress": 20,
                })
                await asyncio.sleep(delay)
                continue
            else:
                logger.error(f"Error executing agent task {req.task_id}: {e}")
                await send_event_to_backend({
                    "type": "error",
                    "task_id": req.task_id,
                    "agent_id": req.agent_id,
                    "content": str(e),
                })
                return


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
        llm = get_llm(temperature=0.3)
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
    Supports conversational discovery -> clarification -> summary -> generate phases with credential extraction.
    """
    project_id = req.get_project_id()
    notes = req.get_notes()
    phase = req.phase or "discovery"
    answers = req.get_answers()
    approved_ctx = req.get_approved_context()

    existing_context = ""
    existing_epics = req.get_existing_epics()
    existing_tasks = req.get_existing_tasks()
    if existing_epics or existing_tasks:
        existing_context = f"""
=== EXISTING PROJECT BLUEPRINT CONTEXT ===
Existing Epics:
{json.dumps(existing_epics, indent=2)}

Existing Staged Tasks:
{json.dumps([{"id": t.get("id"), "title": t.get("title"), "requiredRole": t.get("requiredRole"), "dependencies": t.get("dependencies")} for t in existing_tasks], indent=2)}
=========================================
"""

    llm = get_llm(temperature=0.2)

    try:
        if phase == "discovery":
            prompt = f"""You are Orion Spark, Lead Business Analyst at AgentForge.
Analyze this Business Requirements Document (BRD) / Project Prompt for Project '{project_id}'.

Document Title: {req.title}
Supplementary Notes: {notes}

=== BRD CONTENT ===
{req.content[:20000]}
===================

Identify the core functional scope and discover any ambiguities or required architectural clarifications.
Examine across these 12 categories:
1. Technology Stack & Frameworks
2. Database & Data Storage
3. Authentication & Authorization Strategy
4. Internal/External API Integrations (payment gateways, third-party services, mail)
5. Database & API Credentials (passwords, secret keys, API tokens)
6. Regulatory Compliance & Data Privacy (GDPR, HIPAA, SOC2)
7. Notification & Event Channels (Webhooks, Email, Push)
8. Error Handling, Retry Policies & Observability
9. Deployment Target & Infrastructure Scale
10. Multi-Tenancy Architecture
11. Data Retention & Archival Policies
12. API Versioning Strategy

Formulate 2 to 4 high-impact clarification questions for the human engineering director. Always provide smart selectable options and a sensible default recommendation.

Return ONLY a valid JSON object with:
{{
  "phase": "clarification",
  "executive_summary": "Concise 2-sentence overview of the initiative",
  "questions": [
    {{
      "id": "q1",
      "category": "Technology Stack",
      "question": "Which technology stack and database engine do you want to build this with?",
      "options": ["Go + PostgreSQL (Recommended)", "Python FastAPI + PostgreSQL", "Node.js (TypeScript) + PostgreSQL"],
      "defaultOption": "Go + PostgreSQL (Recommended)",
      "impact": "Sets foundational architecture, runtime containers, and database schema migrations."
    }}
  ]
}}
"""
            response = await llm.ainvoke([HumanMessage(content=prompt)])
            cleaned = strip_codeblock(extract_text(response.content))
            return JSONResponse(content=json.loads(cleaned))

        elif phase == "clarification":
            # Process answers and formulate confirmation summary
            prompt = f"""You are Orion Spark, Lead Business Analyst.
Review the user's clarification answers for the BRD initiative:

Document Title: {req.title}
BRD Content: {req.content[:15000]}
Human Director's Clarification Answers:
{json.dumps(answers, indent=2)}

Synthesize these answers into an Architecture & Operational Baseline summary before generating epics.
If the user skipped a question or requested to 'proceed for now', document a clear, safe STUB ASSUMPTION.

Return ONLY a valid JSON object:
{{
  "phase": "summary",
  "summary": {{
    "title": "Architecture & Operational Baseline",
    "executive_summary": "2-sentence executive summary based on confirmed requirements",
    "chosen_tech_stack": ["Go", "PostgreSQL", "React", "Docker"],
    "confirmed_decisions": [
      {{"category": "Technology Stack", "decision": "Go 1.22 + PostgreSQL 16"}},
      {{"category": "Authentication", "decision": "JWT with refresh token rotation"}}
    ],
    "stub_assumptions": [
      {{"category": "Database Credentials", "assumption": "Using local container database credentials until production secrets are provisioned"}}
    ]
  }}
}}
"""
            response = await llm.ainvoke([HumanMessage(content=prompt)])
            cleaned = strip_codeblock(extract_text(response.content))
            return JSONResponse(content=json.loads(cleaned))

        else: # phase == "generate" or direct fallback
            prompt = f"""You are Orion Spark (Lead BA) and Dr. Marcus Cole (Software Architect).
Generate the full functional Epics, acceptance criteria, engineering Task DAG, AND the required integration credentials manifest for Project '{project_id}'.

Document Title: {req.title}
Supplementary Notes: {notes}
Approved Baseline & Context:
{json.dumps(approved_ctx or answers, indent=2)}

=== SPECIFICATION / BRD CONTENT ===
{req.content[:20000]}
===================================
{existing_context}

CRITICAL:
1. Extract ALL necessary credentials (database passwords, API secrets, JWT keys, third-party tokens) into 'required_credentials'.
   Mark status as 'stub' if a standard local placeholder is expected, or 'pending' if it needs human confirmation before deployment.
2. Produce comprehensive Epics with Given/When/Then acceptance criteria.
3. Formulate the topologically ordered Task DAG.

Return ONLY a valid JSON object:
{{
  "phase": "completed",
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
  "tech_stack_recommendations": ["Go", "PostgreSQL", "React", "Docker"],
  "architectural_notes": [
    "Rule 1: ...",
    "Rule 2: ..."
  ],
  "required_credentials": [
    {{
      "name": "DATABASE_URL",
      "type": "env_var",
      "status": "stub",
      "description": "PostgreSQL database connection URI",
      "exampleValue": "postgres://agentforge:secret@localhost:5432/app",
      "isRequired": true,
      "integration": "PostgreSQL"
    }},
    {{
      "name": "JWT_SECRET",
      "type": "k8s_secret",
      "status": "pending",
      "description": "Secret key for signing JSON Web Tokens",
      "exampleValue": "secret-256-bit-key-placeholder",
      "isRequired": true,
      "integration": "Authentication"
    }}
  ],
  "proposed_tasks": [
    {{
      "id": "task-1-arch",
      "projectId": "{project_id}",
      "epicId": "EPIC-1",
      "title": "Architectural Specification & OpenAPI Contracts",
      "description": "Define data schemas, OpenAPI spec, and integration endpoints",
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
      "title": "Core Implementation & Migrations",
      "description": "Implement database migrations, repositories, and REST handlers (zero stubs)",
      "priority": "CRITICAL",
      "status": "WAITING",
      "requiredRole": "Senior Developer",
      "skills": ["Go", "PostgreSQL", "Clean Architecture"],
      "tools": ["read_file", "write_file", "run_command", "git_ops"],
      "dependencies": ["task-1-arch"],
      "requiresApproval": false
    }},
    {{
      "id": "task-3-qa",
      "projectId": "{project_id}",
      "title": "Automated Quality Assurance & SonarQube Verification",
      "description": "Execute unit, integration, and security smoke tests ensuring >= 80% coverage",
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
      "title": "Containerization & Kubernetes GitOps Release",
      "description": "Multi-stage Dockerfile packaging, Kustomize manifests, and GitHub PR",
      "priority": "CRITICAL",
      "status": "WAITING",
      "requiredRole": "DevOps Engineer",
      "skills": ["Docker", "Kubernetes", "GitOps"],
      "tools": ["run_command", "git_ops", "create_github_pr", "run_kubectl"],
      "dependencies": ["task-3-qa"],
      "requiresApproval": true
    }}
  ]
}}
"""
            response = await llm.ainvoke([HumanMessage(content=prompt)])
            cleaned = strip_codeblock(extract_text(response.content))
            return JSONResponse(content=json.loads(cleaned))

    except Exception as e:
        logger.error(f"Error analyzing BRD in phase '{phase}': {e}")
        return JSONResponse(content={"error": str(e), "phase": phase}, status_code=500)


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
        llm = get_llm(temperature=0.2)
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


class DebateRequest(BaseModel):
    session_id: str
    project_id: str
    topic: str
    proposer: str
    reviewer: str

@app.post("/api/agent/debate")
async def trigger_debate(req: DebateRequest, request: Request):
    secret = request.headers.get("x-internal-secret")
    if secret != INTERNAL_WEBHOOK_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized")
        
    logger.info(f"Starting debate session {req.session_id} between {req.proposer} and {req.reviewer} on {req.topic}")
    
    # In a real app we'd fetch prompts from the orchestrator.
    # For now, we mock basic personas for the test:
    proposer_prompt = f"You are {req.proposer}. Defend your code architecture against critiques."
    reviewer_prompt = f"You are {req.reviewer}. Critique the code robustly. Look for edge cases, security flaws, and performance bottlenecks."
    
    if req.reviewer == "agent-qa":
        reviewer_prompt = "You are the Lead QA Engineer. Critique the proposal for testability, edge cases, and robustness."
    
    state = DebateState(
        session_id=req.session_id,
        topic=req.topic,
        proposer_id=req.proposer,
        reviewer_id=req.reviewer,
        proposer_prompt=proposer_prompt,
        reviewer_prompt=reviewer_prompt,
        messages=[],
        turn_count=0,
        consensus_reached=False,
        backend_url=BACKEND_INTERNAL_URL,
        secret=INTERNAL_WEBHOOK_SECRET
    )
    
    graph = build_debate_graph()
    
    import asyncio
    # Run graph asynchronously in the background so we don't block the HTTP response
    async def run_graph(initial_state):
        try:
            await graph.ainvoke(initial_state)
            logger.info(f"Debate {req.session_id} finished")
        except Exception as e:
            logger.error(f"Debate failed: {e}")
            
    asyncio.create_task(run_graph(state))
    
    return {"status": "started"}
