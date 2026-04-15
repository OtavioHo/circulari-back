import { PrismaClient } from '../src/generated/prisma/client';

const prisma = new PrismaClient();

const categories = [
  'Móveis',
  'Eletrônicos',
  'Smartphones',
  'Computadores',
  'Roupas',
  'Acessórios',
  'Sapatos',
  'Cozinha',
  'Decoração',
  'Livros',
  'Filmes',
  'Ferramentas',
  'Máquinas',
  'Artigos Esportivos',
  'Colecionáveis',
  'Artes',
  'Bebidas',
  'Outros',
];

async function main() {
  for (const name of categories) {
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  console.log(`Seeded ${categories.length} categories.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
