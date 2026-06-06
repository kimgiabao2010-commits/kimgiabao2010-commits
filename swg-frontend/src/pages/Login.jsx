/**
 * Login.jsx — Trang đăng nhập Admin Dashboard
 * =============================================
 * Thiết kế nhất quán với Dashboard:
 *   - Nền: #F5F5F7 (Apple gray)
 *   - Card: bg-white, border border-gray-200
 *   - Text: text-gray-900 / text-gray-400
 *   - Accent: indigo-600 (giống Target icon trong Dashboard header)
 *   - Typography: uppercase tracking-widest (giống label Dashboard)
 */

import React, { useState } from 'react';
import {
  Shield, Lock, User, Eye, EyeOff,
  AlertTriangle, Loader2, Target, Terminal,
} from 'lucide-react';
import useAuthStore from '../store/authStore';

const Login = ({ onNavigateToRegister }) => {
  const [username, setUsername]         = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError]     = useState('');

  const { login, isLoading, error, clearError } = useAuthStore();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    clearError();
    if (!username.trim() || !password) {
      setLocalError('Vui lòng nhập đầy đủ username và mật khẩu.');
      return;
    }
    try {
      await login(username, password);
    } catch {
      // lỗi đã set vào authStore.error
    }
  };

  const displayError = localError || error;

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: '#F5F5F7' }}
    >
      <div className="w-full max-w-sm mx-4">

        {/* ── Brand header ─────────────────────────────── */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2.5 mb-4">
            <Terminal size={18} strokeWidth={1.25} className="text-indigo-600" />
            <span className="text-gray-900 font-bold text-lg tracking-tight">
              SWG<span className="text-indigo-600">GUARD</span>
            </span>
          </div>
          <p className="text-[0.6rem] font-bold text-gray-400 uppercase tracking-[0.2em]">
            // Sec-Ops Admin Console
          </p>
        </div>

        {/* ── Login card ───────────────────────────────── */}
        <div className="bg-white border border-gray-200/80 p-8">

          {/* Card title */}
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
            <h1 className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <Target size={13} strokeWidth={1.5} />
              Admin Authentication
            </h1>
            <div className="px-2 py-0.5 bg-gray-900 text-white font-bold text-[0.55rem] tracking-widest uppercase flex items-center gap-1.5">
              <Shield size={9} strokeWidth={1.5} />
              JWT
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Username */}
            <div className="space-y-1.5">
              <label
                htmlFor="login-username"
                className="block text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest"
              >
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User size={14} strokeWidth={1.5} className="text-gray-300" />
                </div>
                <input
                  id="login-username"
                  type="text"
                  value={username}
                  onChange={(e) => { setUsername(e.target.value); setLocalError(''); clearError(); }}
                  placeholder="Nhập tên tài khoản admin"
                  autoComplete="username"
                  className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 text-gray-900 text-xs font-medium placeholder:text-gray-300 focus:outline-none focus:border-gray-400 transition-colors"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label
                htmlFor="login-password"
                className="block text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest"
              >
                Mật khẩu
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock size={14} strokeWidth={1.5} className="text-gray-300" />
                </div>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setLocalError(''); clearError(); }}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full pl-9 pr-10 py-2.5 bg-white border border-gray-200 text-gray-900 text-xs font-medium placeholder:text-gray-300 focus:outline-none focus:border-gray-400 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-300 hover:text-gray-500 transition-colors"
                >
                  {showPassword ? <EyeOff size={14} strokeWidth={1.5} /> : <Eye size={14} strokeWidth={1.5} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {displayError && (
              <div className="flex items-start gap-2.5 p-3 bg-rose-50 border border-rose-200/60">
                <AlertTriangle size={13} strokeWidth={2} className="text-rose-500 shrink-0 mt-0.5" />
                <p className="text-[0.65rem] font-semibold text-rose-700">{displayError}</p>
              </div>
            )}

            {/* Submit */}
            <button
              id="login-submit-btn"
              type="submit"
              disabled={isLoading}
              className={`w-full flex items-center justify-center gap-2 py-2.5 text-[0.65rem] font-bold uppercase tracking-widest transition-all active:scale-95 ${
                isLoading
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                  : 'bg-gray-900 text-white hover:bg-indigo-700'
              }`}
            >
              {isLoading ? (
                <><Loader2 size={13} strokeWidth={2} className="animate-spin" /><span>Đang xác thực...</span></>
              ) : (
                <><Lock size={13} strokeWidth={2} /><span>Đăng nhập</span></>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-[0.58rem] font-bold text-gray-300 uppercase tracking-widest">hoặc</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          {/* Register link */}
          <button
            id="goto-register-btn"
            type="button"
            onClick={onNavigateToRegister}
            className="w-full py-2.5 text-[0.65rem] font-bold uppercase tracking-widest text-gray-500 hover:text-gray-900 hover:bg-gray-50 border border-gray-200 hover:border-gray-300 transition-all"
          >
            Tạo tài khoản Admin mới
          </button>
        </div>

        {/* Footer */}
        <p className="text-center text-[0.58rem] font-bold text-gray-300 uppercase tracking-widest mt-5">
          SWG Shield v4.1 · VNU Information Security 2026
        </p>
      </div>
    </div>
  );
};

export default Login;
