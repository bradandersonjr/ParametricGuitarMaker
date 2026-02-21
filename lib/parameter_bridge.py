"""
Parameter Bridge — reads, validates, and applies user parameters.

This module provides the interface between the Fusion design parameters
and the UI. It uses the parameter schema (parameters.schema.json) to:
  - Read current parameter values from the design
  - Build a UI-ready payload with groups, controls, and constraints
  - Apply parameter changes in batch

Sub-modules (extracted for clarity):
  - units.py          — unit symbol mapping and metric/imperial detection
  - schema.py         — schema loading and caching
  - fingerprint.py    — design fingerprint detection
  - validation.py     — parameter value validation
  - feature_toggles.py — zero fret, blind frets, heel curve, radius mode, hole remap
"""

import re
import adsk.core
import adsk.fusion

from . import fusionAddInUtils as futil
from . import timeline_manager

# ── Re-exports from sub-modules (backward compatibility for entry.py) ─
from .units import (                                    # noqa: F401
    UNIT_SYMBOLS, METRIC_LENGTH_UNITS, IMPERIAL_LENGTH_UNITS,
    get_unit_symbol, get_document_unit, is_metric_length_unit,
)
from .schema import load_schema                         # noqa: F401
from .fingerprint import (                              # noqa: F401
    FINGERPRINT_PARAM, get_fingerprint, set_fingerprint,
)
from .validation import (                               # noqa: F401
    extract_unit_from_expression as _extract_unit_from_expression,
)
from .feature_toggles import (                          # noqa: F401
    toggle_zero_fret, toggle_blind_frets, toggle_heel_curve,
    set_radius_mode, remap_hole_to_selection_set,
    get_doc_cache_key as _get_doc_cache_key,
)

# Internal imports used by this module
from .schema import get_editable_names as _get_editable_names
from .validation import (
    get_param_limits as _get_param_limits,
    validate_parameter_value as _validate_parameter_value,
)

app = adsk.core.Application.get()


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
    """Extract the pgfm-group value from a parameter comment string."""
    match = _group_tag_re().search(comment or '')
    return match.group(1) if match else None


def _set_group_tag(comment: str, group_id: str) -> str:
    """Set or replace the pgfm-group tag in a comment string."""
    clean = _group_tag_re().sub('', comment or '').rstrip()
    if group_id:
        return f'{clean} [pgfm-group:{group_id}]'.lstrip()
    return clean


def set_param_group(design: adsk.fusion.Design, param_name: str, group_id: str) -> dict:
    """Update a user parameter's comment to encode its group assignment."""
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


# ═══════════════════════════════════════════════════════════════════
# Parameter CRUD
# ═══════════════════════════════════════════════════════════════════

def edit_param(design: adsk.fusion.Design, old_name: str, new_name: str, description: str, group_id: str) -> dict:
    """Rename a user parameter, update its description, and set its group assignment."""
    param = design.userParameters.itemByName(old_name)
    if param is None:
        futil.log(f'Parameter Bridge: Parameter {old_name!r} not found in design')
        return {'ok': False, 'error': f"Parameter '{old_name}' not found"}

    if new_name != old_name:
        if design.userParameters.itemByName(new_name) is not None:
            futil.log(f'Parameter Bridge: Name conflict - {new_name!r} already exists')
            return {'ok': False, 'error': f"A parameter named '{new_name}' already exists"}

    try:
        new_comment = _set_group_tag(description, group_id)
        param.comment = new_comment
        if new_name != old_name:
            param.name = new_name
        futil.log(f'Parameter Bridge: Edited param {old_name!r} -> name={new_name!r} group={group_id!r} desc={description!r}')
        return {'ok': True, 'error': None}
    except Exception as e:
        err = f'Failed to edit param {old_name}: {e}'
        futil.log(err, adsk.core.LogLevels.ErrorLogLevel)
        return {'ok': False, 'error': err}


def delete_param(design: adsk.fusion.Design, param_name: str) -> dict:
    """Delete a user parameter from the design."""
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
    """Read all user parameters from the active design."""
    result = {}
    user_params = design.userParameters

    for i in range(user_params.count):
        p = user_params.item(i)
        result[p.name] = {
            'name': p.name,
            'expression': p.expression,
            'value': p.value,
            'unit': p.unit,
            'comment': p.comment or '',
        }

    futil.log(f'Parameter Bridge: Read {len(result)} user parameter(s) from design')
    return result


