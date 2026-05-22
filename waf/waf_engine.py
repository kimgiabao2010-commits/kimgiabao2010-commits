"""
waf/waf_engine.py
-----------------
Core Logic — WafEngine class.

Task 3 update: Rules now loaded from waf_rules.json (hot-reloadable).
Falls back to waf_rules_set.py if JSON is missing/invalid.
"""

from __future__ import annotations

import html
import json
import logging
import os
import re
import threading
import urllib.parse
from typing import Dict, List, Optional

logger = logging.getLogger("SWG-WAF")

# Path to the hot-reloadable rules file (relative to project root)
_WAF_RULES_PATH = os.path.join(
    os.path.dirname(os.path.dirname(__file__)), "waf_rules.json"
)

# Danh sách các đuôi tên miền được phép (Whitelist TLD)
TRUSTED_TLDS = (
    '.vn', '.com.vn', '.com', '.net',
    '.edu.vn', '.edu', '.ac.vn', '.ac.uk',
    '.gov.vn', '.gov',
    '.org', '.org.vn', '.int',
    '.io', '.ai', '.dev', '.app', '.tech', '.me', '.info'
)

# ---------------------------------------------------------------------------
# Regex tách URL
# ---------------------------------------------------------------------------
_URL_EXTRACTOR = re.compile(
    r"(?:https?|ftp)://"
    r"[^\s\"'<>\[\]{}\(\)\\]+"
    r"[^\s\"'<>\[\]{}\(\)\\.,;:!?]",
    re.IGNORECASE,
)


def _compile_rules_from_json(rules_dict: dict) -> Dict[str, List[re.Pattern]]:
    """Convert raw-string rules from JSON into compiled regex patterns."""
    compiled: Dict[str, List[re.Pattern]] = {}
    for attack_type, patterns in rules_dict.items():
        if attack_type.startswith("_"):  # skip metadata keys
            continue
        compiled_list: List[re.Pattern] = []
        for raw in patterns:
            try:
                compiled_list.append(re.compile(raw, re.IGNORECASE))
            except re.error as exc:
                logger.warning("WAF rule compile error [%s] '%s': %s", attack_type, raw[:60], exc)
        compiled[attack_type] = compiled_list
    return compiled


def _load_rules_from_json(path: str) -> Optional[Dict[str, List[re.Pattern]]]:
    """Load and compile WAF rules from JSON file. Returns None on failure."""
    try:
        with open(path, "r", encoding="utf-8") as f:
            raw = json.load(f)
        compiled = _compile_rules_from_json(raw)
        logger.info("WAF: Loaded %d rule groups from %s", len(compiled), path)
        return compiled
    except FileNotFoundError:
        logger.warning("WAF: waf_rules.json not found at %s. Auto-generating it from fallback rules...", path)
        from waf.waf_rules_set import WAF_RULES  # type: ignore
        raw_rules = {}
        for attack_type, compiled_list in WAF_RULES.items():
            raw_rules[attack_type] = [pattern.pattern for pattern in compiled_list]
        try:
            with open(path, "w", encoding="utf-8") as f:
                json.dump(raw_rules, f, indent=4, ensure_ascii=False)
            logger.info("WAF: Successfully created waf_rules.json")
        except Exception as exc:
            logger.error("WAF: Failed to auto-generate waf_rules.json: %s", exc)
        return WAF_RULES
    except Exception as exc:
        logger.error("WAF: Failed to load waf_rules.json: %s", exc)
        return None


def _load_fallback_rules() -> Dict[str, List[re.Pattern]]:
    """Load compiled rules from the hardcoded waf_rules_set.py."""
    from waf.waf_rules_set import WAF_RULES  # type: ignore
    logger.info("WAF: Using fallback rules from waf_rules_set.py")
    return WAF_RULES


def check_url_security(url: str) -> dict:
    """Heuristic kiểm tra độ an toàn của URL."""
    try:
        lower_url = url.lower()
        if lower_url.startswith("http://") or lower_url.startswith("ftp://"):
            return {"is_safe": False, "attack_type": "INSECURE_HTTP_PROTOCOL"}

        parse_url = url if lower_url.startswith("http") else f"https://{url}"
        parsed = urllib.parse.urlparse(parse_url)
        domain = (parsed.hostname or "").lower()
        if domain.startswith("www."):
            domain = domain[4:]

        if not any(domain.endswith(tld) for tld in TRUSTED_TLDS):
            return {"is_safe": False, "attack_type": "SUSPICIOUS_TLD_PHISHING"}

        return {"is_safe": True}
    except Exception:
        return {"is_safe": False, "attack_type": "SUSPICIOUS_TLD_PHISHING"}


