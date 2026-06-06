// ── Layer Identifiers ──────────────────────────────────────────
export const LAYER_CLIENT   = 'client';
export const LAYER_WAF      = 'waf';
export const LAYER_FASTTEXT = 'fasttext';
export const LAYER_DISTILBERT = 'distilbert';
export const LAYER_RESULT   = 'result';

// ── API Endpoints ──────────────────────────────────────────────
export const API_BASE_URL        = 'https://localhost:8080';  // WAF+Orchestrator (HTTPS port 8080)
export const AI_BASE_URL         = 'http://localhost:5001';   // FastText Layer 2
export const DISTILBERT_BASE_URL = 'http://localhost:5002';   // DistilBERT Layer 3

// Ngưỡng: nếu FastText confidence < threshold → tự động gọi DistilBERT thẩm định
export const DISTILBERT_AUTO_TRIGGER_THRESHOLD = 0.75;

// ── Scan Status ────────────────────────────────────────────────
export const STATUS_IDLE      = 'idle';
export const STATUS_SCANNING  = 'scanning';
export const STATUS_DONE      = 'done';
export const STATUS_ERROR     = 'error';

// ── Verdict Types ──────────────────────────────────────────────
export const VERDICT_SAFE             = 'safe';
export const VERDICT_BLOCKED_WAF      = 'blocked_waf';
export const VERDICT_BLOCKED_FASTTEXT = 'blocked_fasttext';
export const VERDICT_BLOCKED_DISTILBERT = 'blocked_distilbert';
export const VERDICT_SCAM             = 'scam';

// ── Attack Categories (WAF) ────────────────────────────────────
export const ATTACK_SQLI    = 'OWASP_SQLi';
export const ATTACK_XSS     = 'OWASP_XSS';
export const ATTACK_CMDI    = 'OWASP_CMDi';
export const ATTACK_LFI     = 'OWASP_LFI';
export const ATTACK_RFI     = 'OWASP_RFI';
export const ATTACK_URL     = 'SUSPICIOUS_URL';
export const ATTACK_UNKNOWN = 'UNKNOWN';

// ── Color Palette ──────────────────────────────────────────────
export const COLOR_SAFE    = '#10b981';
export const COLOR_WARN    = '#f59e0b';
export const COLOR_DANGER  = '#ef4444';
export const COLOR_INFO    = '#3b82f6';
export const COLOR_PURPLE  = '#8b5cf6';

// ── Pagination ─────────────────────────────────────────────────
export const LOGS_PER_PAGE = 10;
