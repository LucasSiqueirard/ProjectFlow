require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

const app = express();

function runAnalyticsScript() {
  const localPython = path.join(__dirname, '.venv-x64', 'Scripts', 'python.exe');
  const pythonCommand = fs.existsSync(localPython)
    ? localPython
    : (process.platform === 'win32' ? 'python' : 'python3');
  const scriptPath = path.join(__dirname, 'analytics.py');
  const outputPath = path.join(__dirname, 'metrics.json');

  const result = spawnSync(pythonCommand, [scriptPath], {
    cwd: __dirname,
    env: { ...process.env },
    encoding: 'utf8',
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'Erro ao executar o analytics.py');
  }

  if (!fs.existsSync(outputPath)) {
    throw new Error('Arquivo de métricas não foi gerado pelo analytics.py');
  }

  return JSON.parse(fs.readFileSync(outputPath, 'utf8'));
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

app.use(cors());
app.use(express.json());

// Rota de teste
app.get('/', (req, res) => {
  res.send('API ProjectFlow está rodando!');
});

// GET: Gerar métricas do Python
app.get('/analytics', async (req, res) => {
  try {
    const metrics = runAnalyticsScript();
    res.json(metrics);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Não foi possível gerar as métricas do analytics.' });
  }
});

// GET: Listar projetos
app.get('/projects', async (req, res) => {
  try {
    const projects = await prisma.project.findMany();
    res.json(projects);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao buscar projetos' });
  }
});

// POST: Criar projeto
app.post('/projects', async (req, res) => {
  try {
    const { title, description } = req.body;
    const newProject = await prisma.project.create({
      data: { title, description },
    });
    res.status(201).json(newProject);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao criar projeto' });
  }
});

// GET
app.get('/projects/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const project = await prisma.project.findUnique({
      // Nota: Se o seu ID no schema.prisma for String (UUID), remova o Number() e use apenas id: id
      where: { id: Number(id) },
    });

    if (!project) {
      return res.status(404).json({ error: 'Projeto não encontrado' });
    }

    res.json(project);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao buscar o projeto' });
  }
});

// PUT
app.put('/projects/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description } = req.body;

    const updatedProject = await prisma.project.update({
      where: { id: Number(id) },
      data: { title, description },
    });

    res.json(updatedProject);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao atualizar o projeto' });
  }
});

// DELETE
app.delete('/projects/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.project.delete({
      where: { id: Number(id) },
    });

    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao deletar o projeto' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});

// GET: Listar todas as tarefas (com opção de filtrar por projeto: /tasks?projectId=1)
app.get('/tasks', async (req, res) => {
  try {
    const { projectId } = req.query;
    const where = projectId ? { projectId: Number(projectId) } : {};

    const tasks = await prisma.task.findMany({
      where,
      include: { project: true } // Traz os dados do projeto junto
    });
    res.json(tasks);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao buscar tarefas' });
  }
});

// POST: Criar uma nova tarefa vinculada a um projeto
app.post('/tasks', async (req, res) => {
  try {
    const { title, projectId } = req.body;

    if (!title || !projectId) {
      return res.status(400).json({ error: 'Título e projectId são obrigatórios' });
    }

    const newTask = await prisma.task.create({
      data: {
        title,
        projectId: Number(projectId)
      }
    });

    res.status(201).json(newTask);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao criar tarefa' });
  }
});

// PATCH: Atualizar tarefa (título ou status de conclusão)
app.patch('/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, completed, status, priority } = req.body;
    const validStatuses = ['PENDING', 'IN_PROGRESS', 'DONE'];
    const validPriorities = ['URGENT', 'HIGH', 'MEDIUM', 'LOW'];

    if (status !== undefined && !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Status de tarefa inválido' });
    }
    if (priority !== undefined && !validPriorities.includes(priority)) {
      return res.status(400).json({ error: 'Prioridade de tarefa inválida' });
    }

    const data = {};
    if (title !== undefined) data.title = title;
    if (priority !== undefined) data.priority = priority;
    if (status !== undefined) {
      data.status = status;
      data.completed = status === 'DONE';
    } else if (completed !== undefined) {
      data.completed = completed;
      data.status = completed ? 'DONE' : 'PENDING';
    }

    const updatedTask = await prisma.$transaction(async (transaction) => {
      const taskId = Number(id);
      const previousTask = await transaction.task.findUnique({
        where: { id: taskId },
      });

      if (!previousTask) {
        return null;
      }

      const updated = await transaction.task.update({
        where: { id: taskId },
        data,
      });

      if (updated.status !== previousTask.status) {
        await transaction.taskHistory.create({
          data: {
            taskId,
            status: updated.status,
          },
        });
      }

      return updated;
    });

    if (!updatedTask) {
      return res.status(404).json({ error: 'Tarefa não encontrada' });
    }

    res.json(updatedTask);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao atualizar tarefa' });
  }
});

// DELETE: Remover uma tarefa
app.delete('/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.task.delete({
      where: { id: Number(id) }
    });

    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao deletar tarefa' });
  }
});