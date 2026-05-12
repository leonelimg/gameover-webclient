import { Router } from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { authenticate, authorize } from '../middleware/auth.js';

interface InstallerInfo {
  filePath: string;
  fileName: string;
  sizeBytes: number;
  updatedAt: string;
}

const router = Router();
router.use(authenticate, authorize('admin', 'asociado', 'vendedor'));

const readInstallers = async (dir: string): Promise<InstallerInfo[]> => {
  const files: InstallerInfo[] = [];

  const walk = async (current: string) => {
    let entries;
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile() && /\.(exe|zip)$/i.test(entry.name)) {
        const stat = await fs.stat(fullPath);
        files.push({
          filePath: fullPath,
          fileName: entry.name,
          sizeBytes: stat.size,
          updatedAt: stat.mtime.toISOString(),
        });
      }
    }
  };

  await walk(dir);
  return files;
};

const getLatestInstaller = async (): Promise<InstallerInfo | null> => {
  const dir = config.printBridgeInstallerDir;
  
  console.log(`[Print Bridge] Buscando instaladores en: ${dir}`);

  try {
    const installers = await readInstallers(dir);
    console.log(`[Print Bridge] Encontrados ${installers.length} instaladores:`, installers.map(i => i.fileName));
    
    if (installers.length === 0) return null;

    // Prefer .zip packages over raw .exe files; within same type sort by date desc
    installers.sort((a, b) => {
      const aIsZip = a.fileName.toLowerCase().endsWith('.zip') ? 0 : 1;
      const bIsZip = b.fileName.toLowerCase().endsWith('.zip') ? 0 : 1;
      if (aIsZip !== bIsZip) return aIsZip - bIsZip;
      return a.updatedAt < b.updatedAt ? 1 : -1;
    });
    
    console.log(`[Print Bridge] Instalador seleccionado:`, installers[0].fileName);
    return installers[0];
  } catch (err) {
    console.error(`[Print Bridge] Error buscando instaladores:`, err);
    return null;
  }
};

router.get('/installer', async (_req, res) => {
  const installer = await getLatestInstaller();
  if (!installer) {
    res.status(404).json({ message: 'No hay instalador disponible.' });
    return;
  }

  res.json({
    fileName: installer.fileName,
    sizeBytes: installer.sizeBytes,
    updatedAt: installer.updatedAt,
    downloadUrl: `/api/print-bridge/installer/download`,
  });
});

router.get('/installer/download', async (_req, res) => {
  const installer = await getLatestInstaller();
  if (!installer) {
    res.status(404).json({ message: 'No hay instalador disponible.' });
    return;
  }

  res.setHeader('Cache-Control', 'no-store');
  res.download(installer.filePath, installer.fileName);
});

export default router;
