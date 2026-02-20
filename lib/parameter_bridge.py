"""
Parameter Bridge — reads, validates, and applies user parameters.

This module provides the interface between the Fusion design parameters
and the UI. It uses the parameter schema (parameters.schema.json) to:
  - Read current parameter values from the design
  - Build a UI-ready payload with groups, controls, and constraints
  - Apply parameter changes in batch
"""

import json
import os
import re
import adsk.core
import adsk.fusion

from . import fusionAddInUtils as futil
from .. import config
from . import timeline_manager
from . import radius_cache

app = adsk.core.Application.get()

# ── Schema path & cache ──────────────────────────────────────────────
SCHEMA_PATH = os.path.join(config.ADDIN_ROOT, 'schema', 'parameters.schema.json')
_schema_cache = None
_editable_names_cache = None

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


def get_document_unit(design: adsk.fusion.Design) -> str:
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


def load_schema():
    """Load and return the parameter schema dict (cached after first load).

    Returns:
        dict: The parsed schema, or None if the file is missing/invalid.
    """
    global _schema_cache
    if _schema_cache is not None:
        return _schema_cache

    if not os.path.isfile(SCHEMA_PATH):
        futil.log(f'Parameter Bridge: Schema file not found: {SCHEMA_PATH}',
                  adsk.core.LogLevels.ErrorLogLevel)
        return None
    try:
        with open(SCHEMA_PATH, 'r', encoding='utf-8') as f:
            _schema_cache = json.load(f)
        return _schema_cache
    except Exception as e:
        futil.log(f'Parameter Bridge: Failed to load schema: {e}',
                  adsk.core.LogLevels.ErrorLogLevel)
        return None


def _get_editable_names():
    """Return the cached set of editable parameter names from the schema."""
    global _editable_names_cache
    if _editable_names_cache is not None:
        return _editable_names_cache

    schema = load_schema()
    if schema is None:
        return set()

    names = set()
    for group_def in schema.get('groups', []):
        for param_def in group_def.get('parameters', []):
            if param_def.get('editable', True):
                names.add(param_def['name'])
    _editable_names_cache = names
    return _editable_names_cache


# ═══════════════════════════════════════════════════════════════════
# Fingerprint detection
# ═══════════════════════════════════════════════════════════════════

FINGERPRINT_PARAM = 'FretboardFingerPrint'
FINGERPRINT_VALUE = 'FretboardMaker'


def get_fingerprint(design: adsk.fusion.Design):
    """Check if design has the FretboardFingerPrint parameter.

    Returns:
        str: The fingerprint expression if found, None otherwise.
    """
    p = design.userParameters.itemByName(FINGERPRINT_PARAM)
    if p is not None:
        return p.expression
    return None


def set_fingerprint(design: adsk.fusion.Design):
    """Add the FretboardFingerPrint user parameter to the design if not already present.

    A quoted string value causes Fusion to display the unit as "Text" in the
    Parameter Sheet automatically.
    """
    if design.userParameters.itemByName(FINGERPRINT_PARAM) is not None:
        return  # Already exists

    try:
        value_input = adsk.core.ValueInput.createByString(f"'{FINGERPRINT_VALUE}'")
        design.userParameters.add(FINGERPRINT_PARAM, value_input, '',
                                  'Used by Parametric Guitar: Fretboard Maker to identify this file. Do not delete or modify.')
        futil.log(f'Parameter Bridge: Added {FINGERPRINT_PARAM} = {FINGERPRINT_VALUE}')
    except Exception as e:
        futil.log(f'Parameter Bridge: Failed to add FretboardFingerPrint: {e}',
                  adsk.core.LogLevels.WarningLogLevel)


# ═══════════════════════════════════════════════════════════════════
# Read user parameters from the active design
# ═══════════════════════════════════════════════════════════════════

# ═══════════════════════════════════════════════════════════════════
# Parameter group tag helpers
# ═══════════════════════════════════════════════════════════════════

_GROUP_TAG_RE = None

def _group_tag_re():
    global _GROUP_TAG_RE
    if _GROUP_TAG_RE is None:
        _GROUP_TAG_RE = re.compile(r'\s*\[pgfm-group:([^\]]+)\]')
    return _GROUP_TAG_RE


def _parse_group_tag(comment: str):
    """Extract the pgfm-group value from a parameter comment string.

    Returns the group id string (e.g. 'fretboard') or None if not present.
    """
    match = _group_tag_re().search(comment or '')
    return match.group(1) if match else None


def _set_group_tag(comment: str, group_id: str) -> str:
    """Set or replace the pgfm-group tag in a comment string.

    If group_id is None or empty, removes the tag entirely.
    """
    # Remove any existing tag first
    clean = _group_tag_re().sub('', comment or '').rstrip()
    if group_id:
        return f'{clean} [pgfm-group:{group_id}]'.lstrip()
    return clean


def set_param_group(design: adsk.fusion.Design, param_name: str, group_id: str) -> dict:
    """Update a user parameter's comment to encode its group assignment.

    Args:
        design: The active Fusion design.
        param_name: Name of the user parameter to update.
        group_id: Schema group id (e.g. 'fretboard') or '' to remove assignment.

    Returns:
        dict: { "ok": bool, "error": str or None }
    """
    param = design.userParameters.itemByName(param_name)
    if param is None:
        return {'ok': False, 'error': f"Parameter '{param_name}' not found"}
    try:
        param.comment = _set_group_tag(param.comment, group_id)
        futil.log(f'Parameter Bridge: Set group for {param_name} -> {group_id!r}')
        return {'ok': True, 'error': None}
    except Exception as e:
        err = f'Failed to set group for {param_name}: {e}'
        futil.log(err, adsk.core.LogLevels.ErrorLogLevel)
        return {'ok': False, 'error': err}


