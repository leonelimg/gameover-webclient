import { Request } from 'express';

/** Safely extract a string path parameter from an Express request */
export function param(req: Request, key: string): string {
  const val = req.params[key];
  return Array.isArray(val) ? val[0] ?? '' : (val ?? '');
}
