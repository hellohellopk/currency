const API_CONFIGS = {
  currencyapi: {
    name: 'Currency API',
    buildUrl: () => 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json',
    parseResponse: (data) => {
      const rates = Object.fromEntries(Object.entries(data?.usd || {}).map(([code, rate]) => [code.toUpperCase(), rate]));
      return { success: Object.keys(rates).length > 0, rates, timestamp: Date.parse(data?.date || '') / 1000 };
    }
  },
  openerapi: {
    name: 'Open ER API',
    buildUrl: () => 'https://open.er-api.com/v6/latest/USD',
    parseResponse: (data) => ({ success: data?.result === 'success', rates: data?.rates, timestamp: data?.time_last_update_unix })
  }
};

const allCurrencyInfo = {
  HKD: { name: 'Hong Kong Dollar', code: 'hk', symbol: 'HK$' }, USD: { name: 'United States Dollar', code: 'us', symbol: '$' },
  EUR: { name: 'Euro', code: 'eu', symbol: '€' }, JPY: { name: 'Japanese Yen', code: 'jp', symbol: '¥' },
  GBP: { name: 'British Pound', code: 'gb', symbol: '£' }, CNY: { name: 'Chinese Yuan', code: 'cn', symbol: '¥' },
  AUD: { name: 'Australian Dollar', code: 'au', symbol: 'A$' }, CAD: { name: 'Canadian Dollar', code: 'ca', symbol: 'C$' },
  CHF: { name: 'Swiss Franc', code: 'ch', symbol: 'CHF' }, SGD: { name: 'Singapore Dollar', code: 'sg', symbol: 'S$' },
  SEK: { name: 'Swedish Krona', code: 'se', symbol: 'kr' }, KRW: { name: 'South Korean Won', code: 'kr', symbol: '₩' },
  NOK: { name: 'Norwegian Krone', code: 'no', symbol: 'kr' }, NZD: { name: 'New Zealand Dollar', code: 'nz', symbol: 'NZ$' },
  INR: { name: 'Indian Rupee', code: 'in', symbol: '₹' }, MXN: { name: 'Mexican Peso', code: 'mx', symbol: 'MX$' },
  TWD: { name: 'New Taiwan Dollar', code: 'tw', symbol: 'NT$' }, ZAR: { name: 'South African Rand', code: 'za', symbol: 'R' },
  BRL: { name: 'Brazilian Real', code: 'br', symbol: 'R$' }, THB: { name: 'Thai Baht', code: 'th', symbol: '฿' },
  TRY: { name: 'Turkish Lira', code: 'tr', symbol: '₺' }, NGN: { name: 'Nigerian Naira', code: 'ng', symbol: '₦' },
  PHP: { name: 'Philippine Peso', code: 'ph', symbol: '₱' }, VND: { name: 'Vietnamese Dong', code: 'vn', symbol: '₫' },
  IDR: { name: 'Indonesian Rupiah', code: 'id', symbol: 'Rp' }, MYR: { name: 'Malaysian Ringgit', code: 'my', symbol: 'RM' },
  RUB: { name: 'Russian Ruble', code: 'ru', symbol: '₽' }
};

const RGB_CARD_COLORS = {
  HKD: '#FFCCCC', USD: '#FFE5CC', EUR: '#FFFFCC', JPY: '#E5FFCC', GBP: '#CCFFCC', CNY: '#CCFFE5',
  AUD: '#CCFFFF', CAD: '#CCE5FF', CHF: '#CCCCFF', SGD: '#E5CCFF', SEK: '#FFCCFF', KRW: '#FFCCE5',
  NOK: '#E5CCCC', NZD: '#E5E5CC', INR: '#CCE5CC', MXN: '#CCE5E5', TWD: '#CCCCE5', ZAR: '#E5E5FF',
  BRL: '#FFE5FF', THB: '#FFFFE5', TRY: '#FFE0C0', NGN: '#FFFFE0', PHP: '#E0FFC0', VND: '#C0FFC0',
  IDR: '#C0E0E0', MYR: '#C0E0FF', RUB: '#E0C0FF'
};
const defaultCurrencies = ['HKD', 'USD', 'EUR', 'JPY', 'GBP', 'CNY', 'AUD', 'CAD', 'CHF', 'SGD', 'SEK', 'KRW', 'NOK', 'NZD', 'INR', 'MXN', 'TWD', 'ZAR', 'BRL', 'THB'];
const ZERO_DECIMAL_CURRENCIES = new Set(['JPY', 'KRW', 'VND']);
const STORAGE_KEYS = { currencies: 'fx_terminal_list', pinnedCurrencies: 'fx_terminal_pinned', api: 'fx_terminal_api', theme: 'fx_terminal_theme', density: 'fx_terminal_density', cardTheme: 'fx_terminal_card_theme', rateCache: 'fx_terminal_rate_cache', rateCaches: 'fx_terminal_rate_caches_v2' };
const RATE_CACHE_FRESH_MS = 15 * 60 * 1000;
const RATE_CACHE_MAX_AGE_MS = 48 * 60 * 60 * 1000;

