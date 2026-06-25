import { prisma } from './prisma.js';

export const GLOBAL_NUMBER_LIMIT_SETTING_KEY = 'sales.global-number-limit';
export const USER_GLOBAL_NUMBER_LIMIT_PREFIX = 'sales.user-global-number-limit';
export const USER_DRAW_SALE_LIMIT_PREFIX = 'sales.user-draw-sale-limit';
let legacyUserLimitsMigrationPromise: Promise<void> | null = null;
let legacyGlobalNumbersMigrationPromise: Promise<void> | null = null;

function parseNumberLimit(value: string | null): number | null {
  if (value === null) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function parseUserIdFromKey(prefix: string, key: string): string | null {
  const fullPrefix = `${prefix}.`;
  if (!key.startsWith(fullPrefix)) {
    return null;
  }

  const userId = key.slice(fullPrefix.length);
  return userId.trim() ? userId : null;
}

async function migrateLegacyUserRestrictionSettings(): Promise<void> {
  const legacySettings = await prisma.systemSetting.findMany({
    where: {
      OR: [
        { key: { startsWith: `${USER_GLOBAL_NUMBER_LIMIT_PREFIX}.` } },
        { key: { startsWith: `${USER_DRAW_SALE_LIMIT_PREFIX}.` } },
      ],
    },
    select: { key: true, value: true },
  });

  if (legacySettings.length === 0) {
    return;
  }

  const limitsByUser = new Map<string, { userGlobalLimit: number | null; userDrawSaleLimit: number | null }>();

  for (const setting of legacySettings) {
    const globalUserId = parseUserIdFromKey(USER_GLOBAL_NUMBER_LIMIT_PREFIX, setting.key);
    if (globalUserId) {
      const current = limitsByUser.get(globalUserId) ?? {
        userGlobalLimit: null,
        userDrawSaleLimit: null,
      };
      current.userGlobalLimit = parseNumberLimit(setting.value);
      limitsByUser.set(globalUserId, current);
      continue;
    }

    const drawSaleUserId = parseUserIdFromKey(USER_DRAW_SALE_LIMIT_PREFIX, setting.key);
    if (drawSaleUserId) {
      const current = limitsByUser.get(drawSaleUserId) ?? {
        userGlobalLimit: null,
        userDrawSaleLimit: null,
      };
      current.userDrawSaleLimit = parseNumberLimit(setting.value);
      limitsByUser.set(drawSaleUserId, current);
    }
  }

  const upserts = Array.from(limitsByUser.entries()).map(([userId, limits]) =>
    prisma.userRestrictionLimit.upsert({
      where: { userId },
      create: {
        userId,
        userGlobalLimit: limits.userGlobalLimit,
        userDrawSaleLimit: limits.userDrawSaleLimit,
      },
      update: {
        userGlobalLimit: limits.userGlobalLimit,
        userDrawSaleLimit: limits.userDrawSaleLimit,
      },
    })
  );

  await prisma.$transaction(upserts);

  await prisma.systemSetting.deleteMany({
    where: {
      OR: [
        { key: { startsWith: `${USER_GLOBAL_NUMBER_LIMIT_PREFIX}.` } },
        { key: { startsWith: `${USER_DRAW_SALE_LIMIT_PREFIX}.` } },
      ],
    },
  });
}

async function ensureLegacyUserLimitsMigrated(): Promise<void> {
  if (!legacyUserLimitsMigrationPromise) {
    legacyUserLimitsMigrationPromise = migrateLegacyUserRestrictionSettings().catch((error) => {
      legacyUserLimitsMigrationPromise = null;
      throw error;
    });
  }

  await legacyUserLimitsMigrationPromise;
}

async function migrateLegacyDrawRestrictedNumbersToGlobal(): Promise<void> {
  const existingGlobalCount = await prisma.globalNumberRestriction.count();
  if (existingGlobalCount > 0) {
    return;
  }

  const legacyRows = await prisma.restrictedNumber.findMany({
    select: {
      number: true,
      limit: true,
    },
  });

  if (legacyRows.length === 0) {
    return;
  }

  const lowestLimitByNumber = new Map<string, number>();
  for (const row of legacyRows) {
    const current = lowestLimitByNumber.get(row.number);
    if (current === undefined || row.limit < current) {
      lowestLimitByNumber.set(row.number, row.limit);
    }
  }

  await prisma.$transaction(
    Array.from(lowestLimitByNumber.entries()).map(([number, limit]) =>
      prisma.globalNumberRestriction.upsert({
        where: { number },
        create: { number, limit },
        update: { limit },
      })
    )
  );
}

async function ensureLegacyGlobalNumbersMigrated(): Promise<void> {
  if (!legacyGlobalNumbersMigrationPromise) {
    legacyGlobalNumbersMigrationPromise = migrateLegacyDrawRestrictedNumbersToGlobal().catch((error) => {
      legacyGlobalNumbersMigrationPromise = null;
      throw error;
    });
  }

  await legacyGlobalNumbersMigrationPromise;
}

export async function getGlobalNumberLimit(): Promise<number | null> {
  const setting = await prisma.systemSetting.findUnique({
    where: { key: GLOBAL_NUMBER_LIMIT_SETTING_KEY },
    select: { value: true },
  });

  return parseNumberLimit(setting?.value ?? null);
}

export async function setGlobalNumberLimit(limit: number | null): Promise<number | null> {
  const setting = await prisma.systemSetting.upsert({
    where: { key: GLOBAL_NUMBER_LIMIT_SETTING_KEY },
    create: {
      key: GLOBAL_NUMBER_LIMIT_SETTING_KEY,
      value: limit === null ? null : String(limit),
    },
    update: {
      value: limit === null ? null : String(limit),
    },
    select: { value: true },
  });

  return parseNumberLimit(setting.value);
}

export async function getUserGlobalNumberLimit(userId: string): Promise<number | null> {
  await ensureLegacyUserLimitsMigrated();

  const limit = await prisma.userRestrictionLimit.findUnique({
    where: { userId },
    select: { userGlobalLimit: true },
  });

  return limit?.userGlobalLimit ?? null;
}

export async function setUserGlobalNumberLimit(userId: string, limit: number | null): Promise<number | null> {
  await ensureLegacyUserLimitsMigrated();

  const current = await prisma.userRestrictionLimit.findUnique({
    where: { userId },
    select: { userDrawSaleLimit: true, userRestrictedNumbersLimit: true },
  });

  if (limit === null && (current?.userDrawSaleLimit ?? null) === null && (current?.userRestrictedNumbersLimit ?? null) === null) {
    await prisma.userRestrictionLimit.deleteMany({ where: { userId } });
    return null;
  }

  const updated = await prisma.userRestrictionLimit.upsert({
    where: { userId },
    create: {
      userId,
      userGlobalLimit: limit,
      userDrawSaleLimit: current?.userDrawSaleLimit ?? null,
      userRestrictedNumbersLimit: current?.userRestrictedNumbersLimit ?? null,
    },
    update: {
      userGlobalLimit: limit,
    },
    select: { userGlobalLimit: true },
  });

  return updated.userGlobalLimit ?? null;
}

export async function getUserDrawSaleLimit(userId: string): Promise<number | null> {
  await ensureLegacyUserLimitsMigrated();

  const limit = await prisma.userRestrictionLimit.findUnique({
    where: { userId },
    select: { userDrawSaleLimit: true },
  });

  return limit?.userDrawSaleLimit ?? null;
}

export async function setUserDrawSaleLimit(userId: string, limit: number | null): Promise<number | null> {
  await ensureLegacyUserLimitsMigrated();

  const current = await prisma.userRestrictionLimit.findUnique({
    where: { userId },
    select: { userGlobalLimit: true, userRestrictedNumbersLimit: true },
  });

  if (limit === null && (current?.userGlobalLimit ?? null) === null && (current?.userRestrictedNumbersLimit ?? null) === null) {
    await prisma.userRestrictionLimit.deleteMany({ where: { userId } });
    return null;
  }

  const updated = await prisma.userRestrictionLimit.upsert({
    where: { userId },
    create: {
      userId,
      userGlobalLimit: current?.userGlobalLimit ?? null,
      userDrawSaleLimit: limit,
      userRestrictedNumbersLimit: current?.userRestrictedNumbersLimit ?? null,
    },
    update: {
      userDrawSaleLimit: limit,
    },
    select: { userDrawSaleLimit: true },
  });

  return updated.userDrawSaleLimit ?? null;
}

export async function getUserRestrictedNumbersLimit(userId: string): Promise<number | null> {
  await ensureLegacyUserLimitsMigrated();

  const limit = await prisma.userRestrictionLimit.findUnique({
    where: { userId },
    select: { userRestrictedNumbersLimit: true },
  });

  return limit?.userRestrictedNumbersLimit ?? null;
}

export async function setUserRestrictedNumbersLimit(userId: string, limit: number | null): Promise<number | null> {
  await ensureLegacyUserLimitsMigrated();

  const current = await prisma.userRestrictionLimit.findUnique({
    where: { userId },
    select: { userGlobalLimit: true, userDrawSaleLimit: true },
  });

  if (limit === null && (current?.userGlobalLimit ?? null) === null && (current?.userDrawSaleLimit ?? null) === null) {
    await prisma.userRestrictionLimit.deleteMany({ where: { userId } });
    return null;
  }

  const updated = await prisma.userRestrictionLimit.upsert({
    where: { userId },
    create: {
      userId,
      userGlobalLimit: current?.userGlobalLimit ?? null,
      userDrawSaleLimit: current?.userDrawSaleLimit ?? null,
      userRestrictedNumbersLimit: limit,
    },
    update: {
      userRestrictedNumbersLimit: limit,
    },
    select: { userRestrictedNumbersLimit: true },
  });

  return updated.userRestrictedNumbersLimit ?? null;
}

export async function getAllUserRestrictionLimits(): Promise<
  Map<string, { userGlobalLimit: number | null; userDrawSaleLimit: number | null; userRestrictedNumbersLimit: number | null }>
> {
  await ensureLegacyUserLimitsMigrated();

  const limitsByUser = new Map<string, { userGlobalLimit: number | null; userDrawSaleLimit: number | null; userRestrictedNumbersLimit: number | null }>();

  const records = await prisma.userRestrictionLimit.findMany({
    select: {
      userId: true,
      userGlobalLimit: true,
      userDrawSaleLimit: true,
      userRestrictedNumbersLimit: true,
    },
  });

  for (const record of records) {
    limitsByUser.set(record.userId, {
      userGlobalLimit: record.userGlobalLimit ?? null,
      userDrawSaleLimit: record.userDrawSaleLimit ?? null,
      userRestrictedNumbersLimit: record.userRestrictedNumbersLimit ?? null,
    });
  }

  return limitsByUser;
}

export async function listGlobalNumberRestrictions(): Promise<Array<{ number: string; limit: number }>> {
  await ensureLegacyGlobalNumbersMigrated();

  const items = await prisma.globalNumberRestriction.findMany({
    orderBy: { number: 'asc' },
    select: {
      number: true,
      limit: true,
    },
  });

  return items;
}

export async function getGlobalNumberRestrictionByNumber(number: string): Promise<{ number: string; limit: number } | null> {
  await ensureLegacyGlobalNumbersMigrated();

  const item = await prisma.globalNumberRestriction.findUnique({
    where: { number },
    select: {
      number: true,
      limit: true,
    },
  });

  return item;
}

export async function upsertGlobalNumberRestriction(number: string, limit: number): Promise<{ number: string; limit: number }> {
  await ensureLegacyGlobalNumbersMigrated();

  const item = await prisma.globalNumberRestriction.upsert({
    where: { number },
    create: { number, limit },
    update: { limit },
    select: {
      number: true,
      limit: true,
    },
  });

  return item;
}

export async function deleteGlobalNumberRestriction(number: string): Promise<void> {
  await ensureLegacyGlobalNumbersMigrated();

  await prisma.globalNumberRestriction.delete({
    where: { number },
  });
}