def edit_param(design: adsk.fusion.Design, old_name: str, new_name: str, description: str, group_id: str) -> dict:
    """Rename a user parameter, update its description, and set its group assignment.

    Args:
        design: The active Fusion design.
        old_name: Current parameter name.
        new_name: Desired new name (may be same as old_name if not renaming).
        description: New description/comment text (without the group tag).
        group_id: Schema group id or '' to remove assignment.

    Returns:
        dict: { "ok": bool, "error": str or None }
    """
    param = design.userParameters.itemByName(old_name)
    if param is None:
        futil.log(f'Parameter Bridge: Parameter {old_name!r} not found in design')
        return {'ok': False, 'error': f"Parameter '{old_name}' not found"}

    # Check for name conflict only if actually renaming
    if new_name != old_name:
        if design.userParameters.itemByName(new_name) is not None:
            futil.log(f'Parameter Bridge: Name conflict - {new_name!r} already exists')
            return {'ok': False, 'error': f"A parameter named '{new_name}' already exists"}

    try:
        # Build comment: user description + pgfm group tag
        new_comment = _set_group_tag(description, group_id)
        param.comment = new_comment

        # Rename last to avoid potential conflicts during comment write
        if new_name != old_name:
            param.name = new_name

        futil.log(f'Parameter Bridge: Edited param {old_name!r} -> name={new_name!r} group={group_id!r} desc={description!r}')
        return {'ok': True, 'error': None}
    except Exception as e:
        err = f'Failed to edit param {old_name}: {e}'
        futil.log(err, adsk.core.LogLevels.ErrorLogLevel)
        return {'ok': False, 'error': err}


def delete_param(design: adsk.fusion.Design, param_name: str) -> dict:
    """Delete a user parameter from the design.

    Args:
        design: The active Fusion design.
        param_name: Name of the user parameter to delete.

    Returns:
        dict: { "ok": bool, "error": str or None }
    """
    param = design.userParameters.itemByName(param_name)
    if param is None:
        return {'ok': False, 'error': f"Parameter '{param_name}' not found"}
    try:
        param.deleteMe()
        futil.log(f'Parameter Bridge: Deleted user parameter {param_name!r}')
        return {'ok': True, 'error': None}
    except Exception as e:
        err = f'Failed to delete param {param_name}: {e}'
        futil.log(err, adsk.core.LogLevels.ErrorLogLevel)
        return {'ok': False, 'error': err}


def get_user_parameters(design: adsk.fusion.Design):
    """Read all user parameters from the active design.

    Args:
        design: The active Fusion design.

    Returns:
        dict: Keyed by parameter name, each value is a dict with:
              { name, expression, value, unit, comment }
    """
    result = {}
    user_params = design.userParameters

    for i in range(user_params.count):
        p = user_params.item(i)
        result[p.name] = {
            'name': p.name,
            'expression': p.expression,
            'value': p.value,           # internal value (always cm)
            'unit': p.unit,
            'comment': p.comment or '',
        }

    futil.log(f'Parameter Bridge: Read {len(result)} user parameter(s) from design')
    return result


# ═══════════════════════════════════════════════════════════════════
# Build UI-ready payloads
# ═══════════════════════════════════════════════════════════════════

def build_schema_payload(design: adsk.fusion.Design = None):
    """Build a UI payload from schema defaults only (no design needed).

    Used for the initial "configure before import" flow so the user
    can tweak parameters before any template is imported.

    Only includes EDITABLE parameters (non-formula-based) to prevent
    accidental overwriting of calculated expressions.

    If design is provided, reads actual parameter values from Fusion
    and uses those instead of schema defaults, so the baseline reflects
    what's currently in the file (important for metric documents that
    already have parameters set).

    Returns a payload identical in shape to build_ui_payload(), with
    an added ``mode`` field set to ``"initial"``.
    """
    schema = load_schema()
    if schema is None:
        return None

    # Read existing parameters from design if available
    live_params = get_user_parameters(design) if design else {}

    groups = []
    for group_def in schema.get('groups', []):
        group = {
            'id': group_def['id'],
            'label': group_def['label'],
            'order': group_def.get('order', 0),
            'parameters': [],
        }
        for param_def in group_def.get('parameters', []):
            # Skip non-editable (formula-based) parameters
            if not param_def.get('editable', True):
                continue

            param_name = param_def['name']
            # Prefer actual Fusion expression if it exists, fall back to schema default
            if param_name in live_params:
                default_expr = live_params[param_name]['expression']
            else:
                default_expr = param_def.get('default', '')

            # Try to convert default to numeric value for display
            try:
                numeric_value = float(default_expr) if default_expr else None
            except (ValueError, TypeError):
                numeric_value = None

            group['parameters'].append({
                'name': param_def['name'],
                'label': param_def.get('label', param_def['name']),
                'unitKind': param_def.get('unitKind', 'length'),
                'controlType': param_def.get('controlType', 'number'),
                'default': default_expr,
                'defaultMetric': param_def.get('defaultMetric'),
                'min': param_def.get('min'),
                'max': param_def.get('max'),
                'minMetric': param_def.get('minMetric'),
                'maxMetric': param_def.get('maxMetric'),
                'step': param_def.get('step'),
                'stepMetric': param_def.get('stepMetric'),
                'description': param_def.get('description', ''),
                'expression': default_expr,
                'value': numeric_value,
                'unit': '',
            })
        groups.append(group)

    groups.sort(key=lambda g: g['order'])

    doc_unit = get_document_unit(design) if design is not None else 'in'

    # Set the unit for each parameter using the document unit
    for group in groups:
        for param in group['parameters']:
            param['unit'] = get_unit_symbol(param['unitKind'], doc_unit)

            # If document is metric and parameter is a length, use hand-authored
            # metric default from the schema instead of runtime conversion
            if is_metric_length_unit(doc_unit) and param['unitKind'] == 'length' and param.get('defaultMetric'):
                metric_default = param['defaultMetric']
                try:
                    param['value'] = float(metric_default)
                except (ValueError, TypeError):
                    pass
                # Only override expression if we're using the schema default, not a live value
                if param['name'] not in live_params:
                    # Store just the numeric part in expression (frontend reconstructs with unit when needed)
                    param['expression'] = metric_default
                    param['default'] = metric_default

    payload = {
        'schemaVersion': schema.get('schemaVersion', 'unknown'),
        'templateVersion': schema.get('templateVersion', 'unknown'),
        'groups': groups,
        'missing': [],
        'extra': [],
        'extraParams': [],
        'mode': 'initial',
        'documentUnit': doc_unit,
        'fingerprint': None,
        'hasFingerprint': False,
    }

    futil.log(
        f'Parameter Bridge: Built schema-only payload — '
        f'{sum(len(g["parameters"]) for g in groups)} editable params'
    )
    return payload


