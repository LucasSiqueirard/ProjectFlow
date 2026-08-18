const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.project.createMany({
    data: [
      { title: 'ProjectFlow Core', description: 'API Backend em Node.js com Express e Prisma' },
      { title: 'ProjectFlow Web', description: 'Painel Frontend em Angular' },
    ],
  });
  console.log('Banco de dados populado com sucesso!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });