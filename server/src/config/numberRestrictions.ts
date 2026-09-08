import { prisma } from './prisma.js';

export const GLOBAL_NUMBER_LIMIT_SETTING_KEY = 'sales.global-number-limit';
export const USER_GLOBAL_NUMBER_LIMIT_PREFIX = 'sales.user-global-number-limit';
export const USER_DRAW_SALE_LIMIT_PREFIX = 'sales.user-draw-sale-limit';
let legacyUserLimitsMigrationPromise: Promise<void> | null = null;
let legacyGlobalNumbersMigrationPromise: Promise<void> | null = null;
let legacyToDrawTypeMigrationPromise: Promise<void> | null = null;

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

async function migrateLegacyRestrictionsToDefault2D(): Promise<void> {
  await ensureLegacyUserLimitsMigrated();
  await ensureLegacyGlobalNumbersMigrated();

  // Find primary 2D DrawType
  const default2D = await prisma.drawType.findFirst({
    where: { digits: 2 },
    orderBy: { createdAt: 'asc' },
  });

  if (!default2D) {
    return;
  }

  // 1. Migrate globalNumberRestrictions to default2D restricted numbers
  const globalNumbers = await prisma.globalNumberRestriction.findMany();
  for (const gn of globalNumbers) {
    if (gn.number.length === default2D.digits) {
      await prisma.drawTypeRestrictedNumber.upsert({
        where: {
          drawTypeId_number: {
            drawTypeId: default2D.id,
            number: gn.number,
          },
        },
        create: {
          drawTypeId: default2D.id,
          number: gn.number,
          limit: gn.limit,
        },
        update: {}, // keep existing if already configured
      });
    }
  }

  // 2. Migrate systemSetting global number limit if default2D has none
  if (default2D.globalNumberLimit === null) {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: GLOBAL_NUMBER_LIMIT_SETTING_KEY },
      select: { value: true },
    });
    const parsed = parseNumberLimit(setting?.value ?? null);
    if (parsed !== null) {
      await prisma.drawType.update({
        where: { id: default2D.id },
        data: { globalNumberLimit: parsed },
      });
    }
  }

  // 3. Migrate userRestrictionLimit to userDrawTypeLimit for default2D
  const userLimits = await prisma.userRestrictionLimit.findMany();
  for (const ul of userLimits) {
    await prisma.userDrawTypeLimit.upsert({
      where: {
        userId_drawTypeId: {
          userId: ul.userId,
          drawTypeId: default2D.id,
        },
      },
      create: {
        userId: ul.userId,
        drawTypeId: default2D.id,
        userGlobalLimit: ul.userGlobalLimit,
        userDrawSaleLimit: ul.userDrawSaleLimit,
        userRestrictedNumbersLimit: ul.userRestrictedNumbersLimit,
      },
      update: {},
    });
  }
}

async function ensureLegacyToDrawTypeMigrated(): Promise<void> {
  if (!legacyToDrawTypeMigrationPromise) {
    legacyToDrawTypeMigrationPromise = migrateLegacyRestrictionsToDefault2D().catch((error) => {
      legacyToDrawTypeMigrationPromise = null;
      throw error;
    });
  }

  await legacyToDrawTypeMigrationPromise;
}

export interface GlobalLimitResult {
  globalLimit: number | null;
  maxDrawSales: number | null;
  drawTypeId?: string;
  drawTypeName?: string;
  digits?: number;
}

export async function getGlobalLimitsConfig(drawTypeId?: string): Promise<GlobalLimitResult> {
  await ensureLegacyToDrawTypeMigrated();

  if (drawTypeId) {
    const drawType = await prisma.drawType.findUnique({
      where: { id: drawTypeId },
      select: {
        id: true,
        name: true,
        digits: true,
        globalNumberLimit: true,
        maxDrawSales: true,
      },
    });
    if (drawType) {
      return {
        drawTypeId: drawType.id,
        drawTypeName: drawType.name,
        digits: drawType.digits,
        globalLimit: drawType.globalNumberLimit ?? null,
        maxDrawSales: drawType.maxDrawSales ?? null,
      };
    }
  }

  const setting = await prisma.systemSetting.findUnique({
    where: { key: GLOBAL_NUMBER_LIMIT_SETTING_KEY },
    select: { value: true },
  });

  return {
    globalLimit: parseNumberLimit(setting?.value ?? null),
    maxDrawSales: null,
  };
}

