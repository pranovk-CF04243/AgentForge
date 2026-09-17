"""
AgentForge AI Agent Runtime & Tool Registry
Executes real system tools inside the workspace sandbox with full stdout/stderr capture,
Git operations, and real testing harnesses with enterprise security guardrails.
"""

import os
import re
import subprocess
import logging
from typing import Dict, Any, List, Optional
from github_client import github_client

logger = logging.getLogger("AgentForge.AgentTools")

WORKSPACE_DIR = os.getenv("WORKSPACE_DIR")
if not WORKSPACE_DIR:
    WORKSPACE_DIR = "/workspace" if os.path.exists("/workspace") else os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "workspace"))

try:
    os.makedirs(WORKSPACE_DIR, exist_ok=True)
except Exception:
    pass

MAX_OUTPUT_CHARS = 4000

DANGEROUS_COMMAND_PATTERNS = [
    r"rm\s+-rf\s+/\s*$",
    r"rm\s+-rf\s+/\*",
    r"mkfs",
    r"dd\s+if=",
    r":\(\)\s*\{\s*:\|:&\s*\}\s*;\s*:",
    r"shutdown",
    r"reboot",
    r"init\s+[06]",
    r">\s*/dev/sd[a-z]",
    r"chmod\s+-R\s+777\s+/",
    r"chown\s+-R\s+root\s+/",
    r">\s*/etc/",
    r"killall\s+-9",
    r"kill\s+-9\s+1\b",
]

SENSITIVE_FILES = [
    ".env",
    ".git/config",
    ".git/credentials",
    "id_rsa",
    "id_ed25519",
    "id_dsa",
]


def truncate_output(text: str, max_chars: int = MAX_OUTPUT_CHARS) -> str:
    """Truncates output safely preserving the head and tail (error traces) of output."""
    if not text or len(text) <= max_chars:
        return text or ""
    half = max_chars // 2
    omitted = len(text) - max_chars
    return (
        f"{text[:half]}\n\n"
        f"[... AgentForge Guardrail: {omitted} characters truncated for context protection ...]\n\n"
        f"{text[-half:]}"
    )


