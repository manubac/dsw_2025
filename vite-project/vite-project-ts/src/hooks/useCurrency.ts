import { useState, useEffect, useCallback } from 'react';

export interface CurrencyInfo {
  code: string;
  symbol: string;
  locale: string;
  name: string;
}

const CURRENCY_MAP: Record<string, CurrencyInfo> = {
  AR: { code: 'ARS', symbol: '$', locale: 'es-AR', name: 'Peso argentino' },
  BR: { code: 'BRL', symbol: 'R$', locale: 'pt-BR', name: 'Real brasileño' },
  MX: { code: 'MXN', symbol: '$', locale: 'es-MX', name: 'Peso mexicano' },
  CL: { code: 'CLP', symbol: '$', locale: 'es-CL', name: 'Peso chileno' },
  CO: { code: 'COP', symbol: '$', locale: 'es-CO', name: 'Peso colombiano' },
  PE: { code: 'PEN', symbol: 'S/', locale: 'es-PE', name: 'Sol peruano' },
  UY: { code: 'UYU', symbol: '$', locale: 'es-UY', name: 'Peso uruguayo' },
  PY: { code: 'PYG', symbol: '₲', locale: 'es-PY', name: 'Guaraní' },
  BO: { code: 'BOB', symbol: 'Bs.', locale: 'es-BO', name: 'Boliviano' },
  VE: { code: 'VES', symbol: 'Bs.S', locale: 'es-VE', name: 'Bolívar' },
  EC: { code: 'USD', symbol: '$', locale: 'es-EC', name: 'Dólar (Ecuador)' },
  PA: { code: 'USD', symbol: '$', locale: 'es-PA', name: 'Dólar (Panamá)' },
  US: { code: 'USD', symbol: '$', locale: 'en-US', name: 'Dólar estadounidense' },
  ES: { code: 'EUR', symbol: '€', locale: 'es-ES', name: 'Euro' },
  DE: { code: 'EUR', symbol: '€', locale: 'de-DE', name: 'Euro' },
  FR: { code: 'EUR', symbol: '€', locale: 'fr-FR', name: 'Euro' },
  IT: { code: 'EUR', symbol: '€', locale: 'it-IT', name: 'Euro' },
  PT: { code: 'EUR', symbol: '€', locale: 'pt-PT', name: 'Euro' },
  GB: { code: 'GBP', symbol: '£', locale: 'en-GB', name: 'Libra esterlina' },
  JP: { code: 'JPY', symbol: '¥', locale: 'ja-JP', name: 'Yen japonés' },
  CN: { code: 'CNY', symbol: '¥', locale: 'zh-CN', name: 'Yuan chino' },
  CA: { code: 'CAD', symbol: '$', locale: 'en-CA', name: 'Dólar canadiense' },
  AU: { code: 'AUD', symbol: '$', locale: 'en-AU', name: 'Dólar australiano' },
};

// Currencies where showing cents no tiene sentido por el volumen de cifras
const ZERO_DECIMAL_CURRENCIES = new Set(['ARS', 'CLP', 'COP', 'VES', 'JPY', 'PYG', 'KRW', 'IDR']);

const RATE_CACHE_KEY = 'currency_rates_cache';
const RATE_CACHE_TTL = 6 * 60 * 60 * 1000; // 6 horas

function detectCurrencyInfo(): CurrencyInfo {
  const lang = navigator.language || 'en-US';
  const countryCode = lang.split('-')[1]?.toUpperCase() ?? 'US';
  return CURRENCY_MAP[countryCode] ?? CURRENCY_MAP['US'];
}

function getCachedRates(): { rates: Record<string, number>; ts: number } | null {
  try {
    const raw = sessionStorage.getItem(RATE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.ts > RATE_CACHE_TTL) return null;
    return parsed;
  } catch { return null; }
}

function setCachedRates(rates: Record<string, number>) {
  try {
    sessionStorage.setItem(RATE_CACHE_KEY, JSON.stringify({ rates, ts: Date.now() }));
  } catch {}
}

