// Orquestador: aplica el motor elegido y la política común.
import { classifyTraditional } from './traditional.js';
import { classifyGenerative } from './generative.js';
import { detectInjection, finalize } from './policy.js';

export async function analyze(message, mode, deps = {}) {
  const injection = detectInjection(message);
  if (mode === 'traditional') {
    const r = classifyTraditional(message);
    return finalize({ ...r, mode, injection });
  }
  const r = await classifyGenerative(message, deps);
  return finalize({ ...r, mode, injection });
}
