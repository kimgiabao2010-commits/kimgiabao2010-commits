/**
 * Register.jsx — Trang tạo tài khoản Admin mới
 * ==============================================
 * Design nhất quán với Dashboard:
 *   - Nền: #F5F5F7, card bg-white border-gray-200
 *   - Text: gray-900 / gray-400
 *   - Accent: indigo-600
 *   - Labels: uppercase tracking-widest (giống Dashboard)
 */

import React, { useState } from 'react';
import {
  Shield, Lock, User, Eye, EyeOff, KeyRound,
  AlertTriangle, CheckCircle2, Loader2,
  ArrowLeft, Terminal, Target,
} from 'lucide-react';
import { registerAdmin } from '../services/api';

const Register = ({ onNavigateToLogin }) => {
  const [username, setUsername]         = useState('');
  const [password, setPassword]         = useState('');
  const [confirmPassword, setConfirm]   = useState('');
  const [apiKey, setApiKey]             = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading]       = useState(false);
  const [error, setError]               = useState('');
  const [success, setSuccess]           = useState('');

  // Độ mạnh mật khẩu
  const strength = (() => {
    if (!password) return { level: 0, label: '', color: '' };
    let s = 0;
    if (password.length >= 8)             s++;
    if (password.length >= 12)            s++;
    if (/[A-Z]/.test(password))          s++;
    if (/[0-9]/.test(password))          s++;
    if (/[^A-Za-z0-9]/.test(password))  s++;
    if (s <= 2) return { level: s, label: 'Yếu',        color: '#e11d48' };
    if (s <= 3) return { level: s, label: 'Trung bình', color: '#f59e0b' };
    return              { level: s, label: 'Mạnh',       color: '#10b981' };
  })();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!username.trim() || !password || !confirmPassword || !apiKey) {
      setError('Vui lòng điền đầy đủ tất cả các trường.'); return;
    }
    if (password !== confirmPassword) { setError('Mật khẩu xác nhận không khớp.'); return; }
    if (password.length < 8)          { setError('Mật khẩu phải có ít nhất 8 ký tự.'); return; }

    setIsLoading(true);
    try {
      const data = await registerAdmin(username.trim(), password, apiKey.trim());
      setSuccess(`Tài khoản "${data.admin?.username}" đã được tạo thành công!`);
      setTimeout(() => onNavigateToLogin?.(), 2500);
    } catch (err) {
      setError(err.message || 'Đã xảy ra lỗi khi tạo tài khoản.');
    } finally {
      setIsLoading(false);
    }
  };

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

        {/* ── Register card ────────────────────────────── */}
        <div className="bg-white border border-gray-200/80 p-8">

          {/* Back + title */}
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
            <h1 className="text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <Target size={13} strokeWidth={1.5} />
              Tạo tài khoản Admin
            </h1>
            <button
              type="button"
              onClick={onNavigateToLogin}
              className="flex items-center gap-1.5 text-[0.6rem] font-bold text-gray-400 hover:text-gray-700 uppercase tracking-widest transition-colors"
            >
              <ArrowLeft size={11} strokeWidth={2} />
              Quay lại
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Username */}
            <div className="space-y-1.5">
              <label className="block text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest">Username</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User size={14} strokeWidth={1.5} className="text-gray-300" />
                </div>
                <input
                  id="register-username"
                  type="text"
                  value={username}
                  onChange={(e) => { setUsername(e.target.value); setError(''); }}
                  placeholder="Nhập tên tài khoản"
                  autoComplete="username"
                  className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 text-gray-900 text-xs font-medium placeholder:text-gray-300 focus:outline-none focus:border-gray-400 transition-colors"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="block text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest">Mật khẩu</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock size={14} strokeWidth={1.5} className="text-gray-300" />
                </div>
                <input
                  id="register-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  placeholder="Tối thiểu 8 ký tự"
                  autoComplete="new-password"
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
              {/* Strength bar */}
              {password && (
                <div className="space-y-1">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className="flex-1 h-0.5 transition-all duration-300"
                        style={{ background: i <= strength.level ? strength.color : '#e5e7eb' }}
                      />
                    ))}
                  </div>
                  <p className="text-[0.58rem] font-bold uppercase tracking-widest" style={{ color: strength.color }}>
                    {strength.label}
                  </p>
                </div>
              )}
            </div>

            {/* Confirm password */}
            <div className="space-y-1.5">
              <label className="block text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest">Xác nhận mật khẩu</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock size={14} strokeWidth={1.5} className="text-gray-300" />
                </div>
                <input
                  id="register-confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => { setConfirm(e.target.value); setError(''); }}
                  placeholder="Nhập lại mật khẩu"
                  autoComplete="new-password"
                  className="w-full pl-9 pr-10 py-2.5 bg-white text-gray-900 text-xs font-medium placeholder:text-gray-300 focus:outline-none transition-colors"
                  style={{
                    border: `1px solid ${
                      confirmPassword && password !== confirmPassword ? '#f43f5e'
                      : confirmPassword && password === confirmPassword ? '#10b981'
                      : '#e5e7eb'
                    }`,
                  }}
                />
                {confirmPassword && password === confirmPassword && (
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <CheckCircle2 size={13} strokeWidth={2} style={{ color: '#10b981' }} />
                  </div>
                )}
              </div>
            </div>

            {/* API Key */}
            <div className="space-y-1.5">
              <label className="block text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest">
                X-API-Key{' '}
                <span className="text-rose-400 font-bold normal-case tracking-normal">· superadmin only</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <KeyRound size={14} strokeWidth={1.5} className="text-gray-300" />
                </div>
                <input
                  id="register-api-key"
                  type="password"
                  value={apiKey}
                  onChange={(e) => { setApiKey(e.target.value); setError(''); }}
                  placeholder="Nhập API key hệ thống"
                  className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 text-gray-900 text-xs font-mono placeholder:text-gray-300 focus:outline-none focus:border-gray-400 transition-colors"
                />
              </div>
              <p className="text-[0.58rem] text-gray-300 uppercase tracking-widest font-bold">
                Chỉ người có X-API-Key mới tạo được Admin
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2.5 p-3 bg-rose-50 border border-rose-200/60">
                <AlertTriangle size={13} strokeWidth={2} className="text-rose-500 shrink-0 mt-0.5" />
                <p className="text-[0.65rem] font-semibold text-rose-700">{error}</p>
              </div>
            )}

            {/* Success */}
            {success && (
              <div className="flex items-start gap-2.5 p-3 bg-emerald-50 border border-emerald-200/60">
                <CheckCircle2 size={13} strokeWidth={2} className="text-emerald-500 shrink-0 mt-0.5" />
                <p className="text-[0.65rem] font-semibold text-emerald-700">{success}</p>
              </div>
            )}

            {/* Submit */}
            <button
              id="register-submit-btn"
              type="submit"
              disabled={isLoading || !!success}
              className={`w-full flex items-center justify-center gap-2 py-2.5 text-[0.65rem] font-bold uppercase tracking-widest transition-all active:scale-95 ${
                isLoading || success
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                  : 'bg-gray-900 text-white hover:bg-indigo-700'
              }`}
            >
              {isLoading ? (
                <><Loader2 size={13} strokeWidth={2} className="animate-spin" /><span>Đang tạo...</span></>
              ) : success ? (
                <><CheckCircle2 size={13} strokeWidth={2} /><span>Đã tạo thành công!</span></>
              ) : (
                <><Shield size={13} strokeWidth={2} /><span>Tạo tài khoản Admin</span></>
              )}
            </button>
          </form>

          {/* Footer note */}
          <p className="text-center text-[0.58rem] font-bold text-gray-300 uppercase tracking-widest mt-5">
            Mật khẩu mã hóa bcrypt · Salt ngẫu nhiên
          </p>
        </div>

        {/* Page footer */}
        <p className="text-center text-[0.58rem] font-bold text-gray-300 uppercase tracking-widest mt-5">
          SWG Shield v4.1 · VNU Information Security 2026
        </p>
      </div>
    </div>
  );
};

export default Register;
