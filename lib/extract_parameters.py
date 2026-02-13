#!/usr/bin/env python3
"""
Extract Parameters from Fusion Design File

This script extracts all user parameters from a Fusion (.f3d) design file
and compares them against the parameter schema.

IMPORTANT: This script MUST BE RUN FROM WITHIN FUSION:
  1. Open the design file in Fusion
  2. Tools > Python Console
  3. Copy-paste this script and run it

OR use the command-line version:
  python extract_parameters_headless.py <f3d_file_path>

Usage:
  - From Fusion console: Copy entire script and paste
  - From command line: python extract_parameters.py
"""

import json
import os
import sys
import textwrap
from pathlib import Path
from tabulate import tabulate

# Determine the add-in root directory
ADDIN_ROOT = Path(__file__).parent.absolute()
SCHEMA_PATH = ADDIN_ROOT / 'schema' / 'parameters.schema.json'
TEMPLATE_PATH = ADDIN_ROOT / 'templates' / 'fretboard_imperial.f3d'


def load_schema():
    """Load the parameter schema."""
    if not SCHEMA_PATH.exists():
        print(f"ERROR: Schema not found: {SCHEMA_PATH}")
        return None

    try:
        with open(SCHEMA_PATH, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"ERROR: Failed to load schema: {e}")
        return None


def get_user_parameters_from_design(design):
    """Extract user parameters from a Fusion design object.

    This function REQUIRES the Fusion API and must be called
    from within Fusion or an environment with the adsk modules.
    """
    try:
        import adsk.core
        import adsk.fusion
    except ImportError:
        print("ERROR: adsk modules not available. This function must be run within Fusion.")
        return None

    result = {}
    user_params = design.userParameters

    for i in range(user_params.count):
        p = user_params.item(i)
        result[p.name] = {
            'name': p.name,
            'expression': p.expression,
            'value': p.value,  # internal value (always cm)
            'unit': p.unit,
            'comment': p.comment or '',
        }

    return result


def extract_from_active_design():
    """Extract parameters from the currently open Fusion design."""
    try:
        import adsk.core
        import adsk.fusion
    except ImportError:
        print("ERROR: adsk modules not available.")
        return None

    app = adsk.core.Application.get()
    product = app.activeProduct

    if not isinstance(product, adsk.fusion.Design):
        print("ERROR: No Fusion design is currently open.")
        return None

    design = product
    schema = load_schema()

    if schema is None:
        return None

    live_params = get_user_parameters_from_design(design)

    print("\n" + "=" * 100)
    print("FUSION PARAMETER EXTRACTION REPORT")
    print("=" * 100)
    print(f"Schema Version: {schema.get('schemaVersion', 'unknown')}")
    print(f"Template Version: {schema.get('templateVersion', 'unknown')}")
    print(f"Total Parameters Defined in Schema: {sum(len(g.get('parameters', [])) for g in schema.get('groups', []))}")
    print(f"Parameters Found in Design: {len(live_params)}")

    # Build comparison
    schema_param_names = set()
    for group_def in schema.get('groups', []):
        for param_def in group_def.get('parameters', []):
            schema_param_names.add(param_def['name'])

    missing = [name for name in schema_param_names if name not in live_params]
    extra = [name for name in live_params if name not in schema_param_names]

    print(f"\nMissing Parameters: {len(missing)}")
    if missing:
        for name in sorted(missing)[:10]:
            print(f"  - {name}")
        if len(missing) > 10:
            print(f"  ... and {len(missing) - 10} more")

    print(f"\nExtra Parameters (not in schema): {len(extra)}")
    if extra:
        for name in sorted(extra):
            print(f"  - {name}")

    # Display all parameters
    print("\n" + "=" * 100)
    print("DETAILED PARAMETER LIST")
    print("=" * 100)

    for group_def in schema.get('groups', []):
        group_label = group_def.get('label', 'Unknown')
        print(f"\n{group_label}")
        print("-" * 100)

        table_data = []
        for param_def in group_def.get('parameters', []):
            name = param_def['name']
            label = param_def.get('label', name)

            if name in live_params:
                live = live_params[name]
                expr = live['expression']
                value = live['value']
                unit = live['unit']
                status = "FOUND"
            else:
                expr = param_def.get('default', '')
                value = "(not set)"
                unit = ""
                status = "MISSING"

            table_data.append([
                label,
                name,
                expr,
                value,
                unit,
                status,
            ])

        if table_data:
            headers = ["Label", "Name", "Expression", "Value", "Unit", "Status"]
            print(tabulate(table_data, headers=headers, tablefmt="grid"))

    print("\n" + "=" * 100)
    print("END REPORT")
    print("=" * 100)


def main():
    """Main entry point."""
    print("\nParametric Guitar: Fretboard Maker - Parameter Extractor")
    print("=" * 100)

    schema = load_schema()
    if schema is None:
        sys.exit(1)

    try:
        import adsk.core
        print("\nFusion API detected. Attempting to extract from active design...")
        extract_from_active_design()
    except ImportError:
        print("\nFusion API not available.")
        print("To extract parameters:")
        print("  1. Open fretboard_imperial.f3d in Fusion")
        print("  2. Tools > Python Console")
        print("  3. Run this script from within Fusion")
        sys.exit(1)


if __name__ == '__main__':
    main()
