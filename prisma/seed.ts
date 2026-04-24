import { compare, hash } from "bcryptjs";

import { prisma } from "../src/lib/prisma";

const PASSWORD_COST = 10;
const EMPTY_PERMISSIONS = {};

const roles = [
  { code: "FO", name: "Front Office" },
  { code: "HK", name: "Housekeeping" },
  { code: "FB", name: "Food & Beverage" },
  { code: "ACC", name: "Accounting" },
  { code: "ADMIN", name: "Administrator" },
] as const;

const users = [
  {
    username: "admin",
    fullName: "Noah Py",
    roleCode: "ADMIN",
    password: "admin123",
  },
  {
    username: "fo1",
    fullName: "Sheena Ringo",
    roleCode: "FO",
    password: "fo123",
  },
  {
    username: "hk1",
    fullName: "Mas Japran",
    roleCode: "HK",
    password: "hk123",
  },
  {
    username: "fb1",
    fullName: "Jaka Alif",
    roleCode: "FB",
    password: "fb123",
  },
  {
    username: "acc1",
    fullName: "Astrid Noah",
    roleCode: "ACC",
    password: "acc123",
  },
] as const;

async function getPasswordHash(username: string, password: string) {
  const existingUser = await prisma.user.findUnique({
    where: { username },
    select: { passwordHash: true },
  });

  if (existingUser) {
    const passwordMatches = await compare(password, existingUser.passwordHash);

    if (passwordMatches) {
      return existingUser.passwordHash;
    }
  }

  return hash(password, PASSWORD_COST);
}

async function main() {
  for (const role of roles) {
    await prisma.role.upsert({
      where: { code: role.code },
      create: {
        code: role.code,
        name: role.name,
        permissions: EMPTY_PERMISSIONS,
      },
      update: {
        name: role.name,
        permissions: EMPTY_PERMISSIONS,
      },
    });

    console.log(`✓ seeded role ${role.code}`);
  }

  await prisma.hotelSettings.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      hotelName: "Linggian Hotel",
      address: "Bandung, Indonesia",
      taxPercent: 10,
      serviceChargePercent: 5,
      nightAuditTime: "23:00",
      currency: "IDR",
    },
    update: {
      hotelName: "Linggian Hotel",
      address: "Bandung, Indonesia",
      taxPercent: 10,
      serviceChargePercent: 5,
      nightAuditTime: "23:00",
      currency: "IDR",
    },
  });

  console.log("✓ seeded hotel settings");

  for (const userToSeed of users) {
    const passwordHash = await getPasswordHash(
      userToSeed.username,
      userToSeed.password,
    );

    const user = await prisma.user.upsert({
      where: { username: userToSeed.username },
      create: {
        username: userToSeed.username,
        fullName: userToSeed.fullName,
        passwordHash,
        isActive: true,
      },
      update: {
        fullName: userToSeed.fullName,
        passwordHash,
        isActive: true,
      },
    });

    console.log(`✓ seeded user ${userToSeed.username}`);

    const role = await prisma.role.findUniqueOrThrow({
      where: { code: userToSeed.roleCode },
    });

    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: user.id,
          roleId: role.id,
        },
      },
      create: {
        userId: user.id,
        roleId: role.id,
      },
      update: {},
    });

    console.log(
      `✓ seeded user role ${userToSeed.username} -> ${userToSeed.roleCode}`,
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
