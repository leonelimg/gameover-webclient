import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { APP_RESOURCES, isDefaultAllowed } from '../src/config/permissions.js';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱  Seeding database…');

  // ── Plans ────────────────────────────────────────────────────────────────

  const planBasico = await prisma.plan.upsert({
    where: { id: 'plan-basico' },
    update: {},
    create: {
      id: 'plan-basico',
      name: 'Plan Básico',
      multiplier: 60,
      commission: 10,
    },
  });

  const planPremium = await prisma.plan.upsert({
    where: { id: 'plan-premium' },
    update: {},
    create: {
      id: 'plan-premium',
      name: 'Plan Premium',
      multiplier: 80,
      commission: 15,
    },
  });

  // ── Users ────────────────────────────────────────────────────────────────

  const adminHash = await bcrypt.hash('admin123', 12);
  const defaultHash = await bcrypt.hash('password123', 12);

  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      fullName: 'Administrador Principal',
      username: 'admin',
      email: 'admin@gameover.com',
      phone: '0000-0000',
      role: 'admin',
      status: 'activo',
      passwordHash: adminHash,
    },
  });

  const asociado1 = await prisma.user.upsert({
    where: { username: 'jperez' },
    update: {},
    create: {
      fullName: 'Juan Pérez',
      username: 'jperez',
      email: 'juan@gameover.com',
      phone: '8888-1111',
      role: 'asociado',
      status: 'activo',
      passwordHash: defaultHash,
      planId: planBasico.id,
    },
  });

  const asociado2 = await prisma.user.upsert({
    where: { username: 'mlopez' },
    update: {},
    create: {
      fullName: 'María López',
      username: 'mlopez',
      email: 'maria@gameover.com',
      phone: '8888-2222',
      role: 'asociado',
      status: 'activo',
      passwordHash: defaultHash,
      planId: planPremium.id,
      parentId: asociado1.id,
    },
  });

  // Update plan-premium master to asociado1
  await prisma.plan.update({
    where: { id: planPremium.id },
    data: { masterId: asociado1.id },
  });

  await prisma.user.upsert({
    where: { username: 'cruiz' },
    update: {},
    create: {
      fullName: 'Carlos Ruiz',
      username: 'cruiz',
      email: 'carlos@gameover.com',
      phone: '8888-3333',
      role: 'vendedor',
      status: 'activo',
      passwordHash: defaultHash,
      planId: planBasico.id,
      parentId: asociado1.id,
    },
  });

  // ── Role permissions ─────────────────────────────────────────────────────

  await prisma.$transaction(
    APP_RESOURCES.flatMap((resource) =>
      (['admin', 'asociado', 'vendedor'] as const).map((role) =>
        prisma.rolePermission.upsert({
          where: {
            resourceKey_role: {
              resourceKey: resource.key,
              role,
            },
          },
          update: {},
          create: {
            resourceKey: resource.key,
            role,
            allowed: isDefaultAllowed(resource.key, role),
          },
        })
      )
    )
  );

  // ── Draw Types ────────────────────────────────────────────────────────────

  const drawTypeDiaria = await prisma.drawType.upsert({
    where: { id: 'draw-type-diaria-2d' },
    update: {
      name: 'Diaria 2D',
      digits: 2,
      multiplier: 80,
    },
    create: {
      id: 'draw-type-diaria-2d',
      name: 'Diaria 2D',
      description: 'Sorteo tradicional de 2 dígitos (00 - 99)',
      digits: 2,
      multiplier: 80,
      globalNumberLimit: 1000,
    },
  });

  const drawTypePick3 = await prisma.drawType.upsert({
    where: { id: 'draw-type-pick3' },
    update: {
      name: 'Pick 3',
      digits: 3,
      multiplier: 600,
    },
    create: {
      id: 'draw-type-pick3',
      name: 'Pick 3',
      description: 'Sorteo de 3 dígitos (000 - 999)',
      digits: 3,
      multiplier: 600,
      globalNumberLimit: 2000,
    },
  });

  await prisma.drawType.upsert({
    where: { id: 'draw-type-super-4d' },
    update: {
      name: 'Super 4D',
      digits: 4,
      multiplier: 4000,
    },
    create: {
      id: 'draw-type-super-4d',
      name: 'Super 4D',
      description: 'Sorteo especial de 4 dígitos (0000 - 9999)',
      digits: 4,
      multiplier: 4000,
      globalNumberLimit: 5000,
    },
  });

  // Restricted numbers for DrawType Diaria 2D
  await prisma.drawTypeRestrictedNumber.upsert({
    where: {
      drawTypeId_number: {
        drawTypeId: drawTypeDiaria.id,
        number: '00',
      },
    },
    update: { limit: 500 },
    create: {
      drawTypeId: drawTypeDiaria.id,
      number: '00',
      limit: 500,
    },
  });

  await prisma.drawTypeRestrictedNumber.upsert({
    where: {
      drawTypeId_number: {
        drawTypeId: drawTypeDiaria.id,
        number: '11',
      },
    },
    update: { limit: 300 },
    create: {
      drawTypeId: drawTypeDiaria.id,
      number: '11',
      limit: 300,
    },
  });

  // ── Draws ────────────────────────────────────────────────────────────────

  const now = new Date();
  const closeTime = new Date(now);
  closeTime.setHours(21, 0, 0, 0);

  await prisma.draw.upsert({
    where: { id: 'draw-matutino' },
    update: {
      drawTypeId: drawTypeDiaria.id,
    },
    create: {
      id: 'draw-matutino',
      drawTypeId: drawTypeDiaria.id,
      name: 'Sorteo Matutino',
      closeTime,
      minutosPreviosCierre: 10,
      status: 'abierto',
    },
  });

  // Assign existing draws without drawTypeId to drawTypeDiaria
  await prisma.draw.updateMany({
    where: { drawTypeId: null },
    data: { drawTypeId: drawTypeDiaria.id },
  });

  console.log('✅  Seed complete');
  console.log('   Admin login: admin / admin123');
  console.log('   Other users: <username> / password123');
  console.log(`   Users: admin(${admin.id}), asociado1(${asociado1.id}), asociado2(${asociado2.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
