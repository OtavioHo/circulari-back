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

const listColors = [
  { id: '00000000-0000-0000-0000-000000000001', name: 'Vermelho', hex_code: '#EF4444', order: 0 },
  { id: '00000000-0000-0000-0000-000000000002', name: 'Laranja', hex_code: '#F97316', order: 1 },
  { id: '00000000-0000-0000-0000-000000000003', name: 'Amarelo', hex_code: '#EAB308', order: 2 },
  { id: '00000000-0000-0000-0000-000000000004', name: 'Verde', hex_code: '#22C55E', order: 3 },
  { id: '00000000-0000-0000-0000-000000000005', name: 'Azul', hex_code: '#3B82F6', order: 4 },
  { id: '00000000-0000-0000-0000-000000000006', name: 'Roxo', hex_code: '#A855F7', order: 5 },
  { id: '00000000-0000-0000-0000-000000000007', name: 'Rosa', hex_code: '#EC4899', order: 6 },
  { id: '00000000-0000-0000-0000-000000000008', name: 'Cinza', hex_code: '#6B7280', order: 7 },
];

const listIcons = [
  { id: '00000000-0000-0000-0000-000000000001', name: 'Lista', slug: 'list', order: 0 },
  { id: '00000000-0000-0000-0000-000000000002', name: 'Carrinho', slug: 'shopping-cart', order: 1 },
  { id: '00000000-0000-0000-0000-000000000003', name: 'Casa', slug: 'home', order: 2 },
  { id: '00000000-0000-0000-0000-000000000004', name: 'Presente', slug: 'gift', order: 3 },
  { id: '00000000-0000-0000-0000-000000000005', name: 'Etiqueta', slug: 'tag', order: 4 },
  { id: '00000000-0000-0000-0000-000000000006', name: 'Maleta', slug: 'briefcase', order: 5 },
  { id: '00000000-0000-0000-0000-000000000007', name: 'Coração', slug: 'heart', order: 6 },
  { id: '00000000-0000-0000-0000-000000000008', name: 'Estrela', slug: 'star', order: 7 },
  { id: '00000000-0000-0000-0000-000000000009', name: 'Livro', slug: 'book', order: 8 },
  { id: '00000000-0000-0000-0000-000000000010', name: 'Ferramenta', slug: 'tool', order: 9 },
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

  for (const color of listColors) {
    await prisma.listColor.upsert({
      where: { name: color.name },
      update: { hex_code: color.hex_code, order: color.order },
      create: color,
    });
  }
  console.log(`Seeded ${listColors.length} list colors.`);

  for (const icon of listIcons) {
    await prisma.listIcon.upsert({
      where: { name: icon.name },
      update: { slug: icon.slug, order: icon.order },
      create: icon,
    });
  }
  console.log(`Seeded ${listIcons.length} list icons.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
