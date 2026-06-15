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
  <div className="absolute pointer-events-none text-indigo-600 select-none"
    style={{ animation: anim, ...style }}>
    <Icon strokeWidth={1} />
  </div>
);

/* ─── Pulsing ring ────────────────────────────────────────── */
const PulseRing = ({ style }) => (
  <div className="absolute rounded-full border border-indigo-400 pointer-events-none"
    style={{ animation: 'pulseRing 3s ease-out infinite', ...style }} />
);

/* ─── Corner bracket ──────────────────────────────────────── */
const Corner = ({ pos }) => {
  const cls = {
    tl: 'top-0 left-0 border-t-2 border-l-2',
    br: 'bottom-0 right-0 border-b-2 border-r-2',
  }[pos];
  return <span className={`absolute w-5 h-5 border-indigo-300 ${cls} pointer-events-none`} />;
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
      {/* Inject keyframes */}
      <style>{STYLE}</style>

      <div className="min-h-screen flex items-center justify-center relative overflow-hidden"
        style={{ background: '#F5F5F7' }}>

        {/* ── Background floating icons ─────────────────────── */}
        <FloatIcon icon={Shield}       anim="floatA 7s ease-in-out infinite"        style={{ top: '8%',  left: '6%',  width: 52, height: 52, opacity: 0.08 }} />
        <FloatIcon icon={Lock}         anim="floatB 9s ease-in-out infinite"        style={{ top: '55%', left: '4%',  width: 36, height: 36, opacity: 0.07 }} />
        <FloatIcon icon={ShieldCheck}  anim="floatC 8s ease-in-out infinite"        style={{ top: '20%', right: '5%', width: 48, height: 48, opacity: 0.07 }} />
        <FloatIcon icon={KeyRound}     anim="floatA 11s ease-in-out infinite 1s"   style={{ top: '72%', right: '7%', width: 38, height: 38, opacity: 0.07 }} />
        <FloatIcon icon={Fingerprint}  anim="floatB 10s ease-in-out infinite 2s"   style={{ top: '80%', left: '12%', width: 44, height: 44, opacity: 0.06 }} />
        <FloatIcon icon={Wifi}         anim="floatC 12s ease-in-out infinite 0.5s" style={{ top: '40%', right: '3%', width: 32, height: 32, opacity: 0.06 }} />
        <FloatIcon icon={Shield}       anim="floatB 13s ease-in-out infinite 3s"   style={{ top: '88%', right: '18%',width: 28, height: 28, opacity: 0.05 }} />
        <FloatIcon icon={Lock}         anim="floatA 8s ease-in-out infinite 1.5s"  style={{ top: '12%', left: '30%', width: 24, height: 24, opacity: 0.05 }} />

        {/* ── Pulsing rings ─────────────────────────────────── */}
        <PulseRing style={{ width: 120, height: 120, top: '5%',  left: '3%',  animationDelay: '0s'   }} />
        <PulseRing style={{ width: 80,  height: 80,  bottom: '8%', right: '4%', animationDelay: '1.5s' }} />
        <PulseRing style={{ width: 60,  height: 60,  top: '60%', left: '8%',  animationDelay: '3s'   }} />

        {/* ── Soft radial glow ──────────────────────────────── */}
        <div className="absolute pointer-events-none"
          style={{
            top: '-20%', left: '-10%',
            width: 500, height: 500,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(99,102,241,0.10) 0%, transparent 70%)',
          }} />
        <div className="absolute pointer-events-none"
          style={{
            bottom: '-20%', right: '-10%',
            width: 500, height: 500,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)',
          }} />

        {/* ── Scan line across full page ────────────────────── */}
        <div className="absolute left-0 right-0 h-px pointer-events-none"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.25), transparent)',
            animation: 'scanLine 6s linear infinite',
          }} />

        {/* ── Card container ───────────────────────────────── */}
        <div className="relative z-10 w-full max-w-sm mx-4">

          {/* Brand */}
          <div className="text-center mb-8">
            {/* Animated shield icon above brand */}
            <div className="inline-flex items-center justify-center w-12 h-12 mb-4 relative">
              {/* outer pulsing ring */}
              <div className="absolute inset-0 rounded-full border border-indigo-200"
                style={{ animation: 'pulseRing 2.5s ease-out infinite' }} />
              <div className="w-10 h-10 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center">
                <Shield size={18} strokeWidth={1.5} className="text-indigo-600" />
              </div>
            </div>

            <div className="flex items-center justify-center gap-2.5 mb-2">
              <Terminal size={16} strokeWidth={1.25} className="text-indigo-600" />
              <span className="text-gray-900 font-bold text-lg tracking-tight">
                SWG<span className="text-indigo-600">GUARD</span>
              </span>
            </div>
            <p className="text-[0.6rem] font-bold text-gray-400 uppercase tracking-[0.2em]">
              // Sec-Ops Admin Console
            </p>
          </div>

          {/* Card */}
          <div className="relative bg-white border border-gray-200/80 p-8 shadow-sm shadow-gray-200/60">
            <Corner pos="tl" />
            <Corner pos="br" />

            {/* Card header */}
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
                <label htmlFor="login-username"
                  className="block text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest">
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
                    className="w-full pl-9 pr-4 py-2.5 bg-gray-50/80 border border-gray-200 text-gray-900 text-xs font-medium placeholder:text-gray-300 focus:outline-none focus:border-indigo-400 focus:bg-white transition-colors"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label htmlFor="login-password"
                  className="block text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest">
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
                    className="w-full pl-9 pr-10 py-2.5 bg-gray-50/80 border border-gray-200 text-gray-900 text-xs font-medium placeholder:text-gray-300 focus:outline-none focus:border-indigo-400 focus:bg-white transition-colors"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-300 hover:text-gray-500 transition-colors">
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
                {isLoading
                  ? <><Loader2 size={13} strokeWidth={2} className="animate-spin" /><span>Đang xác thực...</span></>
                  : <><Lock size={13} strokeWidth={2} /><span>Đăng nhập</span></>}
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
          <p className="text-center text-[0.55rem] font-bold text-gray-300 uppercase tracking-widest mt-5">
            SWG Shield v4.1 · VNU Information Security 2026
          </p>
        </div>
      </div>
    </>
  );
};

export default Login;
