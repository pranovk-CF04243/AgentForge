import os
import re
import base64
import time
import logging
from typing import Optional, Dict, Any

try:
    from github import Github, Auth, GithubIntegration, GithubException
    PYGITHUB_AVAILABLE = True
except ImportError:
    PYGITHUB_AVAILABLE = False

logger = logging.getLogger("AgentForge.GitHubClient")


class GitHubAppClient:
    """
    Manages GitHub authentication, automatic dedicated repository provisioning,
    branch management, and Pull Request creation for isolated projects.
    """

    def __init__(self):
        self.app_id = os.getenv("GITHUB_APP_ID")
        self.raw_private_key = os.getenv("GITHUB_APP_PRIVATE_KEY", "")
        self.webhook_secret = os.getenv("GITHUB_WEBHOOK_SECRET")
        self.private_key = self._decode_private_key(self.raw_private_key)
        self.token = os.getenv("GITHUB_TOKEN", "").strip()
        self.default_repo = os.getenv("DEFAULT_GITHUB_REPO", "pranovk-CF04243/AgentForge")

    def _decode_private_key(self, raw_key: str) -> str:
        """Decodes base64-encoded RSA PEM key if necessary."""
        if not raw_key:
            return ""
        raw_key = raw_key.strip()
        if raw_key.startswith("-----BEGIN"):
            return raw_key
        try:
            decoded = base64.b64decode(raw_key).decode("utf-8")
            return decoded
        except Exception as e:
            logger.warning(f"Failed to base64 decode private key directly: {e}")
            return raw_key

    def slugify_repo_name(self, project_name: str) -> str:
        """Derives a clean, valid GitHub repository name from a project title."""
        if not project_name:
            return "agentforge-project"
        slug = re.sub(r"[^a-zA-Z0-9\-_\.]", "-", project_name.strip().lower())
        slug = re.sub(r"-+", "-", slug).strip("-")
        if not slug or slug in ["agentforge", "agentforge-platform"]:
            slug = f"agentforge-{slug or 'project'}-{int(time.time()) % 10000}"
        return slug

    def get_authenticated_user_login(self) -> Optional[str]:
        """Gets the GitHub login for the authenticated token or app."""
        token = os.getenv("GITHUB_TOKEN") or self.token
        if not token or not PYGITHUB_AVAILABLE:
            return None
        try:
            gh = Github(auth=Auth.Token(token))
            return gh.get_user().login
        except Exception as e:
            logger.warning(f"Failed to fetch user login: {e}")
            return None

    def get_repo_client(self, repo_name: Optional[str] = None) -> Optional[Any]:
        if not PYGITHUB_AVAILABLE:
            return None
        target_repo = repo_name or self.default_repo
        token = os.getenv("GITHUB_TOKEN") or self.token
        if token:
            try:
                return Github(auth=Auth.Token(token))
            except Exception as e:
                logger.warning(f"Failed to authenticate with GITHUB_TOKEN: {e}")

        if not self.app_id or not self.private_key:
            return None
        try:
            auth = Auth.AppAuth(app_id=int(self.app_id), private_key=self.private_key)
            gi = GithubIntegration(auth=auth)
            owner = target_repo.split("/")[0] if "/" in target_repo else ""
            installations = gi.get_installations()
            inst_id = None
            for inst in installations:
                if inst.account.get("login", "").lower() == owner.lower():
                    inst_id = inst.id
                    break
            if not inst_id and installations.totalCount > 0:
                inst_id = installations[0].id

            if inst_id:
                inst_auth = gi.get_access_token(inst_id)
                return Github(auth=Auth.Token(inst_auth.token))
            return None
        except Exception as e:
            logger.warning(f"Could not authenticate installation for repo {target_repo}: {e}")
            return None

    def ensure_repository(
        self,
        project_name: str,
        repo_name_override: Optional[str] = None,
        description: str = "",
        private: bool = True,
    ) -> Dict[str, Any]:
        """
        Ensures a dedicated GitHub repository exists for the project.
        If it does not exist, automatically creates it under the authenticated user account with auto_init=True.
        """
        token = os.getenv("GITHUB_TOKEN") or self.token
        if not token or not PYGITHUB_AVAILABLE:
            slug = self.slugify_repo_name(project_name)
            sim_full = f"local-workspace/{slug}"
            return {
                "success": False,
                "error": "PyGithub or GITHUB_TOKEN unavailable for automatic provisioning.",
                "repo_name": slug,
                "full_name": sim_full,
                "html_url": f"https://github.com/{sim_full}",
                "clone_url": "",
                "default_branch": "main",
            }

        try:
            gh = Github(auth=Auth.Token(token))
            user = gh.get_user()
            user_login = user.login

            target_slug = ""
            if repo_name_override:
                clean = repo_name_override.strip()
                if clean.startswith("http://") or clean.startswith("https://"):
                    parts = clean.rstrip("/").removesuffix(".git").split("/")
                    if len(parts) >= 2:
                        target_slug = parts[-1]
                elif "/" in clean:
                    target_slug = clean.split("/")[-1]
                else:
                    target_slug = clean

            if not target_slug:
                target_slug = self.slugify_repo_name(project_name)

            # Check if repository already exists
            repo = None
            try:
                repo = user.get_repo(target_slug)
                logger.info(f"Dedicated GitHub repo '{repo.full_name}' already exists.")
            except GithubException as ge:
                if ge.status == 404:
                    logger.info(f"Provisioning NEW dedicated GitHub repository '{user_login}/{target_slug}'...")
                    repo = user.create_repo(
                        name=target_slug,
                        description=description or f"Dedicated software repository for '{project_name}' provisioned by AgentForge.",
                        private=private,
                        auto_init=True,
                    )
                    logger.info(f"Successfully provisioned dedicated repository '{repo.full_name}' ({repo.html_url})")
                else:
                    raise ge

            auth_clone_url = f"https://x-access-token:{token}@github.com/{repo.full_name}.git"

            return {
                "success": True,
                "repo_name": repo.name,
                "full_name": repo.full_name,
                "html_url": repo.html_url,
                "clone_url": auth_clone_url,
                "default_branch": repo.default_branch or "main",
            }

        except Exception as e:
            logger.error(f"Failed to ensure dedicated GitHub repository for '{project_name}': {e}")
            fallback_slug = self.slugify_repo_name(project_name)
            return {
                "success": False,
                "error": str(e),
                "repo_name": fallback_slug,
                "full_name": f"{self.get_authenticated_user_login() or 'user'}/{fallback_slug}",
                "html_url": f"https://github.com/{self.get_authenticated_user_login() or 'user'}/{fallback_slug}",
                "clone_url": "",
                "default_branch": "main",
            }

    def create_pull_request(
        self,
        title: str,
        body: str,
        head_branch: str,
        base_branch: str = "main",
        repo_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Creates a Pull Request in the target dedicated GitHub repository.
        """
        target_repo = repo_name or self.default_repo
        if target_repo.startswith("https://github.com/"):
            target_repo = target_repo.replace("https://github.com/", "").rstrip("/").removesuffix(".git")

        client = self.get_repo_client(target_repo)
        if not client:
            return {
                "success": False,
                "error": f"Repository client could not be obtained for {target_repo}.",
                "pr_url": f"https://github.com/{target_repo}/pull/new/{head_branch}",
                "simulated": True,
            }

        try:
            repo = client.get_repo(target_repo)
            pr = repo.create_pull(
                title=title,
                body=body,
                head=head_branch,
                base=base_branch,
            )
            logger.info(f"Opened Pull Request #{pr.number} on '{target_repo}': {pr.html_url}")
            return {
                "success": True,
                "pr_number": pr.number,
                "pr_url": pr.html_url,
                "title": pr.title,
            }
        except Exception as e:
            logger.error(f"Failed to create PR via GitHub API on '{target_repo}': {e}")
            return {
                "success": False,
                "error": str(e),
                "pr_url": f"https://github.com/{target_repo}/compare/{base_branch}...{head_branch}",
            }


github_client = GitHubAppClient()
