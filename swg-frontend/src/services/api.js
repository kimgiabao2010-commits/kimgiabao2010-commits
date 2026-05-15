import { API_BASE_URL, AI_BASE_URL, DISTILBERT_BASE_URL } from '../utils/constants';

// ══════════════════════════════════════════════════════════════════
//  Health Checks — Kiểm tra từng service đang online không
// ══════════════════════════════════════════════════════════════════

export const checkWAFHealth = async () => {
  const res = await fetch(`${API_BASE_URL}/health`, { method: 'GET' });
  return res.json();
};

export const checkAIHealth = async () => {
  const res = await fetch(`${AI_BASE_URL}/health`, { method: 'GET' });
  return res.json();
};

/**
 * Health check cho DistilBERT (Port 5002).
 * Trả về { status, model, device, model_loaded, ... }
 */
export const checkDistilBERTHealth = async () => {
  const res = await fetch(`${DISTILBERT_BASE_URL}/health`, { method: 'GET' });
  return res.json();
};

// ══════════════════════════════════════════════════════════════════
//  Step 1: WAF Scan (POST /api/scan → Port 8000)
// ══════════════════════════════════════════════════════════════════

/**
 * Gửi text qua WAF Layer 1 (POST /api/scan).
 * WAF chặn → 403 { status: "BLOCKED_BY_WAF", attack_type, detail }
 * Sạch     → 200 { status: "SUCCESS", waf_layer: "CLEAN" }
 */
export const scanWAF = async (text) => {
  const res = await fetch(`${API_BASE_URL}/api/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });

  const data = await res.json().catch(() => ({ detail: res.statusText }));

  // WAF trả 403 khi chặn — không throw, trả về data bình thường
  if (res.status === 403) {
    return { ...data, waf_blocked: true, blocked: true };
  }

  if (!res.ok) {
    throw Object.assign(
      new Error(data.detail || `WAF error ${res.status}`),
      { status: res.status, data }
    );
  }

  return data;
};

// ══════════════════════════════════════════════════════════════════
//  Step 2: FastText AI Scan (POST /predict → Port 5001)
// ══════════════════════════════════════════════════════════════════

/**
 * Gửi text qua FastText AI (POST /predict).
 * Body: { message: text } ← FastText server đọc field "message"
 * Response: { prediction, probability, confidence, model }
 */
export const scanFastText = async (text) => {
  const res = await fetch(`${AI_BASE_URL}/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: text }),
  });

  const data = await res.json().catch(() => ({ detail: res.statusText }));

  if (!res.ok) {
    throw Object.assign(
      new Error(data.error || data.detail || `FastText error ${res.status}`),
      { status: res.status, data }
    );
  }

  return data;
};

// ══════════════════════════════════════════════════════════════════
//  Step 3: DistilBERT Deep Analysis (POST /predict → Port 5002)
// ══════════════════════════════════════════════════════════════════

/**
 * Gửi text qua DistilBERT (POST /predict).
 * Body: { text: string }  ← DistilBERT server đọc field "text"
 * Response: { is_scam, confidence_score, prediction, status, inference_time_ms }
 *
 * Được gọi tự động khi:
 *   - FastText phát hiện Scam
 *   - Hoặc FastText confidence < DISTILBERT_AUTO_TRIGGER_THRESHOLD (nghi ngờ)
 */
export const scanDistilBERT = async (text) => {
  const res = await fetch(`${DISTILBERT_BASE_URL}/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),       // ← DistilBERT server đọc "text"
  });

  const data = await res.json().catch(() => ({ detail: res.statusText }));

  if (!res.ok) {
    throw Object.assign(
      new Error(data.detail || `DistilBERT error ${res.status}`),
      { status: res.status, data }
    );
  }

  return data;
};

// ══════════════════════════════════════════════════════════════════
//  Logs
// ══════════════════════════════════════════════════════════════════

export const fetchServerLogs = async () => {
  const res = await fetch(`${API_BASE_URL}/logs`);
  if (!res.ok) throw new Error('Failed to fetch logs');
  return res.json();
};
