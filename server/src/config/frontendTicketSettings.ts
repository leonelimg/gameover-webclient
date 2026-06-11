import { prisma } from './prisma.js';

export interface FrontendTicketSettings {
  ticketTitle: string;
  footerNote: string;
  ticketCodeFontSize: number;
}

export const FRONTEND_TICKET_TITLE_SETTING_KEY = 'frontend.ticket-title';
export const FRONTEND_TICKET_FOOTER_NOTE_SETTING_KEY = 'frontend.ticket-footer-note';
export const FRONTEND_TICKET_CODE_FONT_SIZE_SETTING_KEY = 'frontend.ticket-code-font-size';

export const DEFAULT_FRONTEND_TICKET_SETTINGS: FrontendTicketSettings = {
  ticketTitle: 'GameOver Loteria',
  footerNote: '',
  ticketCodeFontSize: 32,
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

function normalizeSettings(value?: Partial<FrontendTicketSettings> | null): FrontendTicketSettings {
  return {
    ticketTitle: normalizeTicketTitle(value?.ticketTitle),
    footerNote: normalizeFooterNote(value?.footerNote),
    ticketCodeFontSize: normalizeTicketCodeFontSize(value?.ticketCodeFontSize),
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
        ],
      },
    },
    select: {
      key: true,
      value: true,
    },
  });

  const map = new Map(settings.map((setting) => [setting.key, setting.value]));

  return normalizeSettings({
    ticketTitle: map.get(FRONTEND_TICKET_TITLE_SETTING_KEY) ?? undefined,
    footerNote: map.get(FRONTEND_TICKET_FOOTER_NOTE_SETTING_KEY) ?? undefined,
    ticketCodeFontSize:
      map.get(FRONTEND_TICKET_CODE_FONT_SIZE_SETTING_KEY) !== undefined
        ? Number(map.get(FRONTEND_TICKET_CODE_FONT_SIZE_SETTING_KEY))
        : undefined,
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
  ]);

  return normalized;
}