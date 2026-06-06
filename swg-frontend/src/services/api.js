/**
 * api.js — SWG Shield API Service Layer
 * ========================================
 * Tầng giao tiếp giữa Frontend React và Backend FastAPI.
 *
 * Cấu trúc Auth "Interceptor":
 *   - Browser Extension APIs (scanText, fetchServerLogs): dùng X-API-Key header.
 *   - Admin Dashboard APIs (fetchScanLogs, fetchPendingReports, v.v): dùng JWT Bearer token.
 *   - apiFetch() là hàm wrapper đóng vai trò "Axios Interceptor" thủ công:
 *       1. Tự động lấy token từ authStore
 *       2. Đính kèm Authorization: Bearer <token> vào mọi request Admin
 *       3. Nếu server trả 401 (token hết hạn), tự động logout và redirect /login
 */

import { API_BASE_URL, AI_BASE_URL, DISTILBERT_BASE_URL } from '../utils/constants';

// ══════════════════════════════════════════════════════════════════
//  JWT Auth Interceptor — "Axios-style" wrapper cho Admin APIs
// ══════════════════════════════════════════════════════════════════

/**
 * apiFetch(url, options)
 * ──────────────────────
 * Wrapper của fetch() tự động:
 *   1. Đính kèm Authorization: Bearer <token> từ localStorage
 *   2. Nếu nhận HTTP 401 → logout admin + reload trang (forced re-auth)
 *
 * Dùng cho TẤT CẢ các Admin protected API.
 * Không dùng cho /api/scan (Browser Extension) vì Extension dùng X-API-Key.
 */
const apiFetch = async (url, options = {}) => {
  // Lấy token từ localStorage (không import store để tránh circular dependency)
  const token = localStorage.getItem('swg_admin_token');

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(url, { ...options, headers });

  // Interceptor: xử lý token hết hạn / không hợp lệ → auto logout
  // CHỈ kích hoạt khi đang có token (tránh loop logout trên trang Login/Register)
  if (res.status === 401 && token) {
    const data = await res.json().catch(() => ({}));
    const status = data?.detail?.status || '';

    if (status === 'TOKEN_EXPIRED' || status === 'INVALID_TOKEN' || status === 'UNAUTHORIZED') {
      // Xóa token → Zustand sẽ re-render App.jsx về Login tự động
      localStorage.removeItem('swg_admin_token');
      localStorage.removeItem('swg_admin_username');
      // Không dùng window.location (gây full reload) — import lazy để tránh circular dep
      import('../store/authStore').then(m => m.default.getState().logout());
    }
  }

  return res;
};


// ══════════════════════════════════════════════════════════════════
//  Health Checks — Kiểm tra từng service đang online không
//  (Không cần auth — public endpoints)
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
//  Browser Extension → dùng X-API-Key (KHÔNG dùng JWT)
// ══════════════════════════════════════════════════════════════════

/**
 * scanText(text)
 * ──────────────
 * Gửi text qua Cổng điều phối trung tâm (POST /api/scan).
 * Gateway sẽ tự động định tuyến qua WAF → FastText → DistilBERT.
 * ⚠ Dùng X-API-Key vì Extension không có JWT.
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
//  Admin Auth APIs
//  Chỉ cần X-API-Key (superadmin gọi thủ công, không qua Dashboard)
// ══════════════════════════════════════════════════════════════════

/**
 * registerAdmin(username, password, apiKey)
 * ──────────────────────────────────────────
 * Đăng ký tài khoản Admin mới.
 * Yêu cầu X-API-Key (superadmin/DevOps mới gọi được).
 */
export const registerAdmin = async (username, password, apiKey) => {
  const res = await fetch(`${API_BASE_URL}/api/admin/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    },
    body: JSON.stringify({ username, password }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.detail?.message || data?.detail || `Lỗi ${res.status}`;
    throw new Error(msg);
  }
  return data;
};

/**
 * loginAdmin(username, password)
 * ───────────────────────────────
 * Đăng nhập Admin — thường gọi qua authStore.login() thay vì trực tiếp.
 */
export const loginAdmin = async (username, password) => {
  const res = await fetch(`${API_BASE_URL}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.detail?.message || data?.detail || `Lỗi ${res.status}`;
    throw new Error(msg);
  }
  return data; // { access_token, token_type, username, expires_in }
};


// ══════════════════════════════════════════════════════════════════
//  Protected Admin APIs — tất cả đều dùng apiFetch() → tự thêm JWT
// ══════════════════════════════════════════════════════════════════

export const fetchServerLogs = async () => {
  const res = await fetch(`${API_BASE_URL}/logs`);
  if (!res.ok) throw new Error('Failed to fetch logs');
  return res.json();
};

/**
 * fetchScanLogs(limit)
 * ─────────────────────
 * Poll scan logs từ backend /api/scan-log (GET).
 * ⚠ Endpoint này được bảo vệ bằng JWT — chỉ Admin mới truy cập được.
 * apiFetch() tự động thêm Authorization: Bearer <token>
 */
export const fetchScanLogs = async (limit = 100) => {
  const res = await apiFetch(`${API_BASE_URL}/api/scan-log?limit=${limit}`, {
    method: 'GET',
  });
  if (!res.ok) throw new Error('Failed to fetch scan logs');
  return res.json();
};

/**
 * fetchPendingReports()
 * ──────────────────────
 * Lấy danh sách báo cáo chờ Admin duyệt.
 * ⚠ Bảo vệ bằng JWT.
 */
export const fetchPendingReports = async () => {
  const res = await apiFetch(`${API_BASE_URL}/api/pending-reports`, {
    method: 'GET',
  });
  if (!res.ok) throw new Error('Failed to fetch pending reports');
  return res.json();
};

/**
 * triggerRetrainFastText()
 * ────────────────────────
 * Kích hoạt retrain FastText từ pending reports.
 * ⚠ Bảo vệ bằng JWT (Admin-only).
 */
export const triggerRetrainFastText = async () => {
  const res = await apiFetch(`${API_BASE_URL}/api/retrain/fasttext`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to trigger retrain');
  return res.json();
};

/**
 * reloadWAF()
 * ────────────
 * Hot-reload WAF rules — Double Auth: vừa cần JWT vừa cần X-API-Key.
 */
export const reloadWAF = async () => {
  const res = await apiFetch(`${API_BASE_URL}/api/waf/reload`, {
    method: 'POST',
    headers: {
      'X-API-Key': 'swg-vnu-is-2026', // Double auth: key + JWT
    },
  });
  if (!res.ok) throw new Error('Failed to reload WAF');
  return res.json();
};
