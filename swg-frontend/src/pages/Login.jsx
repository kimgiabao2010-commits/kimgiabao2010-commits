/**
 * Login.jsx — Animated light-mode, dashboard-consistent design
 * Animations: floating shapes, pulsing rings, scanning line
 */
import React, { useState } from 'react';
import {
  Shield, Lock, User, Eye, EyeOff,
  AlertTriangle, Loader2, Terminal, Target,
  ShieldCheck, KeyRound, Fingerprint, Wifi,
} from 'lucide-react';
import useAuthStore from '../store/authStore';

/* ─── Keyframe styles injected once ───────────────────────── */
const STYLE = `
@keyframes floatA {
  0%,100% { transform: translateY(0px) rotate(0deg);   opacity: 0.07; }
  50%      { transform: translateY(-22px) rotate(8deg);  opacity: 0.13; }
}
@keyframes floatB {
  0%,100% { transform: translateY(0px) rotate(0deg);   opacity: 0.06; }
  50%      { transform: translateY(18px) rotate(-6deg); opacity: 0.11; }
}
@keyframes floatC {
  0%,100% { transform: translateY(0px) rotate(0deg);   opacity: 0.05; }
  33%      { transform: translateY(-14px) rotate(5deg);  opacity: 0.10; }
  66%      { transform: translateY(10px) rotate(-4deg);  opacity: 0.08; }
}
@keyframes pulseRing {
  0%   { transform: scale(1);   opacity: 0.15; }
  50%  { transform: scale(1.35);opacity: 0; }
  100% { transform: scale(1);   opacity: 0; }
}
@keyframes scanLine {
  0%   { top: -2px;   opacity: 0; }
  10%  { opacity: 1; }
  90%  { opacity: 1; }
  100% { top: 100%;  opacity: 0; }
}
@keyframes shimmer {
  0%   { background-position: -200% center; }
  100% { background-position:  200% center; }
}
`;

/* ─── Floating icon wrapper ───────────────────────────────── */
const FloatIcon = ({ icon: Icon, style, anim }) => (
  <div className="absolute pointer-events-none text-indigo-600/10 select-none mix-blend-multiply"
    style={{ animation: anim, ...style }}>
    <Icon strokeWidth={1.5} />
  </div>
);

const PulseRing = ({ style }) => (
  <div className="absolute rounded-full border border-indigo-200/60 pointer-events-none"
    style={{ animation: 'pulseRing 3s ease-out infinite', ...style }} />
);

const Corner = ({ pos }) => {
  const cls = {
    tl: 'top-0 left-0 border-t-2 border-l-2 rounded-tl-2xl',
    br: 'bottom-0 right-0 border-b-2 border-r-2 rounded-br-2xl',
  }[pos];
  return <span className={`absolute w-8 h-8 border-indigo-300 ${cls} pointer-events-none`} />;
};

