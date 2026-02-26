"""
Parametric Guitar: Fretboard Maker — the main toolbar command.

Palette with bidirectional communication (React UI ↔ Python bridge).
"""

import json
import webbrowser
import adsk.core
import adsk.fusion
import os
import re
from datetime import date
from ...lib import fusionAddInUtils as futil
from ... import config
from ...lib import parameter_bridge
from ...lib import preferences
from ...lib.deferred_ops import make_deferred_op

app = adsk.core.Application.get()
ui = app.userInterface

# ── Command identity ────────────────────────────────────────────────
CMD_ID = f'{config.COMPANY_NAME}_{config.ADDIN_NAME}_guitarMaker'
CMD_NAME = 'Parametric Guitar: Fretboard Maker'
CMD_DESCRIPTION = 'Design custom guitar fretboards with precise parameter control.'

IS_PROMOTED = True

# ── UI placement ────────────────────────────────────────────────────
WORKSPACE_ID = 'FusionSolidEnvironment'
PANEL_ID = 'SolidCreatePanel'
COMMAND_BESIDE_ID = ''

# ── Icon folder ─────────────────────────────────────────────────────
ICON_FOLDER = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), 'resources', ''
)

# ── Template paths ──────────────────────────────────────────────────
TEMPLATES_DIR = os.path.join(config.ADDIN_ROOT, 'templates')
PRESETS_DIR = os.path.join(config.ADDIN_ROOT, 'templates', 'presets')
USER_TEMPLATES_DIR = os.path.join(config.ADDIN_ROOT, 'templates', 'user')  # User templates in add-in folder

# ── Palette config ──────────────────────────────────────────────────
PALETTE_ID = config.PALETTE_ID
PALETTE_NAME = config.PALETTE_NAME
PALETTE_LOCAL_URL = os.path.join(
    config.ADDIN_ROOT, 'ui_dist', 'index.html'
).replace('\\', '/')
PALETTE_URL = config.PALETTE_DEV_URL or PALETTE_LOCAL_URL

# ── State ───────────────────────────────────────────────────────────
local_handlers = []
_pending_payload = None         # Payload waiting for JS 'ready' signal
_owner_document = None          # The document that owns the palette

# ── Deferred apply event (unique logic — not factory-generated) ─────
_APPLY_EVENT_ID = f'{config.COMPANY_NAME}_{config.ADDIN_NAME}_applyParams'
_pending_apply = None

# ── Deferred timeline event (unique logic — not factory-generated) ──
_TIMELINE_EVENT_ID = f'{config.COMPANY_NAME}_{config.ADDIN_NAME}_timelineOp'
_pending_timeline_op = None


# ═══════════════════════════════════════════════════════════════════
# Factory-generated deferred operations
# ═══════════════════════════════════════════════════════════════════

def _hole_handler(design, op):
    return parameter_bridge.remap_hole_to_selection_set(
        design, op.get('holeName', ''), op.get('selectionSetName', ''))

def _zero_fret_handler(design, op):
    return parameter_bridge.toggle_zero_fret(design, op.get('enabled', False))

def _blind_frets_handler(design, op):
    return parameter_bridge.toggle_blind_frets(design, op.get('enabled', False))

def _radius_mode_handler(design, op):
    return parameter_bridge.set_radius_mode(design, op)

def _heel_curve_handler(design, op):
    return parameter_bridge.toggle_heel_curve(design, op.get('enabled', False))


# Each make_deferred_op returns (event_id, pending_holder, queue_fn, handler_fn)
_HOLE_EVENT_ID, _hole_pending, _queue_hole_op, _deferred_hole_handler = make_deferred_op(
    'holePositionOp', 'hole remap', _hole_handler, 'HOLE_POSITION_RESULT')

_ZERO_FRET_EVENT_ID, _zf_pending, _queue_zero_fret_op, _deferred_zero_fret_handler = make_deferred_op(
    'zeroFretOp', 'zero-fret toggle', _zero_fret_handler, 'ZERO_FRET_RESULT')

_BLIND_FRETS_EVENT_ID, _bf_pending, _queue_blind_frets_op, _deferred_blind_frets_handler = make_deferred_op(
    'blindFretsOp', 'blind-frets toggle', _blind_frets_handler, 'BLIND_FRETS_RESULT')

_RADIUS_MODE_EVENT_ID, _rm_pending, _queue_radius_mode_op, _deferred_radius_mode_handler = make_deferred_op(
    'radiusModeOp', 'radius mode change', _radius_mode_handler, 'RADIUS_MODE_RESULT')

_HEEL_CURVE_EVENT_ID, _hc_pending, _queue_heel_curve_op, _deferred_heel_curve_handler = make_deferred_op(
    'heelCurveOp', 'heel curve toggle', _heel_curve_handler, 'HEEL_CURVE_RESULT')

