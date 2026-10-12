import { Component, computed, inject, OnInit, signal, WritableSignal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDragPlaceholder, CdkDropList, CdkDropListGroup, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { ProjectForm, ProjectPayload } from './project-form';
import { AnalyticsMetrics, ProjectFlowApi, Project, Task, TaskPriority, TaskStatus } from './project-flow-api';

@Component({
  selector: 'app-root',
  imports: [FormsModule, ProjectForm, CdkDropListGroup, CdkDropList, CdkDrag, CdkDragHandle, CdkDragPlaceholder],
  templateUrl: './app.html',
})
export class App implements OnInit {
  private readonly api = inject(ProjectFlowApi);
  readonly projects = signal<Project[]>([]);
  readonly tasks = signal<Task[]>([]);
  readonly pendingTasks = signal<Task[]>([]);
  readonly inProgressTasks = signal<Task[]>([]);
  readonly doneTasks = signal<Task[]>([]);
  readonly selectedProjectId = signal<number | null>(null);
  readonly projectForm = signal<Project | null | undefined>(undefined);
  readonly taskTitle = signal('');
  readonly errorMessage = signal('');
  readonly isLoading = signal(true);
  readonly isSavingTask = signal(false);
  readonly analytics = signal<AnalyticsMetrics | null>(null);
  readonly analyticsLoading = signal(false);
  readonly currentView = signal<'board' | 'analytics'>('board');
  readonly selectedProject = computed(() => this.projects().find((project) => project.id === this.selectedProjectId()) ?? null);
  readonly projectTasks = computed(() => this.tasks().filter((task) => task.projectId === this.selectedProjectId()));
  readonly priorities: { value: TaskPriority; label: string }[] = [
    { value: 'URGENT', label: 'Urgente' },
    { value: 'HIGH', label: 'Alta' },
    { value: 'MEDIUM', label: 'Média' },
    { value: 'LOW', label: 'Baixa' },
  ];
  readonly columns: { status: TaskStatus; label: string; tone: string; id: string; items: WritableSignal<Task[]> }[] = [
    { status: 'PENDING', label: 'Pendente', tone: 'pending', id: 'PENDING', items: this.pendingTasks },
    { status: 'IN_PROGRESS', label: 'Em andamento', tone: 'progress', id: 'IN_PROGRESS', items: this.inProgressTasks },
    { status: 'DONE', label: 'Concluído', tone: 'done', id: 'DONE', items: this.doneTasks },
  ];

  ngOnInit(): void {
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

  tasksFor(status: TaskStatus): Task[] { return this.columnFor(status).items(); }

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
    const task = event.item.data as Task;
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
      const column = this.columns.find((item) => item.id === event.container.id)!;
      column.items.set([...event.container.data]);
      return;
    }

    const source = this.columns.find((column) => column.id === event.previousContainer.id)!;
    const destination = this.columns.find((column) => column.id === event.container.id)!;
    const previousSource = [...source.items()];
    const previousDestination = [...destination.items()];
    const previousTasks = this.tasks();

    transferArrayItem(event.previousContainer.data, event.container.data, event.previousIndex, event.currentIndex);
    source.items.set([...event.previousContainer.data]);
    destination.items.set([...event.container.data]);
    this.tasks.update((tasks) => tasks.map((item) => item.id === task.id
      ? { ...item, status: destination.status, completed: destination.status === 'DONE' }
      : item));

    this.api.updateTaskStatus(task.id, destination.status).subscribe({
      error: () => {
        source.items.set(previousSource);
        destination.items.set(previousDestination);
        this.tasks.set(previousTasks);
        this.errorMessage.set('Não foi possível salvar o novo status. A tarefa voltou à coluna anterior.');
      },
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
      },
      error: () => this.errorMessage.set('Não foi possível atualizar o status da tarefa.'),
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