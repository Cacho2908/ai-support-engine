// Contrato compartido por ambos motores + validación de entrada.
import { AppError } from './errors.js';

export const CATEGORIES = ['ACCESS', 'BUG', 'FEATURE', 'SECURITY'];
export const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
export const MODES = ['traditional', 'generative'];
export const MAX_MESSAGE_LENGTH = 2000;

/** Valida el cuerpo de POST /api/analyze. Lanza AppError(400) si es inválido. */
export function validateAnalyzeRequest(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new AppError(400, 'INVALID_BODY', 'El cuerpo debe ser un objeto JSON.');
  }
  const { message, mode = 'traditional' } = body;
  if (typeof message !== 'string') {
    throw new AppError(400, 'INVALID_MESSAGE', '"message" es obligatorio y debe ser texto.');
  }
  const trimmed = message.trim();
  if (trimmed.length === 0) {
    throw new AppError(400, 'INVALID_MESSAGE', '"message" no puede estar vacío.');
  }
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    throw new AppError(400, 'INVALID_MESSAGE', `"message" excede ${MAX_MESSAGE_LENGTH} caracteres.`);
  }
  if (!MODES.includes(mode)) {
    throw new AppError(400, 'INVALID_MODE', `"mode" debe ser uno de: ${MODES.join(', ')}.`);
  }
  return { message: trimmed, mode };
}

/** Verifica que un objeto cumpla el contrato de respuesta final. Devuelve lista de errores. */
export function checkResponseContract(r) {
  const errors = [];
  if (!r || typeof r !== 'object') return ['la respuesta no es un objeto'];
  if (!CATEGORIES.includes(r.category)) errors.push('category inválida');
  if (!PRIORITIES.includes(r.priority)) errors.push('priority inválida');
  if (typeof r.response !== 'string' || r.response.trim().length === 0) errors.push('response vacío o no es texto');
  if (typeof r.requiresHumanReview !== 'boolean') errors.push('requiresHumanReview no es booleano');
  if (!MODES.includes(r.mode)) errors.push('mode inválido');
  return errors;
}
