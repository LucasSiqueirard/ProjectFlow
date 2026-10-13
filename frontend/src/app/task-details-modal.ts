import { Component, EventEmitter, inject, Input, OnChanges, Output, SimpleChanges, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ProjectFlowApi, Task, TaskHistoryEntry, TaskPriority, TaskStatus } from './project-flow-api';
import { calculateTaskSla } from './task-sla';

@Component({
  selector: 'app-task-details-modal',
  imports: [FormsModule],
  templateUrl: './task-details-modal.html',
  styleUrl: './task-details-modal.css',
})
export class TaskDetailsModal implements OnChanges {
  @Input({ required: true }) task!: Task;
  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<Task>();

  private readonly api = inject(ProjectFlowApi);
  readonly title = signal('');
  readonly description = signal('');
  readonly dueDate = signal('');
  readonly priority = signal<TaskPriority>('MEDIUM');
  readonly status = signal<TaskStatus>('PENDING');
  readonly history = signal<TaskHistoryEntry[]>([]);
  readonly isLoadingHistory = signal(true);
  readonly isSaving = signal(false);
  readonly errorMessage = signal('');
  readonly historyErrorMessage = signal('');
  readonly successMessage = signal('');
  readonly priorities: { value: TaskPriority; label: string }[] = [
    { value: 'LOW', label: 'Baixa' },
    { value: 'MEDIUM', label: 'Média' },
    { value: 'HIGH', label: 'Alta' },
    { value: 'URGENT', label: 'Urgente' },
  ];
  readonly statuses: { value: TaskStatus; label: string }[] = [
    { value: 'PENDING', label: 'Pendente' },
    { value: 'IN_PROGRESS', label: 'Em andamento' },
    { value: 'DONE', label: 'Concluído' },
  ];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['task'] && this.task) {
      this.title.set(this.task.title);
      this.description.set(this.task.description ?? '');
      this.dueDate.set(this.task.dueDate ?? '');
      this.priority.set(this.task.priority);
      this.status.set(this.task.status);
      this.loadHistory();
    }
  }

  loadHistory(): void {
    this.isLoadingHistory.set(true);
    this.historyErrorMessage.set('');
    this.api.loadTaskHistory(this.task.id).subscribe({
      next: (history) => {
        this.history.set(history);
        this.isLoadingHistory.set(false);
      },
      error: () => {
        this.historyErrorMessage.set('Não foi possível carregar o histórico desta tarefa.');
        this.isLoadingHistory.set(false);
      },
    });
  }

  save(): void {
    const title = this.title().trim();
    if (!title) {
      this.errorMessage.set('O título da tarefa é obrigatório.');
      return;
    }

    this.errorMessage.set('');
    this.successMessage.set('');
    this.isSaving.set(true);
    this.api.updateTask(this.task.id, {
      title,
      description: this.description().trim() || null,
      dueDate: this.dueDate() || null,
      priority: this.priority(),
      status: this.status(),
    }).subscribe({
      next: (updatedTask) => {
        this.isSaving.set(false);
        this.successMessage.set('Alterações salvas com sucesso.');
        this.saved.emit(updatedTask);
        this.loadHistory();
      },
      error: () => {
        this.errorMessage.set('Não foi possível salvar as alterações da tarefa.');
        this.isSaving.set(false);
      },
    });
  }

  formatTimestamp(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Data inválida';
    const formattedDate = new Intl.DateTimeFormat('pt-BR').format(date);
    const formattedTime = new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
    return `${formattedDate} às ${formattedTime}`;
  }

  statusLabel(status: TaskStatus): string {
    return this.statuses.find((item) => item.value === status)?.label ?? status;
  }

  get sla() {
    return calculateTaskSla(this.dueDate() || null, this.status());
  }
}
