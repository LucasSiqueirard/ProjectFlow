"""Gera métricas de produtividade do ProjectFlow a partir do PostgreSQL."""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd
from dotenv import load_dotenv
from sqlalchemy import create_engine, inspect, make_url, text


STATUS_LABELS = {
    "PENDING": "Pendente",
    "IN_PROGRESS": "Em andamento",
    "DONE": "Concluído",
}


def normalize_status(value: Any, completed: Any = False) -> str:
    """Normaliza o status da tarefa e usa completed como compatibilidade legada."""
    if pd.isna(value) or not str(value).strip():
        is_completed = False if pd.isna(completed) else bool(completed)
        return "DONE" if is_completed else "PENDING"

    status = str(value).strip().upper()
    aliases = {
        "PENDENTE": "PENDING",
        "EM_ANDAMENTO": "IN_PROGRESS",
        "IN PROGRESS": "IN_PROGRESS",
        "CONCLUIDO": "DONE",
        "CONCLUÍDO": "DONE",
        "COMPLETED": "DONE",
    }
    return aliases.get(status, status)


def _history_columns(history: pd.DataFrame) -> tuple[str, str, str] | None:
    """Localiza os campos de tarefa, status resultante e data na tabela de histórico."""
    candidates = {
        "task_id": ("taskId", "task_id"),
        "status": ("status", "toStatus", "to_status", "newStatus", "new_status"),
        "changed_at": ("changedAt", "changed_at", "createdAt", "created_at", "timestamp", "occurredAt"),
    }
    columns = set(history.columns)
    found = [next((name for name in names if name in columns), None) for names in candidates.values()]
    return tuple(found) if all(found) else None  # type: ignore[return-value]


def calculate_metrics(
    projects: pd.DataFrame,
    tasks: pd.DataFrame,
    task_history: pd.DataFrame,
    history_table_exists: bool = True,
) -> dict[str, Any]:
    """Calcula conclusão, distribuição por status e lead time baseado no histórico."""
    tasks = tasks.copy()
    if tasks.empty:
        tasks = pd.DataFrame(columns=["id", "projectId", "status", "completed", "createdAt"])

    tasks["normalizedStatus"] = [
        normalize_status(row.get("status"), row.get("completed", False))
        for _, row in tasks.iterrows()
    ]
    tasks["isCompleted"] = tasks["normalizedStatus"].eq("DONE")

    counts_by_project = tasks.groupby("projectId").agg(
        taskCount=("id", "count"),
        completedTaskCount=("isCompleted", "sum"),
    )
    completion_by_project = []
    for project in projects.to_dict(orient="records"):
        project_id = project["id"]
        counts = counts_by_project.loc[project_id] if project_id in counts_by_project.index else None
        task_count = int(counts["taskCount"]) if counts is not None else 0
        completed_count = int(counts["completedTaskCount"]) if counts is not None else 0
        completion_by_project.append({
            "projectId": int(project_id),
            "projectTitle": project["title"],
            "taskCount": task_count,
            "completedTaskCount": completed_count,
            "completionRatePercent": round(completed_count / task_count * 100, 2) if task_count else 0.0,
        })

    task_count = len(tasks)
    distribution = []
    for status, label in STATUS_LABELS.items():
        count = int(tasks["normalizedStatus"].eq(status).sum())
        distribution.append({
            "status": status,
            "label": label,
            "count": count,
            "percentage": round(count / task_count * 100, 2) if task_count else 0.0,
        })

    history_note = None
    lead_times = pd.DataFrame(columns=["taskId", "projectId", "leadTimeDays"])
    if not history_table_exists:
        history_note = 'A tabela "TaskHistory" não existe no banco.'
    else:
        columns = _history_columns(task_history)
        if columns is None:
            history_note = (
                'TaskHistory precisa conter taskId, status (ou toStatus/newStatus) e '
                'changedAt (ou createdAt/timestamp).'
            )
        elif not task_history.empty:
            task_id_column, status_column, time_column = columns
            events = task_history[[task_id_column, status_column, time_column]].copy()
            events["normalizedStatus"] = events[status_column].map(normalize_status)
            events["eventTime"] = pd.to_datetime(events[time_column], errors="coerce", utc=True)
            completion_events = events.loc[events["normalizedStatus"].eq("DONE")].dropna(subset=["eventTime"])
            completion_events = completion_events.groupby(task_id_column)["eventTime"].max()

            completed_tasks = tasks.loc[tasks["isCompleted"]].copy()
            completed_tasks["createdTime"] = pd.to_datetime(completed_tasks["createdAt"], errors="coerce", utc=True)
            completed_tasks["completedTime"] = completed_tasks["id"].map(completion_events)
            completed_tasks = completed_tasks.dropna(subset=["createdTime", "completedTime"])
            completed_tasks["leadTimeDays"] = (
                completed_tasks["completedTime"] - completed_tasks["createdTime"]
            ).dt.total_seconds() / 86400
            completed_tasks = completed_tasks.loc[completed_tasks["leadTimeDays"] >= 0]
            lead_times = completed_tasks[["id", "projectId", "leadTimeDays"]].rename(columns={"id": "taskId"})

    if lead_times.empty and history_note is None:
        history_note = "Ainda não há tarefas concluídas com eventos de histórico válidos."

    average_lead_time = round(float(lead_times["leadTimeDays"].mean()), 2) if not lead_times.empty else None
    average_lead_time_by_project = []
    for project in projects.to_dict(orient="records"):
        project_times = lead_times.loc[lead_times["projectId"].eq(project["id"]), "leadTimeDays"]
        average_lead_time_by_project.append({
            "projectId": int(project["id"]),
            "projectTitle": project["title"],
            "averageLeadTimeDays": round(float(project_times.mean()), 2) if not project_times.empty else None,
            "completedTasksWithHistory": int(project_times.count()),
        })

    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "completionRateByProject": completion_by_project,
        "taskDistribution": distribution,
        "averageLeadTimeDays": average_lead_time,
        "averageLeadTimeByProject": average_lead_time_by_project,
        "leadTimeDataAvailable": average_lead_time is not None,
        "leadTimeNote": history_note,
    }


