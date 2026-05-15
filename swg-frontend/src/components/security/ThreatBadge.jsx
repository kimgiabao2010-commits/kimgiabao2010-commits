import React from 'react';
import './ThreatBadge.css';

const CONFIG = {
  safe:             { label: 'AN TOÀN',         cls: 'badge--safe',     icon: '✅' },
  blocked_waf:      { label: 'CHẶN: WAF',        cls: 'badge--waf',      icon: '🔥' },
  blocked_fasttext: { label: 'CHẶN: FastText',   cls: 'badge--fasttext', icon: '🧠' },
  blocked_distilbert:{ label: 'CHẶN: DistilBERT',cls: 'badge--distilbert',icon: '🤖' },
  scam:             { label: 'LỪA ĐẢO',          cls: 'badge--scam',     icon: '⚠️' },
  checking:         { label: 'ĐANG KIỂM TRA',    cls: 'badge--checking', icon: '⏳' },
};

/**
 * @param {'safe'|'blocked_waf'|'blocked_fasttext'|'blocked_distilbert'|'scam'|'checking'} status
 * @param {'sm'|'md'|'lg'} size
 */
const ThreatBadge = ({ status = 'checking', size = 'md' }) => {
  const cfg = CONFIG[status] || CONFIG.checking;
  return (
    <span className={`threat-badge threat-badge--${size} ${cfg.cls}`}>
      <span className="threat-badge__icon">{cfg.icon}</span>
      <span className="threat-badge__label">{cfg.label}</span>
    </span>
  );
};

export default ThreatBadge;
