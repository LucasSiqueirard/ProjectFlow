import { Task, TaskPriority, TaskStatus } from './project-flow-api';

export type TaskSlaStatus = 'OVERDUE' | 'DUE_TODAY' | 'ON_TRACK' | 'COMPLETED';

export interface TaskSlaIndicator {
  status: TaskSlaStatus;
  label: string;
}

export type TaskSlaFilter = 'ALL' | Exclude<TaskSlaStatus, 'COMPLETED'>;

export function filterTasks(
  tasks: readonly Task[],
  slaFilter: TaskSlaFilter,
  priorityFilter: TaskPriority | 'ALL',
  now = new Date(),
): Task[] {
  return tasks.filter((task) => {
    if (priorityFilter !== 'ALL' && task.priority !== priorityFilter) return false;
    if (slaFilter === 'ALL') return true;
    return calculateTaskSla(task.dueDate, task.status, now)?.status === slaFilter;
  });
}

export function calculateTaskSla(
  dueDate: string | null,
  status: TaskStatus,
  now = new Date(),
): TaskSlaIndicator | null {
  if (status === 'DONE') {
    return {
      status: 'COMPLETED',
      label: dueDate ? `Concluída • ${formatDueDate(dueDate)}` : 'Concluída',
    };
  }

  if (!dueDate) return null;

  const datePart = dueDate.slice(0, 10);
  const [year, month, day] = datePart.split('-').map(Number);
  const due = new Date(year, month - 1, day);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(datePart)
    || due.getFullYear() !== year
    || due.getMonth() !== month - 1
    || due.getDate() !== day
  ) {
    return null;
  }

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDay = new Date(year, month - 1, day);
  const labelDate = formatDueDate(datePart);
  if (dueDay < today) return { status: 'OVERDUE', label: `Atrasado • ${labelDate}` };
  if (dueDay.getTime() === today.getTime()) return { status: 'DUE_TODAY', label: 'Vence hoje' };
  return { status: 'ON_TRACK', label: labelDate };
}

function formatDueDate(value: string): string {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const dayPart = new Intl.DateTimeFormat('pt-BR', { day: '2-digit' }).format(date);
  const monthPart = new Intl.DateTimeFormat('pt-BR', { month: 'short' })
    .format(date)
    .replace(/\.$/, '');
  return `${dayPart}/${monthPart.charAt(0).toLocaleUpperCase('pt-BR')}${monthPart.slice(1)}`;
}
