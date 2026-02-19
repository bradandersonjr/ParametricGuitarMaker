"""
User preferences persistence — synced between frontend localStorage and filesystem.
Stores user settings like group order, reports precision, etc.
"""

import json
import os
from typing import Any, Dict, Optional
from .. import config
from . import fusionAddInUtils as futil

# Path to preferences file in add-in root
PREFS_FILE = os.path.join(config.ADDIN_ROOT, 'preferences.json')

# Default preferences structure
DEFAULTS: Dict[str, Any] = {
    'betaDisclaimerDismissedVersion': None,
    'reportsPrecision': 4,
    'groupOrder': None,
}


def load_preferences() -> Dict[str, Any]:
    """Load preferences from file, merging with defaults.

    Returns the merged preferences dict. If the file doesn't exist or is
    corrupted, uses defaults and writes them to the file.
    """
    prefs = DEFAULTS.copy()

    if not os.path.exists(PREFS_FILE):
        futil.log(f'Preferences file not found, creating with defaults: {PREFS_FILE}',
                  force_console=True)
        save_preferences(prefs)
        return prefs

    try:
        with open(PREFS_FILE, 'r', encoding='utf-8') as f:
            stored = json.load(f)

        if isinstance(stored, dict):
            # Merge stored with defaults to handle new keys gracefully
            prefs.update(stored)
            futil.log(f'Loaded preferences from {PREFS_FILE}', force_console=True)
        else:
            futil.log(f'Preferences file has invalid format, using defaults',
                      force_console=True)
            save_preferences(prefs)
    except json.JSONDecodeError as e:
        futil.log(f'Failed to parse preferences file: {e}, using defaults',
                  force_console=True)
        save_preferences(prefs)
    except Exception as e:
        futil.log(f'Error reading preferences: {e}, using defaults',
                  force_console=True)
        save_preferences(prefs)

    return prefs


def save_preferences(prefs: Dict[str, Any]) -> bool:
    """Save preferences to file.

    Args:
        prefs: Dictionary of preferences to save

    Returns:
        True if successful, False otherwise
    """
    try:
        # Ensure parent directory exists
        os.makedirs(os.path.dirname(PREFS_FILE), exist_ok=True)

        with open(PREFS_FILE, 'w', encoding='utf-8') as f:
            json.dump(prefs, f, indent=2)

        futil.log(f'Saved preferences to {PREFS_FILE}', force_console=True)
        return True
    except Exception as e:
        futil.log(f'Error saving preferences: {e}',
                  force_console=True)
        return False


def update_preferences(patch: Dict[str, Any]) -> Dict[str, Any]:
    """Update specific preference keys while preserving others.

    Args:
        patch: Dictionary of keys to update

    Returns:
        The updated preferences dict
    """
    prefs = load_preferences()
    prefs.update(patch)
    save_preferences(prefs)
    return prefs
