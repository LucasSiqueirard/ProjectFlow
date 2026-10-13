import { Component, computed, inject, OnInit, PLATFORM_ID, signal, WritableSignal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDragPlaceholder, CdkDropList, CdkDropListGroup, moveItemInArray } from '@angular/cdk/drag-drop';
import { isPlatformBrowser } from '@angular/common';
import { ProjectForm, ProjectPayload } from './project-form';
import { AnalyticsMetrics, ProjectFlowApi, Project, Task, TaskPriority, TaskStatus } from './project-flow-api';
import { TaskDetailsModal } from './task-details-modal';
import { calculateTaskSla, filterTasks, TaskSlaFilter } from './task-sla';
import { buildTaskReportCsv } from './task-report';

@Component({
  selector: 'app-root',
  imports: [FormsModule, ProjectForm, TaskDetailsModal, CdkDropListGroup, CdkDropList, CdkDrag, CdkDragHandle, CdkDragPlaceholder],
  templateUrl: './app.html',
})
export class App implements OnInit {
  private readonly api = inject(ProjectFlowApi);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  readonly projects = signal<Project[]>([]);
  readonly tasks = signal<Task[]>([]);
  readonly pendingTasks = signal<Task[]>([]);
  readonly inProgressTasks = signal<Task[]>([]);
  readonly doneTasks = signal<Task[]>([]);
  readonly selectedProjectId = signal<number | null>(null);
  readonly projectForm = signal<Project | null | undefined>(undefined);
  readonly selectedTask = signal<Task | null>(null);
  readonly taskTitle = signal('');
  readonly errorMessage = signal('');
  readonly successMessage = signal('');
  readonly isLoading = signal(true);
  readonly isSavingTask = signal(false);
  readonly savingTaskStatusIds = signal<Set<number>>(new Set());
  readonly analytics = signal<AnalyticsMetrics | null>(null);
  readonly analyticsLoading = signal(false);
  readonly currentView = signal<'board' | 'analytics'>('board');
  readonly slaFilter = signal<TaskSlaFilter>('ALL');
  readonly priorityFilter = signal<TaskPriority | 'ALL'>('ALL');
  readonly selectedProject = computed(() => this.projects().find((project) => project.id === this.selectedProjectId()) ?? null);
  readonly projectTasks = computed(() => this.tasks().filter((task) => task.projectId === this.selectedProjectId()));
  readonly filteredTasksByStatus = computed(() => {
    const filteredTasks = filterTasks(this.projectTasks(), this.slaFilter(), this.priorityFilter());
    const grouped: Record<TaskStatus, Task[]> = { PENDING: [], IN_PROGRESS: [], DONE: [] };
    for (const task of filteredTasks) grouped[task.status].push(task);
    return grouped;
  });
  readonly priorities: { value: TaskPriority; label: string }[] = [
    { value: 'URGENT', label: 'Urgente' },
    { value: 'HIGH', label: 'Alta' },
    { value: 'MEDIUM', label: 'Média' },
    { value: 'LOW', label: 'Baixa' },
  ];
  readonly slaFilters: { value: TaskSlaFilter; label: string }[] = [
    { value: 'ALL', label: 'Todas' },
    { value: 'OVERDUE', label: '🔴 Atrasadas' },
    { value: 'DUE_TODAY', label: '🟡 Vence hoje' },
    { value: 'ON_TRACK', label: '🟢 No prazo' },
  ];
  readonly columns: { status: TaskStatus; label: string; tone: string; id: string; items: WritableSignal<Task[]> }[] = [
    { status: 'PENDING', label: 'Pendente', tone: 'pending', id: 'PENDING', items: this.pendingTasks },
    { status: 'IN_PROGRESS', label: 'Em andamento', tone: 'progress', id: 'IN_PROGRESS', items: this.inProgressTasks },
    { status: 'DONE', label: 'Concluído', tone: 'done', id: 'DONE', items: this.doneTasks },
  ];

  ngOnInit(): void {
    if (!this.isBrowser) return;
    this.loadDashboard();
    this.loadAnalytics();
  }

  loadDashboard(): void {
    this.isLoading.set(true);
    this.api.loadDashboard().subscribe({
      next: ({ projects, tasks }) => {
        this.projects.set(projects);
        this.tasks.set(tasks);
        if (!projects.some((project) => project.id === this.selectedProjectId())) this.selectedProjectId.set(projects[0]?.id ?? null);
        this.syncTaskColumns();
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('Não foi possível conectar à API. Verifique se o backend está rodando em localhost:3000.');
        this.isLoading.set(false);
      },
    });
  }

