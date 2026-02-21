"""
Fingerprint detection — identifies designs created with this add-in.

Extracted from parameter_bridge.py for cleaner separation of concerns.
"""

import adsk.core
import adsk.fusion

from . import fusionAddInUtils as futil

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
        futil.log(f'Fingerprint: Added {FINGERPRINT_PARAM} = {FINGERPRINT_VALUE}')
    except Exception as e:
        futil.log(f'Fingerprint: Failed to add FretboardFingerPrint: {e}',
                  adsk.core.LogLevels.WarningLogLevel)