# All factory-generated event IDs for bulk registration/unregistration
_FACTORY_EVENTS = [
    (_HOLE_EVENT_ID, _deferred_hole_handler),
    (_ZERO_FRET_EVENT_ID, _deferred_zero_fret_handler),
    (_BLIND_FRETS_EVENT_ID, _deferred_blind_frets_handler),
    (_RADIUS_MODE_EVENT_ID, _deferred_radius_mode_handler),
    (_HEEL_CURVE_EVENT_ID, _deferred_heel_curve_handler),
]

# Palette action → queue function mapping for factory-generated ops
_ACTION_HANDLERS = {
    'REMAP_HOLE_TO_SELECTION_SET': _queue_hole_op,
    'TOGGLE_ZERO_FRET': _queue_zero_fret_op,
    'TOGGLE_BLIND_FRETS': _queue_blind_frets_op,
    'SET_RADIUS_MODE': _queue_radius_mode_op,
    'TOGGLE_HEEL_CURVE': _queue_heel_curve_op,
}


# ═══════════════════════════════════════════════════════════════════
# Start / Stop
# ═══════════════════════════════════════════════════════════════════

def start(is_startup=False):
    """Register the toolbar button when the add-in starts."""

    # Clean up any stale control/definition from a previous run.
    workspace = ui.workspaces.itemById(WORKSPACE_ID)
    panel = workspace.toolbarPanels.itemById(PANEL_ID)

    existing_control = panel.controls.itemById(CMD_ID)
    if existing_control:
        existing_control.deleteMe()

    existing_def = ui.commandDefinitions.itemById(CMD_ID)
    if existing_def:
        existing_def.deleteMe()

    cmd_def = ui.commandDefinitions.addButtonDefinition(
        CMD_ID, CMD_NAME, CMD_DESCRIPTION, ICON_FOLDER
    )
    futil.add_handler(cmd_def.commandCreated, command_created)
    control = panel.controls.addCommand(cmd_def, COMMAND_BESIDE_ID if COMMAND_BESIDE_ID else '', False)
    control.isPromoted = IS_PROMOTED

    # Listen for document activation changes
    futil.add_handler(app.documentActivated, on_document_activated)

    # Register manual deferred events
    apply_event = app.registerCustomEvent(_APPLY_EVENT_ID)
    futil.add_handler(apply_event, _deferred_apply_handler)

    timeline_event = app.registerCustomEvent(_TIMELINE_EVENT_ID)
    futil.add_handler(timeline_event, _deferred_timeline_handler)

    # Register all factory-generated deferred events
    for event_id, handler_fn in _FACTORY_EVENTS:
        evt = app.registerCustomEvent(event_id)
        futil.add_handler(evt, handler_fn)

    # Show welcome message when manually run, but not on Fusion startup
    if not is_startup:
        ui.messageBox(
            f'<b>{CMD_NAME}</b> has been added to the <b>SOLID</b> tab under the <b>CREATE</b> drop-down menu.<br><br>'
            'Click the button to:<br>'
            '  • Design <i>custom guitar fretboards</i><br>'
            '  • Control <i>every fret</i> with <b>precise parameters</b><br>'
            '  • Save and load <i>templates</i> for your favorite designs',
            CMD_NAME
        )
        futil.log(f'{CMD_NAME}: Welcome message shown (manual run)')
    else:
        futil.log(f'{CMD_NAME}: Skipping welcome message (application startup)')


def stop():
    """Remove the toolbar button and palette when the add-in stops."""
    workspace = ui.workspaces.itemById(WORKSPACE_ID)
    panel = workspace.toolbarPanels.itemById(PANEL_ID)
    command_control = panel.controls.itemById(CMD_ID)
    command_definition = ui.commandDefinitions.itemById(CMD_ID)

    if command_control:
        command_control.deleteMe()
    if command_definition:
        command_definition.deleteMe()

    palette = ui.palettes.itemById(PALETTE_ID)
    if palette:
        palette.deleteMe()

    # Unregister manual deferred events
    app.unregisterCustomEvent(_APPLY_EVENT_ID)
    app.unregisterCustomEvent(_TIMELINE_EVENT_ID)

    # Unregister all factory-generated deferred events
    for event_id, _ in _FACTORY_EVENTS:
        app.unregisterCustomEvent(event_id)


# ═══════════════════════════════════════════════════════════════════
# Command event handlers
# ═══════════════════════════════════════════════════════════════════

def command_created(args: adsk.core.CommandCreatedEventArgs):
    """Called when the command button is clicked."""
    futil.log(f'{CMD_NAME}: Command Created')
    cmd = args.command
    futil.add_handler(cmd.execute, command_execute, local_handlers=local_handlers)
    futil.add_handler(cmd.destroy, command_destroy, local_handlers=local_handlers)


