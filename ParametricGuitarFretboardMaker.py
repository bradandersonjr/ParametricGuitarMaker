# Parametric Guitar: Fretboard Maker — Fusion Add-in Entry Point
# This file is loaded by Fusion when the add-in starts.

from . import commands
from .lib import fusionAddInUtils as futil


def run(context):
    try:
        commands.start()
    except Exception:
        futil.handle_error('run')


def stop(context):
    try:
        futil.clear_handlers()
        commands.stop()
    except Exception:
        futil.handle_error('stop')
