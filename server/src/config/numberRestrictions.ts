import { prisma } from './prisma.js';

export const GLOBAL_NUMBER_LIMIT_SETTING_KEY = 'sales.global-number-limit';

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