def command_execute(args: adsk.core.CommandEventArgs):
    """Open the palette — import happens when user applies."""
    futil.log(f'{CMD_NAME}: Command Execute')
    global _owner_document

    try:
        design = adsk.fusion.Design.cast(app.activeProduct)
        if not design:
            ui.messageBox('A Fusion Design must be active to use Parametric Guitar: Fretboard Maker.')
            return

        fingerprint = parameter_bridge.get_fingerprint(design)
        if fingerprint is not None:
            futil.log(f'{CMD_NAME}: Design fingerprint detected — loading live parameters')
            payload = parameter_bridge.build_ui_payload(design)
        else:
            futil.log(f'{CMD_NAME}: No fingerprint found — this is a new design')
            payload = parameter_bridge.build_schema_payload(design)

        if payload is None:
            ui.messageBox('Failed to build parameter payload. Check the schema file.')
            return

        _show_palette(payload)
    except Exception as e:
        futil.log(f'{CMD_NAME}: command_execute error: {e}', adsk.core.LogLevels.ErrorLogLevel)
        ui.messageBox(f'Error opening palette: {str(e)}', CMD_NAME)


def command_destroy(args: adsk.core.CommandEventArgs):
    """Clean up local handlers when the command ends."""
    futil.log(f'{CMD_NAME}: Command Destroy')
    global local_handlers
    local_handlers = []


# ═══════════════════════════════════════════════════════════════════
# Palette lifecycle
# ═══════════════════════════════════════════════════════════════════

def _show_palette(payload):
    """Create or show the palette and send parameter data."""
    global _pending_payload, _owner_document

    design = adsk.fusion.Design.cast(app.activeProduct)
    if design:
        _owner_document = design.parentDocument

    palette = ui.palettes.itemById(PALETTE_ID)
    is_new = palette is None

    if is_new:
        palette = ui.palettes.add(
            id=PALETTE_ID,
            name=PALETTE_NAME,
            htmlFileURL=PALETTE_URL,
            isVisible=True,
            showCloseButton=True,
            isResizable=True,
            width=680,
            height=1000,
            useNewWebBrowser=True
        )
        futil.add_handler(palette.closed, palette_closed)
        futil.add_handler(palette.incomingFromHTML, palette_incoming)
        futil.log(f'{CMD_NAME}: Created palette')
    else:
        palette.isVisible = True

    if palette.dockingState == adsk.core.PaletteDockingStates.PaletteDockStateFloating:
        palette.dockingState = adsk.core.PaletteDockingStates.PaletteDockStateLeft

    if is_new:
        _pending_payload = payload
        futil.log(f'{CMD_NAME}: Waiting for JS ready signal...')
    else:
        palette.sendInfoToHTML('PALETTE_RESHOWN', '{}')
        _push_preferences(palette)
        _send_payload(palette, payload)


def _send_payload(palette, payload):
    """Send the parameter payload to the JS UI."""
    data_json = json.dumps(payload)
    palette.sendInfoToHTML('PUSH_MODEL_STATE', data_json)
    futil.log(f'{CMD_NAME}: Sent payload to palette '
              f'({sum(len(g["parameters"]) for g in payload["groups"])} params)')


def palette_closed(args: adsk.core.UserInterfaceGeneralEventArgs):
    """Called when the user closes the palette."""
    futil.log(f'{CMD_NAME}: Palette closed')


def _close_palette():
    """Hide the palette."""
    palette = ui.palettes.itemById(PALETTE_ID)
    if palette:
        palette.isVisible = False


# ═══════════════════════════════════════════════════════════════════
# Palette message router
# ═══════════════════════════════════════════════════════════════════

def palette_incoming(args: adsk.core.HTMLEventArgs):
    """Handle messages from the JS palette UI."""
    action = args.action
    futil.log(f'{CMD_NAME}: Palette incoming — action: {action}')

    # Check factory-generated handlers first
    if action in _ACTION_HANDLERS:
        _ACTION_HANDLERS[action](args.data)
        return

    if action == 'ready':
        _on_palette_ready()

    elif action == 'GET_MODEL_STATE':
        _on_refresh_request()

    elif action == 'APPLY_PARAMS':
        _on_apply_params(args.data)

    elif action == 'cancel':
        _close_palette()

    elif action == 'OPEN_URL':
        _on_open_url(args.data)

    elif action == 'OPEN_TEMPLATES_FOLDER':
        _on_open_templates_folder()

    elif action == 'GET_TEMPLATES':
        _on_get_templates()

    elif action == 'SAVE_TEMPLATE':
        _on_save_template(args.data)

    elif action == 'DELETE_TEMPLATE':
        _on_delete_template(args.data)

    elif action == 'LOAD_TEMPLATE':
        _on_load_template(args.data)

    elif action == 'IMPORT_SHARE':
        _on_import_share(args.data)

    elif action == 'SET_PARAM_CATEGORY':
        _on_set_param_category(args.data)

    elif action == 'EDIT_PARAM':
        _on_edit_param(args.data)

    elif action == 'DELETE_PARAM':
        _on_delete_param(args.data)

    elif action == 'GET_GROUP_STATES':
        _on_get_group_states()

    elif action == 'APPLY_TIMELINE_CHANGES':
        _queue_timeline_op('APPLY_TIMELINE_CHANGES', args.data)

    elif action == 'GET_PREFERENCES':
        _on_get_preferences()

    elif action == 'SAVE_PREFERENCES':
        _on_save_preferences(args.data)

    elif action == 'response':
        pass  # Fusion internal acknowledgment — ignore

    else:
        futil.log(f'{CMD_NAME}: Unknown palette action: {action}')