class WafEngine:
    """
    Layer 1 WAF Engine — Defense-in-Depth.
    Supports hot-reload of rules from waf_rules.json via reload_rules().
    """

    def __init__(self):
        self._lock = threading.RLock()
        self._rules: Dict[str, List[re.Pattern]] = {}
        self.reload_rules()

    def reload_rules(self) -> dict:
        """
        Hot-reload rules from waf_rules.json without restarting.
        Falls back to modsec_rules_set.py if JSON is unavailable.
        Returns a status dict.
        """
        new_rules = _load_rules_from_json(_WAF_RULES_PATH)
        if new_rules is None:
            new_rules = _load_fallback_rules()
            source = "waf_rules_set.py (fallback)"
        else:
            source = _WAF_RULES_PATH

        with self._lock:
            self._rules = new_rules

        group_count = len(new_rules)
        rule_count = sum(len(v) for v in new_rules.values())
        logger.info("WAF: Reloaded %d groups / %d rules from %s", group_count, rule_count, source)
        return {
            "status": "ok",
            "source": source,
            "groups": group_count,
            "total_rules": rule_count,
        }

    @staticmethod
    def normalize_payload(text: str) -> str:
        """Chuẩn hóa payload — anti-bypass (multi-pass URL decode, lowercase, HTML unescape, null byte removal)."""
        if not isinstance(text, str):
            text = str(text)

        try:
            prev = None
            while prev != text:
                prev = text
                text = urllib.parse.unquote(text)
        except Exception:
            pass

        try:
            if "\\u" in text or "\\x" in text:
                text = text.encode("raw_unicode_escape").decode("unicode_escape")
        except Exception:
            pass

        text = text.lower()

        try:
            text = html.unescape(text)
        except Exception:
            pass

        text = text.replace('\x00', '').replace('%00', '')
        text = re.sub(r"/\*.*?\*/", " ", text, flags=re.DOTALL)
        text = re.sub(r"(?<![:/])--[^\r\n]*", " ", text)
        text = re.sub(r"\s+", " ", text)

        return text.strip()

    @staticmethod
    def extract_urls(text: str) -> list[str]:
        """Tách tất cả URL có trong chuỗi văn bản."""
        return _URL_EXTRACTOR.findall(text)

    def inspect(self, payload: str, exclude_heuristic: bool = False) -> dict:
        """Kiểm tra payload qua toàn bộ WAF pipeline."""
        if not isinstance(payload, str):
            payload = str(payload)

        normalized = self.normalize_payload(payload)

        with self._lock:
            rules_snapshot = self._rules

        # Quét 5 nhóm luật Regex
        for attack_type, patterns in rules_snapshot.items():
            if attack_type == "MALICIOUS_URL_PATTERNS":
                continue

            for compiled_re in patterns:
                if compiled_re.search(normalized):
                    return {
                        "is_attack": True,
                        "attack_type": attack_type,
                        "matched_pattern": compiled_re.pattern[:120],
                        "urls_found": [],
                        "blocked_url": None,
                        "normalized": normalized[:200],
                    }

        if exclude_heuristic:
            return {
                "is_attack": False,
                "attack_type": None,
                "matched_pattern": None,
                "urls_found": [],
                "blocked_url": None,
                "normalized": normalized[:200],
            }

        # Tách URL và Phân tích Heuristic
        urls_found = self.extract_urls(payload)
        urls_found_norm = self.extract_urls(normalized)
        all_urls = list(dict.fromkeys(urls_found + urls_found_norm))

        for url in all_urls:
            result = check_url_security(url)
            if not result["is_safe"]:
                return {
                    "is_attack": True,
                    "attack_type": result["attack_type"],
                    "matched_data": url,
                    "matched_pattern": result["attack_type"],
                    "urls_found": all_urls,
                    "blocked_url": url,
                    "normalized": normalized[:200],
                }

        return {
            "is_attack": False,
            "attack_type": None,
            "matched_pattern": None,
            "urls_found": all_urls,
            "blocked_url": None,
            "normalized": normalized[:200],
        }
