import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { forkJoin, map, Observable } from 'rxjs';

export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'DONE';
export type TaskPriority = 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
export interface Project { id: number; title: string; description: string | null; }
export interface Task { id: number; title: string; description: string | null; projectId: number; completed: boolean; status: TaskStatus; priority: TaskPriority; dueDate: string | null; createdAt: string; }
export interface TaskHistoryEntry { id: number; taskId: number; previousStatus: TaskStatus | null; status: TaskStatus; changedAt: string; }
export interface ProjectPayload { title: string; description: string; }
export interface AnalyticsMetricRow { status: string; label: string; count: number; percentage: number; }
export interface AnalyticsProjectMetric { projectId: number; projectTitle: string; taskCount: number; completedTaskCount: number; completionRatePercent: number; }
export interface AnalyticsLeadMetric { projectId: number; projectTitle: string; averageLeadTimeDays: number | null; completedTasksWithHistory: number; }
export interface AnalyticsMetrics {
  generatedAt: string;
  completionRateByProject: AnalyticsProjectMetric[];
  taskDistribution: AnalyticsMetricRow[];
  averageLeadTimeDays: number | null;
  averageLeadTimeByProject: AnalyticsLeadMetric[];
  leadTimeDataAvailable: boolean;
  leadTimeNote: string | null;
}
interface ApiTask extends Omit<Task, 'status' | 'priority' | 'description' | 'dueDate'> { description?: string | null; status?: TaskStatus; priority?: TaskPriority; dueDate?: string | null; }

@Injectable({ providedIn: 'root' })
export class ProjectFlowApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'http://localhost:3000';

  loadDashboard(): Observable<{ projects: Project[]; tasks: Task[] }> {
    return forkJoin({ projects: this.http.get<Project[]>(`${this.baseUrl}/projects`), tasks: this.http.get<ApiTask[]>(`${this.baseUrl}/tasks`) })
      .pipe(map(({ projects, tasks }) => ({ projects, tasks: tasks.map((task) => this.normalizeTask(task)) })));
  }
  loadAnalytics(): Observable<AnalyticsMetrics> { return this.http.get<AnalyticsMetrics>(`${this.baseUrl}/analytics`); }
  loadTaskHistory(id: number): Observable<TaskHistoryEntry[]> {
    return this.http.get<TaskHistoryEntry[]>(`${this.baseUrl}/tasks/${id}/history`);
  }
  createProject(payload: ProjectPayload): Observable<Project> { return this.http.post<Project>(`${this.baseUrl}/projects`, payload); }
  updateProject(id: number, payload: ProjectPayload): Observable<Project> { return this.http.put<Project>(`${this.baseUrl}/projects/${id}`, payload); }
  deleteProject(id: number): Observable<void> { return this.http.delete<void>(`${this.baseUrl}/projects/${id}`); }
  createTask(payload: { title: string; projectId: number; dueDate?: string | null }): Observable<Task> {
    return this.http.post<ApiTask>(`${this.baseUrl}/tasks`, payload).pipe(map((task) => this.normalizeTask(task)));
  }
  updateTask(id: number, payload: { title?: string; description?: string | null; status?: TaskStatus; priority?: TaskPriority; dueDate?: string | null }): Observable<Task> {
    return this.http.patch<ApiTask>(`${this.baseUrl}/tasks/${id}`, payload).pipe(map((task) => this.normalizeTask(task)));
  }
  updateTaskStatus(id: number, status: TaskStatus): Observable<Task> {
    return this.updateTask(id, { status });
  }
  deleteTask(id: number): Observable<void> { return this.http.delete<void>(`${this.baseUrl}/tasks/${id}`); }
  private normalizeTask(task: ApiTask): Task {
    return {
      ...task,
      description: task.description ?? null,
      status: task.status ?? (task.completed ? 'DONE' : 'PENDING'),
      priority: task.priority ?? 'MEDIUM',
      dueDate: task.dueDate ? task.dueDate.slice(0, 10) : null,
    };
  }
}