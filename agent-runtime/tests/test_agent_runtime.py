"""
Production Unit Tests for AgentForge Agent Runtime Tools & GitHub Client
"""

import os
import shutil
import tempfile
import unittest
from agent import RealToolRegistry
from github_client import GitHubAppClient


class TestRealToolRegistry(unittest.TestCase):
    def setUp(self):
        self.test_dir = tempfile.mkdtemp()
        self.registry = RealToolRegistry(workspace=self.test_dir)

    def tearDown(self):
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_run_command_success(self):
        res = self.registry.run_command("echo 'Hello AgentForge'")
        self.assertTrue(res["success"])
        self.assertEqual(res["exit_code"], 0)
        self.assertIn("Hello AgentForge", res["stdout"])

    def test_run_command_failure(self):
        res = self.registry.run_command("ls /path_that_definitely_does_not_exist_12345")
        self.assertFalse(res["success"])
        self.assertNotEqual(res["exit_code"], 0)

    def test_file_write_and_read(self):
        # Write
        write_res = self.registry.write_file("src/main.py", "print('AgentForge')\n")
        self.assertTrue(write_res["success"])
        self.assertEqual(write_res["filepath"], "src/main.py")

        # Read
        read_res = self.registry.read_file("src/main.py")
        self.assertTrue(read_res["success"])
        self.assertEqual(read_res["content"], "print('AgentForge')\n")

    def test_path_traversal_prevention(self):
        write_res = self.registry.write_file("../../etc/passwd", "evil")
        self.assertFalse(write_res["success"])
        self.assertIn("denied", write_res["error"].lower())

    def test_list_dir(self):
        self.registry.write_file("file1.txt", "1")
        self.registry.write_file("sub/file2.txt", "2")
        list_res = self.registry.list_dir(".")
        self.assertTrue(list_res["success"])
        names = [entry["name"] for entry in list_res["entries"]]
        self.assertIn("file1.txt", names)
        self.assertIn("sub", names)

    def test_git_branch_and_commit(self):
        # Create file and commit
        self.registry.write_file("service.go", "package main\n")
        branch_res = self.registry.git_ops("branch", branch="feature/agent-task-1")
        self.assertTrue(branch_res["success"])

        commit_res = self.registry.git_ops("commit", message="feat: add service.go")
        self.assertTrue(commit_res["success"])
        self.assertTrue(len(commit_res.get("commit_hash", "")) > 0)


class TestGitHubAppClient(unittest.TestCase):
    def setUp(self):
        self.client = GitHubAppClient()

    def test_private_key_decoding(self):
        # Test decoding base64 PEM key
        raw_key = os.getenv("GITHUB_APP_PRIVATE_KEY", "")
        if raw_key:
            decoded = self.client._decode_private_key(raw_key)
            self.assertTrue(decoded.startswith("-----BEGIN"))
            self.assertIn("PRIVATE KEY-----", decoded)

    def test_app_id_loaded(self):
        app_id = os.getenv("GITHUB_APP_ID")
        if app_id:
            self.assertEqual(self.client.app_id, app_id)


if __name__ == "__main__":
    unittest.main()
