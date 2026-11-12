// Reglas de seguridad aplicadas por CÓDIGO a ambos motores (no dependen del modelo).
import { CATEGORIES, PRIORITIES } from './contract.js';

export function normalize(text) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

// Patrones típicos de prompt injection / intento de manipular la clasificación.
const INJECTION_PATTERNS = [
  /ignor[ae]\s+(todas?\s+)?(las\s+)?(instrucciones|reglas)/,
  /ignore\s+(all\s+)?(the\s+)?(previous|prior|above)\s+(instructions|rules)/,
  /olvida\s+(todo|las\s+instrucciones)/,
  /^\s*system\s*:/m,
  /a partir de ahora\s+(eres|actua)/,
  /eres ahora/,
  /(devuelve|responde|clasifica)\b.{0,40}\b(category|categoria|priority|prioridad)\b/,
  /clasifica\s+(esto|esta|este)\b.{0,40}\bprioridad\s+(baja|low)/,
  /(repite|repitiendo|muestra|revela|imprime)\b.{0,40}\b(api key|clave|secreto|system prompt|prompt del sistema|instrucciones)/,
];

export function detectInjection(text) {
  const t = normalize(text);
  return INJECTION_PATTERNS.some((re) => re.test(t));
}

// Redacción de secretos: se aplica a la entrada antes de enviarla a un proveedor y a la salida.
const LABEL = '(contrase[nñ]a|password|passwd|pwd|token|api[_ -]?key|secret|secreto|clave)';
const SECRET_PATTERNS = [
  /\bsk-[A-Za-z0-9_-]{16,}\b/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
  /\bBearer\s+[A-Za-z0-9._-]{16,}/gi,
  new RegExp(`\\b${LABEL}\\s*(?:es|is|:|=)\\s*[^\\s,;]+`, 'gi'),
];

export function redactSecrets(text) {
  let out = text;
  for (const re of SECRET_PATTERNS) {
    out = out.replace(re, (m) => {
      const label = m.match(new RegExp(`^${LABEL}`, 'i'));
      return label ? `${label[0]}: [REDACTADO]` : '[REDACTADO]';
    });
  }
  return out;
}

/**
 * Construye la respuesta final con el contrato común.
 * Revisión humana si: SECURITY, intento de inyección, prioridad CRITICAL o baja confianza.
 */
export function finalize({ category, priority, response, mode, injection = false, lowConfidence = false }) {
  if (!CATEGORIES.includes(category) || !PRIORITIES.includes(priority)) {
    throw new Error('finalize recibió valores fuera del contrato');
  }
  return {
    category,
    priority,
    response: redactSecrets(response),
    requiresHumanReview: category === 'SECURITY' || injection || priority === 'CRITICAL' || lowConfidence,
    mode,
  };
}