# ═══════════════════════════════════════════════════════════════════
# Palette ready / refresh
# ═══════════════════════════════════════════════════════════════════

def _on_palette_ready():
    """Called when the JS UI signals it has finished loading."""
    global _pending_payload
    _pending_payload = None
    palette = ui.palettes.itemById(PALETTE_ID)
    if not palette:
        futil.log(f'{CMD_NAME}: _on_palette_ready — no palette found!')
        return

    _push_preferences(palette)

    design = adsk.fusion.Design.cast(app.activeProduct)
    if design:
        fingerprint = parameter_bridge.get_fingerprint(design)
        if fingerprint is not None:
            payload = parameter_bridge.build_ui_payload(design)
        else:
            payload = parameter_bridge.build_schema_payload(design)
        if payload:
            _send_payload(palette, payload)
            futil.log(f'{CMD_NAME}: Sent fresh payload on palette ready')


def _on_refresh_request():
    """Called when the UI requests a fresh read of the model state."""
    design = adsk.fusion.Design.cast(app.activeProduct)
    if not design:
        return

    fingerprint = parameter_bridge.get_fingerprint(design)
    has_fingerprint = fingerprint is not None and fingerprint != ''

    if not has_fingerprint:
        payload = parameter_bridge.build_schema_payload(design)
    else:
        payload = parameter_bridge.build_ui_payload(design)

    if payload:
        palette = ui.palettes.itemById(PALETTE_ID)
        if palette:
            _send_payload(palette, payload)


# ═══════════════════════════════════════════════════════════════════
# Preferences handlers
# ═══════════════════════════════════════════════════════════════════

def _push_preferences(palette):
    """Push current preferences to the UI palette."""
    try:
        prefs = preferences.load_preferences()
        data_json = json.dumps(prefs)
        palette.sendInfoToHTML('PREFERENCES_LOADED', data_json)
        futil.log(f'{CMD_NAME}: Pushed preferences to UI', force_console=True)
    except Exception as e:
        futil.log(f'{CMD_NAME}: Error pushing preferences: {e}',
                  adsk.core.LogLevels.ErrorLogLevel)


def _on_get_preferences():
    """Send current preferences to the UI."""
    palette = ui.palettes.itemById(PALETTE_ID)
    if palette:
        _push_preferences(palette)


def _on_save_preferences(data_json):
    """Save preferences from the UI to file."""
    try:
        data = json.loads(data_json)
        success = preferences.save_preferences(data)
        palette = ui.palettes.itemById(PALETTE_ID)
        if palette:
            response = {'success': success}
            palette.sendInfoToHTML('PREFERENCES_SAVED', json.dumps(response))
            futil.log(f'{CMD_NAME}: Saved preferences', force_console=True)
    except Exception as e:
        futil.log(f'{CMD_NAME}: Error saving preferences: {e}',
                  adsk.core.LogLevels.ErrorLogLevel)


# ═══════════════════════════════════════════════════════════════════
# URL / folder handlers
# ═══════════════════════════════════════════════════════════════════

def _on_open_url(data_json):
    """Open a URL in the default browser."""
    try:
        data = json.loads(data_json)
        url = data.get('url')
        if url:
            webbrowser.open(url)
            futil.log(f'{CMD_NAME}: Opened URL: {url}')
    except Exception as e:
        futil.log(f'{CMD_NAME}: Error opening URL: {e}',
                  adsk.core.LogLevels.ErrorLogLevel)


def _on_open_templates_folder():
    """Open the user templates folder in Windows Explorer."""
    os.makedirs(USER_TEMPLATES_DIR, exist_ok=True)
    try:
        os.startfile(TEMPLATES_DIR)
        futil.log(f'{CMD_NAME}: Opened templates folder: {TEMPLATES_DIR}')
    except Exception as e:
        futil.log(f'{CMD_NAME}: Error opening templates folder: {e}',
                  adsk.core.LogLevels.ErrorLogLevel)


# ═══════════════════════════════════════════════════════════════════
# Template management
# ═══════════════════════════════════════════════════════════════════

