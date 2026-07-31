from __future__ import annotations

import base64
import json
from datetime import datetime, timezone
from typing import Any, Callable
from urllib.error import HTTPError
from urllib.parse import quote
from urllib.request import Request, urlopen

from market_workbench.excel_store import ExcelStore


LEDGER_SNAPSHOT_PATH = "ledger/market_workbench_snapshot.json"
Opener = Callable[[Request], Any]


def _is_active_project(project: dict[str, object]) -> bool:
    status = str(project.get("记录状态", "") or "").strip()
    return status in {"", "正常"}


def build_ledger_snapshot(store: ExcelStore) -> dict[str, object]:
    """Create the private GitHub representation of the local workbook."""
    projects = [project for project in store.list_projects() if _is_active_project(project)]
    active_project_ids = {
        str(project.get("project_id", "")).strip()
        for project in projects
        if str(project.get("project_id", "")).strip()
    }
    project_details: dict[str, dict[str, object]] = {}
    for project in projects:
        project_id = str(project.get("project_id", "")).strip()
        if not project_id:
            continue
        project_details[project_id] = {
            "sensitive": store.get_sensitive(project_id),
            "detail": store.get_project_detail(project_id),
            "structured": store.get_project_structured_detail(project_id),
        }
    return {
        "schema_version": 1,
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "projects": projects,
        "project_details": project_details,
        "weekly_imports": store.list_weekly_imports(),
        "progress_records": [
            record
            for record in store.list_progress_records()
            if str(record.get("project_id", "")).strip() in active_project_ids
        ],
    }


def _headers(token: str) -> dict[str, str]:
    return {
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {token}",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json; charset=utf-8",
    }


def _read_existing_sha(url: str, headers: dict[str, str], opener: Opener) -> str:
    try:
        with opener(Request(url, headers=headers)) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        if error.code == 404:
            return ""
        raise
    return str(payload.get("sha", ""))


def upload_ledger_snapshot(
    snapshot: dict[str, object],
    *,
    owner: str,
    repo: str,
    branch: str,
    token: str,
    opener: Opener = urlopen,
) -> dict[str, str]:
    """Store a snapshot in a private GitHub data repository."""
    base_url = f"https://api.github.com/repos/{quote(owner, safe='')}/{quote(repo, safe='')}"
    headers = _headers(token)
    with opener(Request(base_url, headers=headers)) as response:
        repository = json.loads(response.read().decode("utf-8"))
    if not repository.get("private", False):
        raise ValueError("台账快照只能上传到私有 GitHub 仓库。")

    path = quote(LEDGER_SNAPSHOT_PATH, safe="/")
    content_url = f"{base_url}/contents/{path}?ref={quote(branch, safe='')}"
    sha = _read_existing_sha(content_url, headers, opener)
    raw = json.dumps(snapshot, ensure_ascii=False, indent=2).encode("utf-8")
    payload: dict[str, str] = {
        "message": f"chore: update market ledger snapshot ({snapshot.get('generated_at', '')})",
        "content": base64.b64encode(raw).decode("ascii"),
        "branch": branch,
    }
    if sha:
        payload["sha"] = sha
    request = Request(
        f"{base_url}/contents/{path}",
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="PUT",
    )
    with opener(request) as response:
        result = json.loads(response.read().decode("utf-8"))
    content = result.get("content", {}) if isinstance(result, dict) else {}
    return {
        "path": LEDGER_SNAPSHOT_PATH,
        "sha": str(content.get("sha", "")),
        "commit": str((result.get("commit", {}) or {}).get("sha", "")),
    }