def load_data(engine: Any) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, bool]:
    """Carrega as tabelas Prisma usando os nomes sensíveis a maiúsculas do PostgreSQL."""
    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())
    for required_table in ("Project", "Task"):
        if required_table not in table_names:
            raise RuntimeError(f'A tabela obrigatória "{required_table}" não foi encontrada.')

    with engine.connect() as connection:
        projects = pd.read_sql(text('SELECT * FROM "Project"'), connection)
        tasks = pd.read_sql(text('SELECT * FROM "Task"'), connection)
        history_exists = "TaskHistory" in table_names
        history = (
            pd.read_sql(text('SELECT * FROM "TaskHistory"'), connection)
            if history_exists
            else pd.DataFrame()
        )
    return projects, tasks, history, history_exists


def export_metrics(metrics: dict[str, Any], output_path: Path) -> None:
    """Grava JSON UTF-8 para consumo futuro pela API ou pelo frontend."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as output_file:
        json.dump(metrics, output_file, ensure_ascii=False, indent=2, allow_nan=False)
        output_file.write("\n")


def main() -> None:
    backend_dir = Path(__file__).resolve().parent
    load_dotenv(backend_dir / ".env")
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("Defina DATABASE_URL no arquivo backend/.env antes de executar o analytics.")

    database_url_config = make_url(database_url)
    connection_options = dict(database_url_config.query)
    connection_options.pop("schema", None)
    engine = create_engine(database_url_config.set(query=connection_options))
    try:
        projects, tasks, history, history_exists = load_data(engine)
        metrics = calculate_metrics(projects, tasks, history, history_exists)
        output_path = Path(os.getenv("ANALYTICS_OUTPUT", backend_dir / "metrics.json"))
        if not output_path.is_absolute():
            output_path = backend_dir / output_path
        export_metrics(metrics, output_path)
        print(json.dumps(metrics, ensure_ascii=False, indent=2, allow_nan=False))
        print(f"\nMétricas exportadas para: {output_path}")
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()