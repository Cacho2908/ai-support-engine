## INTEGRANTES##
-Héctor Ulises Cacho Gonzalez
-Fátima Avelino Celis
-María Fernanda Fuentes Abascal 

# AI Support Engine

Clasificador de solicitudes de soporte con **dos motores** que comparten el mismo contrato de respuesta:

| Motor | `mode` | Técnica |
|---|---|---|
| Tradicional | `traditional` | IA simbólica: reglas ponderadas por palabras clave + reglas de prioridad. Sin modelos generativos. |
| Generativo | `generative` | LLM real (Anthropic API u Ollama local) con salida JSON validada. |

Cero dependencias externas: solo **Node.js ≥ 18**.

## Ejecución

```bash
cp .env.example .env      # completa tu configuración (el .env está en .gitignore)
npm start                 # http://localhost:3000
npm test                  # pruebas automáticas
npm run eval              # ejecuta ambos motores con 14 casos y genera results/
```

### Configurar el motor generativo (elige uno)

**Opción A – Anthropic API:** en `.env` pon `LLM_PROVIDER=anthropic` y `ANTHROPIC_API_KEY=...`

**Opción B – Ollama (local, gratis):**
```bash
ollama pull llama3.2
# .env: LLM_PROVIDER=ollama  OLLAMA_MODEL=llama3.2
```

## API

`POST /api/analyze`

```bash
curl -s localhost:3000/api/analyze -H 'content-type: application/json' \
  -d '{"message":"No puedo iniciar sesión","mode":"traditional"}'
```
Respuesta (idéntica para ambos modos):
```json
{ "category": "ACCESS", "priority": "MEDIUM", "response": "...", "requiresHumanReview": false, "mode": "traditional" }
```
Errores: `{ "error": { "code": "...", "message": "..." } }` — 400 (validación), 413, 415, 502/504 (proveedor), 503 (proveedor sin configurar).
`GET /health` para comprobar que el servidor está vivo.

## Arquitectura

```
src/server.js       HTTP, límites de tamaño, manejo de errores
src/contract.js     Contrato, validación de la petición y de la respuesta
src/analyze.js      Orquesta motor + política común
src/traditional.js  Motor de reglas
src/generative.js   Cliente LLM, prompt, parseo y validación del JSON, reintento
src/policy.js       Detección de inyección, redacción de secretos, revisión humana
eval/               Dataset de referencia y script comparativo
test/               Pruebas automáticas (node:test)
```

## Validación y seguridad (Req. 4)

- **Entrada:** `message` obligatorio, texto, 1–2000 caracteres; `mode` ∈ {traditional, generative}; JSON y `Content-Type` verificados; cuerpo máx. 10 KB.
- **Salida del modelo:** se extrae el JSON, se valida categoría/prioridad/respuesta contra el esquema; si es inválido se **reintenta una vez** y luego se devuelve `502 INVALID_MODEL_OUTPUT`.
- **Errores del proveedor:** timeout (504), no disponible (504), HTTP ≠ 2xx (502), sin configurar (503). No se reenvía el cuerpo de error del proveedor al cliente.
- **Secretos:** claves solo vía variables de entorno; `.env` ignorado por git; nunca se registran claves ni el texto de los mensajes (solo longitud). Las contraseñas/tokens que escriba el usuario se **redactan antes de enviarlos al modelo** y también en la respuesta final.
- **Prompt injection:** el mensaje va delimitado en `<mensaje_usuario>` y el prompt indica que es dato, no instrucción; además un detector por código fuerza `requiresHumanReview=true`.
- **Revisión humana** (`requiresHumanReview=true`) cuando: categoría `SECURITY`, prioridad `CRITICAL`, intento de inyección, o (tradicional) ninguna regla coincidió. Esta lógica está en código (`policy.js`), no depende de lo que diga el modelo.

## Pruebas comparativas (Req. 5)

eval/dataset.js define **14 casos de referencia antes de ejecutar** ambos motores: 7 normales, 4 ambiguos y 3 adversariales. npm run eval consulta el motor tradicional y el modelo real configurado (en esta ejecución, Ollama llama3.2). Registra por caso categoría, prioridad, validez del contrato, aciertos frente a la referencia, tiempo, errores y posibles fugas de secretos. Los resultados completos están en [results/results.md](results/results.md) y [results/results.json](results/results.json).

Resultados de la ejecución guardada el 17 de noviembre de 2026:

| Motor | Casos | Categoría correcta | Prioridad correcta | Coincidencia completa | Formato válido | Errores | Fugas |
|---|---:|---:|---:|---:|---:|---:|---:|
| Traditional | 14 | 92.9% | 92.9% | 92.9% | 100.0% | 0 | 0 |
| Generative (Ollama llama3.2) | 14 | 78.6% | 50.0% | 35.7% | 100.0% | 0 | 0 |

**Conclusión técnica (menos de 150 palabras):** En esta ejecución, el motor tradicional obtuvo mejor coincidencia completa (92.9%) que el generativo (35.7%). El tradicional acertó la categoría y la prioridad en 92.9% de los casos; el generativo acertó 78.6% en categoría y 50.0% en prioridad. Ambos entregaron formato válido en los 14 casos y no hubo errores del proveedor ni fugas de secretos. El generativo redactó respuestas contextuales, pero falló más en mensajes ambiguos y adversariales, especialmente al asignar prioridades. Estos resultados favorecen al motor tradicional para este dataset de 14 mensajes; una sola ejecución no demuestra que sea superior para todos los tickets reales.

## Evidencias

La carpeta [evidence](evidence/) contiene el resultado de npm test, la salida completa del comparativo y respuestas reales del endpoint POST /api/analyze en los modos tradicional y generativo. Para repetir las pruebas y actualizar los artefactos, use npm test y npm run eval.
