#!/usr/bin/env python3
"""
Headless Parameter Extractor for Fusion Template Files

Since .f3d files are binary Fusion formats that require the Fusion API
to read parameters properly, this script provides an alternative approach:

1. Compares the parameter schema against what should be in the template
2. Generates a report of schema-defined parameters and their defaults
3. Provides a reference for what parameters SHOULD exist in fretboard_imperial.f3d

This helps validate that the template file has all necessary parameters
defined correctly.

Usage:
  python extract_parameters_headless.py [--template fretboard_imperial.f3d]
"""

import json
import sys
from pathlib import Path
from typing import Dict, List, Tuple, Optional
import argparse


def load_schema(schema_path: Path) -> Optional[Dict]:
    """Load the parameter schema from JSON."""
    if not schema_path.exists():
        print(f"ERROR: Schema not found: {schema_path}")
        return None

    try:
        with open(schema_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"ERROR: Failed to load schema: {e}")
        return None


def build_parameter_table(schema: Dict) -> List[List]:
    """Build a table of all parameters from the schema."""
    table_data = []

    for group_def in schema.get('groups', []):
        group_id = group_def.get('id', 'unknown')
        group_label = group_def.get('label', 'Unknown')

        for param_def in group_def.get('parameters', []):
            name = param_def['name']
            label = param_def.get('label', name)
            unit_kind = param_def.get('unitKind', '')
            default = param_def.get('default', '')
            description = param_def.get('description', '')
            min_val = param_def.get('min', '')
            max_val = param_def.get('max', '')
            step = param_def.get('step', '')
            control_type = param_def.get('controlType', 'number')

            table_data.append({
                'group': group_label,
                'group_id': group_id,
                'name': name,
                'label': label,
                'unitKind': unit_kind,
                'controlType': control_type,
                'default': default,
                'min': min_val,
                'max': max_val,
                'step': step,
                'description': description,
            })

    return table_data


def print_schema_report(schema: Dict):
    """Print a detailed schema report."""
    print("\n" + "=" * 120)
    print("PARAMETER SCHEMA REPORT")
    print("=" * 120)
    print(f"Schema Version: {schema.get('schemaVersion', 'unknown')}")
    print(f"Template Version: {schema.get('templateVersion', 'unknown')}")

    total_params = sum(len(g.get('parameters', [])) for g in schema.get('groups', []))
    print(f"Total Parameters: {total_params}")
    print(f"Total Groups: {len(schema.get('groups', []))}")

    print("\n" + "-" * 120)
    print("PARAMETERS BY GROUP")
    print("-" * 120)

    for group_def in schema.get('groups', []):
        group_id = group_def.get('id', 'unknown')
        group_label = group_def.get('label', 'Unknown')
        group_order = group_def.get('order', 0)
        params = group_def.get('parameters', [])

        print(f"\n{group_order}. {group_label} [{group_id}] — {len(params)} parameters")
        print("-" * 120)

        for i, param_def in enumerate(params, 1):
            name = param_def['name']
            label = param_def.get('label', name)
            unit_kind = param_def.get('unitKind', '')
            default = param_def.get('default', '')
            description = param_def.get('description', '')
            min_val = param_def.get('min', '')
            max_val = param_def.get('max', '')

            print(f"\n  {i}. {label}")
            print(f"     Name: {name}")
            print(f"     Type: {param_def.get('controlType', 'number')} | Unit: {unit_kind}")
            print(f"     Default: {default}")

            if min_val != '' or max_val != '':
                print(f"     Range: {min_val} to {max_val}")

            if description:
                print(f"     Description: {description}")

    print("\n" + "=" * 120)


def print_csv_export(schema: Dict, output_path: Optional[Path] = None):
    """Export parameters to CSV format."""
    import csv
    import io

    table_data = build_parameter_table(schema)

    if output_path:
        with open(output_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=table_data[0].keys())
            writer.writeheader()
            writer.writerows(table_data)
        print(f"\nCSV export saved to: {output_path}")
    else:
        # Print to console
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=table_data[0].keys())
        writer.writeheader()
        writer.writerows(table_data)
        print("\n" + output.getvalue())


def print_json_export(schema: Dict, output_path: Optional[Path] = None):
    """Export parameters to JSON format."""
    table_data = build_parameter_table(schema)

    output = json.dumps(table_data, indent=2, ensure_ascii=False)

    if output_path:
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(output)
        print(f"\nJSON export saved to: {output_path}")
    else:
        print("\n" + output)


def validate_schema(schema: Dict) -> Tuple[List[str], List[str]]:
    """Validate the schema for common issues."""
    issues = []
    warnings = []

    all_names = set()
    for group_def in schema.get('groups', []):
        for param_def in group_def.get('parameters', []):
            name = param_def['name']
            if name in all_names:
                issues.append(f"Duplicate parameter name: {name}")
            all_names.add(name)

    # Check for missing required fields
    for group_def in schema.get('groups', []):
        group_id = group_def.get('id')
        if not group_id:
            issues.append(f"Group missing 'id': {group_def.get('label', 'Unknown')}")

        for param_def in group_def.get('parameters', []):
            if 'name' not in param_def:
                issues.append(f"Parameter missing 'name' in group {group_id}")
            if 'default' not in param_def and param_def.get('controlType') != 'select':
                warnings.append(f"Parameter {param_def.get('name', 'unknown')} missing 'default'")

    return issues, warnings


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Extract and validate Fusion parametric guitar parameters"
    )
    parser.add_argument(
        '--schema',
        type=Path,
        default=Path(__file__).parent / 'schema' / 'parameters.schema.json',
        help='Path to parameters.schema.json'
    )
    parser.add_argument(
        '--export-csv',
        type=Path,
        help='Export parameters to CSV file'
    )
    parser.add_argument(
        '--export-json',
        type=Path,
        help='Export parameters to JSON file'
    )
    parser.add_argument(
        '--validate',
        action='store_true',
        help='Validate schema for issues'
    )
    parser.add_argument(
        '--summary',
        action='store_true',
        help='Print summary only (skip detailed report)'
    )

    args = parser.parse_args()

    print("\n" + "=" * 120)
    print("PARAMETRIC GUITAR MAKER — PARAMETER EXTRACTOR")
    print("=" * 120)

    schema = load_schema(args.schema)
    if schema is None:
        sys.exit(1)

    if args.validate:
        issues, warnings = validate_schema(schema)
        print("\nValidation Results:")
        if issues:
            print(f"\n  ISSUES ({len(issues)}):")
            for issue in issues:
                print(f"    - {issue}")
        if warnings:
            print(f"\n  WARNINGS ({len(warnings)}):")
            for warning in warnings[:10]:
                print(f"    - {warning}")
            if len(warnings) > 10:
                print(f"    ... and {len(warnings) - 10} more warnings")
        if not issues and not warnings:
            print("\n  Schema is valid!")

    if not args.summary:
        print_schema_report(schema)

    if args.export_csv:
        print_csv_export(schema, args.export_csv)

    if args.export_json:
        print_json_export(schema, args.export_json)

    print("\n" + "=" * 120)
    print("To extract actual parameters from fretboard_imperial.f3d:")
    print("  1. Open fretboard_imperial.f3d in Fusion")
    print("  2. Tools > Python Console")
    print("  3. Run: exec(open('extract_parameters.py').read())")
    print("=" * 120 + "\n")


if __name__ == '__main__':
    main()
