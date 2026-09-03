// ponytail: espejo mínimo del detector de i18n (wmExplicit → wmVariantDefault) sin importar
// services/i18n.ts, que usa import.meta.glob y no carga en los tests Node de utils/componentes.
const EXPLICIT_LOCALE_KEY = 'wm-locale-explicit';

export function isSpanishUi(): boolean {
  try {
    const explicit = localStorage.getItem(EXPLICIT_LOCALE_KEY);
    if (explicit) return explicit.startsWith('es');
  } catch {
    // sin storage
  }
  return typeof document !== 'undefined' && document.documentElement.dataset.variant === 'chile';
}