let displayedCurrencies = loadDisplayedCurrencies();
let pinnedCurrencies = loadPinnedCurrencies();
let ratesVsHKD = null;
let currentBaseHKD = 1000;
let isEditMode = false;
let isRefreshing = false;
let calcVal = '0';
let calcTarget = 'HKD';
let rateCacheStore = null;
let backgroundRefreshTimer = null;
const CARD_THEMES = {
  pastel: { lightness: 0.8, saturation: 0.72 },
  soft: { lightness: 0.84, saturation: 0.38 },
  mono: { lightness: 0.8, saturation: 0.05 }
};
let selectedDensity = getSavedDensity();
let selectedCardTheme = getSavedCardTheme();

function pastelHexColor(hex, lightness = 0.8, saturation = 0.72) {
  const value = Number.parseInt(hex.slice(1), 16);
  const [red, green, blue] = [16, 8, 0].map((offset) => ((value >> offset) & 255) / 255);
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let hue = 0;

  if (delta) {
    if (max === red) hue = ((green - blue) / delta + (green < blue ? 6 : 0)) / 6;
    else if (max === green) hue = ((blue - red) / delta + 2) / 6;
    else hue = ((red - green) / delta + 4) / 6;
  }

  const hueChannel = (offset) => {
    let channelHue = hue + offset;
    if (channelHue < 0) channelHue += 1;
    if (channelHue > 1) channelHue -= 1;
    const q = lightness < 0.5 ? lightness * (1 + saturation) : lightness + saturation - lightness * saturation;
    const p = 2 * lightness - q;
    if (channelHue < 1 / 6) return p + (q - p) * 6 * channelHue;
    if (channelHue < 1 / 2) return q;
    if (channelHue < 2 / 3) return p + (q - p) * (2 / 3 - channelHue) * 6;
    return p;
  };

  const channels = [1 / 3, 0, -1 / 3].map((offset) => Math.round(hueChannel(offset) * 255));
  return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

function getCardColor(code) {
  const sourceColor = RGB_CARD_COLORS[code] || '#E5E5E5';
  const colorTheme = CARD_THEMES[selectedCardTheme] || CARD_THEMES.pastel;
  const bg = pastelHexColor(sourceColor, colorTheme.lightness, colorTheme.saturation);
  return { bg, border: 'rgba(0, 0, 0, .22)', watermark: 'rgba(0, 0, 0, .25)' };
}

function loadDisplayedCurrencies() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.currencies));
    if (!Array.isArray(stored)) return [...defaultCurrencies];
    const validCodes = [...new Set(stored.filter((code) => allCurrencyInfo[code]))];
    return validCodes.length ? validCodes : [...defaultCurrencies];
  } catch {
    return [...defaultCurrencies];
  }
}

function loadPinnedCurrencies() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.pinnedCurrencies));
    if (!Array.isArray(stored)) return [];
    return [...new Set(stored.filter((code) => displayedCurrencies.includes(code)))];
  } catch {
    return [];
  }
}

function saveSettings() {
  localStorage.setItem(STORAGE_KEYS.currencies, JSON.stringify(displayedCurrencies));
  localStorage.setItem(STORAGE_KEYS.pinnedCurrencies, JSON.stringify(pinnedCurrencies));
}

function setUpdateStatus(message, state = '') {
  const status = document.getElementById('update-time');
  status.textContent = message;
  status.className = `update-time ${state}`.trim();
}

function isValidRateMap(rates) {
  return rates && typeof rates === 'object' && Number.isFinite(Number(rates.HKD)) && Number(rates.HKD) > 0;
}

function loadRateCacheStore() {
  if (rateCacheStore) return rateCacheStore;
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.rateCaches));
    rateCacheStore = stored && typeof stored === 'object' ? stored : {};
  } catch {
    rateCacheStore = {};
  }

  try {
    const legacyCache = JSON.parse(localStorage.getItem(STORAGE_KEYS.rateCache));
    if (legacyCache?.apiType && !rateCacheStore[legacyCache.apiType]) rateCacheStore[legacyCache.apiType] = legacyCache;
  } catch {
    // 舊版快取不存在或格式無效時，直接使用新版快取層。
  }
  return rateCacheStore;
}

function getCachedRates(apiType = selectedApiType) {
  const cached = loadRateCacheStore()[apiType];
  if (!cached || typeof cached !== 'object' || !isValidRateMap(cached.rates) || !Number.isFinite(cached.updatedAt)) return null;
  const cachedAt = Number.isFinite(cached.cachedAt) ? cached.cachedAt : cached.updatedAt;
  const cacheAgeMs = Math.max(0, Date.now() - cachedAt);
  return { ...cached, cachedAt, cacheAgeMs, isFresh: cacheAgeMs <= RATE_CACHE_FRESH_MS, isExpired: cacheAgeMs > RATE_CACHE_MAX_AGE_MS };
}

function saveCachedRates(rates, apiType, updatedAt) {
  const cache = { rates, apiType, updatedAt: Number.isFinite(updatedAt) ? updatedAt : Date.now(), cachedAt: Date.now() };
  const store = loadRateCacheStore();
  store[apiType] = cache;
  localStorage.setItem(STORAGE_KEYS.rateCaches, JSON.stringify(store));
  localStorage.setItem(STORAGE_KEYS.rateCache, JSON.stringify(cache));
}

function buildRatesVsHKD(parsed) {
  if (!parsed?.success || !parsed.rates || typeof parsed.rates !== 'object') throw new Error('匯率資料格式無效');
  const hkdPerUsd = Number(parsed.rates.HKD);
  if (!Number.isFinite(hkdPerUsd) || hkdPerUsd <= 0) throw new Error('缺少有效的 HKD 匯率');

  const normalizedRates = {};
  for (const [code, rate] of Object.entries(parsed.rates)) {
    const numericRate = Number(rate);
    if (Number.isFinite(numericRate) && numericRate > 0) normalizedRates[code.toUpperCase()] = numericRate / hkdPerUsd;
  }
  normalizedRates.HKD = 1;
  if (!Object.keys(normalizedRates).some((code) => allCurrencyInfo[code])) throw new Error('沒有可用的目標貨幣匯率');
  return normalizedRates;
}

function formatUpdatedAt(timestamp) {
  return new Date(timestamp).toLocaleString('zh-Hant', { dateStyle: 'medium', timeStyle: 'short' });
}

async function fetchRates(apiType, { background = false } = {}) {
  const config = API_CONFIGS[apiType];
  if (!config) throw new Error('不支援的匯率資料來源');
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 10000);
  if (!background) setUpdateStatus(`[${config.name}] 正在同步最新匯率…`);

  try {
    const response = await fetch(config.buildUrl(), { signal: controller.signal, cache: 'no-store' });
    if (!response.ok) throw new Error(`匯率服務回應 ${response.status}`);
    const parsed = config.parseResponse(await response.json());
    const normalizedRates = buildRatesVsHKD(parsed);
    const updatedAt = Number.isFinite(parsed.timestamp) ? parsed.timestamp * 1000 : Date.now();
    ratesVsHKD = normalizedRates;
    saveCachedRates(normalizedRates, apiType, updatedAt);
    setUpdateStatus(`[${config.name}] 最後更新：${formatUpdatedAt(updatedAt)}`);
    return normalizedRates;
  } catch (error) {
    const cached = getCachedRates(apiType);
    if (cached) {
      ratesVsHKD = cached.rates;
      const freshness = cached.isExpired ? '，資料已超過 48 小時' : '';
      setUpdateStatus(`無法取得最新匯率；正在使用 ${formatUpdatedAt(cached.updatedAt)} 的已快取資料${freshness}。`, cached.isExpired ? 'error' : 'cached');
      return ratesVsHKD;
    }
    setUpdateStatus(error.name === 'AbortError' ? '連線逾時。請稍後重新整理。' : '匯率資料暫時無法載入。請稍後重新整理。', 'error');
    return null;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function formatNumberWithCommas(number, decimals = 2) {
  if (!Number.isFinite(number)) return '—';
  const parts = number.toFixed(decimals).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.join('.');
}

function formatCurrencyAmount(code, amount) {
  return formatNumberWithCommas(amount, ZERO_DECIMAL_CURRENCIES.has(code) ? 0 : 2);
}

const currencyListElement = document.getElementById('currency-list');

function getVisibleCurrencyCodes() {
  const visibleCodes = displayedCurrencies.filter((code) => {
    const rate = Number(ratesVsHKD?.[code]);
    return allCurrencyInfo[code] && Number.isFinite(rate) && rate > 0;
  });
  const pinnedSet = new Set(pinnedCurrencies);
  return [...visibleCodes.filter((code) => pinnedSet.has(code)), ...visibleCodes.filter((code) => !pinnedSet.has(code))];
}

function createCurrencyCard(code) {
  const info = allCurrencyInfo[code];
  const exchangeRate = Number(ratesVsHKD[code]);
  const amount = currentBaseHKD * exchangeRate;
  const cardColor = getCardColor(code);
  const card = document.createElement('article');
  const isPinned = pinnedCurrencies.includes(code);
  card.className = 'currency-card';
  card.dataset.code = code;
  if (isPinned) card.classList.add('pinned');
  card.style.background = cardColor.bg;
  card.style.borderColor = cardColor.border;
  if (isEditMode) card.classList.add('editing');

  card.innerHTML = `
    <div class="card-actions-left">
      <span class="drag-handle" role="button" tabindex="0" aria-label="拖曳排序 ${code}">⠿</span>
      <button class="pin-btn${isPinned ? ' pinned' : ''}" type="button" aria-label="${isPinned ? '取消釘選' : '釘選'} ${code}" aria-pressed="${isPinned}" title="${isPinned ? '取消釘選' : '釘選至熱門貨幣'}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z"/></svg></button>
      ${code !== 'HKD' ? `<button class="delete-btn" type="button" aria-label="移除 ${code}">×</button>` : ''}
    </div>
    <div class="flag-icon"><img src="https://flagcdn.com/w40/${info.code}.png" width="40" height="30" alt="${code} 國旗" loading="lazy" decoding="async"></div>
    <div class="currency-info"><div class="currency-code">${code}</div>${isPinned ? '<span class="pin-indicator" aria-label="已釘選">★</span>' : ''}<div class="currency-name">${info.name}</div></div>
    <div class="currency-value"><input type="text" id="input-${code}" class="amount-input" value="${info.symbol} ${formatCurrencyAmount(code, amount)}" readonly aria-label="${code} 金額"></div>`;
  return card;
}

function renderCurrencies() {
  const fragment = document.createDocumentFragment();
  getVisibleCurrencyCodes().forEach((code) => fragment.appendChild(createCurrencyCard(code)));
  currencyListElement.replaceChildren(fragment);
}

function updateRenderedAmounts() {
  const visibleCodes = getVisibleCurrencyCodes();
  const cards = [...currencyListElement.querySelectorAll('.currency-card')];
  if (cards.length !== visibleCodes.length || cards.some((card, index) => card.dataset.code !== visibleCodes[index])) return false;

  visibleCodes.forEach((code) => {
    const input = document.getElementById(`input-${code}`);
    if (input) input.value = `${allCurrencyInfo[code].symbol} ${formatCurrencyAmount(code, currentBaseHKD * ratesVsHKD[code])}`;
  });
  return true;
}

currencyListElement.addEventListener('click', (event) => {
  const card = event.target.closest('.currency-card');
  if (!card || !currencyListElement.contains(card)) return;
  const code = card.dataset.code;

  if (event.target.closest('.pin-btn')) {
    pinnedCurrencies = pinnedCurrencies.includes(code)
      ? pinnedCurrencies.filter((item) => item !== code)
      : [...pinnedCurrencies, code];
    saveSettings();
    renderCurrencies();
    return;
  }

  if (event.target.closest('.delete-btn')) {
    displayedCurrencies = displayedCurrencies.filter((item) => item !== code);
    pinnedCurrencies = pinnedCurrencies.filter((item) => item !== code);
    saveSettings();
    renderCurrencies();
    return;
  }

  if (event.target.closest('.amount-input') && !isEditMode) {
    openCalc(code, currentBaseHKD * ratesVsHKD[code]);
  }
});

currencyListElement.addEventListener('pointerdown', (event) => {
  const dragHandle = event.target.closest('.drag-handle');
  if (!dragHandle || !isEditMode) return;
  const card = dragHandle.closest('.currency-card');
  if (!card) return;
  event.preventDefault();
  startManualDrag(card, event);
});

function getDragAfterElement(container, y) {
  const cards = [...container.querySelectorAll('.currency-card:not(.dragging)')];
  return cards.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    return offset < 0 && offset > closest.offset ? { offset, element: child } : closest;
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function startManualDrag(card, startEvent) {
  const cardRect = card.getBoundingClientRect();
  const offsetInCard = startEvent.clientY - cardRect.top;
  const placeholder = document.createElement('div');
  let pendingClientY = startEvent.clientY;
  let animationFrameId = null;
  placeholder.style.height = `${cardRect.height}px`;
  placeholder.style.flexShrink = '0';

  card.classList.add('dragging');
  card.style.position = 'fixed';
  card.style.left = `${cardRect.left}px`;
  card.style.width = `${cardRect.width}px`;
  card.style.top = `${cardRect.top}px`;
  card.style.pointerEvents = 'none';
  currencyListElement.insertBefore(placeholder, card.nextSibling);

  function moveTo(clientY) {
    card.style.top = `${clientY - offsetInCard}px`;
    const afterElement = getDragAfterElement(currencyListElement, clientY);
    if (!afterElement) currencyListElement.appendChild(placeholder);
    else if (afterElement !== placeholder) currencyListElement.insertBefore(placeholder, afterElement);
  }

  function scheduleMove() {
    if (animationFrameId !== null) return;
    animationFrameId = window.requestAnimationFrame(() => {
      animationFrameId = null;
      moveTo(pendingClientY);
    });
  }

  function onMove(event) {
    event.preventDefault();
    pendingClientY = event.clientY;
    scheduleMove();
  }

  function endDrag() {
    if (animationFrameId !== null) window.cancelAnimationFrame(animationFrameId);
    moveTo(pendingClientY);
    card.classList.remove('dragging');
    card.style.position = '';
    card.style.left = '';
    card.style.width = '';
    card.style.top = '';
    card.style.pointerEvents = '';
    currencyListElement.insertBefore(card, placeholder);
    placeholder.remove();
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', endDrag);
    document.removeEventListener('pointercancel', endDrag);
    displayedCurrencies = [...currencyListElement.querySelectorAll('.currency-card')].map((element) => element.dataset.code);
    saveSettings();
  }

  document.addEventListener('pointermove', onMove, { passive: false });
  document.addEventListener('pointerup', endDrag, { once: true });
  document.addEventListener('pointercancel', endDrag, { once: true });
}

function updateAllAmounts(changedCode, changedAmount) {
  const sourceRate = Number(ratesVsHKD?.[changedCode]);
  if (!Number.isFinite(sourceRate) || sourceRate <= 0 || !Number.isFinite(changedAmount)) return;
  currentBaseHKD = changedAmount / sourceRate;
  if (!updateRenderedAmounts()) renderCurrencies();
}

function openCalc(code, value) {
  calcTarget = code;
  calcVal = value.toString();
  document.getElementById('calc-title').textContent = `輸入來源：${code}`;
  updateCalc();
  document.getElementById('calc-modal').classList.add('active');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('active');
}

function calcInput(value) {
  if (calcVal === '0' && value !== '.') calcVal = value;
  else calcVal += value;
  updateCalc();
}

function evaluateExpression(expression) {
  const normalized = expression.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/\s/g, '');
  if (!normalized || !/^[\d.+\-*/]+$/.test(normalized)) throw new Error('無效算式');
  const tokens = normalized.match(/(?:\d+\.?\d*|\.\d+)|[+\-*/]/g) || [];
  if (tokens.join('') !== normalized) throw new Error('無效算式');
  let position = 0;

  function parsePrimary() {
    const token = tokens[position];
    if (token === '+' || token === '-') {
      position += 1;
      const value = parsePrimary();
      return token === '-' ? -value : value;
    }
    if (token && /^(?:\d+\.?\d*|\.\d+)$/.test(token)) {
      position += 1;
      return Number(token);
    }
    throw new Error('無效算式');
  }
  function parseProduct() {
    let value = parsePrimary();
    while (tokens[position] === '*' || tokens[position] === '/') {
      const operator = tokens[position++];
      const right = parsePrimary();
      if (operator === '/' && right === 0) throw new Error('不可除以零');
      value = operator === '*' ? value * right : value / right;
    }
    return value;
  }
  function parseSum() {
    let value = parseProduct();
    while (tokens[position] === '+' || tokens[position] === '-') {
      const operator = tokens[position++];
      const right = parseProduct();
      value = operator === '+' ? value + right : value - right;
    }
    return value;
  }

  const result = parseSum();
  if (position !== tokens.length || !Number.isFinite(result)) throw new Error('無效結果');
  return result;
}

function calcAction(action) {
  if (action === 'AC') calcVal = '0';
  else if (action === 'DEL') calcVal = calcVal.length > 1 ? calcVal.slice(0, -1) : '0';
  else if (action === 'DONE') {
    try {
      updateAllAmounts(calcTarget, evaluateExpression(calcVal));
      closeModal('calc-modal');
    } catch {
      calcVal = 'Error';
      updateCalc();
      window.setTimeout(() => { calcVal = '0'; updateCalc(); }, 700);
      return;
    }
  }
  updateCalc();
}

function updateCalc() {
  document.getElementById('calc-display').textContent = calcVal;
  if (!/[+\-×÷*/−]/.test(calcVal) || calcVal === 'Error') {
    document.getElementById('calc-expr').textContent = '';
    return;
  }
  try {
    document.getElementById('calc-expr').textContent = `≈ ${evaluateExpression(calcVal).toLocaleString()}`;
  } catch {
    document.getElementById('calc-expr').textContent = '';
  }
}

const themeButton = document.getElementById('theme-btn');
const refreshButton = document.getElementById('refresh-btn');
const sourceControl = document.querySelector('.source-control');
const sourceMenuButton = document.getElementById('source-menu-btn');
const sourceMenu = document.getElementById('source-menu');
const sourceOptions = [...sourceMenu.querySelectorAll('.source-option')];
const preferencesControl = document.querySelector('.preferences-control');
const preferencesMenuButton = document.getElementById('preferences-menu-btn');
const preferencesMenu = document.getElementById('preferences-menu');
const densityOptions = [...preferencesMenu.querySelectorAll('[data-density]')];
const cardThemeOptions = [...preferencesMenu.querySelectorAll('[data-card-theme]')];
let selectedApiType = getSavedApiType();

const THEME_ICONS = {
  light: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 15.7A7.5 7.5 0 0 1 8.3 4 7.5 7.5 0 1 0 20 15.7z"/></svg>',
  dark: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.7"/><path d="M12 2.8v2M12 19.2v2M5.5 5.5l1.4 1.4M17.1 17.1l1.4 1.4M2.8 12h2M19.2 12h2M5.5 18.5l1.4-1.4M17.1 6.9l1.4-1.4"/></svg>'
};
const EDIT_ICONS = {
  edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="12" height="16" rx="2"/><path d="m10 16 7.8-7.8a1.7 1.7 0 0 1 2.4 2.4L12.4 18 9 19z"/></svg>',
  done: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="m8.5 12 2.4 2.5 4.9-5"/></svg>'
};

function getSavedTheme() {
  const saved = localStorage.getItem(STORAGE_KEYS.theme);
  if (saved === 'light' || saved === 'dark') return saved;
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

function getSavedDensity() {
  const saved = localStorage.getItem(STORAGE_KEYS.density);
  return saved === 'comfortable' ? 'comfortable' : 'compact';
}

function getSavedCardTheme() {
  const saved = localStorage.getItem(STORAGE_KEYS.cardTheme);
  return CARD_THEMES[saved] ? saved : 'pastel';
}

function applyTheme(theme, { render = true } = {}) {
  const isDark = theme === 'dark';
  document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
  localStorage.setItem(STORAGE_KEYS.theme, isDark ? 'dark' : 'light');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', isDark ? '#0d1117' : '#ffffff');
  themeButton.setAttribute('aria-pressed', String(isDark));
  themeButton.setAttribute('aria-label', isDark ? '切換至淺色模式' : '切換至深色模式');
  themeButton.setAttribute('title', isDark ? '切換至淺色模式' : '切換至深色模式');
  themeButton.innerHTML = isDark ? THEME_ICONS.dark : THEME_ICONS.light;
  if (render && ratesVsHKD) renderCurrencies();
}

function updatePreferenceOptions() {
  densityOptions.forEach((option) => option.setAttribute('aria-pressed', String(option.dataset.density === selectedDensity)));
  cardThemeOptions.forEach((option) => option.setAttribute('aria-pressed', String(option.dataset.cardTheme === selectedCardTheme)));
}

function applyDensity(density) {
  selectedDensity = density === 'comfortable' ? 'comfortable' : 'compact';
  document.documentElement.dataset.density = selectedDensity;
  localStorage.setItem(STORAGE_KEYS.density, selectedDensity);
  updatePreferenceOptions();
}

function applyCardTheme(cardTheme, { render = true } = {}) {
  selectedCardTheme = CARD_THEMES[cardTheme] ? cardTheme : 'pastel';
  document.documentElement.dataset.cardTheme = selectedCardTheme;
  localStorage.setItem(STORAGE_KEYS.cardTheme, selectedCardTheme);
  updatePreferenceOptions();
  if (render && ratesVsHKD) renderCurrencies();
}

function setPreferencesMenuOpen(isOpen) {
  preferencesMenu.classList.toggle('active', isOpen);
  preferencesMenuButton.setAttribute('aria-expanded', String(isOpen));
  if (isOpen) setSourceMenuOpen(false);
}

applyTheme(getSavedTheme(), { render: false });
applyDensity(selectedDensity);
applyCardTheme(selectedCardTheme, { render: false });
themeButton.addEventListener('click', () => applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
preferencesMenuButton.addEventListener('click', () => setPreferencesMenuOpen(!preferencesMenu.classList.contains('active')));
densityOptions.forEach((option) => option.addEventListener('click', () => applyDensity(option.dataset.density)));
cardThemeOptions.forEach((option) => option.addEventListener('click', () => applyCardTheme(option.dataset.cardTheme)));

function updateEditButton() {
  const button = document.getElementById('edit-btn');
  button.innerHTML = isEditMode ? EDIT_ICONS.done : EDIT_ICONS.edit;
  button.classList.toggle('editing', isEditMode);
  button.setAttribute('aria-pressed', String(isEditMode));
  button.setAttribute('aria-label', isEditMode ? '完成編輯貨幣清單' : '編輯貨幣清單');
  button.setAttribute('title', isEditMode ? '完成編輯貨幣清單' : '編輯貨幣清單');
}

updateEditButton();
document.getElementById('edit-btn').addEventListener('click', () => {
  isEditMode = !isEditMode;
  updateEditButton();
  renderCurrencies();
});

const currencyOptionsElement = document.getElementById('currency-options');

function renderCurrencyOptions() {
  const fragment = document.createDocumentFragment();
  Object.keys(allCurrencyInfo).forEach((code) => {
    if (displayedCurrencies.includes(code) || !Number.isFinite(Number(ratesVsHKD?.[code]))) return;
    const option = document.createElement('button');
    option.type = 'button';
    option.className = 'currency-option';
    option.dataset.code = code;
    option.style.width = '100%';
    option.style.background = '#fff';
    option.style.textAlign = 'left';
    option.style.borderLeft = '0';
    option.style.borderRight = '0';
    option.style.borderTop = '0';
    option.innerHTML = `<img src="https://flagcdn.com/w40/${allCurrencyInfo[code].code}.png" width="40" height="30" alt="${code} 國旗" loading="lazy" decoding="async"><span><strong style="display:block;color:#1b1f23">${code}</strong><small style="color:#777">${allCurrencyInfo[code].name}</small></span>`;
    fragment.appendChild(option);
  });
  currencyOptionsElement.replaceChildren(fragment);
}

document.getElementById('add-btn').addEventListener('click', () => {
  renderCurrencyOptions();
  document.getElementById('add-modal').classList.add('active');
});

currencyOptionsElement.addEventListener('click', (event) => {
  const option = event.target.closest('.currency-option');
  if (!option || !currencyOptionsElement.contains(option)) return;
  displayedCurrencies.push(option.dataset.code);
  saveSettings();
  closeModal('add-modal');
  renderCurrencies();
});

document.getElementById('modal-close').addEventListener('click', () => closeModal('add-modal'));

function getSavedApiType() {
  const saved = localStorage.getItem(STORAGE_KEYS.api);
  return API_CONFIGS[saved] ? saved : 'currencyapi';
}

function scheduleBackgroundRefresh(cached, apiType) {
  window.clearTimeout(backgroundRefreshTimer);
  const waitMs = cached?.isFresh ? Math.max(1000, RATE_CACHE_FRESH_MS - cached.cacheAgeMs) : 0;
  backgroundRefreshTimer = window.setTimeout(() => {
    if (selectedApiType === apiType && document.visibilityState === 'visible') initialize({ forceNetwork: true, background: true });
  }, waitMs);
}

function hydrateCachedRates(apiType = selectedApiType) {
  const cached = getCachedRates(apiType);
  if (!cached) return false;
  ratesVsHKD = cached.rates;
  const config = API_CONFIGS[apiType];
  const freshness = cached.isExpired ? '，資料已超過 48 小時' : cached.isFresh ? '，資料仍在快速快取期限內' : '';
  setUpdateStatus(`[${config.name}] 正在使用 ${formatUpdatedAt(cached.updatedAt)} 的已快取資料${freshness}。`, cached.isExpired ? 'error' : 'cached');
  renderCurrencies();
  scheduleBackgroundRefresh(cached, apiType);
  return true;
}

function setSourceMenuOpen(isOpen) {
  sourceMenu.classList.toggle('active', isOpen);
  sourceMenuButton.setAttribute('aria-expanded', String(isOpen));
  if (isOpen) setPreferencesMenuOpen(false);
}

function updateSelectedSourceOption() {
  sourceOptions.forEach((option) => {
    const isSelected = option.dataset.apiType === selectedApiType;
    option.setAttribute('aria-current', String(isSelected));
    option.disabled = isRefreshing;
  });
  const selectedLabel = sourceOptions.find((option) => option.dataset.apiType === selectedApiType)?.textContent.trim() || '匯率來源';
  sourceMenuButton.setAttribute('aria-label', `匯率來源：${selectedLabel}`);
  sourceMenuButton.setAttribute('title', `匯率來源：${selectedLabel}`);
}

updateSelectedSourceOption();
sourceMenuButton.addEventListener('click', () => setSourceMenuOpen(!sourceMenu.classList.contains('active')));
sourceOptions.forEach((option) => option.addEventListener('click', () => {
  selectedApiType = option.dataset.apiType;
  localStorage.setItem(STORAGE_KEYS.api, selectedApiType);
  updateSelectedSourceOption();
  setSourceMenuOpen(false);
  initialize();
}));
document.addEventListener('click', (event) => {
  if (!sourceControl.contains(event.target)) setSourceMenuOpen(false);
  if (!preferencesControl.contains(event.target)) setPreferencesMenuOpen(false);
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    setSourceMenuOpen(false);
    setPreferencesMenuOpen(false);
  }
});
refreshButton.addEventListener('click', () => initialize({ forceNetwork: true }));

async function initialize({ forceNetwork = false, background = false } = {}) {
  if (isRefreshing) return;
  const apiType = selectedApiType;
  const cached = getCachedRates(apiType);

  if (!forceNetwork && cached?.isFresh) {
    ratesVsHKD = cached.rates;
    const config = API_CONFIGS[apiType];
    setUpdateStatus(`[${config.name}] 正在使用 ${formatUpdatedAt(cached.updatedAt)} 的已快取資料，資料仍在快速快取期限內。`, 'cached');
    if (!updateRenderedAmounts()) renderCurrencies();
    scheduleBackgroundRefresh(cached, apiType);
    return;
  }

  isRefreshing = true;
  if (!background) {
    refreshButton.disabled = true;
    sourceMenuButton.disabled = true;
    updateSelectedSourceOption();
  }
  try {
    const rates = await fetchRates(apiType, { background });
    if (rates && !updateRenderedAmounts()) renderCurrencies();
    scheduleBackgroundRefresh(getCachedRates(apiType), apiType);
  } finally {
    isRefreshing = false;
    if (!background) {
      refreshButton.disabled = false;
      sourceMenuButton.disabled = false;
      updateSelectedSourceOption();
    }
  }
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js').catch(() => {}));
}

let deferredPrompt = null;
const installButton = document.getElementById('install-btn');
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredPrompt = event;
  installButton.hidden = false;
});
installButton.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  await deferredPrompt.prompt();
  deferredPrompt = null;
  installButton.hidden = true;
});
window.addEventListener('appinstalled', () => { deferredPrompt = null; installButton.hidden = true; });

hydrateCachedRates();
initialize();
window.addEventListener('online', () => initialize({ forceNetwork: true, background: true }));
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') initialize();
});
