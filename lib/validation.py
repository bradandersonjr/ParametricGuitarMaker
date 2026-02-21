"""
Parameter validation — min/max range checking against schema limits.

Extracted from parameter_bridge.py for cleaner separation of concerns.
"""

import re
import adsk.core

from . import fusionAddInUtils as futil
from .schema import load_schema
from .units import is_metric_length_unit


def get_param_limits():
    """Return a dict of {param_name: {min, max, minMetric, maxMetric, unitKind}} from the schema.

    Used for validating parameter values against configured limits.

    Returns:
        dict: { param_name: {'min': num or None, 'max': num or None, 'minMetric': num or None,
                             'maxMetric': num or None, 'unitKind': str} }
    """
    schema = load_schema()
    if schema is None:
        return {}

    limits = {}
    for group_def in schema.get('groups', []):
        for param_def in group_def.get('parameters', []):
            name = param_def['name']
            limits[name] = {
                'min': param_def.get('min'),
                'max': param_def.get('max'),
                'minMetric': param_def.get('minMetric'),
                'maxMetric': param_def.get('maxMetric'),
                'unitKind': param_def.get('unitKind', 'unitless'),
            }
    return limits


def extract_numeric_value(expression_str):
    """Extract the numeric value from a parameter expression.

    Examples:
        "25.5 in" -> 25.5
        "24" -> 24
        "( 3 / 16 ) * 1 in" -> None (can't extract single number)

    Returns:
        float or None
    """
    match = re.search(r'^([\d.-]+)', expression_str.strip())
    if match:
        try:
            return float(match.group(1))
        except ValueError:
            return None
    return None


def validate_parameter_value(name: str, expression_str: str, limits: dict, doc_unit: str = 'in'):
    """Validate a parameter expression against configured min/max limits.

    Args:
        name: Parameter name
        expression_str: The expression string (e.g., "25.5 in")
        limits: Dict of {param_name: {'min': num, 'max': num, 'minMetric': num, 'maxMetric': num, 'unitKind': str}}
        doc_unit: The document unit ('in', 'mm', etc.). Uses minMetric/maxMetric for 'mm' documents.

    Returns:
        str: Error message, or None if valid
    """
    if name not in limits:
        return None  # No limits configured

    limit = limits[name]
    unit_kind = limit.get('unitKind', 'unitless')

    # Use metric limits for metric documents, imperial limits for others
    if is_metric_length_unit(doc_unit) and unit_kind == 'length':
        min_val = limit.get('minMetric')
        max_val = limit.get('maxMetric')
        min_imperial = limit.get('min')
        max_imperial = limit.get('max')
    else:
        min_val = limit.get('min')
        max_val = limit.get('max')
        min_imperial = None
        max_imperial = None

    if min_val is None and max_val is None:
        return None  # No limits

    numeric_val = extract_numeric_value(expression_str)
    if numeric_val is None:
        return None  # Can't validate; let Fusion handle it

    if min_val is not None and numeric_val < min_val:
        if min_imperial is not None:
            return f'{name}: value {numeric_val} is below minimum {min_val} mm ({min_imperial} in)'
        else:
            return f'{name}: value {numeric_val} is below minimum {min_val}'
    if max_val is not None and numeric_val > max_val:
        if max_imperial is not None:
            return f'{name}: value {numeric_val} exceeds maximum {max_val} mm ({max_imperial} in)'
        else:
            return f'{name}: value {numeric_val} exceeds maximum {max_val}'

    return None


def extract_unit_from_expression(expression: str) -> str:
    """Extract the unit suffix from an expression string.

    Examples:
        "12.5 in" -> "in"
        "45 deg"  -> "deg"
        "6"       -> ""
    """
    match = re.search(r'\b(in|mm|cm|deg)\s*$', expression.strip())
    return match.group(1) if match else ''
