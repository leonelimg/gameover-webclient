import { Router } from 'express';
import { z } from 'zod';
import {
  DEFAULT_FRONTEND_TICKET_SETTINGS,
  FRONTEND_TICKET_CODE_FONT_SIZE_SETTING_KEY,
  FRONTEND_TICKET_FOOTER_NOTE_SETTING_KEY,
  FRONTEND_TICKET_TITLE_SETTING_KEY,
  getFrontendTicketSettings,
  setFrontendTicketSettings,
} from '../config/frontendTicketSettings.js';
import { prisma } from '../config/prisma.js';
import { authenticate, authorizeAnyResource, authorizeResource } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();
router.use(authenticate);

const frontendTicketSettingsSchema = z.object({
  ticketTitle: z.string().trim().min(1).max(60),
  footerNote: z.string().max(240),
  ticketCodeFontSize: z.number().int().min(18).max(64),
});

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
        entityId: `${FRONTEND_TICKET_TITLE_SETTING_KEY},${FRONTEND_TICKET_FOOTER_NOTE_SETTING_KEY},${FRONTEND_TICKET_CODE_FONT_SIZE_SETTING_KEY}`,
        userId: req.user!.sub,
        details: {
          ticketTitle: settings.ticketTitle,
          footerNote: settings.footerNote,
          ticketCodeFontSize: settings.ticketCodeFontSize,
          defaults: {
            ticketTitle: DEFAULT_FRONTEND_TICKET_SETTINGS.ticketTitle,
            footerNote: DEFAULT_FRONTEND_TICKET_SETTINGS.footerNote,
            ticketCodeFontSize: DEFAULT_FRONTEND_TICKET_SETTINGS.ticketCodeFontSize,
          },
        },
      },
    });

    res.json(settings);
  }
);

export default router;