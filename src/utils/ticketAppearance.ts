import { frontendSettingsApi } from '@/services/api';
import { FrontendTicketSettings } from '@/types';

export const DEFAULT_FRONTEND_TICKET_SETTINGS: FrontendTicketSettings = {
  ticketTitle: 'GameOver Loteria',
  footerNote: '',
  ticketCodeFontSize: 32,
};

let cachedFrontendTicketSettings: FrontendTicketSettings = DEFAULT_FRONTEND_TICKET_SETTINGS;
let frontendTicketSettingsPromise: Promise<FrontendTicketSettings> | null = null;

const normalizeTicketTitle = (value: string | null | undefined) => {
  const trimmed = (value ?? '').trim();
  return trimmed || DEFAULT_FRONTEND_TICKET_SETTINGS.ticketTitle;
};

const normalizeFooterNote = (value: string | null | undefined) => {
  return (value ?? '').replace(/\r\n/g, '\n').trim();
};

const normalizeTicketCodeFontSize = (value: number | string | null | undefined) => {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_FRONTEND_TICKET_SETTINGS.ticketCodeFontSize;
  }

  const rounded = Math.round(parsed);
  return Math.min(64, Math.max(18, rounded));
};

const normalizeSettings = (value?: Partial<FrontendTicketSettings> | null): FrontendTicketSettings => ({
  ticketTitle: normalizeTicketTitle(value?.ticketTitle),
  footerNote: normalizeFooterNote(value?.footerNote),
  ticketCodeFontSize: normalizeTicketCodeFontSize(value?.ticketCodeFontSize),
});

const setCachedFrontendTicketSettings = (value?: Partial<FrontendTicketSettings> | null): FrontendTicketSettings => {
  cachedFrontendTicketSettings = normalizeSettings(value);
  return cachedFrontendTicketSettings;
};

export const getFrontendTicketSettings = (): FrontendTicketSettings => cachedFrontendTicketSettings;

export const loadFrontendTicketSettings = async (force = false): Promise<FrontendTicketSettings> => {
  if (force || !frontendTicketSettingsPromise) {
    frontendTicketSettingsPromise = frontendSettingsApi.getTicketAppearance()
      .then((settings) => setCachedFrontendTicketSettings(settings))
      .catch(() => cachedFrontendTicketSettings);
  }

  const settings = await frontendTicketSettingsPromise;
  if (force) {
    frontendTicketSettingsPromise = Promise.resolve(settings);
  }
  return settings;
};

export const saveFrontendTicketSettings = async (value: Partial<FrontendTicketSettings>): Promise<FrontendTicketSettings> => {
  const normalized = normalizeSettings(value);
  const saved = await frontendSettingsApi.updateTicketAppearance(normalized);
  const cached = setCachedFrontendTicketSettings(saved);
  frontendTicketSettingsPromise = Promise.resolve(cached);
  return cached;
};

export const resetFrontendTicketSettings = async (): Promise<FrontendTicketSettings> => {
  return saveFrontendTicketSettings(DEFAULT_FRONTEND_TICKET_SETTINGS);
};

export const getFrontendTicketFooterLines = (multiplier?: number): string[] | undefined => {
  const settings = cachedFrontendTicketSettings;
  const lines: string[] = [];

  if (typeof multiplier === 'number') {
    lines.push(`Multiplicador: ${multiplier}x`);
  }

  if (settings.footerNote) {
    lines.push(...settings.footerNote.split('\n').map((line) => line.trim()).filter(Boolean));
  }

  return lines.length > 0 ? lines : undefined;
};