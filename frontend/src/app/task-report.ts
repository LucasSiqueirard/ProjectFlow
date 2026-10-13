import { Project, Task, TaskPriority, TaskStatus } from './project-flow-api';
import { calculateTaskSla } from './task-sla';

const statusLabels: Record<TaskStatus, string> = {
  PENDING: 'Pendente',
  IN_PROGRESS: 'Em andamento',
  DONE: 'Concluído',
};

const priorityLabels: Record<TaskPriority, string> = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
  URGENT: 'Urgente',
};

export function buildTaskReportCsv(
  tasks: readonly Task[],
  projects: readonly Project[],
  now = new Date(),
): string {
  const projectTitles = new Map(projects.map((project) => [project.id, project.title]));
  const rows = [
    ['Título', 'Projeto', 'Status', 'Prioridade', 'Data de criação', 'Data limite', 'SLA'],
    ...tasks.map((task) => [
      task.title,
      projectTitles.get(task.projectId) ?? 'Projeto não encontrado',
      statusLabels[task.status],
      priorityLabels[task.priority],
      formatReportDate(task.createdAt),
      task.dueDate ? formatReportDate(task.dueDate) : 'Sem prazo',
      calculateTaskSla(task.dueDate, task.status, now)?.label ?? 'Sem prazo',
    ]),
  ];

  return rows.map((row) => row.map(escapeCsv).join(';')).join('\r\n');
}

function formatReportDate(value: string): string {
  const datePart = value.slice(0, 10);
  const [year, month, day] = datePart.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(datePart)
    || date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day
  ) {
    return value;
  }
  return new Intl.DateTimeFormat('pt-BR').format(date);
}

function escapeCsv(value: string): string {
  const safeValue = /^[\t\r ]*[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${safeValue.replace(/"/g, '""')}"`;
}