def build_ui_payload(design: adsk.fusion.Design):
    """Merge the parameter schema with live design values.

    Only includes EDITABLE parameters (non-formula-based) to prevent
    accidental overwriting of calculated expressions.

    Returns a dict suitable for sending to the UI:
    {
        "schemaVersion": "...",
        "templateVersion": "...",
        "groups": [
            {
                "id": "...",
                "label": "...",
                "parameters": [
                    {
                        "name": "...",
                        "label": "...",
                        "unitKind": "...",
                        "controlType": "...",
                        "default": "...",
                        "min": ...,
                        "max": ...,
                        "step": ...,
                        "description": "...",
                        "expression": "...",    ← live from design
                        "value": ...,           ← live from design
                        "unit": "...",          ← live from design
                    },
                    ...
                ]
            },
            ...
        ],
        "missing": [...],    ← schema params not found in design
        "extra": [...]       ← design params not in schema
    }
    """
    schema = load_schema()
    if schema is None:
        return None

    live_params = get_user_parameters(design)

    # Track which schema param names we've matched
    schema_param_names = set()

    groups = []
    missing = []

    for group_def in schema.get('groups', []):
        group = {
            'id': group_def['id'],
            'label': group_def['label'],
            'order': group_def.get('order', 0),
            'parameters': [],
        }

        for param_def in group_def.get('parameters', []):
            name = param_def['name']
            schema_param_names.add(name)

            # Skip non-editable (formula-based) parameters
            if not param_def.get('editable', True):
                continue

            # Only show parameters that exist in the live design
            if name not in live_params:
                missing.append(name)
                continue

            live = live_params[name]

            # For description: prefer the live parameter's comment (if edited), fall back to schema
            # Strip the group tag from the comment if present
            live_description = _group_tag_re().sub('', live['comment']).strip()
            description = live_description if live_description else param_def.get('description', '')

            param_entry = {
                'name': name,
                'label': param_def.get('label', name),
                'unitKind': param_def.get('unitKind', 'length'),
                'controlType': param_def.get('controlType', 'number'),
                'default': param_def.get('default', ''),
                'defaultMetric': param_def.get('defaultMetric'),
                'min': param_def.get('min'),
                'max': param_def.get('max'),
                'minMetric': param_def.get('minMetric'),
                'maxMetric': param_def.get('maxMetric'),
                'step': param_def.get('step'),
                'stepMetric': param_def.get('stepMetric'),
                'description': description,
                'expression': live['expression'],
                'value': live['value'],
                'unit': live['unit'],
            }

            group['parameters'].append(param_entry)

        groups.append(group)

    # Sort groups by order
    groups.sort(key=lambda g: g['order'])

    # Set unit symbols and convert metric expressions
    doc_unit = get_document_unit(design) if design is not None else 'in'
    for group in groups:
        for param in group['parameters']:
            param['unit'] = get_unit_symbol(param['unitKind'], doc_unit)

            # If document is metric and parameter is a length, convert expression from inches to mm
            if is_metric_length_unit(doc_unit) and param['unitKind'] == 'length':
                expr = param['expression']
                match = re.match(r'^([\d.]+)\s*in\s*$', expr)
                if match:
                    imperial_val = float(match.group(1))
                    metric_val = imperial_val * 25.4
                    param['expression'] = f"{metric_val} {param['unit']}"
                    param['value'] = metric_val

    # Find extra params: in design but not in schema (exclude fingerprint parameter)
    extra_names = [name for name in live_params if name not in schema_param_names and name != FINGERPRINT_PARAM]

    # Build full parameter objects for extra params
    # Parse group tag from comment so UI can route the param to the right section
    extra_params = []
    for name in extra_names:
        live = live_params[name]
        raw_comment = live['comment']
        group_id = _parse_group_tag(raw_comment)
        # Strip the tag from the visible description
        clean_description = _group_tag_re().sub('', raw_comment).strip()
        entry = {
            'name': name,
            'label': name,
            'unitKind': 'unitless',
            'controlType': 'number',
            'default': '',
            'description': clean_description,
            'expression': live['expression'],
            'value': live['value'],
            'unit': live['unit'],
        }
        if group_id:
            entry['group'] = group_id
        extra_params.append(entry)

    # Check for fingerprint
    fingerprint = get_fingerprint(design)
    has_fingerprint = fingerprint is not None and fingerprint != ''

    payload = {
        'schemaVersion': schema.get('schemaVersion', 'unknown'),
        'templateVersion': schema.get('templateVersion', 'unknown'),
        'groups': groups,
        'missing': missing,
        'extra': extra_names,
        'extraParams': extra_params,
        'mode': 'live',
        'fingerprint': fingerprint,
        'hasFingerprint': has_fingerprint,
        'documentUnit': doc_unit,
    }

    futil.log(
        f'Parameter Bridge: Built UI payload — '
        f'{sum(len(g["parameters"]) for g in groups)} editable params, '
        f'{len(missing)} missing, {len(extra_names)} extra, '
        f'fingerprint: {fingerprint if has_fingerprint else "none"}'
    )
    return payload


# ═══════════════════════════════════════════════════════════════════
# Export current parameter values
# ═══════════════════════════════════════════════════════════════════

