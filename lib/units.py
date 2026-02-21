"""
Unit helpers — unit symbol mapping and metric/imperial detection.

Extracted from parameter_bridge.py for cleaner separation of concerns.
"""

import re
import adsk.core

from . import fusionAddInUtils as futil

# ── Unit symbol mapping ──────────────────────────────────────────────
UNIT_SYMBOLS = {
    'length': 'in',
    'angle': 'deg',
    'unitless': '',
}

METRIC_LENGTH_UNITS = {'nm', 'um', 'mm', 'cm', 'm', 'km'}
IMPERIAL_LENGTH_UNITS = {'mil', 'in', 'ft', 'yd', 'mi', 'ftin', 'ftandin'}


def get_unit_symbol(unit_kind, doc_unit='in'):
    """Convert unitKind to a display unit symbol.

    Args:
        unit_kind: The unitKind string from schema (e.g., 'length', 'angle', 'unitless').
        doc_unit: The document unit (e.g., 'in', 'mm'). For 'length' unitKind, this overrides the hardcoded default.

    Returns:
        str: The unit symbol (e.g., 'in', 'mm', 'deg', '').
    """
    if unit_kind == 'length':
        return doc_unit
    return UNIT_SYMBOLS.get(unit_kind, '')


def get_document_unit(design) -> str:
    """Return the app-standard length unit for the document ('in' or 'mm').

    Args:
        design: The active Fusion design.

    Returns:
        str: 'mm' for any metric Fusion length unit, otherwise 'in'.
    """
    try:
        units_mgr = design.fusionUnitsManager
        raw_unit = units_mgr.defaultLengthUnits
        return 'mm' if is_metric_length_unit(raw_unit) else 'in'
    except Exception as e:
        futil.log(f'get_document_unit: FAILED ({e}), falling back to "in"')
        return 'in'


def is_metric_length_unit(doc_unit: str) -> bool:
    """Return True if a Fusion length unit should be treated as metric."""
    unit = (doc_unit or '').strip().lower()
    if not unit:
        return False

    # Normalize variants like "ft and in" / "ft-in" / "millimeter".
    normalized = re.sub(r'[^a-z]', '', unit)

    if normalized in METRIC_LENGTH_UNITS:
        return True
    if normalized in IMPERIAL_LENGTH_UNITS:
        return False

    # Heuristics for long-form names.
    if any(token in normalized for token in ('meter', 'metre', 'millimeter', 'centimeter', 'kilometer', 'micrometer', 'nanometer')):
        return True
    if any(token in normalized for token in ('inch', 'foot', 'feet', 'yard', 'mile', 'thou')):
        return False

    futil.log(
        f'is_metric_length_unit: Unknown doc unit "{doc_unit}", defaulting to imperial handling',
        adsk.core.LogLevels.WarningLogLevel
    )
    return False
