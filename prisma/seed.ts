import { PrismaClient } from '../src/generated/prisma';

const prisma = new PrismaClient();

const categories = [
  'Eletrônicos',
  'Roupas e Acessórios',
  'Casa e Decoração',
  'Livros e Mídia',
  'Ferramentas',
  'Esportes e Lazer',
  'Saúde e Beleza',
  'Brinquedos e Jogos',
  'Alimentos e Bebidas',
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