def get_current_editable_values(design: adsk.fusion.Design):
    """Return a dict of {name: expression} for all editable params in the design.

    Used when saving the current design state as a user template.
    Only returns parameters that are both in the schema (editable) and present
    in the live design.

    Returns:
        dict: { param_name: expression_string }
    """
    editable_names = _get_editable_names()
    live_params = get_user_parameters(design)

    result = {}
    for name in editable_names:
        if name in live_params:
            result[name] = live_params[name]['expression']

    futil.log(f'Parameter Bridge: Exported {len(result)} editable parameter value(s)')
    return result


def _get_param_limits():
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


def _extract_numeric_value(expression_str):
    """Extract the numeric value from a parameter expression.

    Examples:
        "25.5 in" → 25.5
        "24" → 24
        "( 3 / 16 ) * 1 in" → None (can't extract single number)

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


def _validate_parameter_value(name: str, expression_str: str, limits: dict, doc_unit: str = 'in'):
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

    numeric_val = _extract_numeric_value(expression_str)
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


# ═══════════════════════════════════════════════════════════════════
# Create new user parameters
# ═══════════════════════════════════════════════════════════════════

def _extract_unit_from_expression(expression: str) -> str:
    """Extract the unit suffix from an expression string.

    Examples:
        "12.5 in" -> "in"
        "45 deg"  -> "deg"
        "6"       -> ""
    """
    match = re.search(r'\b(in|mm|cm|deg)\s*$', expression.strip())
    return match.group(1) if match else ''


def create_user_parameter(design: adsk.fusion.Design, name: str, expression: str,
                          description: str = '', group_id: str = '') -> dict:
    """Create a new user parameter in the Fusion design.

    Args:
        design: The active Fusion design.
        name: Parameter name (must be a valid Fusion identifier).
        expression: Expression string (e.g. "12.5 in" or "6").
        description: Optional human-readable comment string.
        group_id: Optional schema group id to embed as a group tag in the comment.

    Returns:
        dict: { "created": bool, "error": str or None }
    """
    user_params = design.userParameters

    # Check for duplicate
    if user_params.itemByName(name) is not None:
        return {'created': False, 'error': f"Parameter '{name}' already exists"}

    try:
        value_input = adsk.core.ValueInput.createByString(expression)
        unit = _extract_unit_from_expression(expression)
        # Embed the group tag in the comment so the UI can route the param on reload
        comment = _set_group_tag(description, group_id) if group_id else description
        user_params.add(name, value_input, unit, comment)
        futil.log(f'Parameter Bridge: Created user parameter {name} = {expression} (group={group_id!r})')
        return {'created': True, 'error': None}
    except Exception as e:
        err = f'Failed to create parameter {name}: {e}'
        futil.log(err, adsk.core.LogLevels.ErrorLogLevel)
        return {'created': False, 'error': err}


# ═══════════════════════════════════════════════════════════════════
# Apply parameters in batch
# ═══════════════════════════════════════════════════════════════════

def apply_parameters(design: adsk.fusion.Design, param_values: dict, creates: list = None):
    """Apply a dict of parameter expressions to the design, and optionally create new ones.

    Args:
        design: The active Fusion design.
        param_values: Dict of { param_name: new_expression_string }.
                      Only editable schema-defined parameters are applied.
                      Formula-based parameters are protected and ignored.
        creates: Optional list of dicts with { name, expression, description }
                 representing new user parameters to create in Fusion.

    Returns:
        dict: { "updated": int, "created": int, "errors": [str] }
    """
    # Get the cached set of editable parameter names
    # Formula-based parameters are excluded to prevent overwriting expressions
    allowed_names = _get_editable_names()
    if not allowed_names:
        return {'updated': 0, 'created': 0, 'errors': ['Schema could not be loaded.']}

    if not param_values and not creates:
        return {'updated': 0, 'created': 0, 'errors': []}

    # Load parameter limits for validation
    limits = _get_param_limits()
    doc_unit = get_document_unit(design)

    user_params = design.userParameters
    updated = 0
    errors = []
    protected = 0
    out_of_range = 0

    # Iterate only the incoming changes, not all design params
    for name, new_expr in param_values.items():
        new_expr = new_expr.strip()
        if not new_expr:
            continue

        # Check if this is a formula-based parameter (protected)
        if name not in allowed_names:
            protected += 1
            futil.log(
                f'Parameter Bridge: Ignoring protected formula-based parameter: {name}',
                adsk.core.LogLevels.WarningLogLevel
            )
            continue

        # Skip validation for flat-radius sentinel values (these intentionally exceed normal limits)
        is_flat_sentinel = new_expr in ('10000 in', '254000 mm')

        # Validate against schema limits
        validation_error = None if is_flat_sentinel else _validate_parameter_value(name, new_expr, limits, doc_unit)
        if validation_error:
            out_of_range += 1
            errors.append(validation_error)
            futil.log(f'Parameter Bridge: Validation failed: {validation_error}',
                      adsk.core.LogLevels.WarningLogLevel)
            continue

        param = user_params.itemByName(name)
        if param is None:
            errors.append(f'Parameter not found in design: {name}')
            continue

        if new_expr == param.expression:
            continue  # No change needed

        try:
            param.expression = new_expr
            updated += 1
            futil.log(f'Parameter Bridge: Set {name} = {new_expr}')
        except Exception as e:
            err_msg = f'Failed to set {name} = "{new_expr}": {e}'
            errors.append(err_msg)
            futil.log(f'Parameter Bridge: {err_msg}',
                      adsk.core.LogLevels.ErrorLogLevel)

    # Handle creates — new user parameters to add to the design
    created = 0
    if creates:
        for item in creates:
            result = create_user_parameter(
                design,
                item.get('name', ''),
                item.get('expression', ''),
                item.get('description', ''),
                item.get('groupId', '')
            )
            if result['created']:
                created += 1
            elif result['error']:
                errors.append(result['error'])

    futil.log(
        f'Parameter Bridge: Applied {updated} parameter(s), created {created}, '
        f'{protected} protected, {out_of_range} out-of-range, {len(errors)} error(s)'
    )
    return {'updated': updated, 'created': created, 'errors': errors}


# ═══════════════════════════════════════════════════════════════════
# Timeline Management (delegates to timeline_manager)
# ═══════════════════════════════════════════════════════════════════

# Timeline groups surfaced in the Options Drawer.
# Matched by prefix so "Fret Markers" matches "Fret Markers:1" etc.
_FEATURES_DRAWER_GROUPS = ["Fret Markers", "Nut Slot", "Fret Slot Cuts", "Zero Fret Slot Cut"]

# Individual timeline features surfaced in the Options Drawer.
_FEATURES_DRAWER_FEATURES = ["Heel Curve Fillet"]


def _matches_drawer_group(name: str) -> bool:
    """Return True if the item name (stripped) matches any allowed group prefix."""
    stripped = name.strip()
    for group in _FEATURES_DRAWER_GROUPS:
        if stripped == group or stripped.startswith(group + ':'):
            return True
    return False


def _matches_drawer_feature(name: str) -> bool:
    """Return True if the item name (stripped) matches any allowed feature prefix."""
    stripped = name.strip()
    for feat in _FEATURES_DRAWER_FEATURES:
        if stripped == feat or stripped.startswith(feat + ':'):
            return True
    return False


def get_group_states(design: adsk.fusion.Design) -> list:
    """Get the suppression state of each curated Options-panel item.

    Returns a list of ``{name, suppressed}`` dicts — one per matching
    timeline group or feature.
    """
    items = timeline_manager.get_all_items(design, include_suppressed=True)
    return [
        {'name': item['name'].strip(), 'suppressed': item['suppressed']}
        for item in items
        if (item['type'] == 'Group' and _matches_drawer_group(item['name']))
        or (item['type'] == 'Feature' and _matches_drawer_feature(item['name']))
    ]


def suppress_timeline_item(design: adsk.fusion.Design, name: str) -> dict:
    """Suppress a timeline item by name.

    Returns:
        dict: { 'success': bool, 'message': str }
    """
    success = timeline_manager.suppress_item(design, name)
    return {
        'success': success,
        'message': f'Suppressed "{name}"' if success else f'Failed to suppress "{name}"',
    }


def unsuppress_timeline_item(design: adsk.fusion.Design, name: str) -> dict:
    """Unsuppress a timeline item by name.

    Returns:
        dict: { 'success': bool, 'message': str }
    """
    success = timeline_manager.unsuppress_item(design, name)
    return {
        'success': success,
        'message': f'Unsuppressed "{name}"' if success else f'Failed to unsuppress "{name}"',
    }


def toggle_timeline_item(design: adsk.fusion.Design, name: str) -> dict:
    """Toggle a timeline item's suppress state.

    Returns:
        dict: { 'success': bool, 'newState': bool, 'message': str }
    """
    new_state = timeline_manager.toggle_item(design, name)
    if new_state is None:
        return {
            'success': False,
            'newState': None,
            'message': f'Failed to toggle "{name}"',
        }
    return {
        'success': True,
        'newState': new_state,
        'message': f'Toggled "{name}" (now {"suppressed" if new_state else "active"})',
    }


def suppress_group_with_contents(design: adsk.fusion.Design, group_name: str) -> dict:
    """Suppress a group and all its contents.

    Returns:
        dict: { 'success': bool, 'itemsAffected': int, 'message': str }
    """
    success = timeline_manager.suppress_group_with_contents(design, group_name)
    if not success:
        return {
            'success': False,
            'itemsAffected': 0,
            'message': f'Failed to suppress group "{group_name}"',
        }

    items = timeline_manager.get_group_items(design, group_name)
    return {
        'success': True,
        'itemsAffected': len(items) + 1,  # +1 for the group itself
        'message': f'Suppressed group "{group_name}" and {len(items)} item(s)',
    }


def unsuppress_group_with_contents(design: adsk.fusion.Design, group_name: str) -> dict:
    """Unsuppress a group and all its contents.

    Returns:
        dict: { 'success': bool, 'itemsAffected': int, 'message': str }
    """
    success = timeline_manager.unsuppress_group_with_contents(design, group_name)
    if not success:
        return {
            'success': False,
            'itemsAffected': 0,
            'message': f'Failed to unsuppress group "{group_name}"',
        }

    items = timeline_manager.get_group_items(design, group_name)
    return {
        'success': True,
        'itemsAffected': len(items) + 1,  # +1 for the group itself
        'message': f'Unsuppressed group "{group_name}" and {len(items)} item(s)',
    }


def _remap_fail(message: str) -> dict:
    """Return a standardized remap failure result."""
    futil.log(f'remap_hole: FAIL — {message}', force_console=True)
    return {'success': False, 'message': message}


def _collect_unique_tokens(sel_set) -> list:
    """Collect de-duplicated entity tokens from a selection set.

    Tokens survive timeline rolls; object references do not.
    """
    entities = sel_set.entities
    try:
        count = entities.count
    except AttributeError:
        count = len(entities)

    raw = []
    try:
        for i in range(count):
            raw.append(entities.item(i).entityToken)
    except AttributeError:
        for ent in entities:
            raw.append(ent.entityToken)

    seen = set()
    unique = []
    for t in raw:
        if t not in seen:
            seen.add(t)
            unique.append(t)
    if len(unique) != len(raw):
        futil.log(f'remap_hole: de-duplicated tokens {len(raw)} -> {len(unique)}', force_console=True)
    return unique


def _resolve_sketch_points(design, selection_set_name: str, tokens: list):
    """Resolve sketch points after a timeline roll.

    Primary: re-fetch the live selection set (entities may still be valid).
    Fallback: resolve each pre-collected token via design.findEntityByToken().

    Returns (ObjectCollection of SketchPoints, list of skipped objectType strings).
    """
    pts = adsk.core.ObjectCollection.create()
    skipped = []
    seen_tokens = set()

    # Primary: live re-fetch from the selection set
    try:
        live_set = design.selectionSets.itemByName(selection_set_name)
        if live_set:
            live_entities = live_set.entities
            try:
                live_iter = [live_entities.item(i) for i in range(live_entities.count)]
            except AttributeError:
                live_iter = list(live_entities)
            for ent in live_iter:
                point = adsk.fusion.SketchPoint.cast(ent)
                if point and point.isValid:
                    tok = getattr(point, 'entityToken', '')
                    if tok and tok in seen_tokens:
                        continue
                    if tok:
                        seen_tokens.add(tok)
                    pts.add(point)
    except Exception as e:
        futil.log(f'remap_hole: live re-fetch failed: {e}', force_console=True)

    # Fallback: token-based resolution (only if live path yielded nothing)
    if pts.count == 0:
        for token in tokens:
            resolved = design.findEntityByToken(token)
            if resolved and len(resolved) > 0:
                point = adsk.fusion.SketchPoint.cast(resolved[0])
                if point and point.isValid:
                    pts.add(point)
                else:
                    try:
                        skipped.append(resolved[0].objectType)
                    except Exception:
                        skipped.append('Unknown')

    return pts, skipped


def remap_hole_to_selection_set(
    design: adsk.fusion.Design,
    hole_name: str,
    selection_set_name: str,
) -> dict:
    """Remap a HoleFeature to use sketch points from a different Selection Set.

    Rolls the timeline before the hole, calls setPositionBySketchPoints()
    with the resolved points, then restores the timeline to the end.

    Returns:
        dict: { 'success': bool, 'message': str }
    """
    timeline = design.timeline
    timeline_rolled = False

    try:
        # ── 1. Find the hole feature ─────────────────────────────
        item = timeline_manager.find_item_by_name(design, hole_name, exact=True)
        if not item:
            return _remap_fail(f'Hole feature "{hole_name}" not found in timeline')

        timeline_obj = item.get('object')
        if not timeline_obj:
            return _remap_fail(f'Hole feature "{hole_name}" has no timeline object')

        entity = timeline_obj.entity
        hole_feature = adsk.fusion.HoleFeature.cast(entity) if entity else None
        if not hole_feature or not hole_feature.isValid:
            return _remap_fail(f'"{hole_name}" is not a valid HoleFeature')

        futil.log(f'remap_hole: found "{hole_name}"', force_console=True)

        # ── 2. Collect entity tokens from selection set ──────────
        sel_set = design.selectionSets.itemByName(selection_set_name)
        if not sel_set:
            return _remap_fail(f'Selection set "{selection_set_name}" not found')

        tokens = _collect_unique_tokens(sel_set)
        if not tokens:
            return _remap_fail(f'Selection set "{selection_set_name}" is empty')

        futil.log(f'remap_hole: {len(tokens)} tokens from "{selection_set_name}"', force_console=True)

        # ── 3. Expand parent group if collapsed ─────────────────
        #    rollTo() on a child inside a collapsed group fails silently.
        #    Expand the group first, then restore after the operation.
        parent_group = None
        was_collapsed = False
        try:
            pg = timeline_obj.parentGroup
            if pg:
                parent_group = adsk.fusion.TimelineGroup.cast(pg)
                if parent_group and parent_group.isCollapsed:
                    was_collapsed = True
                    parent_group.isCollapsed = False
                    futil.log('remap_hole: expanded parent group', force_console=True)
        except Exception:
            pass  # No parent group or can't access — proceed anyway

        # ── 4. Roll timeline before the hole (exclusive) ─────────
        #    rollTo(True) = exclusive (before feature). Required by Fusion API
        #    for setPositionBySketchPoints — "Didn't roll editing feature back"
        #    error occurs with rollTo(False).
        #    We keep the pre-roll hole_feature reference for the actual call.
        timeline_obj.rollTo(True)
        timeline_rolled = True

        # ── 4. Resolve tokens to SketchPoints after roll ─────────
        pts, skipped = _resolve_sketch_points(design, selection_set_name, tokens)

        if pts.count == 0:
            return _remap_fail('No sketch points could be resolved after timeline roll')
        if skipped:
            return _remap_fail(
                'Selection set contains non-SketchPoint entities: '
                + ', '.join(sorted(set(skipped)))
            )

        futil.log(f'remap_hole: resolved {pts.count} sketch points', force_console=True)

        # ── 5. Surgical remap ────────────────────────────────────
        #    Use the pre-roll hole_feature reference (not timeline_obj.entity,
        #    which becomes invalid after exclusive rollback).
        #    NOTE: Hole must use Distance extent (not All). Extent=All causes
        #    dcDepth errors because Fusion always forces downward cut direction,
        #    but this hole cuts upward.
        hole_feature.setPositionBySketchPoints(pts)

        futil.log(
            f'remap_hole: remapped to {pts.count} point(s) from "{selection_set_name}"',
            force_console=True,
        )
        return {
            'success': True,
            'message': f'Remapped "{hole_name}" to {pts.count} point(s) from "{selection_set_name}"',
        }

    except Exception as e:
        futil.log(f'remap_hole: error: {e}', force_console=True)
        return _remap_fail(str(e))

    finally:
        if timeline_rolled:
            try:
                timeline.moveToEnd()
                futil.log('remap_hole: timeline restored', force_console=True)
            except Exception as restore_err:
                futil.log(f'remap_hole: failed to restore timeline: {restore_err}',
                          force_console=True)
        # Re-collapse parent group if we expanded it
        if was_collapsed and parent_group:
            try:
                parent_group.isCollapsed = True
            except Exception:
                pass


def toggle_zero_fret(design: adsk.fusion.Design, enabled: bool) -> dict:
    """Toggle the Zero Fret feature on/off.

    When enabled: unsuppress 'Zero Fret Slot Cut' group, set ZeroFretAdjust to FretCrownWidth * 1
    When disabled: suppress 'Zero Fret Slot Cut' group, set ZeroFretAdjust to FretCrownWidth * 0

    Args:
        design: The active Fusion design.
        enabled: True to enable zero fret, False to disable.

    Returns:
        dict: { 'success': bool, 'message': str }
    """
    try:
        timeline = design.timeline

        # ── 1. Find the Zero Fret Slot Cut group ─────────────────────────
        item = timeline_manager.find_item_by_name(design, 'Zero Fret Slot Cut', exact=True)
        if not item:
            return {
                'success': False,
                'message': 'Zero Fret Slot Cut group not found in timeline'
            }

        timeline_obj = item.get('object')
        if not timeline_obj:
            return {
                'success': False,
                'message': 'Zero Fret Slot Cut has no timeline object'
            }

        # ── 2. Set suppression state ──────────────────────────────────────
        try:
            timeline_obj.isSuppressed = not enabled
            futil.log(f'toggle_zero_fret: set suppressed={not enabled}', force_console=True)
        except Exception as e:
            futil.log(f'toggle_zero_fret: failed to set suppression: {e}', force_console=True)
            return {
                'success': False,
                'message': f'Failed to set suppression state: {str(e)}'
            }

        # ── 3. Update ZeroFretAdjust parameter ────────────────────────────
        try:
            new_expr = 'FretCrownWidth * 1' if enabled else 'FretCrownWidth * 0'
            params = design.userParameters
            zero_fret_adjust = params.itemByName('ZeroFretAdjust')
            if zero_fret_adjust:
                zero_fret_adjust.expression = new_expr
                futil.log(
                    f'toggle_zero_fret: set ZeroFretAdjust = "{new_expr}"',
                    force_console=True
                )
            else:
                futil.log('toggle_zero_fret: ZeroFretAdjust parameter not found', force_console=True)
                # Non-fatal; the group suppress/unsuppress is the main action
        except Exception as e:
            futil.log(f'toggle_zero_fret: failed to update parameter: {e}', force_console=True)
            # Non-fatal; the group suppress/unsuppress already succeeded

        status = 'enabled' if enabled else 'disabled'
        return {
            'success': True,
            'message': f'Zero Fret {status}'
        }

    except Exception as e:
        futil.log(f'toggle_zero_fret: error: {e}', force_console=True)
        return {
            'success': False,
            'message': str(e)
        }


def toggle_blind_frets(design: adsk.fusion.Design, enabled: bool) -> dict:
    """Toggle the Blind Frets feature on/off by updating the BlindFret parameter.

    When enabled: BlindFret = 0.0625 in * 1
    When disabled: BlindFret = 0.0625 in * -1

    Args:
        design: The active Fusion design.
        enabled: True to enable blind frets, False to disable.

    Returns:
        dict: { 'success': bool, 'message': str }
    """
    try:
        # ── Update BlindFret parameter ───────────────────────────────────
        params = design.userParameters
        blind_fret = params.itemByName('BlindFret')
        if not blind_fret:
            return {
                'success': False,
                'message': 'BlindFret parameter not found'
            }

        new_expr = '0.0625 in * 1' if enabled else '0.0625 in * -1'
        blind_fret.expression = new_expr
        futil.log(
            f'toggle_blind_frets: set BlindFret = "{new_expr}"',
            force_console=True
        )

        status = 'enabled' if enabled else 'disabled'
        return {
            'success': True,
            'message': f'Blind Frets {status}'
        }

    except Exception as e:
        futil.log(f'toggle_blind_frets: error: {e}', force_console=True)
        return {
            'success': False,
            'message': str(e)
        }


def _get_doc_cache_key(design: adsk.fusion.Design) -> str:
    """Build a stable key for radius cache lookups.

    Tries multiple strategies in order:
    1. datafile.id (most stable for cloud-based designs)
    2. document.fullPathName (for local files)
    3. document.name (fallback for unsaved docs)

    Args:
        design: The Fusion design object.

    Returns:
        str: A cache key string, or empty string if none could be generated.
    """
    try:
        doc = design.parentDocument
        if not doc:
            return ''

        data_file = getattr(doc, 'dataFile', None)
        data_file_id = getattr(data_file, 'id', '') if data_file else ''
        if data_file_id:
            return f'datafile:{data_file_id}'

        full_path = getattr(doc, 'fullPathName', '') or ''
        if full_path:
            return f'path:{full_path.lower()}'

        # Last-resort key for unsaved docs in the current user profile.
        name = getattr(doc, 'name', '') or ''
        if name:
            return f'unsaved:{name}'
    except Exception:
        pass
    return ''


def set_radius_mode(design: adsk.fusion.Design, mode_data: dict) -> dict:
    """Set the fretboard radius mode.

    Modes:
    - 'straight': HeelRadius = NutRadius (parameter reference)
    - 'compound': HeelRadius has independent value (default behavior)
    - 'flat': Both NutRadius and HeelRadius = 10000 in

    Args:
        design: The active Fusion design.
        mode_data: Dict with 'mode' ('straight'|'compound'|'flat').

    Returns:
        dict: { 'success': bool, 'message': str }
    """
    def _detect_current_mode(nut_expr: str, heel_expr: str) -> str:
        """Best-effort detection of current radius mode from expressions."""
        nut_clean = (nut_expr or '').strip().lower()
        heel_clean = (heel_expr or '').strip().lower()

        if heel_clean == 'nutradius':
            return 'straight'

        if nut_clean == heel_clean and ('10000 in' in nut_clean or '254000 mm' in nut_clean):
            return 'flat'

        return 'compound'

    try:
        mode = mode_data.get('mode', 'compound')

        futil.log(
            f'set_radius_mode: Setting radius mode to {mode}',
            force_console=True
        )

        params = design.userParameters
        nut_radius = params.itemByName('NutRadius')
        heel_radius = params.itemByName('HeelRadius')

        if not nut_radius:
            return {
                'success': False,
                'message': 'NutRadius parameter not found'
            }

        if not heel_radius:
            return {
                'success': False,
                'message': 'HeelRadius parameter not found'
            }

        doc_cache_key = _get_doc_cache_key(design)
        current_nut_expr = nut_radius.expression
        current_heel_expr = heel_radius.expression
        current_mode = _detect_current_mode(current_nut_expr, current_heel_expr)

        # Persist compound expressions before switching into a derived mode.
        if mode in ('flat', 'straight') and current_mode == 'compound' and doc_cache_key:
            radius_cache.set_cached_radii(doc_cache_key, current_nut_expr, current_heel_expr)
            futil.log(
                f'set_radius_mode: cached compound radii for key "{doc_cache_key}"',
                force_console=True
            )
        # Persist straight NutRadius before switching to flat.
        if mode == 'flat' and current_mode == 'straight' and doc_cache_key:
            radius_cache.set_cached_straight_nut(doc_cache_key, current_nut_expr)
            futil.log(
                f'set_radius_mode: cached straight nut radius for key "{doc_cache_key}"',
                force_console=True
            )

        # Get document unit
        doc_unit = design.fusionUnitsManager.defaultLengthUnits

        if mode == 'flat':
            # Set both to 10000 (with appropriate unit)
            flat_expr = '254000 mm' if is_metric_length_unit(doc_unit) else '10000 in'
            nut_radius.expression = flat_expr
            heel_radius.expression = flat_expr
            futil.log(
                f'set_radius_mode: Set both radii to {flat_expr} (flat mode)',
                force_console=True
            )
            message = 'Fretboard radius set to Flat'

        elif mode == 'straight':
            # Restore previously saved straight NutRadius when returning from flat.
            if current_mode == 'flat' and doc_cache_key:
                cached_straight_nut = radius_cache.get_cached_straight_nut(doc_cache_key)
                if cached_straight_nut:
                    nut_radius.expression = cached_straight_nut
                    futil.log(
                        f'set_radius_mode: restored straight nut radius for key "{doc_cache_key}"',
                        force_console=True
                    )
            # HeelRadius becomes a parameter reference to NutRadius
            heel_radius.expression = 'NutRadius'
            futil.log(
                'set_radius_mode: Set HeelRadius = NutRadius (straight mode)',
                force_console=True
            )
            message = 'Fretboard radius set to Straight'

        elif mode == 'compound':
            restored = False
            if doc_cache_key:
                cached = radius_cache.get_cached_radii(doc_cache_key)
                if cached:
                    cached_nut = cached.get('nutRadius')
                    cached_heel = cached.get('heelRadius')
                    if cached_nut and cached_heel:
                        nut_radius.expression = cached_nut
                        heel_radius.expression = cached_heel
                        restored = True
                        futil.log(
                            f'set_radius_mode: restored cached compound radii for key "{doc_cache_key}"',
                            force_console=True
                        )

            if not restored:
                # Fallback: ensure HeelRadius is independent (not a reference to NutRadius)
                current_expr = heel_radius.expression
                if current_expr.strip() == 'NutRadius':
                    # Convert reference to independent value
                    resolved_value = nut_radius.value
                    heel_radius.value = resolved_value
                    futil.log(
                        f'set_radius_mode: Converted HeelRadius from reference to independent value {heel_radius.expression}',
                        force_console=True
                    )
                else:
                    futil.log(
                        'set_radius_mode: HeelRadius already independent (compound mode)',
                        force_console=True
                    )
            message = 'Fretboard radius set to Compound'

        else:
            return {
                'success': False,
                'message': f'Unknown radius mode: {mode}'
            }

        return {
            'success': True,
            'message': message
        }

    except Exception as e:
        futil.log(f'set_radius_mode: error: {e}', force_console=True)
        return {
            'success': False,
            'message': str(e)
        }


def toggle_heel_curve(design: adsk.fusion.Design, enabled: bool) -> dict:
    """Toggle the Heel Curve between user value and flat (10000 in / 254000 mm).

    When disabling (enabled=False): Cache current value, then set to flat
    When enabling (enabled=True): Restore cached value (or schema default)

    Args:
        design: The active Fusion design.
        enabled: True to enable heel curve (user value), False for flat.

    Returns:
        dict: { 'success': bool, 'message': str }
    """
    try:
        params = design.userParameters
        heel_curve = params.itemByName('HeelCurveRadius')
        if not heel_curve:
            return {
                'success': False,
                'message': 'HeelCurveRadius parameter not found'
            }

        # Get document unit
        doc_unit = design.fusionUnitsManager.defaultLengthUnits
        doc_cache_key = _get_doc_cache_key(design)

        current_expr = heel_curve.expression
        flat_expr = '10000 in' if doc_unit == 'in' else '254000 mm'

        if enabled:
            # Restore cached user value (or fall back to schema default)
            restored = False
            if doc_cache_key:
                cached_value = radius_cache.get_cached_heel_curve(doc_cache_key)
                if cached_value:
                    heel_curve.expression = cached_value
                    restored = True
                    futil.log(
                        f'toggle_heel_curve: restored cached value "{cached_value}"',
                        force_console=True
                    )

            if not restored:
                # Fall back to schema default
                default_expr = '4 in' if doc_unit == 'in' else '102 mm'
                heel_curve.expression = default_expr
                futil.log(
                    f'toggle_heel_curve: no cache, using schema default "{default_expr}"',
                    force_console=True
                )

            message = 'Heel Curve enabled'

        else:
            # Cache current value before setting to flat
            if doc_cache_key and current_expr != flat_expr:
                radius_cache.set_cached_heel_curve(doc_cache_key, current_expr)
                futil.log(
                    f'toggle_heel_curve: cached current value "{current_expr}"',
                    force_console=True
                )

            # Set to flat
            heel_curve.expression = flat_expr
            futil.log(
                f'toggle_heel_curve: set to flat "{flat_expr}"',
                force_console=True
            )
            message = 'Heel Curve disabled (flat)'

        return {
            'success': True,
            'message': message
        }

    except Exception as e:
        futil.log(f'toggle_heel_curve: error: {e}', force_console=True)
        return {
            'success': False,
            'message': str(e)
        }

