import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const users = [
    { username: "admin", password: "admin123" },
    { username: "cruiz", password: "password123" }
  ];

  for (const user of users) {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(user.password, salt);
    // Cambiado de prisma.users a prisma.user
    await prisma.user.update({
      where: { username: user.username },
      data: { passwordHash: passwordHash }
    });
    console.log(`Updated password for ${user.username}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });