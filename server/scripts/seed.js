/**
 * Seeds the demo person so the Prisma-backed store matches the in-memory store's
 * default state. Run after `prisma migrate deploy` when DATABASE_URL is set.
 *
 *   DATABASE_URL="file:./dev.db" npm run db:seed
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  await prisma.person.upsert({
    where: { id: 'person_demo_001' },
    update: {},
    create: {
      id: 'person_demo_001',
      ownerUserId: 'user_demo_001',
      name: '爸爸',
      relation: 'father',
      consentStatus: 'pending',
      voiceCloneStatus: 'disabled'
    }
  });
  console.log('Seeded demo person person_demo_001');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
