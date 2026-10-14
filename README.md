# ProjectFlow

# 🚀 ProjectFlow

> Plataforma de gestão visual de projetos, governança de prazos e analytics desenvolvida para otimizar a atuação de PMOs (Project Management Offices) e equipes ágeis.

![Status do Projeto](https://img.shields.io/badge/status-concluído-success)
![Tecnologias](https://img.shields.io/badge/stack-Node.js%20|%20PostgreSQL%20|%20Python%20|%20Prisma-blue)
![Licença](https://img.shields.io/badge/license-MIT-green)

---

## 🎯 Sobre o Projeto

O **ProjectFlow** nasceu para resolver os principais gargalos operacionais e gerenciais enfrentados em ambientes de projetos: falta de visibilidade do fluxo de trabalho, ausência de rastreabilidade em alterações de prazos e tomada de decisões baseada em "achismos" em vez de dados concretos.

A aplicação une a agilidade do quadro **Kanban** com a disciplina da **governança de dados**, oferecendo controle de SLA, auditoria de alterações e métricas de desempenho automatizadas.

---

## ✨ Funcionalidades Principais

* **🗂️ Gestão Visual (Kanban):** Organização de tarefas por estados (*Pendente*, *Em Andamento*, *Concluído*) com movimentação ágil e suporte a filtros rápidos.
* **⏱️ Governança de SLA:** Alertas visuais automáticos para identificar o status dos prazos:
  * 🔴 **Atrasada (Overdue)**
  * 🟡 **Vence Hoje (Due Today)**
  * 🟢 **No Prazo (On Track)**
* **🔍 Rastreabilidade e Auditoria (`TaskHistory`):** Histórico cronológico e automático de cada movimentação ou alteração realizada no card (quem alterou, quando e o que mudou).
* **📊 Analytics & Lead Time (Python/Pandas):** Módulo analítico integrado para calcular o *Lead Time* médio, mapear gargalos operacionais e medir a taxa de entrega (*Throughput*).
* **📥 Exportação Executiva (CSV):** Geração instantânea de relatórios brutos em 1 clique para alimentação de planilhas e montagem rápida de *Status Reports* para *stakeholders*.

---

## 🛠️ Stacks e Tecnologias

O projeto foi construído utilizando uma arquitetura limpa dividida em camadas:

* **Front-End:** 
  * `HTML5` & `CSS3` (Responsividade e identidade visual padronizada em roxo/branco).
  * `JavaScript (Vanilla)` (Manipulação dinâmica do DOM, interatividade e acessibilidade).
* **Back-End:** 
  * `Node.js` & `Express` (API RESTful para gestão de rotas e requisições).
  * `Prisma ORM` (Mapeamento objeto-relacional com segurança de tipos e alta performance).
* **Banco de Dados:** 
  * `PostgreSQL` (Banco relacional garantindo integridade referencial e vínculos entre projetos e tarefas).
* **Analytics & Dados:** 
  * `Python` & `Pandas` (Processamento de séries temporais para cálculo de KPIs e métricas de ciclo).

---

##  Requisitos do Sistema (Resumo)

### Requisitos Funcionais (RF)
* **CRUD Completo:** Gestão de Projetos (RF-01) e Tarefas (RF-03).
* **Controle de Fluxo:** Quadro Kanban interativo com drag-and-drop e filtros por SLA/Prioridade (RF-02, RF-06, RF-08).
* **Auditoria e Métricas:** Registro histórico de alterações (RF-07), cálculo de *Lead Time* (RF-10) e exportação em CSV (RF-11).

### Requisitos Não-Funcionais (RNF)
* **Responsividade (RNF-01):** Interface adaptável a diferentes larguras de tela.
* **Acessibilidade (RNF-02):** Suporte a rótulos acessíveis, avisos de estado e navegação básica por teclado.
* **Integridade de Dados (RNF-03 & RNF-04):** Persistência relacional via Prisma/PostgreSQL com tratamento seguro de dependências na exclusão de registros.

---

##  Como Executar o Projeto Localmente

Siga os passos abaixo para clonar e rodar o projeto na sua máquina:

### Pré-requisitos
Certifique-se de ter instalado em sua máquina:
* **Node.js** (versão 18+)
* **Python** (versão 3.8+) com a biblioteca Pandas instalada (`pip install pandas`)
* **PostgreSQL** configurado e rodando localmente ou em nuvem

### 1. Clonar o repositório
```bash
git clone [https://github.com/seu-usuario/projectflow.git](https://github.com/seu-usuario/projectflow.git)
cd projectflow