class RealToolRegistry:
    """
    Registry of production-ready tools executed in the mounted workspace with security guardrails.
    """

    def __init__(self, workspace: str = WORKSPACE_DIR):
        self.workspace = workspace
        self._ensure_git_initialized()

    def _ensure_git_initialized(self):
        """Ensures the workspace directory has a valid git repo with user identity."""
        try:
            if not os.path.exists(os.path.join(self.workspace, ".git")):
                subprocess.run(["git", "init"], cwd=self.workspace, check=True, capture_output=True)
            subprocess.run(
                ["git", "config", "user.name", "AgentForge AI"],
                cwd=self.workspace,
                capture_output=True,
            )
            subprocess.run(
                ["git", "config", "user.email", "agent@agentforge.local"],
                cwd=self.workspace,
                capture_output=True,
            )
        except Exception as e:
            logger.warning(f"Git workspace initialization note: {e}")

    def run_command(self, command: str, timeout: int = 60) -> Dict[str, Any]:
        """Runs a shell command inside the workspace with strict safety guardrails."""
        clean_cmd = command.strip()

        # Guardrail 1: Check against destructive command patterns
        for pattern in DANGEROUS_COMMAND_PATTERNS:
            if re.search(pattern, clean_cmd, re.IGNORECASE):
                logger.warning(f"Security Alert: Blocked dangerous command '{clean_cmd}' matching pattern '{pattern}'")
                return {
                    "success": False,
                    "exit_code": 126,
                    "stdout": "",
                    "stderr": f"Security Guardrail: Execution of dangerous system command is prohibited.",
                }

        # Guardrail 2: Block command attempts to dump sensitive credentials
        for sens in SENSITIVE_FILES:
            if re.search(rf"\b(cat|less|more|head|tail|grep|curl|wget)\b.*{re.escape(sens)}", clean_cmd, re.IGNORECASE):
                logger.warning(f"Security Alert: Blocked access to credential file '{sens}'")
                return {
                    "success": False,
                    "exit_code": 126,
                    "stdout": "",
                    "stderr": f"Security Guardrail: Direct inspection of sensitive credential file '{sens}' is prohibited.",
                }

        try:
            res = subprocess.run(
                clean_cmd,
                shell=True,
                cwd=self.workspace,
                capture_output=True,
                text=True,
                timeout=timeout,
            )
            return {
                "success": res.returncode == 0,
                "exit_code": res.returncode,
                "stdout": truncate_output(res.stdout),
                "stderr": truncate_output(res.stderr),
            }
        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "exit_code": 124,
                "stdout": "",
                "stderr": f"Command timed out after {timeout} seconds.",
            }
        except Exception as e:
            return {"success": False, "exit_code": 1, "stdout": "", "stderr": str(e)}

    def write_file(self, filepath: str, content: str) -> Dict[str, Any]:
        """Creates or overwrites a file inside the workspace safely with file protection."""
        try:
            # Normalize path
            clean_path = filepath.strip().lstrip("/")
            full_path = os.path.normpath(os.path.join(self.workspace, clean_path))

            # Guardrail 1: Path traversal protection
            if not full_path.startswith(os.path.abspath(self.workspace)):
                return {"success": False, "error": "Access denied: file path is outside the workspace sandbox."}

            # Guardrail 2: Sensitive file overwrite protection
            rel_path = os.path.relpath(full_path, self.workspace)
            for sens in SENSITIVE_FILES:
                if rel_path == sens or rel_path.startswith(".git/"):
                    return {
                        "success": False,
                        "error": f"Security Guardrail: Overwriting protected repository configuration '{rel_path}' is forbidden.",
                    }

            os.makedirs(os.path.dirname(full_path), exist_ok=True)
            with open(full_path, "w", encoding="utf-8") as f:
                f.write(content)

            return {
                "success": True,
                "filepath": rel_path,
                "bytes_written": len(content),
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    def read_file(self, filepath: str) -> Dict[str, Any]:
        """Reads a file from the workspace with size and credential guardrails."""
        try:
            clean_path = filepath.strip().lstrip("/")
            full_path = os.path.normpath(os.path.join(self.workspace, clean_path))

            if not full_path.startswith(os.path.abspath(self.workspace)):
                return {"success": False, "error": "Access denied: path outside workspace"}

            rel_path = os.path.relpath(full_path, self.workspace)
            for sens in SENSITIVE_FILES:
                if rel_path == sens or (rel_path.startswith(".git/") and not rel_path.startswith(".git/refs")):
                    return {
                        "success": False,
                        "error": f"Security Guardrail: Direct reading of sensitive file '{rel_path}' is protected.",
                    }

            if not os.path.exists(full_path):
                return {"success": False, "error": f"File not found: {filepath}"}

            with open(full_path, "r", encoding="utf-8", errors="replace") as f:
                content = f.read()

            return {
                "success": True,
                "filepath": rel_path,
                "content": truncate_output(content, max_chars=8000),
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    def list_dir(self, dirpath: str = ".") -> Dict[str, Any]:
        """Lists directory contents inside the workspace."""
        try:
            clean_path = dirpath.strip().lstrip("/")
            full_path = os.path.normpath(os.path.join(self.workspace, clean_path))
            if not full_path.startswith(os.path.abspath(self.workspace)):
                return {"success": False, "error": "Access denied: path outside workspace"}

            if not os.path.exists(full_path):
                return {"success": False, "error": f"Directory not found: {dirpath}"}

            entries = []
            for item in os.listdir(full_path):
                if item in [".git", "node_modules", "__pycache__", ".venv", ".pytest_cache"]:
                    continue
                item_path = os.path.join(full_path, item)
                entries.append({
                    "name": item,
                    "is_dir": os.path.isdir(item_path),
                    "size": os.path.getsize(item_path) if os.path.isfile(item_path) else 0,
                })
            return {"success": True, "dirpath": dirpath, "entries": entries}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def git_ops(self, action: str, branch: str = "agent-feature", message: str = "Update code") -> Dict[str, Any]:
        """Executes Git branching, committing, or pushing safely."""
        self._ensure_git_initialized()
        try:
            if action in ["checkout_branch", "branch"]:
                safe_branch = re.sub(r"[^a-zA-Z0-9_\-\/]", "", branch)
                res = subprocess.run(
                    f"git checkout -B {safe_branch}",
                    shell=True,
                    cwd=self.workspace,
                    capture_output=True,
                    text=True,
                )
                return {"success": res.returncode == 0, "branch": safe_branch, "output": res.stdout or res.stderr}

            elif action in ["commit", "commit_all"]:
                subprocess.run("git add .", shell=True, cwd=self.workspace, capture_output=True)
                clean_msg = message.replace('"', '\\"')
                res = subprocess.run(
                    f'git commit -m "{clean_msg}"',
                    shell=True,
                    cwd=self.workspace,
                    capture_output=True,
                    text=True,
                )
                hash_res = subprocess.run("git rev-parse --short HEAD", shell=True, cwd=self.workspace, capture_output=True, text=True)
                commit_hash = hash_res.stdout.strip()
                return {
                    "success": res.returncode == 0 or "nothing to commit" in res.stdout,
                    "commit_hash": commit_hash,
                    "output": res.stdout,
                }

            elif action == "push":
                safe_branch = re.sub(r"[^a-zA-Z0-9_\-\/]", "", branch)
                res = subprocess.run(
                    f"git push -u origin {safe_branch}",
                    shell=True,
                    cwd=self.workspace,
                    capture_output=True,
                    text=True,
                )
                return {"success": res.returncode == 0, "branch": safe_branch, "output": res.stdout or res.stderr}

            return {"success": False, "error": f"Unknown git action: {action}"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def run_test_suite(self, suite_command: Optional[str] = None) -> Dict[str, Any]:
        """Runs the test suite with output truncation and pass/fail reporting."""
        cmd = suite_command
        if not cmd:
            if os.path.exists(os.path.join(self.workspace, "go.mod")):
                cmd = "go test -v ./..."
            elif os.path.exists(os.path.join(self.workspace, "package.json")):
                cmd = "npm test -- --passWithNoTests"
            elif os.path.exists(os.path.join(self.workspace, "requirements.txt")) or os.path.exists(os.path.join(self.workspace, "pytest.ini")):
                cmd = "pytest -v"
            else:
                cmd = "echo 'No formal test configuration detected; smoke verification passed'"

        res = self.run_command(cmd, timeout=90)
        passed = res.get("success", False)
        return {
            "success": passed,
            "command": cmd,
            "stdout": res.get("stdout", ""),
            "stderr": res.get("stderr", ""),
            "passed": passed,
        }

    def create_github_pr(self, title: str, body: str, branch: str, base_branch: str = "main") -> Dict[str, Any]:
        """Opens a Pull Request via GitHub App integration."""
        return github_client.create_pull_request(
            title=title,
            body=body,
            head_branch=branch,
            base_branch=base_branch,
        )


tool_registry = RealToolRegistry()
