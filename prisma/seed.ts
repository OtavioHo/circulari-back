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
  { hex_code: '#F8B3B3', name: 'Vermelho', order: 0 },
  { hex_code: '#F9D5B8', name: 'Laranja', order: 1 },
  { hex_code: '#F5E5B8', name: 'Amarelo', order: 2 },
  { hex_code: '#C8E6C9', name: 'Verde', order: 3 },
  { hex_code: '#BBDEFB', name: 'Azul', order: 4 },
  { hex_code: '#E1BEE7', name: 'Roxo', order: 5 },
  { hex_code: '#F8BBD0', name: 'Rosa', order: 6 },
  { hex_code: '#D0D0D0', name: 'Cinza', order: 7 },
];

const listIcons = [
  { slug: 'list', name: 'Lista', order: 0 },
  { slug: 'shopping-cart', name: 'Carrinho', order: 1 },
  { slug: 'home', name: 'Casa', order: 2 },
  { slug: 'gift', name: 'Presente', order: 3 },
  { slug: 'tag', name: 'Etiqueta', order: 4 },
  { slug: 'briefcase', name: 'Maleta', order: 5 },
  { slug: 'heart', name: 'Coração', order: 6 },
  { slug: 'star', name: 'Estrela', order: 7 },
  { slug: 'book', name: 'Livro', order: 8 },
  { slug: 'tool', name: 'Ferramenta', order: 9 },
];

const listPictures = [
  { slug: 'storage', order: 0 },
  { slug: 'beach_house', order: 1 },
  { slug: 'country_house', order: 2 },
  { slug: 'assets', order: 3 },
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
      where: { hex_code: color.hex_code },
      update: { name: color.name, order: color.order },
      create: color,
    });
  }
  console.log(`Seeded ${listColors.length} list colors.`);

  for (const icon of listIcons) {
    await prisma.listIcon.upsert({
      where: { slug: icon.slug },
      update: { name: icon.name, order: icon.order },
      create: icon,
    });
  }
  console.log(`Seeded ${listIcons.length} list icons.`);

  for (const picture of listPictures) {
    await prisma.listPicture.upsert({
      where: { slug: picture.slug },
      update: { order: picture.order },
      create: picture,
    });
  }
  console.log(`Seeded ${listPictures.length} list pictures.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
