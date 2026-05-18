import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { prisma } from '../config/prisma.js';
import { authenticate, authorizeResource } from '../middleware/auth.js';
import { param } from '../middleware/params.js';

const router = Router();
router.use(authenticate);

// ── Multer storage ────────────────────────────────────────────────────────────

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'announcements');

// Ensure upload dir exists at startup
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    cb(null, `${unique}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos de imagen.'));
    }
  },
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildImageUrl(filename: string): string {
  return `/public/announcements/${filename}`;
}

function deleteImageFile(imageUrl: string | null | undefined): void {
  if (!imageUrl) return;
  const filename = path.basename(imageUrl);
  const filePath = path.join(UPLOAD_DIR, filename);
  fs.unlink(filePath, () => { /* ignore */ });
}

const createdBySelect = { select: { id: true, fullName: true, username: true } };

// ── Validation schemas ────────────────────────────────────────────────────────

const announcementSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres.'),
  message: z.string().optional(),
  startDate: z.string().min(1, 'La fecha de inicio es requerida.'),
  endDate: z.string().min(1, 'La fecha de fin es requerida.'),
});

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /api/announcements/active — active (date range) and not dismissed by user
router.get('/active', async (req, res) => {
  const userId = req.user!.sub;
  const now = new Date();

  const dismissed = await prisma.announcementDismissal.findMany({
    where: { userId },
    select: { announcementId: true },
  });
  const dismissedIds = dismissed.map((d) => d.announcementId);

  const announcements = await prisma.announcement.findMany({
    where: {
      startDate: { lte: now },
      endDate: { gte: now },
      ...(dismissedIds.length > 0 && { id: { notIn: dismissedIds } }),
    },
    include: { createdBy: createdBySelect },
    orderBy: { createdAt: 'asc' },
  });

  res.json(announcements);
});

// GET /api/announcements — full list (admin)
router.get('/', authorizeResource('/announcements'), async (_req, res) => {
  const announcements = await prisma.announcement.findMany({
    include: { createdBy: createdBySelect },
    orderBy: { createdAt: 'desc' },
  });
  res.json(announcements);
});

// POST /api/announcements/:id/dismiss
router.post('/:id/dismiss', async (req, res) => {
  const id = param(req, 'id');
  const userId = req.user!.sub;

  const announcement = await prisma.announcement.findUnique({ where: { id } });
  if (!announcement) {
    res.status(404).json({ message: 'Anuncio no encontrado.' });
    return;
  }

  await prisma.announcementDismissal.upsert({
    where: { announcementId_userId: { announcementId: id, userId } },
    create: { announcementId: id, userId },
    update: {},
  });

  res.status(204).send();
});

// POST /api/announcements — create
router.post(
  '/',
  authorizeResource('/announcements:create'),
  upload.single('image'),
  async (req, res) => {
    const parsed = announcementSchema.safeParse(req.body);
    if (!parsed.success) {
      if (req.file) deleteImageFile(buildImageUrl(req.file.filename));
      res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Datos inválidos.' });
      return;
    }

    const { name, message, startDate, endDate } = parsed.data;
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      if (req.file) deleteImageFile(buildImageUrl(req.file.filename));
      res.status(400).json({ message: 'Fechas inválidas.' });
      return;
    }
    if (end <= start) {
      if (req.file) deleteImageFile(buildImageUrl(req.file.filename));
      res.status(400).json({ message: 'La fecha de fin debe ser posterior a la de inicio.' });
      return;
    }

    const imageUrl = req.file ? buildImageUrl(req.file.filename) : null;

    const announcement = await prisma.announcement.create({
      data: {
        name,
        message: message || null,
        imageUrl,
        startDate: start,
        endDate: end,
        createdById: req.user!.sub,
      },
      include: { createdBy: createdBySelect },
    });

    res.status(201).json(announcement);
  }
);

// PATCH /api/announcements/:id — update
router.patch(
  '/:id',
  authorizeResource('/announcements:update'),
  upload.single('image'),
  async (req, res) => {
    const id = param(req, 'id');
    const existing = await prisma.announcement.findUnique({ where: { id } });
    if (!existing) {
      if (req.file) deleteImageFile(buildImageUrl(req.file.filename));
      res.status(404).json({ message: 'Anuncio no encontrado.' });
      return;
    }

    const parsed = announcementSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      if (req.file) deleteImageFile(buildImageUrl(req.file.filename));
      res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Datos inválidos.' });
      return;
    }

    const { name, message, startDate, endDate } = parsed.data;

    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    if (start && isNaN(start.getTime())) {
      if (req.file) deleteImageFile(buildImageUrl(req.file.filename));
      res.status(400).json({ message: 'Fecha de inicio inválida.' });
      return;
    }
    if (end && isNaN(end.getTime())) {
      if (req.file) deleteImageFile(buildImageUrl(req.file.filename));
      res.status(400).json({ message: 'Fecha de fin inválida.' });
      return;
    }
    const resolvedStart = start ?? existing.startDate;
    const resolvedEnd = end ?? existing.endDate;
    if (resolvedEnd <= resolvedStart) {
      if (req.file) deleteImageFile(buildImageUrl(req.file.filename));
      res.status(400).json({ message: 'La fecha de fin debe ser posterior a la de inicio.' });
      return;
    }

    // Determine new imageUrl
    let imageUrl: string | null = existing.imageUrl;
    const clearImage = req.body.clearImage === 'true';

    if (req.file) {
      // New image uploaded — delete old one
      deleteImageFile(existing.imageUrl);
      imageUrl = buildImageUrl(req.file.filename);
    } else if (clearImage) {
      deleteImageFile(existing.imageUrl);
      imageUrl = null;
    }

    const updated = await prisma.announcement.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(message !== undefined && { message: message || null }),
        imageUrl,
        startDate: resolvedStart,
        endDate: resolvedEnd,
      },
      include: { createdBy: createdBySelect },
    });

    res.json(updated);
  }
);

// DELETE /api/announcements/:id
router.delete('/:id', authorizeResource('/announcements:delete'), async (req, res) => {
  const id = param(req, 'id');
  const existing = await prisma.announcement.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ message: 'Anuncio no encontrado.' });
    return;
  }

  deleteImageFile(existing.imageUrl);
  await prisma.announcement.delete({ where: { id } });
  res.status(204).send();
});

export default router;
