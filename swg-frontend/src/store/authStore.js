/**
 * authStore.js — SWG Shield Admin Authentication Store (Zustand)
 * =============================================================
 * Quản lý toàn bộ trạng thái đăng nhập Admin Dashboard.
 *
 * Luồng JWT hoạt động:
 *   1. Admin gọi login(username, password) → POST /api/admin/login
 *   2. Backend trả về { access_token, username, expires_in }
 *   3. Store lưu token vào state + localStorage (persist qua reload)
 *   4. Mọi request API sau đó đính kèm: Authorization: Bearer <token>
 *   5. Khi logout() → xóa token khỏi state + localStorage → redirect /login
 *
 * Bảo mật localStorage:
 *   - Lưu token vào localStorage là cách phổ biến cho SPA.
 *   - Trong môi trường production cao hơn, dùng httpOnly cookie để chống XSS.
 *   - Hiện tại đây là Dashboard nội bộ nên localStorage là chấp nhận được.
 */

import { create } from 'zustand';
import { API_BASE_URL } from '../utils/constants';

const TOKEN_KEY = 'swg_admin_token';
const USERNAME_KEY = 'swg_admin_username';

// Lấy token đã lưu từ localStorage (persist qua page refresh)
const _loadStoredToken = () => localStorage.getItem(TOKEN_KEY) || null;
const _loadStoredUsername = () => localStorage.getItem(USERNAME_KEY) || null;

const useAuthStore = create((set, get) => ({
  // ── State ──────────────────────────────────────────────────────
  token:           _loadStoredToken(),      // JWT string hoặc null
  username:        _loadStoredUsername(),   // tên admin đang đăng nhập
  isAuthenticated: !!_loadStoredToken(),    // true nếu có token hợp lệ trong localStorage
  isLoading:       false,                   // đang gọi API login
  error:           null,                    // thông báo lỗi đăng nhập

  // ── Actions ────────────────────────────────────────────────────

  /**
   * login(username, password)
   * ─────────────────────────
   * Gọi POST /api/admin/login → nhận JWT → lưu vào state + localStorage.
   * Throw Error nếu thất bại để component có thể hiển thị lỗi.
   */
  login: async (username, password) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        // Lấy thông báo lỗi từ backend (thường là detail.message)
        const msg =
          data?.detail?.message ||
          data?.detail ||
          `Đăng nhập thất bại (HTTP ${res.status})`;
        throw new Error(msg);
      }

      const { access_token, username: adminName } = data;

      // Lưu vào localStorage để persist qua F5
      localStorage.setItem(TOKEN_KEY, access_token);
      localStorage.setItem(USERNAME_KEY, adminName);

      set({
        token:           access_token,
        username:        adminName,
        isAuthenticated: true,
        isLoading:       false,
        error:           null,
      });

      return data; // component có thể dùng để redirect
    } catch (err) {
      set({ isLoading: false, error: err.message });
      throw err; // re-throw để Login.jsx bắt và hiển thị
    }
  },

  /**
   * logout()
   * ─────────
   * Xóa token khỏi state và localStorage.
   * Component/router sẽ redirect về /login sau khi isAuthenticated = false.
   */
  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USERNAME_KEY);
    set({
      token:           null,
      username:        null,
      isAuthenticated: false,
      error:           null,
    });
  },

  /**
   * clearError()
   * ─────────────
   * Reset thông báo lỗi — dùng khi user bắt đầu gõ lại.
   */
  clearError: () => set({ error: null }),

  /**
   * getAuthHeaders()
   * ─────────────────
   * Trả về object headers cần thiết cho mọi request Admin.
   * Dùng trong api.js như một "interceptor" thủ công.
   *
   * Ví dụ:
   *   const headers = useAuthStore.getState().getAuthHeaders();
   *   fetch(url, { headers })
   */
  getAuthHeaders: () => {
    const { token } = get();
    return token
      ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      : { 'Content-Type': 'application/json' };
  },
}));

export default useAuthStore;
