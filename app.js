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

const CARD_COLORS = [
  { h: 142, s: 68 }, { h: 4, s: 78 }, { h: 38, s: 92 }, { h: 199, s: 75 }, { h: 328, s: 70 },
  { h: 262, s: 65 }, { h: 22, s: 85 }, { h: 168, s: 60 }, { h: 352, s: 75 }, { h: 88, s: 55 },
  { h: 214, s: 70 }, { h: 14, s: 80 }, { h: 55, s: 85 }, { h: 285, s: 60 }, { h: 180, s: 55 },
  { h: 305, s: 65 }, { h: 122, s: 60 }, { h: 240, s: 65 }, { h: 65, s: 70 }, { h: 8, s: 70 }
];
const defaultCurrencies = ['HKD', 'USD', 'EUR', 'JPY', 'GBP', 'CNY', 'AUD', 'CAD', 'CHF', 'SGD', 'SEK', 'KRW', 'NOK', 'NZD', 'INR', 'MXN', 'TWD', 'ZAR', 'BRL', 'THB'];
const ZERO_DECIMAL_CURRENCIES = new Set(['JPY', 'KRW', 'VND']);
const STORAGE_KEYS = { currencies: 'fx_terminal_list', api: 'fx_terminal_api', rateCache: 'fx_terminal_rate_cache' };

let displayedCurrencies = loadDisplayedCurrencies();
let ratesVsHKD = null;
let currentBaseHKD = 1000;
let isEditMode = false;
let isRefreshing = false;
let calcVal = '0';
let calcTarget = 'HKD';

