import { z } from "zod";

export const authHeaderSchema = z.object({
  authorization: z.string().optional()
});

export const testPrintSchema = z.object({
  message: z.string().min(1).max(300).default("Test print from GameOver Print Bridge")
});

export const textPrintSchema = z.object({
  text: z.string().min(1).max(4000)
});

export const ticketSchema = z.object({
  width: z.union([z.literal(58), z.literal(80)]).optional(),
  title: z.string().max(80).optional(),
  businessName: z.string().max(120).optional(),
  businessTaxId: z.string().max(40).optional(),
  drawLabel: z.string().max(120).optional(),
  drawDateIso: z.string().max(80).optional(),
  customerName: z.string().max(120).optional(),
  sellerName: z.string().max(120).optional(),
  showSpecialColumn: z.boolean().optional(),
  terminal: z.string().max(40).optional(),
  cashier: z.string().max(80).optional(),
  ticketNumber: z.string().max(60).optional(),
  dateIso: z.string().max(80).optional(),
  items: z
    .array(
      z.object({
        label: z.string().min(1).max(120),
        qty: z.number().positive().optional(),
        unitPrice: z.number().nonnegative().optional(),
        total: z.number().nonnegative().optional()
      })
    )
    .min(1),
  detailLines: z
    .array(
      z.object({
        number: z.string().min(1).max(500),
        regular: z.number().nonnegative(),
        special: z.number().nonnegative(),
        total: z.number().nonnegative()
      })
    )
    .max(200)
    .optional(),
  multipliers: z
    .object({
      regular: z.number().positive().optional(),
      special: z.number().positive().optional()
    })
    .optional(),
  totals: z.object({
    subtotal: z.number().nonnegative().optional(),
    discount: z.number().nonnegative().optional(),
    total: z.number().nonnegative(),
    paid: z.number().nonnegative().optional(),
    change: z.number().nonnegative().optional()
  }),
  notes: z.array(z.string().max(500)).max(200).optional(),
  qrText: z.string().max(300).optional(),
  footer: z.array(z.string().max(120)).max(20).optional()
});

export const ticketPrintSchema = z.object({
  ticket: ticketSchema
});
