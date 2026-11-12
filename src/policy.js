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

// Señales de POSIBLE INCIDENTE DE SEGURIDAD sobre el mensaje original.
// Son independientes de la categoría que devuelva cualquier motor (tradicional o modelo).
// Es preferible sobre-marcar (revisión humana innecesaria) a dejar pasar un incidente.
const OTHERS = '(ajen[oa]s?|de otr[oa]s?\\s+(usuarios?|clientes?|personas?|cuentas?|empresas?)|de terceros|de cualquier\\s+(usuario|cliente|persona))';
const ACCESS_VERB = '(entr|acced|ingres|\\bver\\b|\\bveo\\b|\\bvi\\b|pude ver|puedo ver|lee[rn]?\\b|leo\\b|modific|cambi|descarg|abr[eo]\\b|abrir)';
const SECURITY_SIGNALS = [
  /acceso no autorizado|sin autorizacion|escalar privilegios|escalada de privilegios/,
  // acceder/ver/modificar cuentas o datos de otras personas
  new RegExp(`${ACCESS_VERB}\\w*.{0,60}\\b(cuentas?|datos|informacion|pedidos|facturas|perfil(es)?|mensajes|archivos|documentos|tickets?)\\b.{0,30}\\b${OTHERS}`),
  new RegExp(`\\b(cuentas?|datos|informacion)\\s+${OTHERS}`),
  /cualquiera\s+(puede|podria|pueda|logra)\s+(ver|acceder|entrar|leer|modificar|descargar|borrar)/,
  // saltarse la autenticación
  /(entr|acced|ingres)\w*.{0,50}\bsin\s+(contrasena|autenticacion|autenticar|permiso|permisos|credenciales)/,
  /(panel|funciones|opciones|area)\s+de\s+admin\w*.{0,40}\bsin\s+(ser|tener)/,
  /alguien mas (entro|tiene acceso|accedio)|actividad sospechosa|acceso sospechoso/,
  // ataques y amenazas explícitas
  /vulnerab|inyeccion\s+sql|sql\s*injection|\bxss\b|phishing|hacke|hackear|hackeo|ransomware|malware|exploit|\bddos\b/,
  // fugas de datos (incluye formas verbales: "se filtró", "filtraron")
  /brecha|filtracion|fuga de datos|datos expuestos|\bse filtr|\bfiltr(o|aron|ado|ada)\b/,
  // secretos expuestos
  /(token|clave|api[ _-]?key|credenciales|contrasena|secreto)s?\b.{0,40}(publico|publica|logs?|repositorio|github|expuest|texto plano)/,
];

export function detectSecuritySignal(text) {
  const t = normalize(String(text ?? ''));
  return SECURITY_SIGNALS.some((re) => re.test(t));
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
 * Revisión humana si: SECURITY, señal de seguridad en el mensaje original (independiente del
 * motor), intento de inyección, prioridad CRITICAL o baja confianza.
 * `message` es opcional (compatibilidad): si se pasa, se aplica la señal de seguridad por código.
 */
export function finalize({ category, priority, response, mode, injection = false, lowConfidence = false, message }) {
  if (!CATEGORIES.includes(category) || !PRIORITIES.includes(priority)) {
    throw new Error('finalize recibió valores fuera del contrato');
  }
  const securitySignal = message ? detectSecuritySignal(message) : false;
  return {
    category,
    priority,
    response: redactSecrets(response),
    requiresHumanReview:
      category === 'SECURITY' || securitySignal || injection || priority === 'CRITICAL' || lowConfidence,
    mode,
  };
}