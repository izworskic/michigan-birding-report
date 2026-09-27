// network-ads-v1 integration contract. Runtime/settings are maintained by
// izworskic/chrisizworski-com; this build step has no network dependency.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(process.argv[2] || 'public');
const src = 'https://chrisizworski.com/assets/network-ads-v1.js';
const tag = `<script defer src="${src}"></script>`;
let eligible = 0;
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) { await walk(file); continue; }
    if (!entry.isFile() || !entry.name.endsWith('.html')) continue;
    const original = await readFile(file, 'utf8');
    const metas = original.match(/<meta\b[^>]*>/gi) || [];
    if (metas.some(m => /\bhttp-equiv\s*=\s*["']refresh["']/i.test(m) ||
        (/\bname\s*=\s*["'](?:robots|googlebot)["']/i.test(m) && /\b(?:noindex|none)\b/i.test(m)))) continue;
    const relative = path.relative(root, file).replaceAll(path.sep, '/');
    if (/^(privacy|terms|connect|for-publishers|404|500)(?:\/|\.|$)/.test(relative)) continue;
    if (!/<\/head>/i.test(original)) throw new Error(`Missing head: ${relative}`);
    eligible++;
    const html = original.replace(/<script\b[^>]*\bsrc=["']https:\/\/chrisizworski\.com\/assets\/network-ads-v1\.js["'][^>]*>\s*<\/script>\s*/gi, '');
    const updated = html.replace(/<\/head>/i, tag + '\n</head>');
    if (updated !== original) await writeFile(file, updated);
  }
}
await walk(root);
console.log(`Network ads v1: ${eligible} eligible HTML pages integrated in ${path.basename(root)}`);
