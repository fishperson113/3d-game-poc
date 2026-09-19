export const BRAND_NAME = "CurioLab";

export function brandMark(className = "brand-mark"): string {
  return `<svg class="${className}" viewBox="0 0 64 64" role="img" aria-label="CurioLab">
    <rect x="3" y="3" width="58" height="58" rx="17" fill="#10243b" stroke="#38bdf8" stroke-width="2"/>
    <path d="M39.5 18.5a17 17 0 1 0 2.8 25.2" fill="none" stroke="#7dd3fc" stroke-width="7" stroke-linecap="round"/>
    <path d="M43 12.5l2.2 6.3 6.3 2.2-6.3 2.2L43 29.5l-2.2-6.3-6.3-2.2 6.3-2.2L43 12.5Z" fill="#fbbf24"/>
    <circle cx="31" cy="35" r="4" fill="#34d399"/>
  </svg>`;
}
