"""
Schema loader — loads and caches the parameter schema JSON.

Extracted from parameter_bridge.py for cleaner separation of concerns.
"""

import json
import os
import adsk.core

from . import fusionAddInUtils as futil
from .. import config

# ── Schema path & cache ──────────────────────────────────────────────
SCHEMA_PATH = os.path.join(config.ADDIN_ROOT, 'schema', 'parameters.schema.json')
_schema_cache = None
_editable_names_cache = None


def load_schema():
    """Load and return the parameter schema dict (cached after first load).

    Returns:
        dict: The parsed schema, or None if the file is missing/invalid.
    """
    global _schema_cache
    if _schema_cache is not None:
        return _schema_cache

    if not os.path.isfile(SCHEMA_PATH):
        futil.log(f'Schema: Schema file not found: {SCHEMA_PATH}',
                  adsk.core.LogLevels.ErrorLogLevel)
        return None
    try:
        with open(SCHEMA_PATH, 'r', encoding='utf-8') as f:
            _schema_cache = json.load(f)
        return _schema_cache
    except Exception as e:
        futil.log(f'Schema: Failed to load schema: {e}',
                  adsk.core.LogLevels.ErrorLogLevel)
        return None


def get_editable_names():
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
