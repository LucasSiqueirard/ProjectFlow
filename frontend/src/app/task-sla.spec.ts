import { describe, expect, it } from 'vitest';
import { filterTasks, calculateTaskSla } from './task-sla';
import { Task } from './project-flow-api';

describe('calculateTaskSla', () => {
  const today = new Date(2026, 9, 12, 12);

  it('marks an unfinished task with a past due date as overdue', () => {
    expect(calculateTaskSla('2026-10-11', 'IN_PROGRESS', today)).toEqual({
      status: 'OVERDUE',
      label: 'Atrasado • 11/Out',
    });
  });

  it('marks an unfinished task due today', () => {
    expect(calculateTaskSla('2026-10-12', 'PENDING', today)).toEqual({
      status: 'DUE_TODAY',
      label: 'Vence hoje',
    });
  });

  it('marks a future due date as on track', () => {
    expect(calculateTaskSla('2026-10-13', 'IN_PROGRESS', today)).toEqual({
      status: 'ON_TRACK',
      label: '13/Out',
    });
  });

  it('marks completed tasks as completed regardless of the due date', () => {
    expect(calculateTaskSla('2026-10-11', 'DONE', today)).toMatchObject({
      status: 'COMPLETED',
      label: 'Concluída • 11/Out',
    });
  });

  it('returns no indicator when an unfinished task has no due date', () => {
    expect(calculateTaskSla(null, 'PENDING', today)).toBeNull();
  });

  it('ignores malformed due dates', () => {
    expect(calculateTaskSla('2026-02-30', 'PENDING', today)).toBeNull();
  });

  it('combines SLA and priority filters without mutating the task list', () => {
    const tasks: Task[] = [
      { id: 1, title: 'Late urgent', description: null, projectId: 1, completed: false, status: 'IN_PROGRESS', priority: 'URGENT', dueDate: '2026-10-11', createdAt: '2026-10-01T00:00:00.000Z' },
      { id: 2, title: 'Late low', description: null, projectId: 1, completed: false, status: 'PENDING', priority: 'LOW', dueDate: '2026-10-10', createdAt: '2026-10-01T00:00:00.000Z' },
      { id: 3, title: 'Done urgent', description: null, projectId: 1, completed: true, status: 'DONE', priority: 'URGENT', dueDate: '2026-10-11', createdAt: '2026-10-01T00:00:00.000Z' },
    ];

    expect(filterTasks(tasks, 'OVERDUE', 'URGENT', today).map((task) => task.id)).toEqual([1]);
    expect(filterTasks(tasks, 'ALL', 'URGENT', today).map((task) => task.id)).toEqual([1, 3]);
    expect(tasks).toHaveLength(3);
  });
});
