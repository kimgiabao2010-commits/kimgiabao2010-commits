import React from 'react';
import useScanStore from '../../store/scanStore';
import './PipelineVisualizer.css';

const STEPS = [
  { id: 'client',     icon: '💻', label: 'Client',      sublabel: 'Browser' },
  { id: 'waf',        icon: '🔥', label: 'WAF',         sublabel: 'Layer 1' },
  { id: 'fasttext',   icon: '🧠', label: 'FastText',    sublabel: 'Layer 2' },
  { id: 'distilbert', icon: '🤖', label: 'DistilBERT',  sublabel: 'Layer 3' },
  { id: 'result',     icon: '🏁', label: 'Result',      sublabel: 'Output' },
];

/**
 * Tính trạng thái hiển thị của từng bước dựa trên stepStatus.
 * stepStatus = { waf, fasttext, distilbert }
 */
const getStepState = (stepId, stepStatus) => {
  // Client luôn "done" nếu bất kỳ bước nào đã bắt đầu
  if (stepId === 'client') {
    const anyStarted =
      stepStatus.waf !== 'idle' ||
      stepStatus.fasttext !== 'idle' ||
      stepStatus.distilbert !== 'idle';
    return anyStarted ? 'done' : 'idle';
  }

  if (stepId === 'waf') {
    if (stepStatus.waf === 'idle')     return 'idle';
    if (stepStatus.waf === 'scanning') return 'active';
    if (stepStatus.waf === 'blocked')  return 'blocked';
    if (stepStatus.waf === 'done')     return 'done';
    if (stepStatus.waf === 'error')    return 'error';
    return 'idle';
  }

  if (stepId === 'fasttext') {
    if (stepStatus.waf !== 'done')           return 'pending';
    if (stepStatus.fasttext === 'idle')      return 'pending';
    if (stepStatus.fasttext === 'scanning')  return 'active';
    if (stepStatus.fasttext === 'blocked')   return 'blocked';
    if (stepStatus.fasttext === 'done')      return 'done';
    if (stepStatus.fasttext === 'error')     return 'error';
    return 'pending';
  }

  if (stepId === 'distilbert') {
    // DistilBERT chỉ active sau khi FastText hoàn tất
    const ftFinished = stepStatus.fasttext === 'done' || stepStatus.fasttext === 'blocked';
    if (!ftFinished)                          return 'pending';
    if (stepStatus.distilbert === 'idle')     return 'pending';
    if (stepStatus.distilbert === 'scanning') return 'active';
    if (stepStatus.distilbert === 'blocked')  return 'blocked';
    if (stepStatus.distilbert === 'done')     return 'done';
    if (stepStatus.distilbert === 'error')    return 'error';
    return 'pending';
  }

  if (stepId === 'result') {
    const wafBlocked = stepStatus.waf === 'blocked';
    const ftDone     = stepStatus.fasttext === 'done' || stepStatus.fasttext === 'blocked';
    const dbDone     = stepStatus.distilbert === 'done' || stepStatus.distilbert === 'blocked' || stepStatus.distilbert === 'error';

    // Kết quả xuất hiện khi: WAF chặn, hoặc FastText xong (và DistilBERT xong / không cần)
    if (wafBlocked) return 'done';
    if (ftDone && (dbDone || stepStatus.distilbert === 'idle')) return 'done';
    return 'pending';
  }

  return 'idle';
};

const PipelineVisualizer = () => {
  const { stepStatus } = useScanStore();

  return (
    <div className="pipeline" id="pipeline-visualizer" aria-label="Security pipeline">
      {STEPS.map((step, i) => {
        const state = getStepState(step.id, stepStatus);
        const isBlocked = state === 'blocked';

        return (
          <React.Fragment key={step.id}>
            <div
              className={`pipeline__step pipeline__step--${state}`}
              id={`pipe-${step.id}`}
            >
              <div className={`pipeline__bubble ${state === 'active' ? 'pipeline__bubble--pulse' : ''}`}>
                <span className="pipeline__icon">{step.icon}</span>
                {state === 'done' && <span className="pipeline__check">✓</span>}
                {isBlocked && <span className="pipeline__blocked">✕</span>}
              </div>

              <div className="pipeline__info">
                <span className="pipeline__label">{step.label}</span>
                <span className="pipeline__sub">{step.sublabel}</span>
              </div>

              {isBlocked && (
                <span className="pipeline__tag pipeline__tag--blocked">BLOCKED</span>
              )}
            </div>

            {i < STEPS.length - 1 && (
              <div className={`pipeline__arrow ${
                getStepState(STEPS[i + 1].id, stepStatus) !== 'pending' &&
                getStepState(STEPS[i + 1].id, stepStatus) !== 'idle'
                  ? 'pipeline__arrow--active' : ''
              }`}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12h14M13 6l6 6-6 6"
                    stroke="currentColor" strokeWidth="2"
                    strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default PipelineVisualizer;
