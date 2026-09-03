#!/usr/bin/env node
// Completa la CSP de nginx con los sha256 de los inline scripts del HTML EMITIDO.
// Por qué: vite.config inyecta la variante en el prepaint al construir (variantes ≠ full),
// así que su hash difiere del HTML commiteado; la CSP del repo (gate tests/deploy-config)
// solo puede contener los hashes del HTML commiteado. Este paso corre en la imagen.
// Uso: node csp-from-html.mjs <html> <nginx.conf>
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const [html, conf] = process.argv.slice(2);
const page = readFileSync(html, 'utf8');
let out = readFileSync(conf, 'utf8');
const anchor = "'nonce-wm-static-bootstrap' ";
let added = 0;
for (const m of page.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*ld\+json)[^>]*>([\s\S]*?)<\/script>/g)) {
  const hash = `'sha256-${createHash('sha256').update(m[1]).digest('base64')}'`;
  if (out.includes(hash)) continue;
  out = out.split(anchor).join(anchor + hash + ' ');
  added += 1;
}
writeFileSync(conf, out);
console.log(`csp-from-html: ${added} hash(es) agregados desde ${html}`);
