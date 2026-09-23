/**
 * 从 ui-ux-pro-max 的 CSV 知识库里检索（替代缺失的 search.py，无需 Python）
 *
 * 用法:
 *   node scripts/skill-search.mjs styles 关系测试
 *   node scripts/skill-search.mjs colors 娱乐 社交 女性
 *   node scripts/skill-search.mjs typography 中文 现代
 *   node scripts/skill-search.mjs --list
 */
import { readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const DATA = join(homedir(), '.agents', 'skills', 'ck-ui-ux-pro-max', 'data');

/** 极简 CSV 解析（支持双引号包裹、内部逗号与换行） */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch !== '\r') {
      field += ch;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [header, ...body] = rows.filter((r) => r.some((c) => c.trim() !== ''));
  return { header, rows: body };
}

function load(file) {
  const candidates = [
    join(DATA, `${file}.csv`),
    join(DATA, 'stacks', `${file}.csv`),
  ];
  for (const p of candidates) {
    try {
      return parseCsv(readFileSync(p, 'utf8'));
    } catch {
      /* 继续尝试 */
    }
  }
  return null;
}

function listAll() {
  console.log('可用知识库:\n');
  for (const dir of [DATA, join(DATA, 'stacks')]) {
    let files = [];
    try {
      files = readdirSync(dir).filter((f) => f.endsWith('.csv'));
    } catch {
      continue;
    }
    for (const f of files) {
      const { rows } = parseCsv(readFileSync(join(dir, f), 'utf8'));
      console.log(`  ${f.replace('.csv', '').padEnd(18)} ${rows.length} 条`);
    }
  }
}

const args = process.argv.slice(2);
if (args.length === 0 || args[0] === '--list') {
  listAll();
  process.exit(0);
}

const file = args[0];
const keywords = args.slice(1).join(' ').toLowerCase().split(/\s+/).filter(Boolean);
const table = load(file);
if (!table) {
  console.error(`未找到知识库: ${file}`);
  process.exit(1);
}

const { header, rows } = table;
const scored = rows
  .map((row) => {
    const joined = row.join(' ').toLowerCase();
    let score = 0;
    for (const kw of keywords) {
      if (joined.includes(kw)) score += 1;
      // 标题列命中权重更高
      if ((row[1] ?? '').toLowerCase().includes(kw)) score += 2;
    }
    return { row, score };
  })
  .filter((r) => r.score > 0)
  .sort((a, b) => b.score - a.score)
  .slice(0, Number(process.env.LIMIT ?? 6));

console.log(`# ${file}  (关键词: ${keywords.join(' / ') || '全部'})  命中 ${scored.length} 条\n`);
for (const { row } of scored) {
  header.forEach((h, i) => {
    const val = (row[i] ?? '').trim();
    if (!val) return;
    const short = val.length > 320 ? `${val.slice(0, 320)}…` : val;
    console.log(`  ${h}: ${short}`);
  });
  console.log('');
}
