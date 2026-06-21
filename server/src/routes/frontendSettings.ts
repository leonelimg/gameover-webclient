import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import {
  DEFAULT_FRONTEND_TICKET_SETTINGS,
  FRONTEND_TICKET_CODE_FONT_SIZE_SETTING_KEY,
  FRONTEND_TICKET_DEFAULT_WIDTH_SETTING_KEY,
  FRONTEND_TICKET_FOOTER_NOTE_SETTING_KEY,
  FRONTEND_TICKET_SELLER_WIDTHS_SETTING_KEY,
  FRONTEND_TICKET_TITLE_SETTING_KEY,
  getFrontendTicketSettings,
  setFrontendTicketSettings,
} from '../config/frontendTicketSettings.js';
import {
  REPORTING_FILTER_SECTION_KEYS,
  REPORTING_FILTER_SETTINGS_KEY,
  getReportingFilterSettings,
  normalizeReportingFilterSettings,
  setReportingFilterSettings,
} from '../config/reportingFilterSettings.js';
import { prisma } from '../config/prisma.js';
import { authenticate, authorizeAnyResource, authorizeResource } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();
router.use(authenticate);

const frontendTicketSettingsSchema = z.object({
  ticketTitle: z.string().trim().min(1).max(60),
  footerNote: z.string().max(240),
  ticketCodeFontSize: z.number().int().min(18).max(64),
  defaultTicketWidth: z.union([z.literal(58), z.literal(80)]),
  sellerTicketWidths: z.record(z.string(), z.union([z.literal(58), z.literal(80)])),
});

const reportingFilterRuleSchema = z.object({
  requireFinalized: z.boolean(),
  requireWinnerDefined: z.boolean(),
});

const reportingFilterSettingsSchema = z.object({
  sections: z.record(z.enum(REPORTING_FILTER_SECTION_KEYS), reportingFilterRuleSchema),
});

router.get(
  '/ticket-vendor-widths',
  authorizeResource('/roles:update'),
  async (_req, res) => {
    const [settings, sellers] = await Promise.all([
      getFrontendTicketSettings(),
      prisma.user.findMany({
        where: { role: 'vendedor', status: { not: 'archivado' } },
        select: {
          id: true,
          fullName: true,
          username: true,
          status: true,
        },
        orderBy: [{ fullName: 'asc' }],
      }),
    ]);

    res.json({
      defaultTicketWidth: settings.defaultTicketWidth,
      sellers: sellers.map((seller) => ({
        ...seller,
        ticketWidth: settings.sellerTicketWidths[seller.id] ?? settings.defaultTicketWidth,
      })),
    });
  }
);

router.get(
  '/ticket-appearance',
  authorizeAnyResource('/sales', '/reports/sales-by-user', '/roles:update'),
  async (_req, res) => {
    const settings = await getFrontendTicketSettings();
    res.json(settings);
  }
);

router.patch(
  '/ticket-appearance',
  authorizeResource('/roles:update'),
  validate(frontendTicketSettingsSchema),
  async (req, res) => {
    const body = req.body as z.infer<typeof frontendTicketSettingsSchema>;
    const settings = await setFrontendTicketSettings(body);

    await prisma.auditLog.create({
      data: {
        action: 'UPDATE_FRONTEND_TICKET_SETTINGS',
        entity: 'SystemSetting',
        entityId: `${FRONTEND_TICKET_TITLE_SETTING_KEY},${FRONTEND_TICKET_FOOTER_NOTE_SETTING_KEY},${FRONTEND_TICKET_CODE_FONT_SIZE_SETTING_KEY},${FRONTEND_TICKET_DEFAULT_WIDTH_SETTING_KEY},${FRONTEND_TICKET_SELLER_WIDTHS_SETTING_KEY}`,
        userId: req.user!.sub,
        details: {
          ticketTitle: settings.ticketTitle,
          footerNote: settings.footerNote,
          ticketCodeFontSize: settings.ticketCodeFontSize,
          defaultTicketWidth: settings.defaultTicketWidth,
          sellerTicketWidths: settings.sellerTicketWidths,
          defaults: {
            ticketTitle: DEFAULT_FRONTEND_TICKET_SETTINGS.ticketTitle,
            footerNote: DEFAULT_FRONTEND_TICKET_SETTINGS.footerNote,
            ticketCodeFontSize: DEFAULT_FRONTEND_TICKET_SETTINGS.ticketCodeFontSize,
            defaultTicketWidth: DEFAULT_FRONTEND_TICKET_SETTINGS.defaultTicketWidth,
            sellerTicketWidths: DEFAULT_FRONTEND_TICKET_SETTINGS.sellerTicketWidths,
          },
        },
      },
    });

    res.json(settings);
  }
);

router.get(
  '/reporting-filters',
  authorizeResource('/frontend-settings/reporting-filters'),
  async (_req, res) => {
    const settings = await getReportingFilterSettings();
    res.json(settings);
  }
);

router.patch(
  '/reporting-filters',
  authorizeResource('/frontend-settings/reporting-filters'),
  validate(reportingFilterSettingsSchema),
  async (req, res) => {
    const body = req.body as z.infer<typeof reportingFilterSettingsSchema>;
    const settings = await setReportingFilterSettings(normalizeReportingFilterSettings(body));
    const settingsDetails = JSON.parse(JSON.stringify(settings)) as Prisma.InputJsonValue;

    await prisma.auditLog.create({
      data: {
        action: 'UPDATE_REPORTING_FILTER_SETTINGS',
        entity: 'SystemSetting',
        entityId: REPORTING_FILTER_SETTINGS_KEY,
        userId: req.user!.sub,
        details: settingsDetails,
      },
    });

    res.json(settings);
  }
);

export default router;