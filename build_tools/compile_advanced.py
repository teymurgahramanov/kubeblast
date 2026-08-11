from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

PROTECTED_MODULES = {
    "license_check.py": ".",
    "services/jobs_extra.py": "services",
    "services/ldap_auth.py": "services",
    "services/oidc_auth.py": "services",
    "services/pats.py": "services",
    "services/users.py": "services",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Compile the private Advanced overlay with Nuitka."
    )
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--temp", type=Path, required=True)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    source_root = args.source.resolve()
    output_root = args.output.resolve()
    temp_root = args.temp.resolve()

    missing = [
        relative_path
        for relative_path in PROTECTED_MODULES
        if not (source_root / relative_path).is_file()
    ]
    if missing:
        raise FileNotFoundError(f"Missing protected modules: {', '.join(missing)}")

    temp_root.mkdir(parents=True, exist_ok=True)
    for relative_path, output_subdirectory in PROTECTED_MODULES.items():
        module_output = output_root / output_subdirectory
        module_output.mkdir(parents=True, exist_ok=True)
        subprocess.run(
            [
                sys.executable,
                "-m",
                "nuitka",
                "--mode=module",
                "--nofollow-imports",
                "--python-flag=no_docstrings",
                "--no-pyi-file",
                "--remove-output",
                "--jobs=2",
                f"--output-dir={module_output}",
                str(source_root / relative_path),
            ],
            cwd=temp_root,
            check=True,
        )


if __name__ == "__main__":
    main()