export async function setGlobalLimitsConfig(
  globalLimit: number | null,
  maxDrawSales: number | null | undefined,
  drawTypeId?: string
): Promise<GlobalLimitResult> {
  await ensureLegacyToDrawTypeMigrated();

  if (drawTypeId) {
    const updateData: { globalNumberLimit?: number | null; maxDrawSales?: number | null } = {
      globalNumberLimit: globalLimit,
    };
    if (maxDrawSales !== undefined) {
      updateData.maxDrawSales = maxDrawSales;
    }

    const updated = await prisma.drawType.update({
      where: { id: drawTypeId },
      data: updateData,
      select: {
        id: true,
        name: true,
        digits: true,
        globalNumberLimit: true,
        maxDrawSales: true,
      },
    });

    return {
      drawTypeId: updated.id,
      drawTypeName: updated.name,
      digits: updated.digits,
      globalLimit: updated.globalNumberLimit ?? null,
      maxDrawSales: updated.maxDrawSales ?? null,
    };
  }

  const setting = await prisma.systemSetting.upsert({
    where: { key: GLOBAL_NUMBER_LIMIT_SETTING_KEY },
    create: {
      key: GLOBAL_NUMBER_LIMIT_SETTING_KEY,
      value: globalLimit === null ? null : String(globalLimit),
    },
    update: {
      value: globalLimit === null ? null : String(globalLimit),
    },
    select: { value: true },
  });

  return {
    globalLimit: parseNumberLimit(setting.value),
    maxDrawSales: null,
  };
}

export async function getGlobalNumberLimit(drawTypeId?: string): Promise<number | null> {
  const res = await getGlobalLimitsConfig(drawTypeId);
  return res.globalLimit;
}

export async function setGlobalNumberLimit(limit: number | null, drawTypeId?: string): Promise<number | null> {
  const res = await setGlobalLimitsConfig(limit, undefined, drawTypeId);
  return res.globalLimit;
}

export async function getUserGlobalNumberLimit(userId: string, drawTypeId?: string): Promise<number | null> {
  await ensureLegacyToDrawTypeMigrated();

  if (drawTypeId) {
    const drawTypeLimit = await prisma.userDrawTypeLimit.findUnique({
      where: { userId_drawTypeId: { userId, drawTypeId } },
      select: { userGlobalLimit: true },
    });
    return drawTypeLimit?.userGlobalLimit ?? null;
  }

  const limit = await prisma.userRestrictionLimit.findUnique({
    where: { userId },
    select: { userGlobalLimit: true },
  });

  return limit?.userGlobalLimit ?? null;
}