function getCardColor(code) {
  let hash = 0;
  for (let index = 0; index < code.length; index += 1) hash = (hash * 31 + code.charCodeAt(index)) % CARD_COLORS.length;
  const color = CARD_COLORS[Math.abs(hash) % CARD_COLORS.length];
  return { bg: `hsl(${color.h}, ${color.s}%, 62%)`, border: `hsl(${color.h}, ${color.s}%, 42%)`, watermark: `hsl(${color.h}, ${color.s}%, 15%)` };
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

function saveSettings() {
  localStorage.setItem(STORAGE_KEYS.currencies, JSON.stringify(displayedCurrencies));
}

function setUpdateStatus(message, state = '') {
  const status = document.getElementById('update-time');
  status.textContent = message;
  status.className = `update-time ${state}`.trim();
}

function getCachedRates() {
  try {
    const cached = JSON.parse(localStorage.getItem(STORAGE_KEYS.rateCache));
    if (!cached || typeof cached !== 'object' || !cached.rates || !Number.isFinite(cached.updatedAt)) return null;
    return cached;
  } catch {
    return null;
  }
}

function saveCachedRates(rates, apiType, updatedAt) {
  localStorage.setItem(STORAGE_KEYS.rateCache, JSON.stringify({ rates, apiType, updatedAt: Number.isFinite(updatedAt) ? updatedAt : Date.now() }));
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

async function fetchRates(apiType) {
  const config = API_CONFIGS[apiType];
  if (!config) throw new Error('不支援的匯率資料來源');
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 10000);
  setUpdateStatus(`[${config.name}] 正在同步最新匯率…`);

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
    const cached = getCachedRates();
    if (cached) {
      ratesVsHKD = cached.rates;
      setUpdateStatus(`無法取得最新匯率；正在使用 ${formatUpdatedAt(cached.updatedAt)} 的已快取資料。`, 'cached');
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

function renderCurrencies() {
  const listElement = document.getElementById('currency-list');
  listElement.innerHTML = '';

  displayedCurrencies.forEach((code) => {
    const info = allCurrencyInfo[code];
    const exchangeRate = Number(ratesVsHKD?.[code]);
    if (!info || !Number.isFinite(exchangeRate) || exchangeRate <= 0) return;

    const amount = currentBaseHKD * exchangeRate;
    const cardColor = getCardColor(code);
    const card = document.createElement('article');
    card.className = 'currency-card';
    card.dataset.code = code;
    card.style.background = cardColor.bg;
    card.style.borderColor = cardColor.border;
    if (isEditMode) card.classList.add('editing');

    card.innerHTML = `
      <div class="card-actions-left">
        <span class="drag-handle" role="button" tabindex="0" aria-label="拖曳排序 ${code}">⠿</span>
        ${code !== 'HKD' ? `<button class="delete-btn" type="button" aria-label="移除 ${code}">×</button>` : ''}
      </div>
      <div class="flag-icon"><img src="https://flagcdn.com/w160/${info.code}.png" alt="${code} 國旗" loading="lazy"></div>
      <div class="currency-info"><div class="currency-code">${code}</div><div class="currency-watermark" style="color:${cardColor.watermark}">${info.name}</div></div>
      <div class="currency-value"><input type="text" id="input-${code}" class="amount-input" value="${info.symbol} ${formatCurrencyAmount(code, amount)}" readonly aria-label="${code} 金額"></div>`;

    const deleteButton = card.querySelector('.delete-btn');
    if (deleteButton) deleteButton.addEventListener('click', (event) => {
      event.stopPropagation();
      displayedCurrencies = displayedCurrencies.filter((item) => item !== code);
      saveSettings();
      renderCurrencies();
    });

    const amountInput = card.querySelector('.amount-input');
    amountInput.addEventListener('click', (event) => {
      if (isEditMode) return;
      event.stopPropagation();
      openCalc(code, amount);
    });

    const dragHandle = card.querySelector('.drag-handle');
    dragHandle.addEventListener('pointerdown', (event) => {
      if (!isEditMode) return;
      event.preventDefault();
      startManualDrag(card, event);
    });
    dragHandle.addEventListener('keydown', (event) => {
      if (isEditMode && (event.key === 'Enter' || event.key === ' ')) event.preventDefault();
    });

    listElement.appendChild(card);
  });
}

function getDragAfterElement(container, y) {
  const cards = [...container.querySelectorAll('.currency-card:not(.dragging)')];
  return cards.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    return offset < 0 && offset > closest.offset ? { offset, element: child } : closest;
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function startManualDrag(card, startEvent) {
  const listElement = document.getElementById('currency-list');
  const cardRect = card.getBoundingClientRect();
  const offsetInCard = startEvent.clientY - cardRect.top;
  const placeholder = document.createElement('div');
  placeholder.style.height = `${cardRect.height}px`;
  placeholder.style.flexShrink = '0';

  card.classList.add('dragging');
  card.style.position = 'fixed';
  card.style.left = `${cardRect.left}px`;
  card.style.width = `${cardRect.width}px`;
  card.style.top = `${cardRect.top}px`;
  card.style.pointerEvents = 'none';
  listElement.insertBefore(placeholder, card.nextSibling);

  function moveTo(clientY) {
    card.style.top = `${clientY - offsetInCard}px`;
    const afterElement = getDragAfterElement(listElement, clientY);
    if (!afterElement) listElement.appendChild(placeholder);
    else if (afterElement !== placeholder) listElement.insertBefore(placeholder, afterElement);
  }

  function onMove(event) {
    event.preventDefault();
    moveTo(event.clientY);
  }

  function endDrag() {
    card.classList.remove('dragging');
    card.style.position = '';
    card.style.left = '';
    card.style.width = '';
    card.style.top = '';
    card.style.pointerEvents = '';
    listElement.insertBefore(card, placeholder);
    placeholder.remove();
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', endDrag);
    document.removeEventListener('pointercancel', endDrag);
    displayedCurrencies = [...document.querySelectorAll('.currency-card')].map((element) => element.dataset.code);
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
  displayedCurrencies.forEach((code) => {
    const input = document.getElementById(`input-${code}`);
    if (input) input.value = `${allCurrencyInfo[code].symbol} ${formatCurrencyAmount(code, currentBaseHKD * ratesVsHKD[code])}`;
  });
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

const apiSelector = document.getElementById('api-selector');
const refreshButton = document.getElementById('refresh-btn');

document.getElementById('edit-btn').addEventListener('click', () => {
  isEditMode = !isEditMode;
  const button = document.getElementById('edit-btn');
  button.textContent = isEditMode ? '完成' : '編輯';
  button.classList.toggle('editing', isEditMode);
  renderCurrencies();
});

document.getElementById('add-btn').addEventListener('click', () => {
  const container = document.getElementById('currency-options');
  container.innerHTML = '';
  Object.keys(allCurrencyInfo).forEach((code) => {
    if (displayedCurrencies.includes(code) || !Number.isFinite(Number(ratesVsHKD?.[code]))) return;
    const option = document.createElement('button');
    option.type = 'button';
    option.className = 'currency-option';
    option.style.width = '100%';
    option.style.background = '#fff';
    option.style.textAlign = 'left';
    option.style.borderLeft = '0';
    option.style.borderRight = '0';
    option.style.borderTop = '0';
    option.innerHTML = `<img src="https://flagcdn.com/w80/${allCurrencyInfo[code].code}.png" alt="${code} 國旗" loading="lazy"><span><strong style="display:block;color:#1b1f23">${code}</strong><small style="color:#777">${allCurrencyInfo[code].name}</small></span>`;
    option.addEventListener('click', () => {
      displayedCurrencies.push(code);
      saveSettings();
      closeModal('add-modal');
      renderCurrencies();
    });
    container.appendChild(option);
  });
  document.getElementById('add-modal').classList.add('active');
});

document.getElementById('modal-close').addEventListener('click', () => closeModal('add-modal'));

function getSavedApiType() {
  const saved = localStorage.getItem(STORAGE_KEYS.api);
  return API_CONFIGS[saved] ? saved : 'currencyapi';
}

apiSelector.value = getSavedApiType();
apiSelector.addEventListener('change', () => initialize({ savePreference: true }));
refreshButton.addEventListener('click', () => initialize());

async function initialize({ savePreference = false } = {}) {
  if (isRefreshing) return;
  isRefreshing = true;
  const apiType = apiSelector.value;
  refreshButton.disabled = true;
  apiSelector.disabled = true;
  if (savePreference) localStorage.setItem(STORAGE_KEYS.api, apiType);
  try {
    const rates = await fetchRates(apiType);
    if (rates) renderCurrencies();
  } finally {
    isRefreshing = false;
    refreshButton.disabled = false;
    apiSelector.disabled = false;
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

initialize();
