/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  SWGGuard — Global Scan Store (Zustand)                    ║
 * ║  Pipeline 3 bước: WAF → FastText → DistilBERT              ║
 * ║  + LocalStorage Caching + Conflict Detection               ║
 * ╚══════════════════════════════════════════════════════════════╝
 */
import { create } from 'zustand';
import {
  STATUS_IDLE, STATUS_SCANNING, STATUS_DONE, STATUS_ERROR,
  LAYER_CLIENT, DISTILBERT_AUTO_TRIGGER_THRESHOLD,
} from '../utils/constants';
import { genId } from '../utils/helpers';
import {
  scanWAF, scanFastText, scanDistilBERT,
  checkWAFHealth, checkAIHealth, checkDistilBERTHealth,
} from '../services/api';

// ══════════════════════════════════════════════════════════════════
//  LocalStorage Cache — tránh gọi AI lại cho cùng 1 nội dung
// ══════════════════════════════════════════════════════════════════
const CACHE_KEY = 'swg_scan_cache';
const CACHE_MAX = 100;   // giữ tối đa 100 kết quả

/**
 * Tạo hash đơn giản từ text (djb2 algorithm).
 * Dùng làm key trong cache.
 */
const hashText = (str) => {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit int
  }
  return 'h_' + Math.abs(hash).toString(36);
};

/** Đọc cache từ localStorage */
const getCache = () => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

/** Lưu 1 entry vào cache */
const setCacheEntry = (text, data) => {
  try {
    const cache = getCache();
    const key = hashText(text);
    cache[key] = { text: text.slice(0, 200), data, ts: Date.now() };

    // Giới hạn cache size — xóa entry cũ nhất
    const entries = Object.entries(cache);
    if (entries.length > CACHE_MAX) {
      entries.sort((a, b) => a[1].ts - b[1].ts);
      const toRemove = entries.slice(0, entries.length - CACHE_MAX);
      toRemove.forEach(([k]) => delete cache[k]);
    }

    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.warn('[Cache] Lỗi lưu cache:', e);
  }
};

/** Tìm kết quả trong cache theo text */
const getCacheEntry = (text) => {
  try {
    const cache = getCache();
    const key = hashText(text);
    const entry = cache[key];
    if (!entry) return null;

    // Cache expire sau 1 giờ
    if (Date.now() - entry.ts > 3600_000) {
      delete cache[key];
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
      return null;
    }

    return entry.data;
  } catch {
    return null;
  }
};

