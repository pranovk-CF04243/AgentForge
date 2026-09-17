import os
import base64
import time
import logging
from typing import Optional, Dict, Any

try:
    from github import Github, Auth, GithubIntegration
    PYGITHUB_AVAILABLE = True
except ImportError:
    PYGITHUB_AVAILABLE = False

logger = logging.getLogger("AgentForge.GitHubClient")


class GitHubAppClient:
    """
    Manages GitHub App authentication, branch management, and Pull Request creation.
    """

    def __init__(self):
        self.app_id = os.getenv("GITHUB_APP_ID")
        self.raw_private_key = os.getenv("GITHUB_APP_PRIVATE_KEY", "")
        self.webhook_secret = os.getenv("GITHUB_WEBHOOK_SECRET")
        self.private_key = self._decode_private_key(self.raw_private_key)
        self.default_repo = os.getenv("DEFAULT_GITHUB_REPO", "AgentForge/workspace")

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

    def get_app_client(self) -> Optional[Any]:
        if not PYGITHUB_AVAILABLE or not self.app_id or not self.private_key:
            return None
        try:
            auth = Auth.AppAuth(app_id=int(self.app_id), private_key=self.private_key)
            return Github(auth=auth)
        except Exception as e:
            logger.error(f"Error creating GitHub App client: {e}")
            return None

    def get_repo_client(self, repo_name: Optional[str] = None) -> Optional[Any]:
        if not PYGITHUB_AVAILABLE or not self.app_id or not self.private_key:
            return None
        target_repo = repo_name or self.default_repo
        try:
            auth = Auth.AppAuth(app_id=int(self.app_id), private_key=self.private_key)
            gi = GithubIntegration(auth=auth)
            # Find installation for repo
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

    def create_pull_request(
        self,
        title: str,
        body: str,
        head_branch: str,
        base_branch: str = "main",
        repo_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Creates a Pull Request in the target GitHub repository.
        """
        target_repo = repo_name or self.default_repo
        client = self.get_repo_client(target_repo)
        if not client:
            return {
                "success": False,
                "error": f"GitHub App credentials configured (App ID: {self.app_id}), but repository access token could not be obtained for {target_repo}.",
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
            return {
                "success": True,
                "pr_number": pr.number,
                "pr_url": pr.html_url,
                "title": pr.title,
            }
        except Exception as e:
            logger.error(f"Failed to create PR via GitHub API: {e}")
            return {
                "success": False,
                "error": str(e),
                "pr_url": f"https://github.com/{target_repo}/compare/{base_branch}...{head_branch}",
            }


github_client = GitHubAppClient()