export async function setUserGlobalNumberLimit(userId: string, limit: number | null, drawTypeId?: string): Promise<number | null> {
  await ensureLegacyToDrawTypeMigrated();

  if (drawTypeId) {
    const updated = await prisma.userDrawTypeLimit.upsert({
      where: { userId_drawTypeId: { userId, drawTypeId } },
      create: {
        userId,
        drawTypeId,
        userGlobalLimit: limit,
      },
      update: {
        userGlobalLimit: limit,
      },
      select: { userGlobalLimit: true },
    });
    return updated.userGlobalLimit ?? null;
  }

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

export async function getUserDrawSaleLimit(userId: string, drawTypeId?: string): Promise<number | null> {
  await ensureLegacyToDrawTypeMigrated();

  if (drawTypeId) {
    const drawTypeLimit = await prisma.userDrawTypeLimit.findUnique({
      where: { userId_drawTypeId: { userId, drawTypeId } },
      select: { userDrawSaleLimit: true },
    });
    return drawTypeLimit?.userDrawSaleLimit ?? null;
  }

  const limit = await prisma.userRestrictionLimit.findUnique({
    where: { userId },
    select: { userDrawSaleLimit: true },
  });

  return limit?.userDrawSaleLimit ?? null;
}

export async function setUserDrawSaleLimit(userId: string, limit: number | null, drawTypeId?: string): Promise<number | null> {
  await ensureLegacyToDrawTypeMigrated();

  if (drawTypeId) {
    const updated = await prisma.userDrawTypeLimit.upsert({
      where: { userId_drawTypeId: { userId, drawTypeId } },
      create: {
        userId,
        drawTypeId,
        userDrawSaleLimit: limit,
      },
      update: {
        userDrawSaleLimit: limit,
      },
      select: { userDrawSaleLimit: true },
    });
    return updated.userDrawSaleLimit ?? null;
  }

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

export async function getUserRestrictedNumbersLimit(userId: string, drawTypeId?: string): Promise<number | null> {
  await ensureLegacyToDrawTypeMigrated();

  if (drawTypeId) {
    const drawTypeLimit = await prisma.userDrawTypeLimit.findUnique({
      where: { userId_drawTypeId: { userId, drawTypeId } },
      select: { userRestrictedNumbersLimit: true },
    });
    return drawTypeLimit?.userRestrictedNumbersLimit ?? null;
  }

  const limit = await prisma.userRestrictionLimit.findUnique({
    where: { userId },
    select: { userRestrictedNumbersLimit: true },
  });

  return limit?.userRestrictedNumbersLimit ?? null;
}

export async function setUserRestrictedNumbersLimit(userId: string, limit: number | null, drawTypeId?: string): Promise<number | null> {
  await ensureLegacyToDrawTypeMigrated();

  if (drawTypeId) {
    const updated = await prisma.userDrawTypeLimit.upsert({
      where: { userId_drawTypeId: { userId, drawTypeId } },
      create: {
        userId,
        drawTypeId,
        userRestrictedNumbersLimit: limit,
      },
      update: {
        userRestrictedNumbersLimit: limit,
      },
      select: { userRestrictedNumbersLimit: true },
    });
    return updated.userRestrictedNumbersLimit ?? null;
  }

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

export async function getAllUserRestrictionLimits(drawTypeId?: string): Promise<
  Map<string, { userGlobalLimit: number | null; userDrawSaleLimit: number | null; userRestrictedNumbersLimit: number | null }>
> {
  await ensureLegacyToDrawTypeMigrated();

  const limitsByUser = new Map<string, { userGlobalLimit: number | null; userDrawSaleLimit: number | null; userRestrictedNumbersLimit: number | null }>();

  if (drawTypeId) {
    const dtRecords = await prisma.userDrawTypeLimit.findMany({
      where: { drawTypeId },
      select: {
        userId: true,
        userGlobalLimit: true,
        userDrawSaleLimit: true,
        userRestrictedNumbersLimit: true,
      },
    });

    for (const record of dtRecords) {
      limitsByUser.set(record.userId, {
        userGlobalLimit: record.userGlobalLimit ?? null,
        userDrawSaleLimit: record.userDrawSaleLimit ?? null,
        userRestrictedNumbersLimit: record.userRestrictedNumbersLimit ?? null,
      });
    }

    return limitsByUser;
  }

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

export async function listGlobalNumberRestrictions(drawTypeId?: string): Promise<Array<{ number: string; limit: number }>> {
  await ensureLegacyToDrawTypeMigrated();

  if (drawTypeId) {
    return prisma.drawTypeRestrictedNumber.findMany({
      where: { drawTypeId },
      orderBy: { number: 'asc' },
      select: {
        number: true,
        limit: true,
      },
    });
  }

  return prisma.globalNumberRestriction.findMany({
    orderBy: { number: 'asc' },
    select: {
      number: true,
      limit: true,
    },
  });
}

export async function getGlobalNumberRestrictionByNumber(number: string, drawTypeId?: string): Promise<{ number: string; limit: number } | null> {
  await ensureLegacyToDrawTypeMigrated();

  if (drawTypeId) {
    return prisma.drawTypeRestrictedNumber.findUnique({
      where: { drawTypeId_number: { drawTypeId, number } },
      select: {
        number: true,
        limit: true,
      },
    });
  }

  return prisma.globalNumberRestriction.findUnique({
    where: { number },
    select: {
      number: true,
      limit: true,
    },
  });
}

export async function upsertGlobalNumberRestriction(number: string, limit: number, drawTypeId?: string): Promise<{ number: string; limit: number }> {
  await ensureLegacyToDrawTypeMigrated();

  if (drawTypeId) {
    const item = await prisma.drawTypeRestrictedNumber.upsert({
      where: { drawTypeId_number: { drawTypeId, number } },
      create: { drawTypeId, number, limit },
      update: { limit },
      select: {
        number: true,
        limit: true,
      },
    });
    return item;
  }

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

export async function deleteGlobalNumberRestriction(number: string, drawTypeId?: string): Promise<void> {
  await ensureLegacyToDrawTypeMigrated();

  if (drawTypeId) {
    await prisma.drawTypeRestrictedNumber.delete({
      where: { drawTypeId_number: { drawTypeId, number } },
    });
    return;
  }

  await prisma.globalNumberRestriction.delete({
    where: { number },
  });
}