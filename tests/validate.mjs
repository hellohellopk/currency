import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const failures = [];

function expect(condition, message) {
  if (!condition) failures.push(message);
}

const indexHtml = readFileSync(join(root, 'index.html'), 'utf8');
const appJs = readFileSync(join(root, 'app.js'), 'utf8');
const manifest = JSON.parse(readFileSync(join(root, 'manifest.webmanifest'), 'utf8'));
const serviceWorker = readFileSync(join(root, 'service-worker.js'), 'utf8');

try {
  new Function(appJs);
} catch (error) {
  failures.push(`主程式語法錯誤：${error.message}`);
}

expect(indexHtml.includes('<script src="./app.js"></script>'), '首頁未載入獨立主程式');
expect(indexHtml.includes('currency-list'), '首頁缺少匯率清單容器');
expect(indexHtml.includes('app-footer') && !indexHtml.includes('header-content'), '匯率資訊未移至頁面底部');
expect(indexHtml.includes('refresh-btn'), '首頁缺少手動重新整理按鈕');
expect(indexHtml.includes('header-toolbar') && indexHtml.includes('icon-btn'), '首頁缺少頂部圖示工具列');
expect(indexHtml.includes('id="theme-btn"') && indexHtml.includes('data-theme="dark"'), '首頁缺少深色模式切換按鈕或深色樣式');
expect(indexHtml.includes('source-menu-btn') && indexHtml.includes('source-menu'), '首頁缺少圖示化匯率來源選單');
expect(!indexHtml.includes('api-selector'), '首頁仍保留舊的匯率來源下拉選單');
expect(indexHtml.includes('display=swap'), '字型未設定非阻塞顯示策略');
expect(indexHtml.includes('dns-prefetch') && indexHtml.includes('flagcdn.com'), '首頁缺少國旗網域預先解析');
const rgbPaletteMatch = appJs.match(/const RGB_CARD_COLORS = \{([\s\S]*?)\n\};/);
const rgbPalette = rgbPaletteMatch ? [...rgbPaletteMatch[1].matchAll(/#[0-9A-F]{6}/gi)].map((match) => match[0].toUpperCase()) : [];
expect(appJs.includes('RGB_CARD_COLORS'), '找不到固定 RGB 卡片配色設定');
expect(rgbPalette.length >= 20, '固定 RGB 色盤不足二十種顏色');
expect(new Set(rgbPalette).size === rgbPalette.length, '固定 RGB 色盤含有重複顏色');
expect(['#FFCCCC', '#FFE5CC', '#FFFFCC', '#E5FFCC', '#CCFFCC'].every((color) => rgbPalette.includes(color)), '固定 RGB 色盤未使用指定色表的淺色系色碼');
expect(indexHtml.includes('height:40px'), '貨幣卡片高度未設定為 40px');
expect(!appJs.includes('currency-title-row') && !indexHtml.includes('.currency-title-row'), '貨幣卡片仍保留兩行名稱結構');
expect(appJs.includes('currency-name') && indexHtml.includes('.currency-name'), '貨幣卡片未提供完整名稱欄位');
expect(appJs.includes('pinnedCurrencies') && appJs.includes('fx_terminal_pinned'), '找不到熱門貨幣釘選偏好設定');
expect(appJs.includes('pin-btn') && indexHtml.includes('.pin-btn'), '找不到熱門貨幣釘選控制');
expect(appJs.includes('pin-indicator') && indexHtml.includes('.pin-indicator'), '找不到已釘選貨幣的視覺標記');
expect(appJs.includes('startManualDrag'), '找不到拖曳排序邏輯');
expect(appJs.includes('sourceMenuButton') && appJs.includes('setSourceMenuOpen'), '找不到圖示化匯率來源選單邏輯');
expect(appJs.includes('fx_terminal_theme') && appJs.includes('applyTheme') && appJs.includes('themeButton'), '找不到主題偏好保存與切換邏輯');
expect(appJs.includes('darkenHexColor') && appJs.includes('saturation = 0.32') && appJs.includes("dataset.theme === 'dark'"), '找不到低飽和度的深色貨幣卡片色彩處理');
expect(appJs.includes('EDIT_ICONS') && appJs.includes('updateEditButton') && !appJs.includes("textContent = isEditMode ? '完成'"), '編輯按鈕未改為圖示化完成控制');
expect(!appJs.includes('apiSelector'), '主程式仍使用已移除的來源下拉選單');
expect(appJs.includes('evaluateExpression'), '找不到受限計算器解析器');
expect(!appJs.includes('Function('), '計算器仍使用動態 Function 執行算式');
expect(appJs.includes('fx_terminal_rate_cache') && appJs.includes('fx_terminal_rate_caches_v2'), '找不到匯率離線快取與新版多來源快取設定');
expect(appJs.includes('RATE_CACHE_FRESH_MS') && appJs.includes('RATE_CACHE_MAX_AGE_MS'), '找不到匯率快取新鮮度與有效期限設定');
expect(appJs.includes('loadRateCacheStore') && appJs.includes('getCachedRates(apiType)'), '找不到來源分流的快取讀取流程');
expect(appJs.includes('hydrateCachedRates') && appJs.includes('scheduleBackgroundRefresh'), '找不到快取預先渲染與背景同步排程');
expect(appJs.includes('DocumentFragment') && appJs.includes('replaceChildren'), '找不到批次 DOM 渲染策略');
expect(appJs.includes('requestAnimationFrame'), '找不到拖曳動畫幀節流');
expect(appJs.includes('w40') && !appJs.includes('w160'), '國旗圖片尺寸尚未最佳化');
expect(appJs.includes('AbortController'), '找不到匯率請求逾時控制');
expect(!/(fxr_live_|app_id=|api_key=|0d5edd3dbe|219fb31)/.test(appJs), '主程式不應包含資料服務金鑰');
expect(manifest.lang === 'zh-Hant', 'Manifest 未設定繁體中文語言');
expect(manifest.icons?.length === 3, 'Manifest 圖示設定不完整');

for (const icon of manifest.icons || []) {
  const iconPath = join(root, icon.src.replace(/^\.\//, ''));
  expect(existsSync(iconPath), `找不到圖示檔案：${icon.src}`);
}

expect(serviceWorker.includes("CACHE_NAME = 'fx-terminal-pwa-v17'"), 'Service Worker 快取版本未更新');
expect(serviceWorker.includes('./app.js'), 'Service Worker 未預快取新版主程式');
expect(serviceWorker.includes('NETWORK_FIRST_PATHS') && serviceWorker.includes('networkFirst'), 'Service Worker 未對核心更新資產採取網路優先策略');
expect(serviceWorker.includes('APP_SHELL'), 'Service Worker 缺少 App Shell 快取設定');

if (failures.length) {
  console.error('驗證失敗：');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('靜態驗證通過：新版頁面、快取預先渲染、批次 DOM 更新、拖曳節流與 PWA 設定均符合預期。');
