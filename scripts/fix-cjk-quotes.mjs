/**
 * 把用户可见文案里的 ASCII 双引号转为中文引号「」
 *
 * 用法: node scripts/fix-cjk-quotes.mjs [--write]
 *
 * ── 为什么要做这件事 ──────────────────────────────────────────────────
 * 文案里原来写的是 `他回"你想多了""你又来了"`。ASCII 双引号在中文语境下有
 * 两个问题：
 *   1. 连排时视觉上糊成一片（`""` 与 `"` 难以区分）
 *   2. 得意黑对 ASCII 引号的支持不如中文标点，分享卡片上会显得突兀
 * 统一改成「」后，中文排印更规范，也避免了这个视觉问题。
 *
 * ── 安全约束 ──────────────────────────────────────────────────────────
 * 只替换**单引号字符串内部**的 ASCII 双引号，不触碰任何代码结构
 * （对象键、JSX 属性、模板字符串一律不动）。
 * 转换后跑 `npm run typecheck` 与测试即可确认没有破坏语法。
 */
import fs from 'node:fs';

const shouldWrite = process.argv.includes('--write');
const DQ = String.fromCharCode(34);
const OPEN = '「';
const CLOSE = '」';

const FILES = [
  'content/questions.canonical.ts',
  'lib/model.ts',
  'lib/archetypes.ts',
  'lib/levels.ts',
  'lib/advice.ts',
  'lib/copy.ts',
];

/** 把一段文本里的 ASCII 双引号按出现顺序成对替换为「」 */
function convertSegment(segment) {
  let out = '';
  let open = true;
  for (const ch of segment) {
    if (ch === DQ) {
      out += open ? OPEN : CLOSE;
      open = !open;
    } else {
      out += ch;
    }
  }
  return out;
}

/**
 * 逐行处理：识别单引号字符串（'...'），只转换其内部内容。
 * 处理转义（\'）与字符串边界。
 */
function convertLine(line) {
  let out = '';
  let i = 0;
  while (i < line.length) {
    const ch = line[i];
    if (ch !== "'") {
      out += ch;
      i += 1;
      continue;
    }
    // 进入单引号字符串
    let seg = '';
    i += 1;
    while (i < line.length) {
      if (line[i] === '\\' && i + 1 < line.length) {
        seg += line[i] + line[i + 1];
        i += 2;
        continue;
      }
      if (line[i] === "'") break;
      seg += line[i];
      i += 1;
    }
    out += "'" + convertSegment(seg) + "'";
    i += 1; // 跳过收尾单引号
  }
  return out;
}

let totalFiles = 0;
let totalReplaced = 0;

for (const f of FILES) {
  if (!fs.existsSync(f)) {
    console.log('  跳过（不存在）: ' + f);
    continue;
  }
  const src = fs.readFileSync(f, 'utf8');
  const before = (src.match(new RegExp(DQ, 'g')) || []).length;
  const converted = src
    .split('\n')
    .map(convertLine)
    .join('\n');
  const after = (converted.match(new RegExp(DQ, 'g')) || []).length;
  const replaced = before - after;
  totalReplaced += replaced;
  totalFiles += 1;
  console.log('  ' + f.padEnd(34) + '转换 ' + replaced + ' 处');

  if (shouldWrite) fs.writeFileSync(f, converted, 'utf8');
}

// 生成文件必须从 canonical 重新生成，避免两份不同步
if (shouldWrite) {
  console.log('');
  console.log('提示：questions.ts 由 canonical 生成，请随后运行：');
  console.log('  node --experimental-strip-types scripts/generate-questions.mjs --write');
}

console.log('');
console.log((shouldWrite ? '✓ 已写入 ' : '（预览，加 --write 生效）') + totalFiles + ' 个文件，共 ' + totalReplaced + ' 处');