// ══════════════════════════════════════════════════════════════════
//  STORE
// ══════════════════════════════════════════════════════════════════
const useScanStore = create((set, get) => ({
  // ── Scanner State ────────────────────────────────────────────
  inputText: '',
  currentLayer: LAYER_CLIENT,

  // Trạng thái từng bước (3 layers)
  stepStatus: {
    waf:        'idle',   // 'idle' | 'scanning' | 'done' | 'blocked' | 'error'
    fasttext:   'idle',
    distilbert: 'idle',
  },

  // Kết quả từng bước
  wafResult:        null,
  fastTextResult:   null,
  distilbertResult: null,

  // Conflict: FastText vs DistilBERT mâu thuẫn
  hasConflict: false,
  conflictDetail: null,

  // Cache hit?
  cacheHit: false,

  error: null,

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

  // ══════════════════════════════════════════════════════════════
  //  ACTIONS
  // ══════════════════════════════════════════════════════════════

  setInputText: (text) => set({ inputText: text }),

  resetScan: () => set({
    currentLayer:     LAYER_CLIENT,
    stepStatus:       { waf: 'idle', fasttext: 'idle', distilbert: 'idle' },
    wafResult:        null,
    fastTextResult:   null,
    distilbertResult: null,
    hasConflict:      false,
    conflictDetail:   null,
    cacheHit:         false,
    error:            null,
  }),

  // ── Bước 1: Quét WAF ─────────────────────────────────────────
  runWAFScan: async () => {
    const { inputText, stats } = get();
    if (!inputText.trim()) return;

    // Reset tất cả kết quả, bắt đầu bước 1
    set({
      stepStatus:       { waf: 'scanning', fasttext: 'idle', distilbert: 'idle' },
      wafResult:        null,
      fastTextResult:   null,
      distilbertResult: null,
      currentLayer:     'waf',
      hasConflict:      false,
      conflictDetail:   null,
      cacheHit:         false,
      error:            null,
    });

    await delay(300);

    try {
      const wafData = await scanWAF(inputText);
      const blocked = wafData.waf_blocked === true || wafData.blocked === true ||
                      wafData.status === 'BLOCKED_BY_WAF';

      set({
        wafResult:    wafData,
        currentLayer: blocked ? 'result' : 'waf',
        stepStatus:   { waf: blocked ? 'blocked' : 'done', fasttext: 'idle', distilbert: 'idle' },
      });

      // WAF chặn → ghi log + stats
      if (blocked) {
        const newWafEvents = [
          {
            id:        genId(),
            timestamp: new Date().toISOString(),
            type:      wafData.attack_type || 'UNKNOWN',
            reason:    wafData.detail || `Phát hiện: ${wafData.attack_type || 'malicious payload'}`,
            payload:   inputText,
            layer:     'WAF',
            status:    'BLOCKED',
          },
          ...get().wafEvents,
        ].slice(0, 500);

        const entry = {
          id:        genId(),
          timestamp: new Date().toISOString(),
          text:      inputText,
          result:    { ...wafData, waf_blocked: true, blocked: true },
        };

        set({
          wafEvents: newWafEvents,
          stats:     { ...stats, total: stats.total + 1, blockedWAF: stats.blockedWAF + 1 },
          history:   [entry, ...get().history].slice(0, 200),
        });
      }
    } catch (err) {
      set({
        stepStatus:   { waf: 'error', fasttext: 'idle', distilbert: 'idle' },
        error:        err.message,
        currentLayer: 'result',
      });
    }
  },

  // ── Bước 2: Quét FastText AI ──────────────────────────────────
  runAIScan: async () => {
    const { inputText, wafResult, stats } = get();
    if (!inputText.trim() || !wafResult) return;

    // ── Check cache trước ──────────────────────────────────────
    const cached = getCacheEntry(inputText);
    if (cached?.fasttext) {
      console.log('[Cache] ✅ FastText cache hit');
      const ftCached = cached.fasttext;
      const isScam   = ftCached.prediction?.toLowerCase() === 'scam';
      
      // MỚI: FastText chỉ thẩm định, KHÔNG có quyền chặn
      const blocked  = false; 

      set({
        fastTextResult: { ...ftCached, fasttext_blocked: blocked, cached: true },
        currentLayer:   'result',
        stepStatus:     { ...get().stepStatus, fasttext: 'done' }, // Luôn done
        cacheHit:       true,
      });

      // Nếu có DistilBERT cache
      if (cached.distilbert) {
        const dbCached = cached.distilbert;
        set({
          distilbertResult: { ...dbCached, cached: true },
          stepStatus: { ...get().stepStatus, distilbert: dbCached.is_scam ? 'blocked' : 'done' },
        });
        // Kiểm tra conflict
        _checkConflict(ftCached, dbCached, set, get);
      }

      // Ghi history
      _recordFinalHistory(set, get, inputText, stats, blocked);
      return;
    }

    // ── Gọi API thực ──────────────────────────────────────────
    set({
      stepStatus:       { ...get().stepStatus, fasttext: 'scanning' },
      fastTextResult:   null,
      distilbertResult: null,
      currentLayer:     'fasttext',
      error:            null,
    });

    await delay(300);

    try {
      const ftData = await scanFastText(inputText);
      const isScam     = ftData.prediction?.toLowerCase() === 'scam';
      
      // MỚI: FastText chỉ thẩm định, KHÔNG có quyền chặn
      const blocked    = false; 
      const ftDataFull = { ...ftData, fasttext_blocked: blocked };

      set({
        fastTextResult: ftDataFull,
        currentLayer:   'result',
        stepStatus:     { ...get().stepStatus, fasttext: 'done' }, // Luôn done
      });

      // ── Logic tự động gọi DistilBERT ──────────────────────
      const distilbertAvailable = get().distilbertOnline === true;

      if (distilbertAvailable) {
        // Tự động chạy bước 3 LUÔN LUÔN vì DistilBERT mới có quyền chặn
        await get()._runDistilBERTInternal(inputText, ftDataFull);
      } else {
        // Không có DistilBERT → hệ thống không thể chặn bằng AI (FastText k được chặn)
        _recordFinalHistory(set, get, inputText, stats, blocked);

        // Lưu cache (chỉ FastText)
        setCacheEntry(inputText, { fasttext: ftData });
      }
    } catch (err) {
      set({
        stepStatus: { ...get().stepStatus, fasttext: 'error' },
        error:      err.message,
        currentLayer: 'result',
      });
    }
  },

  // ── Bước 3: DistilBERT Deep Analysis (có thể trigger thủ công) ─
  runDistilBERTScan: async () => {
    const { inputText, fastTextResult } = get();
    if (!inputText.trim() || !fastTextResult) return;
    await get()._runDistilBERTInternal(inputText, fastTextResult);
  },

  // ── Internal: Chạy DistilBERT ─────────────────────────────────
  _runDistilBERTInternal: async (text, ftResult) => {
    const { stats } = get();

    // Check cache
    const cached = getCacheEntry(text);
    if (cached?.distilbert) {
      console.log('[Cache] ✅ DistilBERT cache hit');
      const dbCached = cached.distilbert;
      set({
        distilbertResult: { ...dbCached, cached: true },
        stepStatus: { ...get().stepStatus, distilbert: dbCached.is_scam ? 'blocked' : 'done' },
      });
      _checkConflict(ftResult, dbCached, set, get);
      _recordFinalHistory(set, get, text, stats, null);
      return;
    }

    // Gọi API
    set({
      stepStatus:       { ...get().stepStatus, distilbert: 'scanning' },
      distilbertResult: null,
      currentLayer:     'distilbert',
      error:            null,
    });

    await delay(300);

    try {
      const dbData = await scanDistilBERT(text);

      // DistilBERT trả: { is_scam, confidence_score (0-100), prediction, status }
      const dbFull = {
        ...dbData,
        distilbert_blocked: dbData.is_scam === true,
      };

      set({
        distilbertResult: dbFull,
        currentLayer:     'result',
        stepStatus: { ...get().stepStatus, distilbert: dbData.is_scam ? 'blocked' : 'done' },
      });

      // ── Conflict Detection ──────────────────────────────────
      _checkConflict(ftResult, dbData, set, get);

      // ── Lưu cache (FastText + DistilBERT) ───────────────────
      const ftRaw = { ...ftResult };
      delete ftRaw.fasttext_blocked;
      delete ftRaw.cached;
      setCacheEntry(text, { fasttext: ftRaw, distilbert: dbData });

      // ── Ghi history ─────────────────────────────────────────
      _recordFinalHistory(set, get, text, stats, null);

    } catch (err) {
      // DistilBERT lỗi → hệ thống vẫn hoạt động với 2 layer
      console.warn('[DistilBERT] Lỗi — fallback về kết quả FastText:', err.message);
      set({
        stepStatus: { ...get().stepStatus, distilbert: 'error' },
        error: `DistilBERT: ${err.message} (hệ thống vẫn hoạt động với 2 layer)`,
        currentLayer: 'result',
      });

      // Ghi history chỉ với FastText
      _recordFinalHistory(set, get, text, stats, null);
    }
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

  // ── Gửi báo cáo Admin (khi conflict) ─────────────────────────
  sendAdminReport: () => {
    const { conflictDetail, inputText } = get();
    if (!conflictDetail) return;

    // Trong production, đây sẽ là POST request tới admin endpoint
    // Hiện tại: log ra console + alert
    const report = {
      timestamp:  new Date().toISOString(),
      text:       inputText,
      fasttext:   conflictDetail.fasttext,
      distilbert: conflictDetail.distilbert,
      type:       'MODEL_CONFLICT',
    };

    console.log('[Admin Report] 📧 Báo cáo mâu thuẫn:', report);

    // Lưu vào localStorage cho admin xem
    try {
      const reports = JSON.parse(localStorage.getItem('swg_admin_reports') || '[]');
      reports.unshift(report);
      localStorage.setItem('swg_admin_reports', JSON.stringify(reports.slice(0, 50)));
    } catch (e) {
      console.warn('[Admin] Lỗi lưu report:', e);
    }

    alert('📧 Đã gửi báo cáo mâu thuẫn cho Admin!\nChi tiết đã lưu vào hệ thống.');
  },

  // ── Thêm bản ghi Verified từ Admin Queue vào Stats và Lịch sử ──
  addVerifiedRecord: (record) => set((state) => {
    const isScam = record.admin_verdict === 'scam';
    
    // Tạo result giả lập kết quả AI chặn
    const combinedResult = {
      waf_blocked: false,
      blocked: false,
      fasttext_blocked: isScam,
      distilbert_blocked: isScam,
      final_blocked: isScam,
      confidence: 1.0, // Xác nhận từ con người (100%)
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

// ══════════════════════════════════════════════════════════════════
//  LẮNG NGHE SỰ KIỆN TỪ EXTENSION
// ══════════════════════════════════════════════════════════════════
if (typeof window !== 'undefined') {
  window.addEventListener('swg_extension_scan', (e) => {
    if (e.detail) {
      const { text, aiData, isMalicious } = e.detail;
      useScanStore.getState().addExtensionScanRecord(text, aiData, isMalicious);
    }
  });
}

// ══════════════════════════════════════════════════════════════════
//  HELPER FUNCTIONS (bên ngoài store)
// ══════════════════════════════════════════════════════════════════

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Kiểm tra conflict giữa FastText và DistilBERT.
 * Conflict = một bên nói Safe, bên kia nói Scam.
 */
function _checkConflict(ftResult, dbResult, set, get) {
  const ftIsScam = ftResult?.prediction?.toLowerCase() === 'scam';
  const dbIsScam = dbResult?.is_scam === true;

  // Conflict: kết quả mâu thuẫn nhau
  if (ftIsScam !== dbIsScam) {
    set({
      hasConflict: true,
      conflictDetail: {
        fasttext: {
          prediction: ftResult.prediction,
          confidence: ftResult.confidence,
          is_scam: ftIsScam,
        },
        distilbert: {
          prediction: dbResult.prediction,
          confidence_score: dbResult.confidence_score,
          is_scam: dbIsScam,
        },
      },
    });
  } else {
    set({ hasConflict: false, conflictDetail: null });
  }
}

/**
 * Ghi lịch sử tổng hợp sau khi pipeline hoàn tất.
 * @param {Function} set - Zustand setter
 * @param {Function} get - Zustand getter
 * @param {string} text - Input text
 * @param {object} stats - Current stats
 * @param {boolean|null} forcedBlocked - Nếu null thì tự tính
 */
function _recordFinalHistory(set, get, text, stats, forcedBlocked) {
  const { wafResult, fastTextResult, distilbertResult } = get();

  // Tính blocked tổng hợp
  const ftBlocked = fastTextResult?.fasttext_blocked === true;
  const dbBlocked = distilbertResult?.distilbert_blocked === true;
  
  // DistilBERT là Layer 3 (thẩm định sâu) → nếu có kết quả thì lấy của DistilBERT
  const aiBlocked = distilbertResult ? dbBlocked : ftBlocked;
  
  const blocked = forcedBlocked !== null ? forcedBlocked : aiBlocked;

  const combined = {
    ...(wafResult || {}),
    ...(fastTextResult || {}),
    ...(distilbertResult || {}),
    waf_blocked:        false,
    blocked:            false,
    fasttext_blocked:   ftBlocked,
    distilbert_blocked: dbBlocked,
    final_blocked:      aiBlocked, // Lưu trạng thái block cuối cùng
    ft_prediction:      fastTextResult?.prediction, // Lưu lại dự đoán của riêng FastText
  };

  // Thêm confidence tổng hợp (DistilBERT ưu tiên nếu có)
  if (distilbertResult) {
    combined.confidence = distilbertResult.confidence_score / 100;
    combined.prediction = distilbertResult.prediction;
  }

  const entry = {
    id:        genId(),
    timestamp: new Date().toISOString(),
    text:      text,
    result:    combined,
  };

  const newStats = {
    ...stats,
    total:     stats.total + 1,
    blockedAI: stats.blockedAI + (blocked ? 1 : 0),
    safe:      stats.safe      + (!blocked ? 1 : 0),
  };

  set({
    stats:   newStats,
    history: [entry, ...get().history].slice(0, 200),
  });
}

export default useScanStore;
