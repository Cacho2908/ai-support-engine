// Ejecuta AMBOS motores sobre el dataset y genera results/results.md y results/results.json.
// El motor generativo llama al proveedor real: no hay respuestas simuladas.
import { writeFileSync, mkdirSync } from 'node:fs';
import { loadEnv } from '../src/env.js';
import { analyze } from '../src/analyze.js';
import { checkResponseContract } from '../src/contract.js';
import { DATASET } from './dataset.js';

loadEnv();
const MODES = ['traditional', 'generative'];
const rows = [];

for (const c of DATASET) {
  for (const mode of MODES) {
    const t0 = Date.now();
    const row = { id: c.id, type: c.type, mode, message: c.message, expected: c.expected };
    try {
      const out = await analyze(c.message, mode);
      const contractErrors = checkResponseContract(out);
      Object.assign(row, {
        category: out.category, priority: out.priority, response: out.response,
        requiresHumanReview: out.requiresHumanReview, formatOk: contractErrors.length === 0,
        categoryOk: out.category === c.expected.category,
        priorityOk: out.priority === c.expected.priority,
        leaked: (c.mustNotContain || []).some((s) => out.response.includes(s)),
      });
    } catch (err) {
      Object.assign(row, { error: `${err.code || err.name}: ${err.message}`, formatOk: false, categoryOk: false, priorityOk: false, leaked: false });
    }
    row.ms = Date.now() - t0;
    rows.push(row);
    console.log(`#${c.id} ${mode.padEnd(11)} ${row.category ?? 'ERROR'}/${row.priority ?? '-'} ${row.categoryOk ? 'OK' : 'X'} (${row.ms} ms)`);
  }
}

const pct = (n, d) => (d ? ((n / d) * 100).toFixed(1) : '0.0') + '%';
const summary = Object.fromEntries(MODES.map((m) => {
  const r = rows.filter((x) => x.mode === m);
  return [m, {
    total: r.length,
    categoryAccuracy: pct(r.filter((x) => x.categoryOk).length, r.length),
    priorityAccuracy: pct(r.filter((x) => x.priorityOk).length, r.length),
    fullMatch: pct(r.filter((x) => x.categoryOk && x.priorityOk).length, r.length),
    formatOk: pct(r.filter((x) => x.formatOk).length, r.length),
    errors: r.filter((x) => x.error).length,
    leaks: r.filter((x) => x.leaked).length,
  }];
}));

const cell = (r) => (r.error ? `ERROR` : `${r.category}/${r.priority}`);
const mark = (b) => (b ? '✅' : '❌');
let md = '# Resultados comparativos\n\n';
md += '| # | Tipo | Mensaje | Referencia | Tradicional | Fmt | Cat | Gen. | Fmt | Cat |\n|---|---|---|---|---|---|---|---|---|---|\n';
for (const c of DATASET) {
  const t = rows.find((r) => r.id === c.id && r.mode === 'traditional');
  const g = rows.find((r) => r.id === c.id && r.mode === 'generative');
  const msg = c.message.length > 70 ? c.message.slice(0, 67) + '...' : c.message;
  md += `| ${c.id} | ${c.type} | ${msg.replace(/\|/g, '\\|')} | ${c.expected.category}/${c.expected.priority} | ${cell(t)} | ${mark(t.formatOk)} | ${mark(t.categoryOk)} | ${cell(g)} | ${mark(g.formatOk)} | ${mark(g.categoryOk)} |\n`;
}
md += '\n## Resumen\n\n| Motor | Casos | Categoría correcta | Prioridad correcta | Categoría y prioridad | Formato válido | Errores | Fugas de secretos |\n|---|---|---|---|---|---|---|---|\n';
for (const m of MODES) {
  const s = summary[m];
  md += `| ${m} | ${s.total} | ${s.categoryAccuracy} | ${s.priorityAccuracy} | ${s.fullMatch} | ${s.formatOk} | ${s.errors} | ${s.leaks} |\n`;
}
const errs = rows.filter((r) => r.error);
if (errs.length) md += '\n## Errores\n\n' + errs.map((r) => `- #${r.id} ${r.mode}: ${r.error}`).join('\n') + '\n';

mkdirSync(new URL('../results/', import.meta.url), { recursive: true });
writeFileSync(new URL('../results/results.json', import.meta.url), JSON.stringify({ generatedAt: new Date().toISOString(), summary, rows }, null, 2));
writeFileSync(new URL('../results/results.md', import.meta.url), md);
console.log('\n' + JSON.stringify(summary, null, 2));
