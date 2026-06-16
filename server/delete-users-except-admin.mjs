import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const KEEP_USERNAME = process.argv[2] ?? "admin";

async function main() {
  const keepUser = await prisma.user.findUnique({
    where: { username: KEEP_USERNAME },
    select: { id: true, username: true }
  });

  if (!keepUser) {
    throw new Error(`No existe el usuario a conservar: ${KEEP_USERNAME}`);
  }

  const usersToDelete = await prisma.user.findMany({
    where: { id: { not: keepUser.id } },
    select: { id: true, username: true }
  });

  if (usersToDelete.length === 0) {
    console.log("No hay usuarios para eliminar.");
    return;
  }

  const userIds = usersToDelete.map((u) => u.id);

  console.log(`Conservando usuario: ${keepUser.username}`);
  console.log(`Eliminando ${usersToDelete.length} usuarios...`);

  await prisma.$transaction(async (tx) => {
    await tx.announcementDismissal.deleteMany({
      where: { userId: { in: userIds } }
    });

    await tx.announcement.deleteMany({
      where: { createdById: { in: userIds } }
    });

    await tx.cashMovement.deleteMany({
      where: {
        OR: [
          { targetUserId: { in: userIds } },
          { createdById: { in: userIds } },
          { canceledById: { in: userIds } }
        ]
      }
    });

    await tx.ticket.deleteMany({
      where: {
        OR: [
          { sellerId: { in: userIds } },
          { associateId: { in: userIds } },
          { canceledById: { in: userIds } },
          { paidById: { in: userIds } }
        ]
      }
    });

    await tx.auditLog.deleteMany({
      where: { userId: { in: userIds } }
    });

    await tx.refreshToken.deleteMany({
      where: { userId: { in: userIds } }
    });

    await tx.userRestrictionLimit.deleteMany({
      where: { userId: { in: userIds } }
    });

    await tx.plan.updateMany({
      where: { masterId: { in: userIds } },
      data: { masterId: null }
    });

    await tx.user.updateMany({
      where: {
        parentId: { in: userIds },
        id: keepUser.id
      },
      data: { parentId: null }
    });

    await tx.user.deleteMany({
      where: { id: { in: userIds } }
    });
  });

  console.log("Proceso completado: solo queda el usuario admin.");
}

main()
  .catch((e) => {
    console.error("Error eliminando usuarios:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
