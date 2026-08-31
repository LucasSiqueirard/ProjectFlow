require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

const app = express();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

app.use(cors());
app.use(express.json());

// Rota de teste
app.get('/', (req, res) => {
  res.send('API ProjectFlow está rodando!');
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