def _load_template_file(filepath):
    """Load a template JSON file and return the dict, or None on error."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        futil.log(f'{CMD_NAME}: Failed to read template {filepath}: {e}',
                  adsk.core.LogLevels.ErrorLogLevel)
        return None


def _scan_template_dir(directory, is_readonly, is_metric, schema_version):
    """Scan a directory for .json template files and return a list of template dicts."""
    if not os.path.isdir(directory):
        return []

    templates = []
    for fname in sorted(os.listdir(directory)):
        if not fname.endswith('.json'):
            continue
        data = _load_template_file(os.path.join(directory, fname))
        if not data:
            continue

        description = (data.get('description_metric', '') if is_metric and 'description_metric' in data
                       else data.get('description', ''))

        templates.append({
            'id': fname[:-5],
            'name': data.get('name', fname[:-5]),
            'description': description,
            'createdAt': data.get('createdAt', ''),
            'schemaVersion': data.get('schemaVersion', schema_version),
            'readonly': is_readonly,
            'parameters': data.get('parameters', {}),
        })
    return templates


def _build_template_list():
    """Scan preset and user template dirs and return PUSH_TEMPLATES payload."""
    schema_version = '0.3.0'
    try:
        schema = parameter_bridge.load_schema()
        if schema:
            schema_version = schema.get('schemaVersion', schema_version)
    except Exception:
        pass

    design = adsk.fusion.Design.cast(app.activeProduct)
    doc_unit = parameter_bridge.get_document_unit(design) if design else 'in'
    is_metric = parameter_bridge.is_metric_length_unit(doc_unit)

    os.makedirs(USER_TEMPLATES_DIR, exist_ok=True)
    presets = _scan_template_dir(PRESETS_DIR, True, is_metric, schema_version)
    user_templates = _scan_template_dir(USER_TEMPLATES_DIR, False, is_metric, schema_version)

    return {'presets': presets, 'userTemplates': user_templates}


def _on_get_templates():
    """Send the current template list to the UI."""
    payload = _build_template_list()
    palette = ui.palettes.itemById(PALETTE_ID)
    if palette:
        palette.sendInfoToHTML('PUSH_TEMPLATES', json.dumps(payload))
    futil.log(f'{CMD_NAME}: Sent template list '
              f'({len(payload["presets"])} presets, {len(payload["userTemplates"])} user)')


def _on_save_template(data_json):
    """Save a user template to USER_TEMPLATES_DIR."""
    try:
        data = json.loads(data_json)
    except Exception as e:
        futil.log(f'{CMD_NAME}: Bad SAVE_TEMPLATE data: {e}',
                  adsk.core.LogLevels.ErrorLogLevel)
        return

    name = data.get('name', '').strip()
    if not name:
        futil.log(f'{CMD_NAME}: SAVE_TEMPLATE — name is required',
                  adsk.core.LogLevels.WarningLogLevel)
        return

    slug = re.sub(r'[^\w\s-]', '', name.lower())
    slug = re.sub(r'[\s-]+', '_', slug).strip('_') or 'template'

    template = {
        'name': name,
        'description': data.get('description', ''),
        'createdAt': str(date.today()),
        'schemaVersion': data.get('schemaVersion', '0.3.0'),
        'parameters': data.get('parameters', {}),
    }

    os.makedirs(USER_TEMPLATES_DIR, exist_ok=True)
    filepath = os.path.join(USER_TEMPLATES_DIR, f'{slug}.json')

    if os.path.isfile(filepath):
        existing = _load_template_file(filepath)
        if existing and existing.get('name') != name:
            counter = 2
            while os.path.isfile(os.path.join(USER_TEMPLATES_DIR, f'{slug}_{counter}.json')):
                counter += 1
            slug = f'{slug}_{counter}'
            filepath = os.path.join(USER_TEMPLATES_DIR, f'{slug}.json')

    try:
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(template, f, indent=2)
        futil.log(f'{CMD_NAME}: Saved template "{name}" → {filepath}')
    except Exception as e:
        futil.log(f'{CMD_NAME}: Failed to save template: {e}',
                  adsk.core.LogLevels.ErrorLogLevel)
        return

    _on_get_templates()


def _on_delete_template(data_json):
    """Delete a user template file."""
    try:
        data = json.loads(data_json)
    except Exception as e:
        futil.log(f'{CMD_NAME}: Bad DELETE_TEMPLATE data: {e}',
                  adsk.core.LogLevels.ErrorLogLevel)
        return

    template_id = data.get('id', '')
    if not template_id:
        return

    safe_id = os.path.basename(template_id)
    filepath = os.path.join(USER_TEMPLATES_DIR, f'{safe_id}.json')

    if not os.path.abspath(filepath).startswith(os.path.abspath(USER_TEMPLATES_DIR)):
        futil.log(f'{CMD_NAME}: DELETE_TEMPLATE path traversal blocked: {template_id}',
                  adsk.core.LogLevels.WarningLogLevel)
        return

    if os.path.isfile(filepath):
        try:
            os.remove(filepath)
            futil.log(f'{CMD_NAME}: Deleted template: {filepath}')
        except Exception as e:
            futil.log(f'{CMD_NAME}: Failed to delete template: {e}',
                      adsk.core.LogLevels.ErrorLogLevel)
    else:
        futil.log(f'{CMD_NAME}: DELETE_TEMPLATE — file not found: {filepath}',
                  adsk.core.LogLevels.WarningLogLevel)

    _on_get_templates()


# ═══════════════════════════════════════════════════════════════════
# Template loading / importing
# ═══════════════════════════════════════════════════════════════════

def _build_template_payload(parameters: dict, mode: str, template_name: str = ''):
    """Build a model-state payload from schema defaults merged with parameter overrides."""
    schema = parameter_bridge.load_schema()
    if schema is None:
        return None

    design = adsk.fusion.Design.cast(app.activeProduct)
    doc_unit = parameter_bridge.get_document_unit(design) if design else 'in'
    is_metric = parameter_bridge.is_metric_length_unit(doc_unit)

    fingerprint = parameter_bridge.get_fingerprint(design) if design else None

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
            name = param_def['name']
            unit_kind = param_def.get('unitKind', 'length')
            if is_metric and unit_kind == 'length':
                metric_key = f'{name}_metric'
                expr = parameters.get(metric_key) or parameters.get(name) or param_def.get('defaultMetric') or param_def.get('default', '')
            else:
                expr = parameters.get(name, param_def.get('default', ''))
            try:
                numeric_value = float(expr) if expr else None
            except (ValueError, TypeError):
                numeric_value = None
            group['parameters'].append({
                'name': name,
                'label': param_def.get('label', name),
                'unitKind': unit_kind,
                'controlType': param_def.get('controlType', 'number'),
                'default': param_def.get('default', ''),
                'defaultMetric': param_def.get('defaultMetric'),
                'min': param_def.get('min'),
                'max': param_def.get('max'),
                'minMetric': param_def.get('minMetric'),
                'maxMetric': param_def.get('maxMetric'),
                'step': param_def.get('step'),
                'stepMetric': param_def.get('stepMetric'),
                'description': param_def.get('description', ''),
                'expression': expr,
                'value': numeric_value,
                'unit': parameter_bridge.get_unit_symbol(unit_kind, doc_unit),
            })
        groups.append(group)

    groups.sort(key=lambda g: g['order'])

    return {
        'schemaVersion': schema.get('schemaVersion', 'unknown'),
        'templateVersion': schema.get('templateVersion', 'unknown'),
        'groups': groups,
        'missing': [],
        'extra': [],
        'mode': mode,
        'templateName': template_name,
        'documentUnit': doc_unit,
        'fingerprint': fingerprint,
        'hasFingerprint': bool(fingerprint),
        'extraParams': [],
    }


def _on_load_template(data_json):
    """Load a template and push its parameter values to the UI."""
    try:
        data = json.loads(data_json)
    except Exception as e:
        futil.log(f'{CMD_NAME}: Bad LOAD_TEMPLATE data: {e}',
                  adsk.core.LogLevels.ErrorLogLevel)
        return

    template_id = data.get('id', '')
    is_readonly = data.get('readonly', False)

    safe_id = os.path.basename(template_id)
    base_dir = PRESETS_DIR if is_readonly else USER_TEMPLATES_DIR
    filepath = os.path.join(base_dir, f'{safe_id}.json')

    if not os.path.isfile(filepath):
        futil.log(f'{CMD_NAME}: LOAD_TEMPLATE — file not found: {filepath}',
                  adsk.core.LogLevels.WarningLogLevel)
        return

    template = _load_template_file(filepath)
    if not template:
        return

    parameters = template.get('parameters', {})
    payload = _build_template_payload(parameters, mode='template', template_name=template.get('name', ''))
    if payload is None:
        return

    palette = ui.palettes.itemById(PALETTE_ID)
    if palette:
        palette.sendInfoToHTML('PUSH_MODEL_STATE', json.dumps(payload))
    futil.log(f'{CMD_NAME}: Loaded template "{template.get("name")}" ({len(parameters)} params)')


def _on_import_share(data_json):
    """Import parameters from a share string and push to the UI."""
    try:
        data = json.loads(data_json)
    except Exception as e:
        futil.log(f'{CMD_NAME}: Bad IMPORT_SHARE data: {e}',
                  adsk.core.LogLevels.ErrorLogLevel)
        return

    parameters = data.get('parameters', {})
    if not parameters:
        futil.log(f'{CMD_NAME}: IMPORT_SHARE — no parameters provided',
                  adsk.core.LogLevels.WarningLogLevel)
        return

    payload = _build_template_payload(parameters, mode='imported')
    if payload is None:
        return

    palette = ui.palettes.itemById(PALETTE_ID)
    if palette:
        palette.sendInfoToHTML('PUSH_MODEL_STATE', json.dumps(payload))
    futil.log(f'{CMD_NAME}: Imported share data ({len(parameters)} params)')


# ═══════════════════════════════════════════════════════════════════
# Apply parameters (deferred — unique logic, not factory-generated)
# ═══════════════════════════════════════════════════════════════════

def _on_apply_params(data_json):
    """Queue parameter application — fires custom event for main thread."""
    global _pending_apply

    try:
        _pending_apply = json.loads(data_json)
    except Exception as e:
        futil.log(f'{CMD_NAME}: Bad APPLY_PARAMS data: {e}',
                  adsk.core.LogLevels.ErrorLogLevel)
        return

    palette = ui.palettes.itemById(PALETTE_ID)
    if palette:
        palette.sendInfoToHTML('COMPUTING', '{}')

    app.fireCustomEvent(_APPLY_EVENT_ID)


def _deferred_apply_handler(args: adsk.core.CustomEventArgs):
    """Runs on the Fusion main thread — does the actual apply work."""
    global _pending_apply, _owner_document

    pending = _pending_apply
    _pending_apply = None

    if pending is None:
        return

    param_values = pending.get('updates', {}) or {}
    creates = pending.get('creates', []) or []

    design = adsk.fusion.Design.cast(app.activeProduct)
    if not design:
        return

    # Open template on first apply
    if design.userParameters.count == 0:
        doc_unit = parameter_bridge.get_document_unit(design)
        template_file = 'fretboard_metric.f3d' if parameter_bridge.is_metric_length_unit(doc_unit) else 'fretboard_imperial.f3d'
        template_path = os.path.join(TEMPLATES_DIR, template_file)

        if not os.path.isfile(template_path):
            futil.log(f'{CMD_NAME}: Template not found: {template_path}',
                      adsk.core.LogLevels.ErrorLogLevel)
            ui.messageBox(f'Template file not found: {template_file}',
                         f'{CMD_NAME}', adsk.core.MessageBoxButtonIds.OKButtonId)
            return

        original_doc = design.parentDocument

        import_manager = app.importManager
        import_options = import_manager.createFusionArchiveImportOptions(template_path)
        template_doc = import_manager.importToNewDocument(import_options)
        template_doc.activate()
        futil.log(f'{CMD_NAME}: Opened template in new document')

        _owner_document = template_doc

        if original_doc and original_doc != template_doc:
            try:
                orig_design = adsk.fusion.Design.cast(original_doc.products.itemByProductType('DesignProductType'))
                is_virgin = (
                    orig_design is not None
                    and orig_design.userParameters.count == 0
                    and orig_design.timeline.count == 0
                    and orig_design.rootComponent.bRepBodies.count == 0
                    and orig_design.rootComponent.sketches.count == 0
                    and orig_design.rootComponent.occurrences.count == 0
                )
                if is_virgin:
                    original_doc.close(False)
                    futil.log(f'{CMD_NAME}: Closed empty original document')
                else:
                    futil.log(f'{CMD_NAME}: Original document is not empty, leaving open')
            except Exception as e:
                futil.log(f'{CMD_NAME}: Could not close original document: {e}')

        design = adsk.fusion.Design.cast(app.activeProduct)
        if not design:
            futil.log(f'{CMD_NAME}: Could not acquire design after open',
                      adsk.core.LogLevels.ErrorLogLevel)
            return

        parameter_bridge.set_fingerprint(design)

    result = parameter_bridge.apply_parameters(design, param_values, creates=creates)
    futil.log(f'{CMD_NAME}: Apply result: {result}')

    _on_refresh_request()


# ═══════════════════════════════════════════════════════════════════
# Parameter CRUD handlers
# ═══════════════════════════════════════════════════════════════════

def _on_set_param_category(data_json):
    """Update the group assignment for a user parameter."""
    try:
        data = json.loads(data_json)
    except Exception as e:
        futil.log(f'{CMD_NAME}: Bad SET_PARAM_CATEGORY data: {e}',
                  adsk.core.LogLevels.ErrorLogLevel)
        return

    design = adsk.fusion.Design.cast(app.activeProduct)
    if not design:
        return

    result = parameter_bridge.set_param_group(design, data.get('name', ''), data.get('groupId', ''))
    futil.log(f'{CMD_NAME}: SET_PARAM_CATEGORY {data.get("name", "")!r} -> {data.get("groupId", "")!r}: {result}')
    _on_refresh_request()


def _on_edit_param(data_json):
    """Rename a user parameter, update its description, and/or change its group."""
    try:
        data = json.loads(data_json)
    except Exception as e:
        futil.log(f'{CMD_NAME}: Bad EDIT_PARAM data: {e}',
                  adsk.core.LogLevels.ErrorLogLevel)
        return

    design = adsk.fusion.Design.cast(app.activeProduct)
    if not design:
        return

    old_name = data.get('oldName', '')
    new_name = data.get('newName', old_name)
    result = parameter_bridge.edit_param(design, old_name, new_name,
                                          data.get('description', ''), data.get('groupId', ''))
    futil.log(f'{CMD_NAME}: EDIT_PARAM {old_name!r} -> {new_name!r}: {result}')
    _on_refresh_request()


def _on_delete_param(data_json):
    """Delete a user parameter from the design."""
    try:
        data = json.loads(data_json)
    except Exception as e:
        futil.log(f'{CMD_NAME}: Bad DELETE_PARAM data: {e}',
                  adsk.core.LogLevels.ErrorLogLevel)
        return

    design = adsk.fusion.Design.cast(app.activeProduct)
    if not design:
        return

    param_name = data.get('name', '')
    result = parameter_bridge.delete_param(design, param_name)
    futil.log(f'{CMD_NAME}: DELETE_PARAM {param_name!r}: {result}')
    _on_refresh_request()


# ═══════════════════════════════════════════════════════════════════
# Timeline management (deferred — unique logic, not factory-generated)
# ═══════════════════════════════════════════════════════════════════

def _on_get_group_states():
    """Send curated group suppression states to the UI."""
    design = adsk.fusion.Design.cast(app.activeProduct)
    if not design:
        return

    states = parameter_bridge.get_group_states(design)
    palette = ui.palettes.itemById(PALETTE_ID)
    if palette:
        palette.sendInfoToHTML('PUSH_GROUP_STATES', json.dumps({'groups': states}))
    futil.log(f'{CMD_NAME}: Sent {len(states)} group state(s)')


def _queue_timeline_op(action: str, data_json: str):
    """Queue a timeline operation to run on the Fusion main thread."""
    global _pending_timeline_op
    try:
        data = json.loads(data_json)
    except Exception as e:
        futil.log(f'{CMD_NAME}: Bad {action} data: {e}',
                  adsk.core.LogLevels.ErrorLogLevel)
        return

    futil.log(f'{CMD_NAME}: Queueing {action} with {len(data.get("changes", []))} change(s)')
    _pending_timeline_op = {'action': action, 'data': data}
    app.fireCustomEvent(_TIMELINE_EVENT_ID)


def _deferred_timeline_handler(args: adsk.core.CustomEventArgs):
    """Runs on the Fusion main thread — performs batch timeline changes."""
    global _pending_timeline_op

    op = _pending_timeline_op
    _pending_timeline_op = None

    if op is None or op['action'] != 'APPLY_TIMELINE_CHANGES':
        return

    changes = op['data'].get('changes', [])
    futil.log(f'{CMD_NAME}: Applying {len(changes)} timeline change(s)')

    design = adsk.fusion.Design.cast(app.activeProduct)
    if not design:
        futil.log(f'{CMD_NAME}: No active design',
                  adsk.core.LogLevels.ErrorLogLevel)
        return

    success_count = 0
    failed = []

    for change in changes:
        name = change.get('name', '')
        item_type = change.get('type', 'Feature')
        target_suppressed = change.get('suppressed', False)

        action_name = f"{'suppress' if target_suppressed else 'unsuppress'} {item_type.lower()} '{name}'"
        try:
            if item_type == 'Group':
                if target_suppressed:
                    result = parameter_bridge.suppress_group_with_contents(design, name)
                else:
                    result = parameter_bridge.unsuppress_group_with_contents(design, name)
            else:
                if target_suppressed:
                    result = parameter_bridge.suppress_timeline_item(design, name)
                else:
                    result = parameter_bridge.unsuppress_timeline_item(design, name)

            if result.get('success'):
                futil.log(f'{CMD_NAME}: {action_name} OK')
                success_count += 1
            else:
                futil.log(f'{CMD_NAME}: {action_name} FAILED: {result.get("message", "?")}',
                          adsk.core.LogLevels.ErrorLogLevel)
                failed.append(name)
        except Exception as e:
            futil.log(f'{CMD_NAME}: {action_name} error: {e}',
                      adsk.core.LogLevels.ErrorLogLevel)
            failed.append(name)

    result = {
        'success': len(failed) == 0,
        'message': f'Applied {success_count} change(s)' + (f' ({len(failed)} failed)' if failed else ''),
        'successCount': success_count,
        'failed': failed,
    }

    futil.log(f'{CMD_NAME}: Timeline result: {result["message"]}')

    palette = ui.palettes.itemById(PALETTE_ID)
    if palette:
        palette.sendInfoToHTML('TIMELINE_OPERATION_RESULT', json.dumps(result))


# ═══════════════════════════════════════════════════════════════════
# Document Lifecycle
# ═══════════════════════════════════════════════════════════════════

def on_document_activated(args: adsk.core.DocumentEventArgs):
    """Hide/show the palette based on which document is active."""
    global _owner_document

    palette = ui.palettes.itemById(PALETTE_ID)
    if not palette:
        return

    active_doc = args.document

    if _owner_document and active_doc != _owner_document:
        palette.isVisible = False
        futil.log(f'{CMD_NAME}: Hiding palette (switched to different document)')


