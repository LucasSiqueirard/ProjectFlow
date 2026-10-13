import unittest

import pandas as pd

from analytics import calculate_metrics


class CalculateMetricsTests(unittest.TestCase):
    def test_calculates_lead_time_from_datetime_history(self) -> None:
        projects = pd.DataFrame([{"id": 1, "title": "Projeto"}])
        tasks = pd.DataFrame([{
            "id": 10,
            "projectId": 1,
            "status": "DONE",
            "completed": True,
            "createdAt": "2026-10-01T12:00:00Z",
        }])
        task_history = pd.DataFrame([{
            "taskId": 10,
            "status": "DONE",
            "changedAt": "2026-10-03T12:00:00Z",
        }])

        metrics = calculate_metrics(projects, tasks, task_history)

        self.assertEqual(metrics["averageLeadTimeDays"], 2.0)
        self.assertTrue(metrics["leadTimeDataAvailable"])
        self.assertEqual(metrics["averageLeadTimeByProject"][0]["completedTasksWithHistory"], 1)


if __name__ == "__main__":
    unittest.main()
