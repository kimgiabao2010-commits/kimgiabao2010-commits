import {
  COLOR_SAFE, COLOR_WARN, COLOR_DANGER, COLOR_PURPLE,
  VERDICT_SAFE, VERDICT_BLOCKED_WAF, VERDICT_BLOCKED_FASTTEXT,
  VERDICT_BLOCKED_DISTILBERT, VERDICT_SCAM,
  ATTACK_SQLI, ATTACK_XSS, ATTACK_CMDI, ATTACK_LFI, ATTACK_RFI, ATTACK_URL,
} from './constants';

// ── Date / Time ────────────────────────────────────────────────
export const formatDateTime = (isoString) => {
  const d = new Date(isoString || Date.now());
  return d.toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
};

export const formatTime = (isoString) => {
  const d = new Date(isoString || Date.now());
  return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

export const formatDuration = (ms) => {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
};

// ── Verdict → Color ────────────────────────────────────────────
export const getVerdictColor = (verdict) => {
  switch (verdict) {
    case VERDICT_SAFE:             return COLOR_SAFE;
    case VERDICT_BLOCKED_WAF:      return COLOR_DANGER;
    case VERDICT_BLOCKED_FASTTEXT: return COLOR_PURPLE;
    case VERDICT_BLOCKED_DISTILBERT: return '#a855f7';
    case VERDICT_SCAM:             return COLOR_DANGER;
    default:                       return COLOR_WARN;
  }
};

// ── Verdict → Human Label ──────────────────────────────────────
export const getVerdictLabel = (verdict) => {
  switch (verdict) {
    case VERDICT_SAFE:               return 'An Toàn';
    case VERDICT_BLOCKED_WAF:        return 'Bị chặn bởi WAF';
    case VERDICT_BLOCKED_FASTTEXT:   return 'Bị chặn bởi FastText';
    case VERDICT_BLOCKED_DISTILBERT: return 'Bị chặn bởi DistilBERT';
    case VERDICT_SCAM:               return 'Lừa Đảo';
    default:                         return 'Không xác định';
  }
};

// ── Attack Type → CSS class suffix ────────────────────────────
export const getAttackClass = (type) => {
  switch (type) {
    case ATTACK_SQLI: return 'sqli';
    case ATTACK_XSS:  return 'xss';
    case ATTACK_CMDI: return 'cmd';
    case ATTACK_LFI:  return 'lfi';
    case ATTACK_RFI:  return 'rfi';
    case ATTACK_URL:  return 'url';
    default:          return 'unknown';
  }
};

// ── Confidence → Percentage string ───────────────────────────
export const formatConfidence = (value) => {
  const pct = Math.round(value * 100);
  return `${pct}%`;
};

// ── Truncate long text ────────────────────────────────────────
export const truncate = (str, max = 60) => {
  if (!str) return '';
  return str.length > max ? str.slice(0, max) + '…' : str;
};

// ── Generate unique IDs ───────────────────────────────────────
export const genId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
