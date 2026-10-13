import { describe, expect, it } from 'vitest';
import { Project, Task } from './project-flow-api';
import { buildTaskReportCsv } from './task-report';

describe('buildTaskReportCsv', () => {
  const projects: Project[] = [{ id: 1, title: 'Projeto; Especial', description: null }];
  const tasks: Task[] = [{
    id: 3,
    title: 'Revisar "escopo"',
    description: null,
    projectId: 1,
    completed: false,
    status: 'IN_PROGRESS',
    priority: 'URGENT',
    dueDate: '2026-10-11',
    createdAt: '2026-10-01T12:30:00.000Z',
  }];

  it('exports all requested columns with localized values and escaped CSV cells', () => {
    const csv = buildTaskReportCsv(tasks, projects, new Date(2026, 9, 12, 12));
    const lines = csv.split('\r\n');

    expect(lines[0]).toBe('"Título";"Projeto";"Status";"Prioridade";"Data de criação";"Data limite";"SLA"');
    expect(lines[1]).toBe('"Revisar ""escopo""";"Projeto; Especial";"Em andamento";"Urgente";"01/10/2026";"11/10/2026";"Atrasado • 11/Out"');
  });

  it('exports tasks without deadlines with explicit empty-deadline labels', () => {
    const csv = buildTaskReportCsv([{ ...tasks[0], dueDate: null }], projects);

    expect(csv).toContain('"Sem prazo";"Sem prazo"');
  });

  it('neutralizes spreadsheet formula cells in user-controlled task text', () => {
    const csv = buildTaskReportCsv([{ ...tasks[0], title: '=HYPERLINK("https://example.com")' }], projects);

    expect(csv).toContain(`"'=HYPERLINK(""https://example.com"")"`);
  });
});
