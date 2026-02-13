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
import adsk.core
import adsk.fusion

from . import fusionAddInUtils as futil
from .. import config
from . import timeline_manager

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


def get_unit_symbol(unit_kind):
    """Convert unitKind to a display unit symbol.

    Args:
        unit_kind: The unitKind string from schema (e.g., 'length', 'angle', 'unitless').

    Returns:
        str: The unit symbol (e.g., 'in', 'deg', '').
    """
    return UNIT_SYMBOLS.get(unit_kind, '')


def get_document_unit(design: adsk.fusion.Design) -> str:
    """Return the document's active length unit symbol (e.g. 'in', 'mm', 'cm').

    Args:
        design: The active Fusion design.

    Returns:
        str: The length unit symbol used by the document.
    """
    try:
        units_mgr = design.fusionUnitsManager
        return units_mgr.defaultLengthUnits
    except Exception:
        return 'in'


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

    Returns a payload identical in shape to build_ui_payload(), with
    an added ``mode`` field set to ``"initial"``.
    """
    schema = load_schema()
    if schema is None:
        return None

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
                'min': param_def.get('min'),
                'max': param_def.get('max'),
                'step': param_def.get('step'),
                'description': param_def.get('description', ''),
                'expression': default_expr,
                'value': numeric_value,
                'unit': '',
            })
        groups.append(group)

    groups.sort(key=lambda g: g['order'])

    doc_unit = get_document_unit(design) if design is not None else 'in'

    payload = {
        'schemaVersion': schema.get('schemaVersion', 'unknown'),
        'templateVersion': schema.get('templateVersion', 'unknown'),
        'groups': groups,
        'missing': [],
        'extra': [],
        'mode': 'initial',
        'documentUnit': doc_unit,
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
            param_entry = {
                'name': name,
                'label': param_def.get('label', name),
                'unitKind': param_def.get('unitKind', 'length'),
                'controlType': param_def.get('controlType', 'number'),
                'default': param_def.get('default', ''),
                'min': param_def.get('min'),
                'max': param_def.get('max'),
                'step': param_def.get('step'),
                'description': param_def.get('description', ''),
                'expression': live['expression'],
                'value': live['value'],
                'unit': live['unit'],
            }

            group['parameters'].append(param_entry)

        groups.append(group)

    # Sort groups by order
    groups.sort(key=lambda g: g['order'])

    # Find extra params: in design but not in schema (exclude fingerprint parameter)
    extra_names = [name for name in live_params if name not in schema_param_names and name != FINGERPRINT_PARAM]

    # Build full parameter objects for extra params
    extra_params = []
    for name in extra_names:
        live = live_params[name]
        extra_params.append({
            'name': name,
            'label': name,
            'unitKind': 'unitless',
            'controlType': 'number',
            'default': '',
            'description': live['comment'],
            'expression': live['expression'],
            'value': live['value'],
            'unit': live['unit'],
        })

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
        'documentUnit': get_document_unit(design),
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


# ═══════════════════════════════════════════════════════════════════
# Apply parameters in batch
# ═══════════════════════════════════════════════════════════════════

def apply_parameters(design: adsk.fusion.Design, param_values: dict):
    """Apply a dict of parameter expressions to the design.

    Args:
        design: The active Fusion design.
        param_values: Dict of { param_name: new_expression_string }.
                      Only editable schema-defined parameters are applied.
                      Formula-based parameters are protected and ignored.

    Returns:
        dict: { "updated": int, "errors": [str] }
    """
    # Get the cached set of editable parameter names
    # Formula-based parameters are excluded to prevent overwriting expressions
    allowed_names = _get_editable_names()
    if not allowed_names:
        return {'updated': 0, 'errors': ['Schema could not be loaded.']}

    if not param_values:
        return {'updated': 0, 'errors': []}

    user_params = design.userParameters
    updated = 0
    errors = []
    protected = 0

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

    futil.log(
        f'Parameter Bridge: Applied {updated} parameter(s), '
        f'{protected} protected, {len(errors)} error(s)'
    )
    return {'updated': updated, 'errors': errors}


# ═══════════════════════════════════════════════════════════════════
# Timeline Management (delegates to timeline_manager)
# ═══════════════════════════════════════════════════════════════════

def get_timeline_items(design: adsk.fusion.Design):
    """Get all timeline items with full details for UI display.

    Groups include a 'children' list of their member features.
    """
    items = timeline_manager.get_all_items(design, include_suppressed=True)
    result = []
    for item in items:
        entry = {
            'name': item['name'],
            'type': item['type'],
            'suppressed': item['suppressed'],
            'index': item['index'],
        }
        if item['type'] == 'Group':
            children = timeline_manager.get_group_items(design, item['name'])
            entry['children'] = [
                {
                    'name': c['name'],
                    'type': c['type'],
                    'suppressed': c['suppressed'],
                    'index': c['index'],
                }
                for c in children
            ]
        result.append(entry)
    return result


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


def get_timeline_summary(design: adsk.fusion.Design) -> dict:
    """Get a summary of the timeline state."""
    return timeline_manager.get_timeline_summary(design)

