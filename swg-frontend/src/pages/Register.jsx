/**
 * Register.jsx — Animated light-mode, dashboard-consistent design
 */
import React, { useState } from 'react';
import {
  Shield, Lock, User, Eye, EyeOff, KeyRound,
  AlertTriangle, CheckCircle2, Loader2,
  ArrowLeft, Terminal, Target,
  ShieldCheck, Fingerprint, Wifi, ScanLine,
} from 'lucide-react';
import { registerAdmin } from '../services/api';

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
  0%   { top: -2px;  opacity: 0; }
  10%  { opacity: 1; }
  90%  { opacity: 1; }
  100% { top: 100%; opacity: 0; }
}
`;

const FloatIcon = ({ icon: Icon, style, anim }) => (
  <div className="absolute pointer-events-none text-indigo-600 select-none"
    style={{ animation: anim, ...style }}>
    <Icon strokeWidth={1} />
  </div>
);

const PulseRing = ({ style }) => (
  <div className="absolute rounded-full border border-indigo-400 pointer-events-none"
    style={{ animation: 'pulseRing 3s ease-out infinite', ...style }} />
);

const Corner = ({ pos }) => {
  const cls = { tl: 'top-0 left-0 border-t-2 border-l-2', br: 'bottom-0 right-0 border-b-2 border-r-2' }[pos];
  return <span className={`absolute w-5 h-5 border-indigo-300 ${cls} pointer-events-none`} />;
};

const Register = ({ onNavigateToLogin }) => {
  const [username, setUsername]         = useState('');
  const [password, setPassword]         = useState('');
  const [confirmPassword, setConfirm]   = useState('');
  const [apiKey, setApiKey]             = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading]       = useState(false);
  const [error, setError]               = useState('');
  const [success, setSuccess]           = useState('');

  const strength = (() => {
    if (!password) return { level: 0, label: '', color: '' };
    let s = 0;
    if (password.length >= 8)            s++;
    if (password.length >= 12)           s++;
    if (/[A-Z]/.test(password))         s++;
    if (/[0-9]/.test(password))         s++;
    if (/[^A-Za-z0-9]/.test(password))  s++;
    if (s <= 2) return { level: s, label: 'Yếu',        color: '#e11d48' };
    if (s <= 3) return { level: s, label: 'Trung bình', color: '#f59e0b' };
    return           { level: s, label: 'Mạnh',          color: '#10b981' };
  })();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!username.trim() || !password || !confirmPassword || !apiKey) { setError('Vui lòng điền đầy đủ tất cả các trường.'); return; }
    if (password !== confirmPassword) { setError('Mật khẩu xác nhận không khớp.'); return; }
    if (password.length < 8)          { setError('Mật khẩu phải có ít nhất 8 ký tự.'); return; }
    setIsLoading(true);
    try {
      const data = await registerAdmin(username.trim(), password, apiKey.trim());
      setSuccess(`Tài khoản "${data.admin?.username}" đã được tạo thành công!`);
      setTimeout(() => onNavigateToLogin?.(), 2500);
    } catch (err) {
      setError(err.message || 'Đã xảy ra lỗi khi tạo tài khoản.');
    } finally { setIsLoading(false); }
  };

  return (
    <>
      <style>{STYLE}</style>

      <div className="min-h-screen flex items-center justify-center relative overflow-hidden py-8"
        style={{ background: '#F5F5F7' }}>

        {/* Floating icons — mirrored positions vs Login */}
        <FloatIcon icon={ShieldCheck}  anim="floatB 7s ease-in-out infinite"        style={{ top: '6%',  right: '6%',  width: 52, height: 52 }} />
        <FloatIcon icon={Lock}         anim="floatA 9s ease-in-out infinite"        style={{ top: '55%', right: '4%', width: 36, height: 36 }} />
        <FloatIcon icon={Shield}       anim="floatC 8s ease-in-out infinite"        style={{ top: '22%', left: '5%',  width: 48, height: 48 }} />
        <FloatIcon icon={KeyRound}     anim="floatB 11s ease-in-out infinite 1s"   style={{ top: '75%', left: '7%',  width: 38, height: 38 }} />
        <FloatIcon icon={Fingerprint}  anim="floatA 10s ease-in-out infinite 2s"   style={{ top: '82%', right: '12%',width: 44, height: 44 }} />
        <FloatIcon icon={Wifi}         anim="floatC 12s ease-in-out infinite 0.5s" style={{ top: '42%', left: '3%',  width: 32, height: 32 }} />
        <FloatIcon icon={Shield}       anim="floatA 13s ease-in-out infinite 3s"   style={{ top: '90%', left: '20%', width: 28, height: 28 }} />
        <FloatIcon icon={ScanLine}     anim="floatB 8s ease-in-out infinite 1.5s"  style={{ top: '10%', right: '28%',width: 24, height: 24 }} />

        {/* Pulsing rings */}
        <PulseRing style={{ width: 120, height: 120, top: '4%',   right: '3%',  animationDelay: '0s'   }} />
        <PulseRing style={{ width: 80,  height: 80,  bottom: '8%',left: '4%',   animationDelay: '1.5s' }} />
        <PulseRing style={{ width: 60,  height: 60,  top: '58%',  right: '8%',  animationDelay: '3s'   }} />

        {/* Glow blobs */}
        <div className="absolute pointer-events-none" style={{
          top: '-20%', right: '-10%', width: 500, height: 500, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.10) 0%, transparent 70%)',
        }} />
        <div className="absolute pointer-events-none" style={{
          bottom: '-20%', left: '-10%', width: 500, height: 500, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)',
        }} />

        {/* Scan line */}
        <div className="absolute left-0 right-0 h-px pointer-events-none" style={{
          background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.25), transparent)',
          animation: 'scanLine 6s linear infinite',
          animationDelay: '3s',
        }} />

        {/* ── Card ─────────────────────────────────────────── */}
        <div className="relative z-10 w-full max-w-sm mx-4">

          {/* Brand */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 mb-4 relative">
              <div className="absolute inset-0 rounded-full border border-indigo-200"
                style={{ animation: 'pulseRing 2.5s ease-out infinite' }} />
              <div className="w-10 h-10 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center">
                <ShieldCheck size={18} strokeWidth={1.5} className="text-indigo-600" />
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
                Tạo tài khoản Admin
              </h1>
              <button type="button" onClick={onNavigateToLogin}
                className="flex items-center gap-1.5 text-[0.6rem] font-bold text-gray-400 hover:text-gray-700 uppercase tracking-widest transition-colors">
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
                  <input id="register-username" type="text" value={username}
                    onChange={(e) => { setUsername(e.target.value); setError(''); }}
                    placeholder="Nhập tên tài khoản" autoComplete="username"
                    className="w-full pl-9 pr-4 py-2.5 bg-gray-50/80 border border-gray-200 text-gray-900 text-xs font-medium placeholder:text-gray-300 focus:outline-none focus:border-indigo-400 focus:bg-white transition-colors"
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
                  <input id="register-password" type={showPassword ? 'text' : 'password'} value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(''); }}
                    placeholder="Tối thiểu 8 ký tự" autoComplete="new-password"
                    className="w-full pl-9 pr-10 py-2.5 bg-gray-50/80 border border-gray-200 text-gray-900 text-xs font-medium placeholder:text-gray-300 focus:outline-none focus:border-indigo-400 focus:bg-white transition-colors"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-300 hover:text-gray-500 transition-colors">
                    {showPassword ? <EyeOff size={14} strokeWidth={1.5} /> : <Eye size={14} strokeWidth={1.5} />}
                  </button>
                </div>
                {password && (
                  <div className="space-y-1 pt-0.5">
                    <div className="flex gap-1">
                      {[1,2,3,4,5].map(i => (
                        <div key={i} className="flex-1 h-0.5 transition-all duration-300"
                          style={{ background: i <= strength.level ? strength.color : '#e5e7eb' }} />
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
                  <input id="register-confirm-password"
                    type={showPassword ? 'text' : 'password'} value={confirmPassword}
                    onChange={(e) => { setConfirm(e.target.value); setError(''); }}
                    placeholder="Nhập lại mật khẩu" autoComplete="new-password"
                    className="w-full pl-9 pr-10 py-2.5 bg-gray-50/80 text-gray-900 text-xs font-medium placeholder:text-gray-300 focus:outline-none transition-colors"
                    style={{ border: `1px solid ${confirmPassword && password !== confirmPassword ? '#f43f5e' : confirmPassword && password === confirmPassword ? '#10b981' : '#e5e7eb'}` }}
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
                  X-API-Key <span className="text-rose-400 font-bold normal-case tracking-normal">· superadmin only</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <KeyRound size={14} strokeWidth={1.5} className="text-gray-300" />
                  </div>
                  <input id="register-api-key" type="password" value={apiKey}
                    onChange={(e) => { setApiKey(e.target.value); setError(''); }}
                    placeholder="Nhập API key hệ thống"
                    className="w-full pl-9 pr-4 py-2.5 bg-gray-50/80 border border-gray-200 text-gray-900 text-xs font-mono placeholder:text-gray-300 focus:outline-none focus:border-indigo-400 focus:bg-white transition-colors"
                  />
                </div>
                <p className="text-[0.58rem] text-gray-300 uppercase tracking-widest font-bold">
                  Chỉ người có X-API-Key mới tạo được Admin
                </p>
              </div>

              {/* Error / Success */}
              {error && (
                <div className="flex items-start gap-2.5 p-3 bg-rose-50 border border-rose-200/60">
                  <AlertTriangle size={13} strokeWidth={2} className="text-rose-500 shrink-0 mt-0.5" />
                  <p className="text-[0.65rem] font-semibold text-rose-700">{error}</p>
                </div>
              )}
              {success && (
                <div className="flex items-start gap-2.5 p-3 bg-emerald-50 border border-emerald-200/60">
                  <CheckCircle2 size={13} strokeWidth={2} className="text-emerald-500 shrink-0 mt-0.5" />
                  <p className="text-[0.65rem] font-semibold text-emerald-700">{success}</p>
                </div>
              )}

              {/* Submit */}
              <button id="register-submit-btn" type="submit" disabled={isLoading || !!success}
                className={`w-full flex items-center justify-center gap-2 py-2.5 text-[0.65rem] font-bold uppercase tracking-widest transition-all active:scale-95 ${
                  isLoading || success
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                    : 'bg-gray-900 text-white hover:bg-indigo-700'
                }`}>
                {isLoading   ? <><Loader2 size={13} strokeWidth={2} className="animate-spin" /><span>Đang tạo...</span></> :
                 success     ? <><CheckCircle2 size={13} strokeWidth={2} /><span>Đã tạo thành công!</span></> :
                               <><Shield size={13} strokeWidth={2} /><span>Tạo tài khoản Admin</span></>}
              </button>
            </form>

            <p className="text-center text-[0.58rem] font-bold text-gray-300 uppercase tracking-widest mt-5">
              Mật khẩu mã hóa bcrypt · Salt ngẫu nhiên
            </p>
          </div>

          <p className="text-center text-[0.55rem] font-bold text-gray-300 uppercase tracking-widest mt-5">
            SWG Shield v4.1 · VNU Information Security 2026
          </p>
        </div>
      </div>
    </>
  );
};

export default Register;
