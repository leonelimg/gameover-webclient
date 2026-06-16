import { prisma } from './prisma.js';

export interface FrontendTicketSettings {
  ticketTitle: string;
  footerNote: string;
  ticketCodeFontSize: number;
  defaultTicketWidth: 58 | 80;
  sellerTicketWidths: Record<string, 58 | 80>;
}

export const FRONTEND_TICKET_TITLE_SETTING_KEY = 'frontend.ticket-title';
export const FRONTEND_TICKET_FOOTER_NOTE_SETTING_KEY = 'frontend.ticket-footer-note';
export const FRONTEND_TICKET_CODE_FONT_SIZE_SETTING_KEY = 'frontend.ticket-code-font-size';
export const FRONTEND_TICKET_DEFAULT_WIDTH_SETTING_KEY = 'frontend.ticket-default-width';
export const FRONTEND_TICKET_SELLER_WIDTHS_SETTING_KEY = 'frontend.ticket-seller-widths';

export const DEFAULT_FRONTEND_TICKET_SETTINGS: FrontendTicketSettings = {
  ticketTitle: 'GameOver Loteria',
  footerNote: '',
  ticketCodeFontSize: 32,
  defaultTicketWidth: 80,
  sellerTicketWidths: {},
};

function normalizeTicketTitle(value: string | null | undefined): string {
  const trimmed = (value ?? '').trim();
  return trimmed || DEFAULT_FRONTEND_TICKET_SETTINGS.ticketTitle;
}

function normalizeFooterNote(value: string | null | undefined): string {
  return (value ?? '').replace(/\r\n/g, '\n').trim();
}

function normalizeTicketCodeFontSize(value: number | string | null | undefined): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_FRONTEND_TICKET_SETTINGS.ticketCodeFontSize;
  }

  const rounded = Math.round(parsed);
  return Math.min(64, Math.max(18, rounded));
}

function normalizeTicketWidth(value: number | string | null | undefined): 58 | 80 {
  const parsed = typeof value === 'number' ? value : Number(value);
  return parsed === 58 ? 58 : 80;
}

function normalizeSellerTicketWidths(
  value: Record<string, number | string | null | undefined> | string | null | undefined
): Record<string, 58 | 80> {
  const source: Record<string, number | string | null | undefined> =
    typeof value === 'string'
      ? (() => {
          try {
            const parsed = JSON.parse(value) as unknown;
            return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, number | string | null | undefined>) : {};
          } catch {
            return {};
          }
        })()
      : value ?? {};

  const normalized: Record<string, 58 | 80> = {};
  for (const [sellerId, width] of Object.entries(source)) {
    const key = sellerId.trim();
    if (!key) {
      continue;
    }
    normalized[key] = normalizeTicketWidth(width);
  }

  return normalized;
}

function normalizeSettings(value?: Partial<FrontendTicketSettings> | null): FrontendTicketSettings {
  return {
    ticketTitle: normalizeTicketTitle(value?.ticketTitle),
    footerNote: normalizeFooterNote(value?.footerNote),
    ticketCodeFontSize: normalizeTicketCodeFontSize(value?.ticketCodeFontSize),
    defaultTicketWidth: normalizeTicketWidth(value?.defaultTicketWidth),
    sellerTicketWidths: normalizeSellerTicketWidths(value?.sellerTicketWidths),
  };
}

export async function getFrontendTicketSettings(): Promise<FrontendTicketSettings> {
  const settings = await prisma.systemSetting.findMany({
    where: {
      key: {
        in: [
          FRONTEND_TICKET_TITLE_SETTING_KEY,
          FRONTEND_TICKET_FOOTER_NOTE_SETTING_KEY,
          FRONTEND_TICKET_CODE_FONT_SIZE_SETTING_KEY,
          FRONTEND_TICKET_DEFAULT_WIDTH_SETTING_KEY,
          FRONTEND_TICKET_SELLER_WIDTHS_SETTING_KEY,
        ],
      },
    },
    select: {
      key: true,
      value: true,
    },
  });

  const map = new Map(settings.map((setting) => [setting.key, setting.value]));
  const storedDefaultWidth = map.get(FRONTEND_TICKET_DEFAULT_WIDTH_SETTING_KEY);
  const storedSellerWidths = map.get(FRONTEND_TICKET_SELLER_WIDTHS_SETTING_KEY);

  return normalizeSettings({
    ticketTitle: map.get(FRONTEND_TICKET_TITLE_SETTING_KEY) ?? undefined,
    footerNote: map.get(FRONTEND_TICKET_FOOTER_NOTE_SETTING_KEY) ?? undefined,
    ticketCodeFontSize:
      map.get(FRONTEND_TICKET_CODE_FONT_SIZE_SETTING_KEY) !== undefined
        ? Number(map.get(FRONTEND_TICKET_CODE_FONT_SIZE_SETTING_KEY))
        : undefined,
    defaultTicketWidth: storedDefaultWidth !== undefined ? normalizeTicketWidth(storedDefaultWidth) : undefined,
    sellerTicketWidths: storedSellerWidths !== undefined ? normalizeSellerTicketWidths(storedSellerWidths) : undefined,
  });
}

export async function setFrontendTicketSettings(value: FrontendTicketSettings): Promise<FrontendTicketSettings> {
  const normalized = normalizeSettings(value);

  await prisma.$transaction([
    prisma.systemSetting.upsert({
      where: { key: FRONTEND_TICKET_TITLE_SETTING_KEY },
      create: {
        key: FRONTEND_TICKET_TITLE_SETTING_KEY,
        value: normalized.ticketTitle,
      },
      update: {
        value: normalized.ticketTitle,
      },
    }),
    prisma.systemSetting.upsert({
      where: { key: FRONTEND_TICKET_FOOTER_NOTE_SETTING_KEY },
      create: {
        key: FRONTEND_TICKET_FOOTER_NOTE_SETTING_KEY,
        value: normalized.footerNote || null,
      },
      update: {
        value: normalized.footerNote || null,
      },
    }),
    prisma.systemSetting.upsert({
      where: { key: FRONTEND_TICKET_CODE_FONT_SIZE_SETTING_KEY },
      create: {
        key: FRONTEND_TICKET_CODE_FONT_SIZE_SETTING_KEY,
        value: String(normalized.ticketCodeFontSize),
      },
      update: {
        value: String(normalized.ticketCodeFontSize),
      },
    }),
    prisma.systemSetting.upsert({
      where: { key: FRONTEND_TICKET_DEFAULT_WIDTH_SETTING_KEY },
      create: {
        key: FRONTEND_TICKET_DEFAULT_WIDTH_SETTING_KEY,
        value: String(normalized.defaultTicketWidth),
      },
      update: {
        value: String(normalized.defaultTicketWidth),
      },
    }),
    prisma.systemSetting.upsert({
      where: { key: FRONTEND_TICKET_SELLER_WIDTHS_SETTING_KEY },
      create: {
        key: FRONTEND_TICKET_SELLER_WIDTHS_SETTING_KEY,
        value: JSON.stringify(normalized.sellerTicketWidths),
      },
      update: {
        value: JSON.stringify(normalized.sellerTicketWidths),
      },
    }),
  ]);

  return normalized;
}