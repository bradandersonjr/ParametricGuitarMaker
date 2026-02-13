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

# ── Deferred apply event ─────────────────────────────────────────────
_APPLY_EVENT_ID = f'{config.COMPANY_NAME}_{config.ADDIN_NAME}_applyParams'
_pending_apply = None   # param_values dict waiting for deferred execution

# ── Deferred timeline event ──────────────────────────────────────────
_TIMELINE_EVENT_ID = f'{config.COMPANY_NAME}_{config.ADDIN_NAME}_timelineOp'
_pending_timeline_op = None  # {'action': str, 'data': dict}

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
USER_TEMPLATES_DIR = os.path.join(
    os.environ.get('APPDATA', os.path.expanduser('~')),
    'ParametricGuitarFretboardMaker', 'templates'
)

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

def start(is_startup=False):
    """Register the toolbar button when the add-in starts."""
    cmd_def = ui.commandDefinitions.addButtonDefinition(
        CMD_ID, CMD_NAME, CMD_DESCRIPTION, ICON_FOLDER
    )
    futil.add_handler(cmd_def.commandCreated, command_created)

    workspace = ui.workspaces.itemById(WORKSPACE_ID)
    panel = workspace.toolbarPanels.itemById(PANEL_ID)
    control = panel.controls.addCommand(cmd_def, COMMAND_BESIDE_ID if COMMAND_BESIDE_ID else '', False)
    control.isPromoted = IS_PROMOTED

    # Listen for document activation changes
    futil.add_handler(app.documentActivated, on_document_activated)

    # Register custom event for deferred parameter apply
    apply_event = app.registerCustomEvent(_APPLY_EVENT_ID)
    futil.add_handler(apply_event, _deferred_apply_handler)

    # Register custom event for deferred timeline operations
    timeline_event = app.registerCustomEvent(_TIMELINE_EVENT_ID)
    futil.add_handler(timeline_event, _deferred_timeline_handler)

    # Show welcome message when manually run, but not on Fusion startup
    if not is_startup:
        ui.messageBox(
            f'{CMD_NAME} has been added to the SOLID tab under the CREATE drop-down menu.\n\n'
            'Click the button to design custom guitar fretboards with precise parameter control.',
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

    app.unregisterCustomEvent(_APPLY_EVENT_ID)
    app.unregisterCustomEvent(_TIMELINE_EVENT_ID)


# ── Event handlers ──────────────────────────────────────────────────

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

        # ── Build payload ────────────────────────────────────────────────
        # If the fingerprint parameter exists, this design was created with the app
        # — go straight to live mode. Otherwise show schema defaults for first-time import.
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

        # ── Show the palette ────────────────────────────────────────────
        _show_palette(payload)
    except Exception as e:
        futil.log(f'{CMD_NAME}: command_execute error: {e}', adsk.core.LogLevels.ErrorLogLevel)
        ui.messageBox(f'Error opening palette: {str(e)}', CMD_NAME)


def _show_palette(payload):
    """Create or show the palette and send parameter data."""
    global _pending_payload, _owner_document

    # Track which document owns this palette
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

    # Dock at left if floating
    if palette.dockingState == adsk.core.PaletteDockingStates.PaletteDockStateFloating:
        palette.dockingState = adsk.core.PaletteDockingStates.PaletteDockStateLeft

    if is_new:
        # HTML not loaded yet — stash payload for the 'ready' signal
        _pending_payload = payload
        futil.log(f'{CMD_NAME}: Waiting for JS ready signal...')
    else:
        # Palette exists, JS loaded — send immediately
        _send_payload(palette, payload)


def _send_payload(palette, payload):
    """Send the parameter payload to the JS UI."""
    data_json = json.dumps(payload)
    palette.sendInfoToHTML('PUSH_MODEL_STATE', data_json)
    futil.log(f'{CMD_NAME}: Sent payload to palette '
              f'({sum(len(g["parameters"]) for g in payload["groups"])} params)')


# ── Palette event handlers ──────────────────────────────────────────

def _on_open_url(data_json):
    """Called when the UI requests opening a URL in the default browser."""
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
        os.startfile(USER_TEMPLATES_DIR)
        futil.log(f'{CMD_NAME}: Opened templates folder: {USER_TEMPLATES_DIR}')
    except Exception as e:
        futil.log(f'{CMD_NAME}: Error opening templates folder: {e}',
                  adsk.core.LogLevels.ErrorLogLevel)


def _load_template_file(filepath):
    """Load a template JSON file and return the dict, or None on error."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        futil.log(f'{CMD_NAME}: Failed to read template {filepath}: {e}',
                  adsk.core.LogLevels.ErrorLogLevel)
        return None


def _build_template_list():
    """Scan preset and user template dirs and return PUSH_TEMPLATES payload."""
    schema_version = '0.3.0'
    try:
        schema = parameter_bridge.load_schema()
        if schema:
            schema_version = schema.get('schemaVersion', schema_version)
    except Exception:
        pass

    presets = []
    if os.path.isdir(PRESETS_DIR):
        for fname in sorted(os.listdir(PRESETS_DIR)):
            if not fname.endswith('.json'):
                continue
            data = _load_template_file(os.path.join(PRESETS_DIR, fname))
            if data:
                presets.append({
                    'id': fname[:-5],
                    'name': data.get('name', fname[:-5]),
                    'description': data.get('description', ''),
                    'createdAt': data.get('createdAt', ''),
                    'schemaVersion': data.get('schemaVersion', schema_version),
                    'readonly': True,
                    'parameters': data.get('parameters', {}),
                })

    os.makedirs(USER_TEMPLATES_DIR, exist_ok=True)
    user_templates = []
    for fname in sorted(os.listdir(USER_TEMPLATES_DIR)):
        if not fname.endswith('.json'):
            continue
        data = _load_template_file(os.path.join(USER_TEMPLATES_DIR, fname))
        if data:
            user_templates.append({
                'id': fname[:-5],
                'name': data.get('name', fname[:-5]),
                'description': data.get('description', ''),
                'createdAt': data.get('createdAt', ''),
                'schemaVersion': data.get('schemaVersion', schema_version),
                'readonly': False,
                'parameters': data.get('parameters', {}),
            })

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

    # Slugify: keep alphanumeric, spaces→underscores, strip rest
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

    # Append a counter if the slug already exists and is a different template
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

    # Respond with updated list
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

    # Sanitize: strip path separators to prevent traversal
    safe_id = os.path.basename(template_id)
    filepath = os.path.join(USER_TEMPLATES_DIR, f'{safe_id}.json')

    # Verify the resolved path is inside USER_TEMPLATES_DIR
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

    # Build a model-state payload using schema defaults merged with template values
    pb = parameter_bridge
    schema = pb.load_schema()
    if schema is None:
        return

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
            expr = parameters.get(name, param_def.get('default', ''))
            try:
                numeric_value = float(expr) if expr else None
            except (ValueError, TypeError):
                numeric_value = None
            unit_kind = param_def.get('unitKind', 'length')
            group['parameters'].append({
                'name': name,
                'label': param_def.get('label', name),
                'unitKind': unit_kind,
                'controlType': param_def.get('controlType', 'number'),
                'default': param_def.get('default', ''),
                'min': param_def.get('min'),
                'max': param_def.get('max'),
                'step': param_def.get('step'),
                'description': param_def.get('description', ''),
                'expression': expr,
                'value': numeric_value,
                'unit': parameter_bridge.get_unit_symbol(unit_kind),
            })
        groups.append(group)

    groups.sort(key=lambda g: g['order'])

    design = adsk.fusion.Design.cast(app.activeProduct)
    doc_unit = parameter_bridge.get_document_unit(design) if design else 'in'

    payload = {
        'schemaVersion': schema.get('schemaVersion', 'unknown'),
        'templateVersion': schema.get('templateVersion', 'unknown'),
        'groups': groups,
        'missing': [],
        'extra': [],
        'mode': 'template',
        'templateName': template.get('name', ''),
        'documentUnit': doc_unit,
    }

    palette = ui.palettes.itemById(PALETTE_ID)
    if palette:
        palette.sendInfoToHTML('PUSH_MODEL_STATE', json.dumps(payload))
    futil.log(f'{CMD_NAME}: Loaded template "{template.get("name")}" ({len(parameters)} params)')


def palette_incoming(args: adsk.core.HTMLEventArgs):
    """Handle messages from the JS palette UI."""
    action = args.action
    futil.log(f'{CMD_NAME}: Palette incoming — action: {action}')

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

    elif action == 'GET_TIMELINE_ITEMS':
        _on_get_timeline_items()

    elif action == 'APPLY_TIMELINE_CHANGES':
        _queue_timeline_op('APPLY_TIMELINE_CHANGES', args.data)

    elif action == 'GET_TIMELINE_SUMMARY':
        _on_get_timeline_summary()

    elif action == 'response':
        pass  # Fusion internal acknowledgment — ignore

    else:
        futil.log(f'{CMD_NAME}: Unknown palette action: {action}')


def _on_palette_ready():
    """Called when the JS UI signals it has finished loading."""
    global _pending_payload
    if _pending_payload is not None:
        palette = ui.palettes.itemById(PALETTE_ID)
        if palette:
            _send_payload(palette, _pending_payload)
        _pending_payload = None


def _on_refresh_request():
    """Called when the UI requests a fresh read of the model state."""
    design = adsk.fusion.Design.cast(app.activeProduct)
    if not design:
        return

    payload = parameter_bridge.build_ui_payload(design)
    if payload:
        palette = ui.palettes.itemById(PALETTE_ID)
        if palette:
            _send_payload(palette, payload)


def _on_apply_params(data_json):
    """Called when the UI sends parameter changes to apply.

    Immediately sends COMPUTING to JS so it can repaint, then fires a
    custom event to do the actual work on the next Fusion event loop tick.
    """
    global _pending_apply

    try:
        _pending_apply = json.loads(data_json)
    except Exception as e:
        futil.log(f'{CMD_NAME}: Bad APPLY_PARAMS data: {e}',
                  adsk.core.LogLevels.ErrorLogLevel)
        return

    # Tell the UI we're working — it can repaint now before we block
    palette = ui.palettes.itemById(PALETTE_ID)
    if palette:
        palette.sendInfoToHTML('COMPUTING', '{}')

    # Fire the custom event — actual work happens in _deferred_apply_handler
    app.fireCustomEvent(_APPLY_EVENT_ID)


def _deferred_apply_handler(args: adsk.core.CustomEventArgs):
    """Runs on the next Fusion event loop tick — does the actual apply work."""
    global _pending_apply, _owner_document

    param_values = _pending_apply
    _pending_apply = None

    if param_values is None:
        return

    design = adsk.fusion.Design.cast(app.activeProduct)
    if not design:
        return

    # ── Open template on first apply ─────────────────────────────
    if design.userParameters.count == 0:
        template_file = 'fretboard_imperial.f3d'
        template_path = os.path.join(TEMPLATES_DIR, template_file)

        if not os.path.isfile(template_path):
            futil.log(f'{CMD_NAME}: Template not found: {template_path}',
                      adsk.core.LogLevels.ErrorLogLevel)
            ui.messageBox(f'Template file not found: {template_file}',
                         f'{CMD_NAME}', adsk.core.MessageBoxButtonIds.OKButtonId)
            return

        import_manager = app.importManager
        import_options = import_manager.createFusionArchiveImportOptions(template_path)
        template_doc = import_manager.importToNewDocument(import_options)
        template_doc.activate()
        futil.log(f'{CMD_NAME}: Opened template in new document')

        _owner_document = template_doc

        design = adsk.fusion.Design.cast(app.activeProduct)
        if not design:
            futil.log(f'{CMD_NAME}: Could not acquire design after open',
                      adsk.core.LogLevels.ErrorLogLevel)
            return

        parameter_bridge.set_fingerprint(design)

    # ── Apply parameter changes ───────────────────────────────────
    result = parameter_bridge.apply_parameters(design, param_values)
    futil.log(f'{CMD_NAME}: Apply result: {result}')

    # Push updated live state back to the UI
    _on_refresh_request()


# ── Timeline management handlers ─────────────────────────────────

def _on_get_timeline_items():
    """Send all timeline items to the UI."""
    design = adsk.fusion.Design.cast(app.activeProduct)
    if not design:
        return

    items = parameter_bridge.get_timeline_items(design)
    payload = {'items': items}

    palette = ui.palettes.itemById(PALETTE_ID)
    if palette:
        palette.sendInfoToHTML('PUSH_TIMELINE_ITEMS', json.dumps(payload))
    futil.log(f'{CMD_NAME}: Sent {len(items)} timeline item(s)')


def _queue_timeline_op(action: str, data_json: str):
    """Queue a timeline operation to run on the Fusion main thread.

    The palette incomingFromHTML handler runs on a thread where design
    modifications are not allowed.  We store the operation and fire a custom
    event so it executes on the next Fusion event-loop tick.
    """
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
            futil.log(f'{CMD_NAME}: {action_name}...')
            if item_type == 'Group':
                if target_suppressed:
                    parameter_bridge.suppress_group_with_contents(design, name)
                else:
                    parameter_bridge.unsuppress_group_with_contents(design, name)
            else:  # Feature
                if target_suppressed:
                    parameter_bridge.suppress_timeline_item(design, name)
                else:
                    parameter_bridge.unsuppress_timeline_item(design, name)
            futil.log(f'{CMD_NAME}: ✓ {action_name}')
            success_count += 1
        except Exception as e:
            futil.log(f'{CMD_NAME}: ✗ {action_name}: {e}',
                      adsk.core.LogLevels.ErrorLogLevel)
            failed.append(name)

    result = {
        'success': len(failed) == 0,
        'message': f'Applied {success_count} change(s)' + (f' ({len(failed)} failed)' if failed else ''),
        'successCount': success_count,
        'failed': failed,
    }

    futil.log(f'{CMD_NAME}: Timeline batch result: {result["message"]}')

    palette = ui.palettes.itemById(PALETTE_ID)
    if palette:
        palette.sendInfoToHTML('TIMELINE_OPERATION_RESULT', json.dumps(result))


def _on_get_timeline_summary():
    """Send timeline summary to the UI."""
    design = adsk.fusion.Design.cast(app.activeProduct)
    if not design:
        return

    summary = parameter_bridge.get_timeline_summary(design)
    palette = ui.palettes.itemById(PALETTE_ID)
    if palette:
        palette.sendInfoToHTML('PUSH_TIMELINE_SUMMARY', json.dumps(summary))
    futil.log(f'{CMD_NAME}: Sent timeline summary')


def palette_closed(args: adsk.core.UserInterfaceGeneralEventArgs):
    """Called when the user closes the palette."""
    futil.log(f'{CMD_NAME}: Palette closed')


def _close_palette():
    """Hide the palette."""
    palette = ui.palettes.itemById(PALETTE_ID)
    if palette:
        palette.isVisible = False


def command_destroy(args: adsk.core.CommandEventArgs):
    """Clean up local handlers when the command ends."""
    futil.log(f'{CMD_NAME}: Command Destroy')
    global local_handlers
    local_handlers = []


# ── Document Lifecycle ──────────────────────────────────────────────

def on_document_activated(args: adsk.core.DocumentEventArgs):
    """Hide/show the palette based on which document is active."""
    global _owner_document
    
    palette = ui.palettes.itemById(PALETTE_ID)
    if not palette:
        return
    
    # Get the newly activated document
    active_doc = args.document

    # Hide palette if switching away from owner document
    if _owner_document and active_doc != _owner_document:
        palette.isVisible = False
        futil.log(f'{CMD_NAME}: Hiding palette (switched to different document)')
