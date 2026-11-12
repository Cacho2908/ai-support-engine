import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { loadEnv } from './env.js';
import { AppError } from './errors.js';
import { validateAnalyzeRequest } from './contract.js';
import { analyze } from './analyze.js';

const MAX_BODY_BYTES = 10 * 1024;

function send(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(body) });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) { reject(new AppError(413, 'BODY_TOO_LARGE', 'El cuerpo excede 10 KB.')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

export function createServer(deps = {}) {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (req.method === 'GET' && url.pathname === '/health') return send(res, 200, { status: 'ok' });
      if (url.pathname !== '/api/analyze') throw new AppError(404, 'NOT_FOUND', 'Ruta no encontrada.');
      if (req.method !== 'POST') throw new AppError(405, 'METHOD_NOT_ALLOWED', 'Use POST.');
      if (!(req.headers['content-type'] || '').includes('application/json')) {
        throw new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type debe ser application/json.');
      }
      let body;
      try { body = JSON.parse(await readBody(req)); }
      catch (e) { throw e instanceof AppError ? e : new AppError(400, 'INVALID_JSON', 'JSON mal formado.'); }

      const { message, mode } = validateAnalyzeRequest(body);
      const result = await analyze(message, mode, deps);
      console.log(`[analyze] mode=${mode} len=${message.length} -> ${result.category}/${result.priority} review=${result.requiresHumanReview}`);
      return send(res, 200, result);
    } catch (err) {
      if (err instanceof AppError) return send(res, err.status, { error: { code: err.code, message: err.message } });
      console.error('[error]', err?.name, err?.message); // nunca se registran cabeceras ni claves
      return send(res, 500, { error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor.' } });
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  loadEnv();
  const port = Number(process.env.PORT) || 3000;
  createServer().listen(port, () => console.log(`AI Support Engine escuchando en http://localhost:${port}`));
}
