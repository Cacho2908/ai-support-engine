// Orquestador: aplica el motor elegido y la política común.
import { classifyTraditional } from './traditional.js';
import { classifyGenerative } from './generative.js';
import { detectInjection, finalize } from './policy.js';
import { classifyWithML } from './machine-learning.js';



export async function analyze(message, mode, deps = {}) {
    const injection = detectInjection(message);

    // MOTOR TRADICIONAL
    if (mode === 'traditional') {
        const r = classifyTraditional(message);

        return finalize({
            ...r,
            mode,
            injection,
            message
        });
    }

    // MOTOR MACHINE LEARNING
    if (mode === 'ml') {
        const ml = await (deps.classifyWithML || classifyWithML)(message);

        const replies = {
            ACCESS: 'Se ha identificado una solicitud relacionada con el acceso a la cuenta. Nuestro equipo puede ayudarte a recuperar el acceso.',
            BUG: 'Se ha identificado un posible problema técnico. Nuestro equipo revisará el inconveniente reportado.',
            FEATURE: 'Se ha identificado una sugerencia de mejora. Gracias por compartir tu propuesta.',
            SECURITY: 'Se ha identificado un posible incidente de seguridad. Nuestro equipo de seguridad debe revisarlo.'
        };

        const priorities = {
            ACCESS: 'MEDIUM',
            BUG: 'MEDIUM',
            FEATURE: 'LOW',
            SECURITY: 'HIGH'
        };

        const r = {
            category: ml.category,
            priority: priorities[ml.category],
            response: replies[ml.category],
            lowConfidence: ml.confidence < 0.60
        };

        return finalize({
            ...r,
            mode,
            injection,
            message
        });
    }

    // MOTOR GENERATIVO
    const r = await classifyGenerative(message, deps);

    return finalize({
        ...r,
        mode,
        injection,
        message
    });
}
