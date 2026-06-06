/**
 * SWGGuard — Global Scan Store (Zustand)
 * Pure SIEM/Dashboard logic (Scanner UI has been removed)
 */
import { create } from 'zustand';
import { genId } from '../utils/helpers';
import {
  checkWAFHealth, checkAIHealth, checkDistilBERTHealth,
  fetchScanLogs,
} from '../services/api';

const useScanStore = create((set, get) => ({
  // ── Servers ──────────────────────────────────────────────────
  wafOnline:       null,
  aiOnline:        null,
  distilbertOnline: null,

  // ── History ──────────────────────────────────────────────────
  history:   [],
  wafEvents: [],

  // ── Stats ─────────────────────────────────────────────────────
  stats: {
    total:       0,
    blockedWAF:  0,
    blockedAI:   0,
    safe:        0,
  },

  // ── Tracking backend poll ────────────────────────────────────
  _lastPollCount: 0,

  // ── History / Events ──────────────────────────────────────────
  clearHistory:   () => set({ history: [], stats: { total: 0, blockedWAF: 0, blockedAI: 0, safe: 0 }, _lastPollCount: 0 }),
  clearWafEvents: () => set({ wafEvents: [] }),

  // ── Server Health Checks ──────────────────────────────────────
  checkServers: async () => {
    set({ wafOnline: null, aiOnline: null, distilbertOnline: null });
    try { await checkWAFHealth();       set({ wafOnline: true }); }
    catch { set({ wafOnline: false }); }
    try { await checkAIHealth();        set({ aiOnline:  true }); }
    catch { set({ aiOnline:  false }); }
    try { await checkDistilBERTHealth(); set({ distilbertOnline: true }); }
    catch { set({ distilbertOnline: false }); }
  },

  // ── Thêm bản ghi Verified từ Admin Queue vào Stats và Lịch sử ──
  addVerifiedRecord: (record) => set((state) => {
    const isScam = record.admin_verdict === 'scam';
    
    const combinedResult = {
      waf_blocked: false,
      blocked: false,
      fasttext_blocked: isScam,
      distilbert_blocked: isScam,
      final_blocked: isScam,
      confidence: 1.0, // Human verified
      prediction: isScam ? 'Scam' : 'Legit',
    };

    const entry = {
      id: record.id || genId(),
      timestamp: record.verified_at || new Date().toISOString(),
      text: record.page_text_preview || record.url,
      result: combinedResult,
    };

    return {
      stats: {
        ...state.stats,
        total: state.stats.total + 1,
        blockedAI: state.stats.blockedAI + (isScam ? 1 : 0),
        safe: state.stats.safe + (!isScam ? 1 : 0),
      },
      history: [entry, ...state.history].slice(0, 200),
    };
  }),

  // ── Thêm bản ghi quét trực tiếp từ Extension vào Stats và Lịch sử ──
  addExtensionScanRecord: (text, aiData, isScam) => set((state) => {
    let conf = null;
    const isWaf = aiData?.status === 'BLOCKED_BY_WAF' || aiData?.waf_blocked;
    const isTrusted = aiData?.layer === 'TRUSTED_DOMAIN' || aiData?.layer === 'TRUSTED_CITATION';
    
    if (isWaf) conf = 1.0;
    else if (isTrusted) conf = null;   // Trusted bypass — hiện 'BYPASS' thay vì số
    else if (aiData?.distilbert?.confidence_score != null) conf = aiData.distilbert.confidence_score / 100;
    else if (aiData?.fasttext?.confidence != null) conf = aiData.fasttext.confidence;
    else if (aiData?.score != null) conf = aiData.score;  // fallback: backend pipeline score

    const combinedResult = {
      waf_blocked: isWaf,
      blocked: isWaf || isScam,
      fasttext_blocked: !isWaf && isScam && !aiData?.distilbert,
      distilbert_blocked: !isWaf && isScam && !!aiData?.distilbert,
      final_blocked: isWaf || isScam,
      confidence: conf,
      prediction: (isWaf || isScam) ? (isWaf ? aiData?.attack_type || 'Attack' : 'Scam') : 'Legit',
      layer_info: aiData?.layer || (isWaf ? 'WAF' : undefined),
      detail: aiData?.detail,
      is_trusted: isTrusted,
      fasttext: aiData?.fasttext,
      distilbert: aiData?.distilbert,
      pattern_engine: aiData?.pattern_engine,
      override_reason: aiData?.override_reason,
    };

    const entry = {
      id: genId(),
      timestamp: new Date().toISOString(),
      text: text,
      result: combinedResult,
    };

    return {
      stats: {
        ...state.stats,
        total: state.stats.total + 1,
        blockedWAF: state.stats.blockedWAF + (isWaf ? 1 : 0),
        blockedAI: state.stats.blockedAI + (!isWaf && isScam ? 1 : 0),
        safe: state.stats.safe + (!isWaf && !isScam ? 1 : 0),
      },
      history: [entry, ...state.history].slice(0, 200),
    };
  }),

  // ── FIX 2: Poll backend /api/scan-log mỗi 5 giây ──────────────────────
  pollBackendLogs: async () => {
    try {
      const data = await fetchScanLogs(200);
      if (!data || !data.logs) return;

      const { _lastPollCount, history } = get();
      const newTotal = data.total;

      // Nếu backend có nhiều log hơn lần trước → có log mới
      if (newTotal <= _lastPollCount) return;

      // Lấy các log MỚI (chênh lệch giữa lần poll trước và bây giờ)
      const newCount = newTotal - _lastPollCount;
      const newLogs = data.logs.slice(0, newCount);

      // Chuyển đổi log backend → format store
      // Tạo một text-based key để loại bỏ những log mà `addExtensionScanRecord` ĐÃ thêm realtime (tránh trùng lặp giữa polling và realtime event)
      // Những log backend CŨ hơn thời điểm chúng ta mở dashboard là an toàn, những log MỚI mà ta đã có qua realtime event list cũng sẽ có dấu timestamp rất gần.
      // Tuy nhiên, không block người dùng quét CÙNG MỘT đoạn text nhiều lần ở các thời điểm khác nhau.
      // Dùng kết hợp text + timestamp (làm tròn đến phút) để Deduplicate.
      const existingKeys = new Set(history.map(h => {
        const t = (h.text || '').substring(0, 100);
        // Lấy thời gian đến mức Phút. Nếu cùng text ở cùng 1 phút -> coi như bị duplicate bởi realtime event.
        const timeKey = h.timestamp ? h.timestamp.substring(0, 16) : '';
        return t + '|' + timeKey;
      }));

      const entries = [];

      for (const log of newLogs) {
        const textStr = (log.text || '').substring(0, 100);
        const logTimeKey = log.timestamp ? log.timestamp.substring(0, 16) : '';
        const dedupeKey = textStr + '|' + logTimeKey;

        // Nếu store ĐÃ có log này (nhờ event swg_extension_scan bắn sang từ trước), thì skip.
        if (existingKeys.has(dedupeKey)) continue;
        existingKeys.add(dedupeKey);

        const isWaf = log.waf_blocked;
        const isScam = log.is_malicious;

        let conf = null;
        if (isWaf) conf = 1.0;
        else if (log.distilbert?.confidence_score != null) conf = log.distilbert.confidence_score / 100;
        else if (log.fasttext?.confidence != null) conf = log.fasttext.confidence;
        else if (log.score != null) conf = log.score;

        entries.push({
          id: genId(),
          timestamp: log.timestamp || new Date().toISOString(),
          text: log.text,
          result: {
            waf_blocked: isWaf,
            blocked: isWaf || isScam,
            fasttext_blocked: !isWaf && isScam && !log.distilbert,
            distilbert_blocked: !isWaf && isScam && !!log.distilbert,
            final_blocked: isWaf || isScam,
            confidence: conf,
            prediction: (isWaf || isScam) ? (isWaf ? log.attack_type || 'Attack' : 'Scam') : 'Legit',
            layer_info: log.layer,
            fasttext: log.fasttext,
            distilbert: log.distilbert,
            pattern_engine: log.pattern_engine,
          },
        });
      }

      if (entries.length === 0) {
        set({ _lastPollCount: newTotal });
        return;
      }

      set((state) => {
        let addWAF = 0, addAI = 0, addSafe = 0;
        entries.forEach(e => {
          const r = e.result;
          if (r.waf_blocked) addWAF++;
          else if (r.final_blocked) addAI++;
          else addSafe++;
        });

        return {
          _lastPollCount: newTotal,
          stats: {
            total: state.stats.total + entries.length,
            blockedWAF: state.stats.blockedWAF + addWAF,
            blockedAI: state.stats.blockedAI + addAI,
            safe: state.stats.safe + addSafe,
          },
          history: [...entries, ...state.history].slice(0, 200),
        };
      });
    } catch {
      // Backend offline — im lặng
    }
  },
}));

// LẮNG NGHE SỰ KIỆN TỪ EXTENSION (khi dashboard tab đang mở)
if (typeof window !== 'undefined') {
  window.addEventListener('swg_extension_scan', (e) => {
    if (e.detail) {
      const { text, aiData, isMalicious } = e.detail;
      useScanStore.getState().addExtensionScanRecord(text, aiData, isMalicious);
    }
  });

  // Auto-poll backend scan logs mỗi 5 giây — CHỈ khi đã đăng nhập
  // (tránh apiFetch() nhận 401 → gọi logout() liên tục trên trang Login/Register)
  const _isLoggedIn = () => !!localStorage.getItem('swg_admin_token');

  setInterval(() => {
    if (_isLoggedIn()) useScanStore.getState().pollBackendLogs();
  }, 5000);

  // Poll ngay lập tức khi load page — nhưng chỉ khi đã có token
  setTimeout(() => {
    if (_isLoggedIn()) useScanStore.getState().pollBackendLogs();
  }, 1000);
}

export default useScanStore;