  loadAnalytics(): void {
    this.analyticsLoading.set(true);
    this.api.loadAnalytics().subscribe({
      next: (metrics) => {
        this.analytics.set(metrics);
        this.analyticsLoading.set(false);
      },
      error: () => {
        this.analytics.set(null);
        this.analyticsLoading.set(false);
      },
    });
  }

  openProjectForm(project: Project | null = null): void {
    this.errorMessage.set('');
    this.projectForm.set(project);
  }

  openTaskDetails(task: Task): void {
    this.errorMessage.set('');
    this.successMessage.set('');
    this.selectedTask.set(task);
  }

  handleTaskCardKeydown(event: Event, task: Task): void {
    if (event.target === event.currentTarget) {
      this.openTaskDetails(task);
    }
  }

  updateTaskFromDetails(updatedTask: Task): void {
    this.tasks.update((tasks) => tasks.map((item) => item.id === updatedTask.id ? updatedTask : item));
    this.syncTaskColumns();
    this.loadAnalytics();
  }

  selectProject(projectId: number): void {
    this.selectedProjectId.set(projectId);
    this.syncTaskColumns();
  }

  saveProject(payload: ProjectPayload): void {
    const currentProject = this.projectForm();
    const request = currentProject ? this.api.updateProject(currentProject.id, payload) : this.api.createProject(payload);
    request.subscribe({
      next: (project) => {
        this.projects.update((projects) => currentProject
          ? projects.map((item) => item.id === project.id ? project : item)
          : [...projects, project]);
        if (!currentProject) {
          this.selectedProjectId.set(project.id);
          this.syncTaskColumns();
        }
        this.projectForm.set(undefined);
      },
      error: () => this.errorMessage.set('Não foi possível salvar o projeto.'),
    });
  }

  deleteProject(project: Project): void {
    if (!window.confirm(`Excluir o projeto "${project.title}" e todas as tarefas vinculadas?`)) return;
    this.api.deleteProject(project.id).subscribe({
      next: () => {
        const remaining = this.projects().filter((item) => item.id !== project.id);
        this.projects.set(remaining);
        this.tasks.update((tasks) => tasks.filter((task) => task.projectId !== project.id));
        if (this.selectedProjectId() === project.id) this.selectedProjectId.set(remaining[0]?.id ?? null);
        this.syncTaskColumns();
      },
      error: () => this.errorMessage.set('Não foi possível excluir o projeto.'),
    });
  }

  setView(view: 'board' | 'analytics'): void {
    this.currentView.set(view);
    if (view === 'analytics' && !this.analytics()) {
      this.loadAnalytics();
    }
  }

  tasksFor(status: TaskStatus): Task[] {
    const columnTasks = this.columnFor(status).items();
    return this.isTaskFilterActive()
      ? filterTasks(columnTasks, this.slaFilter(), this.priorityFilter())
      : columnTasks;
  }

  visibleTaskCount(): number {
    return Object.values(this.filteredTasksByStatus()).reduce((count, tasks) => count + tasks.length, 0);
  }

  isTaskFilterActive(): boolean {
    return this.slaFilter() !== 'ALL' || this.priorityFilter() !== 'ALL';
  }

  isTaskStatusSaving(taskId: number): boolean {
    return this.savingTaskStatusIds().has(taskId);
  }

  taskSla(task: Task) { return calculateTaskSla(task.dueDate, task.status); }