const Login = ({ onNavigateToRegister }) => {
  const [username, setUsername]         = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError]     = useState('');

  const { login, isLoading, error, clearError } = useAuthStore();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError(''); clearError();
    if (!username.trim() || !password) { setLocalError('Vui lòng nhập đầy đủ username và mật khẩu.'); return; }
    try { await login(username, password); } catch { /* → authStore.error */ }
  };

  const displayError = localError || error;

  return (
    <>
      <style>{STYLE}</style>

      <div className="min-h-screen flex items-center justify-center relative overflow-hidden font-sans"
        style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #e0e7ff 100%)' }}>

        {/* ── Background floating icons ─────────────────────── */}
        <FloatIcon icon={Shield}       anim="floatA 7s ease-in-out infinite"        style={{ top: '8%',  left: '6%',  width: 64, height: 64 }} />
        <FloatIcon icon={Lock}         anim="floatB 9s ease-in-out infinite"        style={{ top: '55%', left: '4%',  width: 48, height: 48 }} />
        <FloatIcon icon={ShieldCheck}  anim="floatC 8s ease-in-out infinite"        style={{ top: '20%', right: '5%', width: 56, height: 56 }} />
        <FloatIcon icon={KeyRound}     anim="floatA 11s ease-in-out infinite 1s"   style={{ top: '72%', right: '7%', width: 44, height: 44 }} />
        <FloatIcon icon={Fingerprint}  anim="floatB 10s ease-in-out infinite 2s"   style={{ top: '80%', left: '12%', width: 52, height: 52 }} />
        <FloatIcon icon={Wifi}         anim="floatC 12s ease-in-out infinite 0.5s" style={{ top: '40%', right: '3%', width: 40, height: 40 }} />
        <FloatIcon icon={Shield}       anim="floatB 13s ease-in-out infinite 3s"   style={{ top: '88%', right: '18%',width: 32, height: 32 }} />
        <FloatIcon icon={Lock}         anim="floatA 8s ease-in-out infinite 1.5s"  style={{ top: '12%', left: '30%', width: 28, height: 28 }} />

        {/* ── Pulsing rings ─────────────────────────────────── */}
        <PulseRing style={{ width: 140, height: 140, top: '5%',  left: '3%',  animationDelay: '0s'   }} />
        <PulseRing style={{ width: 100, height: 100, bottom: '8%', right: '4%', animationDelay: '1.5s' }} />
        <PulseRing style={{ width: 80,  height: 80,  top: '60%', left: '8%',  animationDelay: '3s'   }} />

        {/* ── Scan line across full page ────────────────────── */}
        <div className="absolute left-0 right-0 h-px pointer-events-none"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.3), transparent)',
            animation: 'scanLine 6s linear infinite',
          }} />

        {/* ── Card container ───────────────────────────────── */}
        <div className="relative z-10 w-full max-w-md mx-4">
          
          {/* Brand */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 mb-4 relative">
              <div className="absolute inset-0 rounded-full border border-indigo-200"
                style={{ animation: 'pulseRing 2.5s ease-out infinite' }} />
              <div className="w-14 h-14 rounded-full bg-white border border-indigo-100 shadow-sm flex items-center justify-center">
                <Shield size={26} strokeWidth={1.5} className="text-indigo-600" />
              </div>
            </div>

            <div className="flex items-center justify-center gap-3 mb-2">
              <Terminal size={22} strokeWidth={1.5} className="text-indigo-600" />
              <span className="text-slate-900 font-black text-2xl tracking-tight">
                SWG<span className="text-indigo-600">GUARD</span>
              </span>
            </div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              // Sec-Ops Admin Console
            </p>
          </div>

          {/* Card */}
          <div className="relative bg-white/95 backdrop-blur-xl border border-white rounded-3xl p-8 sm:p-10 shadow-2xl shadow-indigo-600/10">
            <Corner pos="tl" />
            <Corner pos="br" />

            {/* Card header */}
            <div className="flex items-center justify-between mb-8 pb-5 border-b border-slate-100">
              <h1 className="text-sm font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2">
                <Target size={16} className="text-indigo-600" />
                Admin Authentication
              </h1>
              <div className="px-2.5 py-1 bg-slate-900 text-white rounded-lg font-bold text-xs tracking-widest uppercase flex items-center gap-1.5 shadow-md shadow-slate-900/20">
                <Shield size={12} strokeWidth={2} />
                JWT
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">

              {/* Username */}
              <div className="space-y-2">
                <label htmlFor="login-username"
                  className="block text-xs font-bold text-slate-500 uppercase tracking-widest">
                  Username
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <User size={16} strokeWidth={1.5} className="text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                  </div>
                  <input
                    id="login-username"
                    type="text"
                    value={username}
                    onChange={(e) => { setUsername(e.target.value); setLocalError(''); clearError(); }}
                    placeholder="Nhập tên tài khoản admin"
                    autoComplete="username"
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-medium placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-sm"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <label htmlFor="login-password"
                  className="block text-xs font-bold text-slate-500 uppercase tracking-widest">
                  Mật khẩu
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Lock size={16} strokeWidth={1.5} className="text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                  </div>
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setLocalError(''); clearError(); }}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-medium placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-sm"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-indigo-600 transition-colors">
                    {showPassword ? <EyeOff size={16} strokeWidth={1.5} /> : <Eye size={16} strokeWidth={1.5} />}
                  </button>
                </div>
              </div>

              {/* Error */}
              {displayError && (
                <div className="flex items-start gap-3 p-3.5 bg-rose-50 border border-rose-100 rounded-xl">
                  <AlertTriangle size={16} strokeWidth={2} className="text-rose-500 shrink-0 mt-0.5" />
                  <p className="text-xs font-semibold text-rose-700 leading-relaxed">{displayError}</p>
                </div>
              )}

              {/* Submit */}
              <button
                id="login-submit-btn"
                type="submit"
                disabled={isLoading}
                className={`w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl text-sm font-bold uppercase tracking-widest transition-all active:scale-[0.98] ${
                  isLoading
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200 shadow-sm'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/40 border border-indigo-500'
                }`}
              >
                {isLoading
                  ? <><Loader2 size={16} strokeWidth={2} className="animate-spin" /><span>Đang xác thực...</span></>
                  : <><Lock size={16} strokeWidth={2} /><span>Đăng nhập hệ thống</span></>}
              </button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-4 my-7">
              <div className="flex-1 h-px bg-slate-100" />
              <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">hoặc</span>
              <div className="flex-1 h-px bg-slate-100" />
            </div>

            {/* Register link */}
            <button
              id="goto-register-btn"
              type="button"
              onClick={onNavigateToRegister}
              className="w-full py-3.5 rounded-xl text-xs font-bold uppercase tracking-widest text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 transition-all focus:outline-none focus:ring-4 focus:ring-slate-100 shadow-sm hover:shadow-md"
            >
              Đăng ký tài khoản Admin mới
            </button>
          </div>

          {/* Footer */}
          <p className="text-center text-xs font-bold text-slate-400 uppercase tracking-widest mt-8">
            SWG Shield v4.1 · VNU Information Security 2026
          </p>
        </div>
      </div>
    </>
  );
};

export default Login;