def create_user_parameter(design: adsk.fusion.Design, name: str, expression: str,
                          description: str = '', group_id: str = '') -> dict:
    """Create a new user parameter in the Fusion design."""
    user_params = design.userParameters

    if user_params.itemByName(name) is not None:
        return {'created': False, 'error': f"Parameter '{name}' already exists"}

    try:
        value_input = adsk.core.ValueInput.createByString(expression)
        unit = _extract_unit_from_expression(expression)
        comment = _set_group_tag(description, group_id) if group_id else description
        user_params.add(name, value_input, unit, comment)
        futil.log(f'Parameter Bridge: Created user parameter {name} = {expression} (group={group_id!r})')
        return {'created': True, 'error': None}
    except Exception as e:
        err = f'Failed to create parameter {name}: {e}'
        futil.log(err, adsk.core.LogLevels.ErrorLogLevel)
        return {'created': False, 'error': err}


# ═══════════════════════════════════════════════════════════════════
# Build UI-ready payloads
# ═══════════════════════════════════════════════════════════════════

def build_schema_payload(design: adsk.fusion.Design = None):
    """Build a UI payload from schema defaults only (no design needed).

    Used for the initial "configure before import" flow.
    If design is provided, reads actual parameter values from Fusion.
    """
    schema = load_schema()
    if schema is None:
        return None

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
            if not param_def.get('editable', True):
                continue

            param_name = param_def['name']
            if param_name in live_params:
                default_expr = live_params[param_name]['expression']
            else:
                default_expr = param_def.get('default', '')

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

    for group in groups:
        for param in group['parameters']:
            param['unit'] = get_unit_symbol(param['unitKind'], doc_unit)
            if is_metric_length_unit(doc_unit) and param['unitKind'] == 'length' and param.get('defaultMetric'):
                metric_default = param['defaultMetric']
                try:
                    param['value'] = float(metric_default)
                except (ValueError, TypeError):
                    pass
                if param['name'] not in live_params:
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

    Only includes EDITABLE parameters (non-formula-based).
    """
    schema = load_schema()
    if schema is None:
        return None

    live_params = get_user_parameters(design)
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

            if not param_def.get('editable', True):
                continue

            if name not in live_params:
                missing.append(name)
                continue

            live = live_params[name]
            live_description = _group_tag_re().sub('', live['comment']).strip()
            description = live_description if live_description else param_def.get('description', '')

            group['parameters'].append({
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
            })

        groups.append(group)

    groups.sort(key=lambda g: g['order'])

    doc_unit = get_document_unit(design) if design is not None else 'in'
    for group in groups:
        for param in group['parameters']:
            param['unit'] = get_unit_symbol(param['unitKind'], doc_unit)
            if is_metric_length_unit(doc_unit) and param['unitKind'] == 'length':
                expr = param['expression']
                match = re.match(r'^([\d.]+)\s*in\s*$', expr)
                if match:
                    imperial_val = float(match.group(1))
                    metric_val = imperial_val * 25.4
                    param['expression'] = f"{metric_val} {param['unit']}"
                    param['value'] = metric_val

    from .fingerprint import FINGERPRINT_PARAM
    extra_names = [name for name in live_params if name not in schema_param_names and name != FINGERPRINT_PARAM]

    extra_params = []
    for name in extra_names:
        live = live_params[name]
        raw_comment = live['comment']
        group_id = _parse_group_tag(raw_comment)
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
    """Return a dict of {name: expression} for all editable params in the design."""
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

def apply_parameters(design: adsk.fusion.Design, param_values: dict, creates: list = None):
    """Apply a dict of parameter expressions to the design, and optionally create new ones."""
    allowed_names = _get_editable_names()
    if not allowed_names:
        return {'updated': 0, 'created': 0, 'errors': ['Schema could not be loaded.']}

    if not param_values and not creates:
        return {'updated': 0, 'created': 0, 'errors': []}

    limits = _get_param_limits()
    doc_unit = get_document_unit(design)

    user_params = design.userParameters
    updated = 0
    errors = []
    protected = 0
    out_of_range = 0

    for name, new_expr in param_values.items():
        new_expr = new_expr.strip()
        if not new_expr:
            continue

        if name not in allowed_names:
            protected += 1
            futil.log(
                f'Parameter Bridge: Ignoring protected formula-based parameter: {name}',
                adsk.core.LogLevels.WarningLogLevel
            )
            continue

        is_flat_sentinel = new_expr in ('10000 in', '254000 mm')
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
            continue

        try:
            param.expression = new_expr
            updated += 1
            futil.log(f'Parameter Bridge: Set {name} = {new_expr}')
        except Exception as e:
            err_msg = f'Failed to set {name} = "{new_expr}": {e}'
            errors.append(err_msg)
            futil.log(f'Parameter Bridge: {err_msg}',
                      adsk.core.LogLevels.ErrorLogLevel)

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

_FEATURES_DRAWER_GROUPS = ["Fret Markers", "Nut Slot", "Fret Slot Cuts", "Zero Fret Slot Cut"]
_FEATURES_DRAWER_FEATURES = ["Heel Curve Fillet"]


def _matches_drawer_group(name: str) -> bool:
    stripped = name.strip()
    for group in _FEATURES_DRAWER_GROUPS:
        if stripped == group or stripped.startswith(group + ':'):
            return True
    return False


def _matches_drawer_feature(name: str) -> bool:
    stripped = name.strip()
    for feat in _FEATURES_DRAWER_FEATURES:
        if stripped == feat or stripped.startswith(feat + ':'):
            return True
    return False


def get_group_states(design: adsk.fusion.Design) -> list:
    """Get the suppression state of each curated Options-panel item."""
    items = timeline_manager.get_all_items(design, include_suppressed=True)
    return [
        {'name': item['name'].strip(), 'suppressed': item['suppressed']}
        for item in items
        if (item['type'] == 'Group' and _matches_drawer_group(item['name']))
        or (item['type'] == 'Feature' and _matches_drawer_feature(item['name']))
    ]


def suppress_timeline_item(design: adsk.fusion.Design, name: str) -> dict:
    success = timeline_manager.suppress_item(design, name)
    return {
        'success': success,
        'message': f'Suppressed "{name}"' if success else f'Failed to suppress "{name}"',
    }


def unsuppress_timeline_item(design: adsk.fusion.Design, name: str) -> dict:
    success = timeline_manager.unsuppress_item(design, name)
    return {
        'success': success,
        'message': f'Unsuppressed "{name}"' if success else f'Failed to unsuppress "{name}"',
    }


def toggle_timeline_item(design: adsk.fusion.Design, name: str) -> dict:
    new_state = timeline_manager.toggle_item(design, name)
    if new_state is None:
        return {'success': False, 'newState': None, 'message': f'Failed to toggle "{name}"'}
    return {
        'success': True,
        'newState': new_state,
        'message': f'Toggled "{name}" (now {"suppressed" if new_state else "active"})',
    }


def suppress_group_with_contents(design: adsk.fusion.Design, group_name: str) -> dict:
    success = timeline_manager.suppress_group_with_contents(design, group_name)
    if not success:
        return {'success': False, 'itemsAffected': 0, 'message': f'Failed to suppress group "{group_name}"'}
    items = timeline_manager.get_group_items(design, group_name)
    return {
        'success': True,
        'itemsAffected': len(items) + 1,
        'message': f'Suppressed group "{group_name}" and {len(items)} item(s)',
    }


def unsuppress_group_with_contents(design: adsk.fusion.Design, group_name: str) -> dict:
    success = timeline_manager.unsuppress_group_with_contents(design, group_name)
    if not success:
        return {'success': False, 'itemsAffected': 0, 'message': f'Failed to unsuppress group "{group_name}"'}
    items = timeline_manager.get_group_items(design, group_name)
    return {
        'success': True,
        'itemsAffected': len(items) + 1,
        'message': f'Unsuppressed group "{group_name}" and {len(items)} item(s)',
    }