  exportTaskReport(): void {
    const csv = buildTaskReportCsv(this.tasks(), this.projects());
    const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' });
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `relatorio_projectflow_${new Date().getFullYear()}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);
  }

  private columnFor(status: TaskStatus) {
    return this.columns.find((column) => column.status === status)!;
  }

  private syncTaskColumns(): void {
    const projectTasks = this.projectTasks();
    this.pendingTasks.set(projectTasks.filter((task) => task.status === 'PENDING'));
    this.inProgressTasks.set(projectTasks.filter((task) => task.status === 'IN_PROGRESS'));
    this.doneTasks.set(projectTasks.filter((task) => task.status === 'DONE'));
  }

  drop(event: CdkDragDrop<Task[]>): void {
    if (this.isTaskFilterActive()) return;

    const task = event.item.data as Task;
    if (this.savingTaskStatusIds().has(task.id)) return;

    if (event.previousContainer === event.container) {
      const column = this.columns.find((item) => item.id === event.container.id)!;
      const reorderedTasks = [...event.container.data];
      moveItemInArray(reorderedTasks, event.previousIndex, event.currentIndex);
      queueMicrotask(() => column.items.set(reorderedTasks));
      return;
    }

    const source = this.columns.find((column) => column.id === event.previousContainer.id)!;
    const destination = this.columns.find((column) => column.id === event.container.id)!;
    const previousTasks = this.tasks();
    const sourceItems = [...event.previousContainer.data];
    const destinationItems = [...event.container.data];
    sourceItems.splice(event.previousIndex, 1);
    destinationItems.splice(event.currentIndex, 0, {
      ...task,
      status: destination.status,
      completed: destination.status === 'DONE',
    });
    queueMicrotask(() => {
      source.items.set(sourceItems);
      destination.items.set(destinationItems);
      this.tasks.update((tasks) => tasks.map((item) => item.id === task.id
        ? { ...item, status: destination.status, completed: destination.status === 'DONE' }
        : item));
      this.savingTaskStatusIds.update((ids) => new Set(ids).add(task.id));

      this.api.updateTaskStatus(task.id, destination.status).subscribe({
        next: (updatedTask) => {
          this.tasks.update((tasks) => tasks.map((item) => item.id === updatedTask.id ? updatedTask : item));
          destination.items.update((items) => items.map((item) => item.id === updatedTask.id ? updatedTask : item));
          this.savingTaskStatusIds.update((ids) => {
            const updatedIds = new Set(ids);
            updatedIds.delete(task.id);
            return updatedIds;
          });
          this.errorMessage.set('');
          this.successMessage.set(`Etapa atualizada para "${destination.label}". A alteração foi registrada no histórico.`);
        },
        error: () => {
          this.tasks.set(previousTasks);
          this.syncTaskColumns();
          this.savingTaskStatusIds.update((ids) => {
            const updatedIds = new Set(ids);
            updatedIds.delete(task.id);
            return updatedIds;
          });
          this.successMessage.set('');
          this.errorMessage.set('Não foi possível salvar o novo status. A tarefa voltou à etapa anterior.');
        },
      });
    });
  }

  changeTaskPriority(task: Task, priority: TaskPriority): void {
    this.api.updateTask(task.id, { priority }).subscribe({
      next: (updatedTask) => {
        this.tasks.update((tasks) => tasks.map((item) => item.id === task.id ? updatedTask : item));
        this.syncTaskColumns();
      },
      error: () => this.errorMessage.set('Não foi possível atualizar a prioridade da tarefa.'),
    });
  }

  addTask(): void {
    const title = this.taskTitle().trim();
    const projectId = this.selectedProjectId();
    if (!title || projectId === null) return;
    this.isSavingTask.set(true);
    this.api.createTask({ title, projectId }).subscribe({
      next: (task) => {
        this.tasks.update((tasks) => [...tasks, task]);
        this.syncTaskColumns();
        this.taskTitle.set('');
        this.isSavingTask.set(false);
      },
      error: () => {
        this.errorMessage.set('Não foi possível criar a tarefa.');
        this.isSavingTask.set(false);
      },
    });
  }

  changeTaskStatus(task: Task, status: TaskStatus): void {
    this.api.updateTask(task.id, { status }).subscribe({
      next: (updatedTask) => {
        this.tasks.update((tasks) => tasks.map((item) => item.id === task.id ? updatedTask : item));
        this.syncTaskColumns();
        this.errorMessage.set('');
        this.successMessage.set('Etapa atualizada com sucesso e registrada no histórico.');
      },
      error: () => {
        this.successMessage.set('');
        this.errorMessage.set('Não foi possível atualizar o status da tarefa.');
      },
    });
  }

  deleteTask(task: Task): void {
    this.api.deleteTask(task.id).subscribe({
      next: () => {
        this.tasks.update((tasks) => tasks.filter((item) => item.id !== task.id));
        this.syncTaskColumns();
      },
      error: () => this.errorMessage.set('Não foi possível excluir a tarefa.'),
    });
  }
}