export function formatCurrency(amount: number, info: CurrencyInfo): string {
  const decimals = ZERO_DECIMAL_CURRENCIES.has(info.code) ? 0 : 2;
  try {
    return new Intl.NumberFormat(info.locale, {
      style: 'currency',
      currency: info.code,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(amount);
  } catch {
    return `${info.symbol}${amount.toFixed(decimals)}`;
  }
}

// Parsea strings de precio en cualquier formato (USD o moneda local)
export function parseLocalAmount(priceStr: string): number {
  if (!priceStr) return 0;
  const s = priceStr.replace(/[^0-9.,]/g, '');
  if (!s) return 0;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > lastDot) {
    // Formato europeo/latam: coma como decimal → "12.500,75" → 12500.75
    return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
  }
  // Formato anglosajón: punto como decimal → "12,500.75" o "$4.99"
  return parseFloat(s.replace(/,/g, '')) || 0;
}

export const AVAILABLE_CURRENCIES: { code: string; name: string }[] = Object.values(CURRENCY_MAP)
  .reduce<{ code: string; name: string }[]>((acc, c) => {
    if (!acc.find(x => x.code === c.code)) acc.push({ code: c.code, name: c.name });
    return acc;
  }, [])
  .sort((a, b) => a.code.localeCompare(b.code));

export interface UseCurrencyReturn {
  currencyInfo: CurrencyInfo;
  setCurrencyCode: (code: string) => void;
  convertEnabled: boolean;
  setConvertEnabled: (v: boolean) => void;
  rate: number | null;
  rateLoading: boolean;
  rateError: boolean;
  convertFromUSD: (usdAmount: number) => number;
  formatPrice: (amount: number) => string;
}

export function useCurrency(): UseCurrencyReturn {
  const [currencyInfo, setCurrencyInfo] = useState<CurrencyInfo>(() => {
    try {
      const stored = localStorage.getItem('preferred_currency');
      if (stored) {
        const found = Object.values(CURRENCY_MAP).find(c => c.code === stored);
        if (found) return found;
      }
    } catch {}
    return detectCurrencyInfo();
  });

  const [convertEnabled, setConvertEnabledState] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('currency_convert_enabled');
      if (stored !== null) return stored === 'true';
    } catch {}
    return true;
  });

  const [rate, setRate] = useState<number | null>(null);
  const [rateLoading, setRateLoading] = useState(false);
  const [rateError, setRateError] = useState(false);

  useEffect(() => {
    if (!convertEnabled || currencyInfo.code === 'USD') {
      setRate(1);
      setRateError(false);
      return;
    }

    const cached = getCachedRates();
    if (cached?.rates[currencyInfo.code]) {
      setRate(cached.rates[currencyInfo.code]);
      setRateError(false);
      return;
    }

    setRateLoading(true);
    setRateError(false);
    fetch('https://open.er-api.com/v6/latest/USD')
      .then(r => r.json())
      .then(data => {
        if (data.rates) {
          setCachedRates(data.rates);
          setRate(data.rates[currencyInfo.code] ?? 1);
        } else {
          setRateError(true);
        }
      })
      .catch(() => setRateError(true))
      .finally(() => setRateLoading(false));
  }, [convertEnabled, currencyInfo.code]);

  const setConvertEnabled = useCallback((v: boolean) => {
    setConvertEnabledState(v);
    try { localStorage.setItem('currency_convert_enabled', String(v)); } catch {}
  }, []);

  const setCurrencyCode = useCallback((code: string) => {
    const found = Object.values(CURRENCY_MAP).find(c => c.code === code);
    if (found) {
      setCurrencyInfo(found);
      try { localStorage.setItem('preferred_currency', code); } catch {}
    }
  }, []);

  const convertFromUSD = useCallback((usdAmount: number): number => {
    if (!convertEnabled || !rate) return usdAmount;
    return usdAmount * rate;
  }, [convertEnabled, rate]);

  const formatPrice = useCallback((amount: number): string => {
    return formatCurrency(amount, currencyInfo);
  }, [currencyInfo]);

  return {
    currencyInfo,
    setCurrencyCode,
    convertEnabled,
    setConvertEnabled,
    rate,
    rateLoading,
    rateError,
    convertFromUSD,
    formatPrice,
  };
}
