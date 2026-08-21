import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const failures = [];

function expect(condition, message) {
  if (!condition) failures.push(message);
}

const indexHtml = readFileSync(join(root, 'index.html'), 'utf8');
const manifest = JSON.parse(readFileSync(join(root, 'manifest.webmanifest'), 'utf8'));
const serviceWorker = readFileSync(join(root, 'service-worker.js'), 'utf8');
const scriptMatch = indexHtml.match(/<script>([\s\S]*?)<\/script>/);

expect(Boolean(scriptMatch), '找不到主程式區塊');
if (scriptMatch) {
  try {
    new Function(scriptMatch[1]);
  } catch (error) {
    failures.push(`主程式語法錯誤：${error.message}`);
  }
}

expect(!indexHtml.includes('Function(`return ('), '計算器仍使用動態 Function 執行算式');
expect(indexHtml.includes('evaluateExpression'), '找不到受限計算器解析器');
expect(indexHtml.includes('fx_terminal_rate_cache'), '找不到匯率離線快取設定');
expect(indexHtml.includes('AbortController'), '找不到匯率請求逾時控制');
expect(indexHtml.includes('refresh-btn'), '找不到手動重新整理按鈕');
expect(manifest.lang === 'zh-Hant', 'Manifest 未設定繁體中文語言');
expect(manifest.icons?.length === 3, 'Manifest 圖示設定不完整');

for (const icon of manifest.icons || []) {
  const iconPath = join(root, icon.src.replace(/^\.\//, ''));
  expect(existsSync(iconPath), `找不到圖示檔案：${icon.src}`);
}

expect(serviceWorker.includes("CACHE_NAME = 'fx-terminal-pwa-v2'"), 'Service Worker 快取版本未更新');
expect(serviceWorker.includes('APP_SHELL'), 'Service Worker 缺少 App Shell 快取設定');

if (failures.length) {
  console.error('驗證失敗：');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('靜態驗證通過：PWA 資產、Manifest、Service Worker 與主程式語法均符合預期。');
