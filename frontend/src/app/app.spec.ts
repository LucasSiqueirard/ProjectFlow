import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { ProjectFlowApi } from './project-flow-api';
import { of } from 'rxjs';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [{
        provide: ProjectFlowApi,
        useValue: {
          loadDashboard: () => of({ projects: [], tasks: [] }),
          loadAnalytics: () => of({
            generatedAt: '',
            completionRateByProject: [],
            taskDistribution: [],
            averageLeadTimeDays: null,
            averageLeadTimeByProject: [],
            leadTimeDataAvailable: false,
            leadTimeNote: null,
          }),
        },
      }],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the empty workspace state', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Organize o trabalho.');
  });
});
