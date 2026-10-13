import { Component, input, OnChanges, output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Project } from './project-flow-api';

export interface ProjectPayload { title: string; description: string; }

@Component({
  selector: 'app-project-form',
  imports: [ReactiveFormsModule],
  template: `
    <div class="modal-backdrop" (click)="cancelled.emit()">
      <section class="project-form" role="dialog" aria-modal="true" aria-labelledby="project-form-title" (click)="$event.stopPropagation()">
        <header class="form-header"><div><p class="form-eyebrow">ESPAÇO DE TRABALHO</p><h2 id="project-form-title">{{ project() ? 'Editar projeto' : 'Novo projeto' }}</h2></div><button class="close-button" type="button" aria-label="Fechar formulário" (click)="cancelled.emit()">×</button></header>
        <form [formGroup]="form" (ngSubmit)="submit()">
          <label for="project-title">Nome do projeto <span>*</span></label><input id="project-title" formControlName="title" maxlength="80" placeholder="Ex.: Lançamento do produto" />
          @if (form.controls.title.touched && form.controls.title.invalid) { <small class="field-error">Informe um nome de até 80 caracteres.</small> }
          <label for="project-description">Descrição</label><textarea id="project-description" formControlName="description" rows="4" maxlength="300" placeholder="Qual é o objetivo deste projeto?"></textarea>
          <footer class="form-actions"><button class="cancel-button" type="button" (click)="cancelled.emit()">Cancelar</button><button class="save-button" type="submit">{{ project() ? 'Salvar alterações' : 'Criar projeto' }}</button></footer>
        </form>
      </section>
    </div>
  `,
  styles: `
    :host { position: fixed; z-index: 10; inset: 0; display: grid; place-items: center; padding: 18px; }
    .modal-backdrop { position: absolute; inset: 0; display: grid; place-items: center; padding: 18px; background: #091e427a; animation: fade-in .15s ease both; }
    .project-form { width: min(100%, 460px); padding: 23px; border-radius: 5px; background: #fff; box-shadow: 0 12px 35px #091e423d; animation: rise-in .2s ease both; }
    .form-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 22px; }.form-eyebrow { margin: 0 0 6px; color: #6b778c; font-size: 9px; font-weight: 750; letter-spacing: 1px; }
    h2 { margin: 0; color: #172b4d; font-size: 20px; font-weight: 650; }.close-button { width: 29px; height: 29px; border: 0; border-radius: 4px; background: transparent; color: #6b778c; font-size: 22px; cursor: pointer; }.close-button:hover { background: #f4f5f7; }
    label { display: block; margin: 15px 0 6px; color: #344563; font-size: 12px; font-weight: 650; }label span { color: #de350b; }
    input,textarea { box-sizing: border-box; width: 100%; padding: 9px 10px; border: 1px solid #dfe1e6; border-radius: 4px; color: #172b4d; font: inherit; font-size: 12px; resize: vertical; }
    input:focus,textarea:focus { outline: 2px solid var(--purple); outline-offset: 1px; }.field-error { display: block; margin-top: 5px; color: #bf2600; font-size: 10px; }
    .form-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 23px; }.cancel-button,.save-button { min-height: 34px; padding: 0 12px; border: 1px solid #dfe1e6; border-radius: 4px; font: inherit; font-size: 12px; font-weight: 650; cursor: pointer; }.cancel-button { color: #344563; background: #fff; }.save-button { border-color: var(--purple); background: var(--purple); color: #fff; }
    @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }@keyframes rise-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
  `,
})
export class ProjectForm implements OnChanges {
  readonly project = input<Project | null>(null);
  readonly saved = output<ProjectPayload>();
  readonly cancelled = output<void>();
  readonly form = new FormGroup({
    title: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(80)] }),
    description: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(300)] }),
  });

  ngOnChanges(): void {
    const project = this.project();
    this.form.reset({ title: project?.title ?? '', description: project?.description ?? '' });
  }

  submit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const value = this.form.getRawValue();
    this.saved.emit({ title: value.title.trim(), description: value.description.trim() });
  }
}