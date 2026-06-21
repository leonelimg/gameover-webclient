import { prisma } from './prisma.js';

export const REPORTING_FILTER_SETTINGS_KEY = 'reports.draw-filter-settings';

export const REPORTING_FILTER_SECTION_KEYS = [
  'reports.sales-stats.summary',
  'reports.sales-stats.top-numbers',
  'reports.sales-stats.recent-tickets',
  'reports.balance-breakdown',
  'reports.sales-by-user',
  'reports.commissions',
  'reports.draw-lists',
  'cash-movements.balance',
  'cash-movements.summary-by-event',
] as const;

export type ReportingFilterSectionKey = (typeof REPORTING_FILTER_SECTION_KEYS)[number];

export interface DrawFilterRule {
  requireFinalized: boolean;
  requireWinnerDefined: boolean;
}

export interface ReportingFilterSettings {
  sections: Record<ReportingFilterSectionKey, DrawFilterRule>;
}

const DEFAULT_RULE: DrawFilterRule = {
  requireFinalized: true,
  requireWinnerDefined: true,
};

export const DEFAULT_REPORTING_FILTER_SETTINGS: ReportingFilterSettings = {
  sections: {
    'reports.sales-stats.summary': DEFAULT_RULE,
    'reports.sales-stats.top-numbers': DEFAULT_RULE,
    'reports.sales-stats.recent-tickets': DEFAULT_RULE,
    'reports.balance-breakdown': DEFAULT_RULE,
    'reports.sales-by-user': DEFAULT_RULE,
    'reports.commissions': DEFAULT_RULE,
    'reports.draw-lists': {
      requireFinalized: false,
      requireWinnerDefined: false,
    },
    'cash-movements.balance': DEFAULT_RULE,
    'cash-movements.summary-by-event': DEFAULT_RULE,
  },
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function normalizeReportingFilterSettings(value: unknown): ReportingFilterSettings {
  const source = isObject(value) ? value : {};
  const sourceSections = isObject(source.sections) ? source.sections : {};

  const sections = REPORTING_FILTER_SECTION_KEYS.reduce<Record<ReportingFilterSectionKey, DrawFilterRule>>(
    (acc, sectionKey) => {
      const defaults = DEFAULT_REPORTING_FILTER_SETTINGS.sections[sectionKey];
      const rawRule = isObject(sourceSections[sectionKey]) ? sourceSections[sectionKey] : {};

      acc[sectionKey] = {
        requireFinalized: toBoolean(rawRule.requireFinalized, defaults.requireFinalized),
        requireWinnerDefined: toBoolean(rawRule.requireWinnerDefined, defaults.requireWinnerDefined),
      };

      return acc;
    },
    {} as Record<ReportingFilterSectionKey, DrawFilterRule>
  );

  return { sections };
}

export async function getReportingFilterSettings(): Promise<ReportingFilterSettings> {
  const setting = await prisma.systemSetting.findUnique({
    where: { key: REPORTING_FILTER_SETTINGS_KEY },
    select: { value: true },
  });

  if (!setting?.value) {
    return DEFAULT_REPORTING_FILTER_SETTINGS;
  }

  try {
    return normalizeReportingFilterSettings(JSON.parse(setting.value));
  } catch {
    return DEFAULT_REPORTING_FILTER_SETTINGS;
  }
}

export async function setReportingFilterSettings(
  value: ReportingFilterSettings
): Promise<ReportingFilterSettings> {
  const normalized = normalizeReportingFilterSettings(value);

  await prisma.systemSetting.upsert({
    where: { key: REPORTING_FILTER_SETTINGS_KEY },
    create: {
      key: REPORTING_FILTER_SETTINGS_KEY,
      value: JSON.stringify(normalized),
    },
    update: {
      value: JSON.stringify(normalized),
    },
  });

  return normalized;
}
