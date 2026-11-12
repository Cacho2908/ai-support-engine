// Motor tradicional: IA simbólica basada en reglas ponderadas. Sin modelos generativos.
import { normalize } from './policy.js';

// [regex sobre texto normalizado (minúsculas, sin acentos), peso]
const RULES = {
  SECURITY: [
    [/vulnerab/, 3], [/inyeccion\s+sql|sql\s*injection|\bxss\b/, 3], [/phishing/, 3],
    [/hacke|hackear|hackeo/, 3], [/brecha|filtracion|fuga de datos|datos expuestos|expuest[oa]/, 3],
    [/ransomware|malware|virus/, 3], [/acceso no autorizado|sin autorizacion/, 3],
    [/robo|robaron|robar/, 2], [/comprometid[oa]/, 3], [/exploit|ataque|ddos/, 3],
    [/actividad sospechosa|acceso sospechoso/, 3], [/alguien mas (entro|tiene acceso|accedio)/, 3],
    [/texto plano/, 2], [/seguridad/, 1],
  ],
  ACCESS: [
    [/iniciar sesion|inicio de sesion|\blogin\b|log in/, 3], [/no puedo (entrar|acceder|ingresar)/, 3],
    [/cuenta bloquead[ao]|cuenta suspendid[ao]/, 3], [/acceso denegado/, 3],
    [/contrasena|password/, 1], [/restablecer|recuperar|olvide/, 1],
    [/\b2fa\b|verificacion en dos pasos|codigo de verificacion/, 2], [/\bsso\b|permisos/, 2],
  ],
  BUG: [
    [/se cierra|se congela|se cuelga|crash/, 3], [/no funciona|no carga|no responde|no guarda/, 3],
    [/\bbug\b|\bfalla\b|\bfallo\b|excepcion|pantalla en blanco/, 3],
    [/\berror\b|\b500\b|\b404\b/, 1], [/lent[oa]|tarda mucho/, 2], [/se cae|caido|caida/, 2],
    [/duplicad[oa]|incorrect[oa]|se queda cargando/, 2], [/raro/, 1],
  ],
  FEATURE: [
    [/me gustaria|quisiera|seria util|seria genial/, 3], [/agreg(ar|uen|ar)|anadir|anadan|incluir/, 2],
    [/funcionalidad nueva|nueva funcion|nueva funcionalidad|sugerencia|sugiero/, 3],
    [/modo oscuro|exportar|integracion|\bfeature\b/, 1], [/mejora|opcion de|poder\b/, 1],
  ],
};
const TIE_ORDER = ['SECURITY', 'ACCESS', 'BUG', 'FEATURE'];

const REPLIES = {
  ACCESS: 'Lamentamos el inconveniente. Verifique sus credenciales y utilice la recuperación de contraseña si es necesario. Si el problema continúa, nuestro equipo de soporte le ayudará a restablecer el acceso.',
  BUG: 'Gracias por reportar el problema. Hemos registrado la falla y nuestro equipo técnico la investigará. Si puede, indíquenos los pasos para reproducirla y capturas de pantalla.',
  FEATURE: 'Gracias por su sugerencia. La hemos registrado y se evaluará para futuras versiones del producto. Le avisaremos si se incorpora a la hoja de ruta.',
  SECURITY: 'Gracias por reportar este asunto de seguridad. Lo hemos escalado de inmediato a nuestro equipo de seguridad, que lo revisará con prioridad. Por favor no comparta detalles sensibles por canales públicos.',
};

function score(text) {
  const totals = Object.fromEntries(TIE_ORDER.map((c) => [c, 0]));
  for (const c of TIE_ORDER) for (const [re, w] of RULES[c]) if (re.test(text)) totals[c] += w;
  return totals;
}

function priorityFor(category, t) {
  const critical = /produccion.*(caid|down|no funciona|no responde)|(caid|down).*produccion|perdida de datos|se perdieron|borro (mis |los )?datos/.test(t);
  switch (category) {
    case 'SECURITY':
      return /filtracion|fuga|brecha|ransomware|robo de datos|robaron|expuest[oa].*(clientes|produccion|publicamente)|(clientes|produccion).*expuest|en produccion|activamente|ahora mismo|hackearon|hackeado|comprometid/.test(t)
        ? 'CRITICAL' : 'HIGH';
    case 'ACCESS':
      return /\b(todos|nadie)\b|varios usuarios|toda la empresa|equipo completo|admin|urgente|no puedo trabajar/.test(t)
        ? 'HIGH' : 'MEDIUM';
    case 'BUG':
      if (critical) return 'CRITICAL';
      if (/ortografia|tipografia|alineacion|cosmetic|detalle visual|pequeno/.test(t)) return 'LOW';
      if (/no funciona|se cae|caido|pierd|pago|facturacion|\b(todos|nadie)\b|urgente|bloquea/.test(t)) return 'HIGH';
      return 'MEDIUM';
    case 'FEATURE':
      return /muchos clientes|varios clientes|necesitamos|requisito/.test(t) ? 'MEDIUM' : 'LOW';
    default:
      return 'MEDIUM';
  }
}

/** @returns {{category, priority, response, lowConfidence, scores}} */
export function classifyTraditional(message) {
  const t = normalize(message);
  const scores = score(t);
  const best = Math.max(...Object.values(scores));
  if (best === 0) {
    // Sin coincidencias: valor por defecto prudente + revisión humana.
    return { category: 'BUG', priority: 'MEDIUM', response: REPLIES.BUG, lowConfidence: true, scores };
  }
  const category = TIE_ORDER.find((c) => scores[c] === best);
  return { category, priority: priorityFor(category, t), response: REPLIES[category], lowConfidence: false, scores };
}
