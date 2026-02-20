"""
Radius mode cache — stores radius expressions per document so they can be
restored when switching between Compound/Straight/Flat modes.

Cache file: radius_cache.json in add-in root, keyed by document path.
"""

import json
import os
from typing import Optional, Dict
from .. import config
from . import fusionAddInUtils as futil

# Path to cache file in add-in root
CACHE_FILE = os.path.join(config.ADDIN_ROOT, 'radius_cache.json')


def _load_cache() -> Dict[str, Dict[str, str]]:
    """Load the entire cache file.

    Returns:
        Dict mapping document paths to { 'nutRadius': expr, 'heelRadius': expr }
    """
    if not os.path.exists(CACHE_FILE):
        return {}

    try:
        with open(CACHE_FILE, 'r', encoding='utf-8') as f:
            cache = json.load(f)
            if isinstance(cache, dict):
                return cache
            else:
                futil.log('Radius cache file has invalid format', force_console=True)
                return {}
    except json.JSONDecodeError as e:
        futil.log(f'Failed to parse radius cache: {e}', force_console=True)
        return {}
    except Exception as e:
        futil.log(f'Error reading radius cache: {e}', force_console=True)
        return {}


def _save_cache(cache: Dict[str, Dict[str, str]]) -> None:
    """Save the entire cache file.

    Args:
        cache: Dict mapping document paths to radius values
    """
    try:
        os.makedirs(os.path.dirname(CACHE_FILE), exist_ok=True)

        with open(CACHE_FILE, 'w', encoding='utf-8') as f:
            json.dump(cache, f, indent=2)

        futil.log(f'Saved radius cache to {CACHE_FILE}', force_console=True)
    except Exception as e:
        futil.log(f'Failed to save radius cache: {e}', force_console=True)
        # Non-fatal — cache is a convenience feature


def get_cached_radii(doc_path: str) -> Optional[Dict[str, str]]:
    """Get cached radius values for a specific document.

    Args:
        doc_path: Full file path of the design document

    Returns:
        Dict with 'nutRadius' and 'heelRadius' keys, or None if not cached
    """
    if not doc_path:
        return None

    cache = _load_cache()
    return cache.get(doc_path)


def set_cached_radii(doc_path: str, nut_expr: str, heel_expr: str) -> None:
    """Cache radius values for a specific document.

    Args:
        doc_path: Full file path of the design document
        nut_expr: NutRadius expression to cache
        heel_expr: HeelRadius expression to cache
    """
    if not doc_path:
        futil.log('set_cached_radii: Cannot cache — no document path', force_console=True)
        return

    cache = _load_cache()
    entry = cache.get(doc_path, {})
    if not isinstance(entry, dict):
        entry = {}
    entry['nutRadius'] = nut_expr
    entry['heelRadius'] = heel_expr
    cache[doc_path] = entry
    _save_cache(cache)
    futil.log(
        f'Cached radii for {os.path.basename(doc_path)}: nut="{nut_expr}", heel="{heel_expr}"',
        force_console=True
    )


def get_cached_straight_nut(doc_path: str) -> Optional[str]:
    """Get cached NutRadius expression used for straight mode restoration."""
    if not doc_path:
        return None

    cache = _load_cache()
    entry = cache.get(doc_path)
    if not isinstance(entry, dict):
        return None
    straight_nut = entry.get('straightNutRadius')
    return straight_nut if isinstance(straight_nut, str) and straight_nut else None


def set_cached_straight_nut(doc_path: str, nut_expr: str) -> None:
    """Cache NutRadius expression for straight mode restoration."""
    if not doc_path:
        futil.log('set_cached_straight_nut: Cannot cache — no document path', force_console=True)
        return

    cache = _load_cache()
    entry = cache.get(doc_path, {})
    if not isinstance(entry, dict):
        entry = {}
    entry['straightNutRadius'] = nut_expr
    cache[doc_path] = entry
    _save_cache(cache)
    futil.log(
        f'Cached straight nut radius for {os.path.basename(doc_path)}: nut="{nut_expr}"',
        force_console=True
    )


def get_cached_heel_curve(doc_path: str) -> Optional[str]:
    """Retrieve cached HeelCurveRadius expression for a document.

    Args:
        doc_path: Full file path of the design document

    Returns:
        str: The cached expression, or None if not found.
    """
    if not doc_path:
        return None

    cache = _load_cache()
    entry = cache.get(doc_path)
    if not isinstance(entry, dict):
        return None
    heel_curve = entry.get('heelCurve')
    return heel_curve if isinstance(heel_curve, str) and heel_curve else None


def set_cached_heel_curve(doc_path: str, expression: str) -> None:
    """Store HeelCurveRadius expression for a document.

    Args:
        doc_path: Full file path of the design document
        expression: The parameter expression to cache.
    """
    if not doc_path:
        futil.log('set_cached_heel_curve: Cannot cache — no document path', force_console=True)
        return

    cache = _load_cache()
    entry = cache.get(doc_path, {})
    if not isinstance(entry, dict):
        entry = {}
    entry['heelCurve'] = expression
    cache[doc_path] = entry
    _save_cache(cache)
    futil.log(
        f'Cached heel curve for {os.path.basename(doc_path)}: "{expression}"',
        force_console=True
    )
