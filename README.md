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

`eval/dataset.js` contiene 14 casos (7 normales, 4 ambiguos, 3 adversariales) con **clasificación de referencia definida antes de ejecutar**. `npm run eval` corre ambos motores y escribe `results/results.md` y `results/results.json` (categoría, prioridad, formato válido, correcto/incorrecto, % de aciertos, fugas de secretos).

Resultados: ver `results/results.md` (**pega aquí la tabla y la conclusión de ≤150 palabras tras ejecutarlo**).

## Evidencias

Agrega capturas/logs en `evidence/`: `npm start` + `curl` en ambos modos, y la salida de `npm run eval`.
