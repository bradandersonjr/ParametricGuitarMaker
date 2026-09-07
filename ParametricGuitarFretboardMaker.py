"""Parametric Guitar: Fretboard Maker - designs fretboards from driven parameters.

A fretboard is defined by scale length, fret count, nut and end widths, and a
radius that may be straight, compound or flat. Driving all of that from Fusion
user parameters by hand means editing dozens of values in the Parameters dialog
and recomputing fret spacing manually.

This add-in puts the whole parameter set behind an HTML palette backed by a JSON
schema, writes the values into the design as user parameters, and fingerprints
the document so reopening it restores the same UI state.

This file delegates to the command registry and holds no logic of its own.
Command code lives in commands/fretboardMaker/entry.py.

Requires Autodesk Fusion (the adsk modules only exist inside Fusion's Python).
"""

__author__ = 'brad anderson jr.'
__copyright__ = 'Copyright (c) 2026 brad anderson jr.'
__license__ = 'MIT'
__version__ = '0.3.2'
__maintainer__ = 'brad anderson jr.'
__email__ = 'brad@bradandersonjr.com'
__status__ = 'Development'

from . import commands
from .lib import fusionAddInUtils as futil


def run(context):
    try:
        is_startup = context.get('IsApplicationStartup', False) if isinstance(context, dict) else False
        commands.start(is_startup=is_startup)
    except Exception:
        futil.handle_error('run')


def stop(context):
    try:
        futil.clear_handlers()
        commands.stop()
    except Exception:
        futil.handle_error('stop')
