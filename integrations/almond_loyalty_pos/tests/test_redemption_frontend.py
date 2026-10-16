"""Run the real-source frontend outcome checks in the existing POS gate."""
import shutil
import subprocess
import unittest
from pathlib import Path


class TestFrontendContract(unittest.TestCase):
    def test_redemption_frontend_outcomes(self):
        node = shutil.which("node")
        self.assertIsNotNone(node, "Node is required by the repository gate")
        result = subprocess.run([node, "--test", str(Path(__file__).with_name("redemption_frontend.test.mjs"))],
                                capture_output=True, text=True, timeout=20, check=False)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
