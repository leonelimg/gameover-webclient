import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function normalize(num: string | null): string {
  if (!num) return '';
  return parseInt(num, 10).toString();
}

async function main() {
  console.log('--- SORTEOS CON WINNER NUMBER ---');
  const draws = await prisma.draw.findMany({
    where: { NOT: { winnerNumber: null } },
    include: {
      tickets: {
        include: {
          lines: true,
          seller: { include: { plan: true } },
          associate: { include: { plan: true } }
        }
      }
    }
  });

  for (const draw of draws) {
    const normWinner = normalize(draw.winnerNumber);
    let matchingLinesCount = 0;
    
    for (const ticket of draw.tickets) {
      for (const line of ticket.lines) {
        if (normalize(line.number) === normWinner) {
          matchingLinesCount++;
        }
      }
    }
    
    console.log(Draw: \ | Winner: \ | Matching Lines: \);
  }

  console.log('\n--- EJEMPLO DE 10 TICKETS ---');
  const tickets = await prisma.ticket.findMany({
    take: 10,
    include: {
      draw: true,
      lines: true,
      seller: { include: { plan: true } },
      associate: { include: { plan: true } }
    },
    orderBy: { createdAt: 'desc' }
  });

  tickets.forEach((t, i) => {
    const winnerNumber = t.draw.winnerNumber;
    const normWinner = normalize(winnerNumber);
    const hasMatch = t.lines.some(l => normalize(l.number) === normWinner);
    
    console.log(\. Code: \);
    console.log(   Seller: \ (Plan: \));
    console.log(   Associate: \ (Plan: \));
    console.log(   Winner Number: \);
    console.log(   Matches: \);
  });
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.\();
  });
