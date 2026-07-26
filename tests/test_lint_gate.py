"""Regression coverage for the pre-deployment GenVM lint gate."""

import os
from pathlib import Path
import subprocess


def test_genvm_lint_gate_passes_for_both_contracts():
    root = Path(__file__).resolve().parents[1]
    env = os.environ.copy()
    env["PYTHONUTF8"] = "1"

    result = subprocess.run(
        [
            "powershell",
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            str(root / "scripts" / "lint.ps1"),
        ],
        cwd=root,
        env=env,
        capture_output=True,
        text=True,
        timeout=120,
    )

    assert result.returncode == 0, result.stdout + result.stderr
    assert result.stdout.count("Validation passed") == 2
