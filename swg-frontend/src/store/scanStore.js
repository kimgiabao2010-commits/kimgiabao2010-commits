/**
 * SWGGuard — Global Scan Store (Zustand)
 * Pure SIEM/Dashboard logic (Scanner UI has been removed)
 */
import { create } from 'zustand';
import { genId } from '../utils/helpers';
import {
  checkWAFHealth, checkAIHealth, checkDistilBERTHealth,
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

  // ── History / Events ──────────────────────────────────────────
  clearHistory:   () => set({ history: [] }),
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
    let conf = 0;
    if (aiData?.distilbert) conf = aiData.distilbert.confidence_score / 100;
    else if (aiData?.fasttext) conf = aiData.fasttext.confidence;

    const combinedResult = {
      waf_blocked: false,
      blocked: false,
      fasttext_blocked: isScam && !aiData?.distilbert,
      distilbert_blocked: isScam && !!aiData?.distilbert,
      final_blocked: isScam,
      confidence: conf,
      prediction: isScam ? 'Scam' : 'Legit',
      layer_info: aiData?.layer,
      detail: aiData?.detail,
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
        blockedAI: state.stats.blockedAI + (isScam ? 1 : 0),
        safe: state.stats.safe + (!isScam ? 1 : 0),
      },
      history: [entry, ...state.history].slice(0, 200),
    };
  }),
}));

// LẮNG NGHE SỰ KIỆN TỪ EXTENSION
if (typeof window !== 'undefined') {
  window.addEventListener('swg_extension_scan', (e) => {
    if (e.detail) {
      const { text, aiData, isMalicious } = e.detail;
      useScanStore.getState().addExtensionScanRecord(text, aiData, isMalicious);
    }
  });
}

export default useScanStore;
