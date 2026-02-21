"""
Deferred operation factory — eliminates repeated queue/handler boilerplate in entry.py.

Fusion's palette incomingFromHTML handler runs on a background thread where
design modifications are not allowed. Each operation must:
  1. Parse the JSON data from the palette
  2. Store it in a pending variable
  3. Fire a custom event
  4. Handle the event on the main Fusion thread
  5. Send a result back to the palette
  6. Optionally refresh group states

This module provides a factory that generates queue/handler function pairs
from a simple configuration, replacing ~30 lines of boilerplate per operation.
"""

import json
import adsk.core
import adsk.fusion

from . import fusionAddInUtils as futil
from .. import config

app = adsk.core.Application.get()


def make_deferred_op(
    event_id_suffix: str,
    action_name: str,
    handler_fn,
    result_action: str,
    auto_refresh_groups: bool = True,
    palette_id: str = None,
    cmd_name: str = 'Parametric Guitar: Fretboard Maker',
):
    """Create a queue function and deferred handler for a Fusion custom event.

    Args:
        event_id_suffix: Unique suffix for the custom event ID (e.g., 'zeroFretOp').
        action_name: Human-readable name for logging (e.g., 'zero-fret toggle').
        handler_fn: Callable(design, op_data) -> dict with 'success' and 'message' keys.
        result_action: The palette action name to send results back (e.g., 'ZERO_FRET_RESULT').
        auto_refresh_groups: If True, sends GET_GROUP_STATES after the operation completes.
        palette_id: Palette ID to send results to. Defaults to config.PALETTE_ID.
        cmd_name: Command name for logging.

    Returns:
        tuple: (event_id, pending_holder, queue_fn, deferred_handler_fn)
            - event_id: str — register this with app.registerCustomEvent()
            - pending_holder: dict — mutable container with a 'data' key for the pending op
            - queue_fn: callable(data_json: str) — call from palette_incoming
            - deferred_handler_fn: callable(args) — register as custom event handler
    """
    _palette_id = palette_id or config.PALETTE_ID
    event_id = f'{config.COMPANY_NAME}_{config.ADDIN_NAME}_{event_id_suffix}'
    pending = {'data': None}

    def queue_fn(data_json: str):
        try:
            data = json.loads(data_json)
        except Exception as e:
            futil.log(f'{cmd_name}: Bad {action_name} data: {e}',
                      adsk.core.LogLevels.ErrorLogLevel)
            return

        futil.log(f'{cmd_name}: Queueing {action_name}')
        pending['data'] = data
        app.fireCustomEvent(event_id)

    def deferred_handler_fn(args):
        op = pending['data']
        pending['data'] = None

        if op is None:
            return

        design = adsk.fusion.Design.cast(app.activeProduct)
        if not design:
            futil.log(f'{cmd_name}: {action_name} — no active design',
                      adsk.core.LogLevels.ErrorLogLevel)
            return

        result = handler_fn(design, op)
        futil.log(f'{cmd_name}: {action_name} result: {result.get("message", "?")}')

        palette = app.userInterface.palettes.itemById(_palette_id)
        if palette:
            palette.sendInfoToHTML(result_action, json.dumps(result))

        if auto_refresh_groups:
            from . import parameter_bridge
            states = parameter_bridge.get_group_states(design)
            if palette:
                palette.sendInfoToHTML('PUSH_GROUP_STATES', json.dumps({'groups': states}))

    return event_id, pending, queue_fn, deferred_handler_fn
