import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function normalizeNumber(value: string): string {
  const trimmed = value.trim();
  return trimmed.replace(/^0+(?=\d)/, '');
}

async function main() {
  console.log('Iniciando migración histórica de datos financieros de tickets...');

  // Get default plan
  const defaultPlan = await prisma.plan.findFirst({
    orderBy: { createdAt: 'asc' },
    select: { multiplier: true, commission: true },
  });
  const defaultPlanMultiplier = defaultPlan?.multiplier ?? 0;
  const defaultPlanCommission = defaultPlan?.commission ?? 0;

  console.log(`Plan por defecto: Multiplicador: ${defaultPlanMultiplier}, Comisión: ${defaultPlanCommission}%`);

  // Fetch all tickets with lines, draw, seller plan, and associate plan
  const tickets = await prisma.ticket.findMany({
    include: {
      lines: true,
      draw: {
        select: {
          winnerNumber: true,
          specialMultiplier: { select: { value: true } },
        },
      },
      seller: {
        select: {
          plan: { select: { multiplier: true, commission: true } },
        },
      },
      associate: {
        select: {
          plan: { select: { multiplier: true, commission: true } },
        },
      },
    },
  });

  console.log(`Se encontraron ${tickets.length} tickets para procesar.`);

  let updatedCount = 0;
  let batchUpdates = [];

  for (const ticket of tickets) {
    // 1. Calculate commission
    const effectivePlan = ticket.seller.plan ?? ticket.associate.plan ?? defaultPlan;
    const commissionRate = (effectivePlan?.commission ?? 0) / 100;
    const commission = ticket.total * commissionRate;

    // 2. Calculate prize
    let prize = 0;
    const winnerNumber = ticket.draw.winnerNumber;
    if (winnerNumber && winnerNumber.trim() && !ticket.canceledAt) {
      const normalizedWinner = normalizeNumber(winnerNumber);
      const regularMultiplier = effectivePlan?.multiplier ?? 0;
      const specialMultiplierValue = ticket.draw.specialMultiplier?.value ?? null;

      for (const line of ticket.lines) {
        if (normalizeNumber(line.number) === normalizedWinner) {
          if (specialMultiplierValue !== null && (line.specialAmount ?? 0) > 0) {
            prize += (line.amount + (line.specialAmount ?? 0)) * regularMultiplier * specialMultiplierValue;
          } else {
            prize += line.amount * regularMultiplier;
          }
        }
      }
    }

    // Prepare update
    batchUpdates.push(
      prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          commission,
          prize,
        },
      })
    );

    if (batchUpdates.length >= 100) {
      await prisma.$transaction(batchUpdates);
      updatedCount += batchUpdates.length;
      console.log(`Progreso: ${updatedCount}/${tickets.length} tickets actualizados.`);
      batchUpdates = [];
    }
  }

  // Execute remaining updates
  if (batchUpdates.length > 0) {
    await prisma.$transaction(batchUpdates);
    updatedCount += batchUpdates.length;
  }

  console.log(`Migración completada. Se actualizaron ${updatedCount} tickets.`);
}

main()
  .catch((e) => {
    console.error('Error durante la migración:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
