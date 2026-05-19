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
//  Central Gateway Scan (POST /api/scan → Port 8000)
// ══════════════════════════════════════════════════════════════════

/**
 * Gửi text qua Cổng điều phối trung tâm (POST /api/scan).
 * Gateway sẽ tự động định tuyến qua WAF → FastText → DistilBERT.
 */
export const scanText = async (text) => {
  const res = await fetch(`${API_BASE_URL}/api/scan`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': 'swg-vnu-is-2026',
    },
    body: JSON.stringify({ text }),
  });

  const data = await res.json().catch(() => ({ detail: res.statusText }));

  // Gateway trả 403 khi WAF chặn
  if (res.status === 403) {
    return { ...data, waf_blocked: true, blocked: true };
  }

  if (!res.ok) {
    throw Object.assign(
      new Error(data.detail || `Gateway error ${res.status}`),
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
