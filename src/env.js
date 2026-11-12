// Cargador mínimo de .env (sin dependencias). No sobreescribe variables ya definidas.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export function loadEnv() {
  const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.env');
  let content;
  try { content = readFileSync(file, 'utf8'); } catch { return; }
  for (const line of content.split(/\r?\n/)) {
    if (line.trim().startsWith('#')) continue;
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    const value = m[2].replace(/^["']|["']$/g, '');
    if (process.env[m[1]] === undefined) process.env[m[1]] = value;
  }
}
