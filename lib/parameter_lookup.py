#!/usr/bin/env python3
"""
Parameter Lookup Utility

Quick reference for finding parameter information without running full extraction.

Usage:
  python parameter_lookup.py                      # List all parameters
  python parameter_lookup.py --search "scale"    # Search by keyword
  python parameter_lookup.py --group "body"      # List group parameters
  python parameter_lookup.py --param "BodyLength" # Get parameter details
"""

import json
import sys
from pathlib import Path
from typing import Optional, List, Dict
import argparse


def load_schema() -> Optional[Dict]:
    """Load the parameter schema."""
    schema_path = Path(__file__).parent / 'schema' / 'parameters.schema.json'

    if not schema_path.exists():
        print(f"ERROR: Schema not found: {schema_path}")
        return None

    try:
        with open(schema_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"ERROR: Failed to load schema: {e}")
        return None


def find_parameter(schema: Dict, param_name: str) -> Optional[Dict]:
    """Find a single parameter by name."""
    for group in schema.get('groups', []):
        for param in group.get('parameters', []):
            if param['name'].lower() == param_name.lower():
                return {
                    'param': param,
                    'group': group
                }
    return None


def search_parameters(schema: Dict, keyword: str) -> List[Dict]:
    """Search parameters by keyword."""
    keyword = keyword.lower()
    results = []

    for group in schema.get('groups', []):
        for param in group.get('parameters', []):
            if (keyword in param['name'].lower() or
                keyword in param.get('label', '').lower() or
                keyword in param.get('description', '').lower()):
                results.append({
                    'param': param,
                    'group': group
                })

    return results


def get_group_parameters(schema: Dict, group_id: str) -> List[Dict]:
    """Get all parameters in a group."""
    group_id = group_id.lower()
    results = []

    for group in schema.get('groups', []):
        if group.get('id', '').lower() == group_id:
            for param in group.get('parameters', []):
                results.append({
                    'param': param,
                    'group': group
                })

    return results


def print_parameter_details(result: Dict):
    """Print detailed information about a parameter."""
    param = result['param']
    group = result['group']

    print(f"\nParameter: {param['name']}")
    print("=" * 80)
    print(f"Group: {group['label']} ({group['id']})")
    print(f"Label: {param.get('label', param['name'])}")
    print(f"Type: {param.get('controlType', 'number')}")
    print(f"Unit: {param.get('unitKind', 'unknown')}")
    print(f"Default: {param.get('default', '(none)')}")

    if 'min' in param or 'max' in param:
        min_val = param.get('min', '-inf')
        max_val = param.get('max', '+inf')
        print(f"Range: {min_val} to {max_val}")

    if 'step' in param:
        print(f"Step: {param['step']}")

    if param.get('description'):
        print(f"Description: {param['description']}")


def print_parameter_list(results: List[Dict], title: str = None):
    """Print a list of parameters."""
    if not results:
        print("\nNo parameters found.")
        return

    if title:
        print(f"\n{title}")
        print("=" * 80)

    for result in results:
        param = result['param']
        group = result['group']
        label = param.get('label', param['name'])
        default = param.get('default', '')

        print(f"\n{param['name']}")
        print(f"  Label: {label}")
        print(f"  Group: {group['label']}")
        print(f"  Default: {default}")
        if param.get('description'):
            print(f"  Description: {param.get('description')}")


def list_groups(schema: Dict):
    """List all parameter groups."""
    print("\nParameter Groups")
    print("=" * 80)

    for group in schema.get('groups', []):
        group_id = group.get('id', 'unknown')
        label = group.get('label', 'Unknown')
        count = len(group.get('parameters', []))
        order = group.get('order', 0)

        print(f"\n{order}. {label}")
        print(f"   ID: {group_id}")
        print(f"   Parameters: {count}")


def list_all_parameters(schema: Dict):
    """List all parameters in a compact format."""
    print("\nAll Parameters")
    print("=" * 80)

    for group in schema.get('groups', []):
        group_label = group.get('label', 'Unknown')
        print(f"\n{group_label}")
        print("-" * 80)

        for param in group.get('parameters', []):
            name = param['name']
            label = param.get('label', name)
            default = param.get('default', '')
            print(f"  {name:<30} {label:<30} = {default}")


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Parametric Guitar: Fretboard Maker — Parameter Lookup Utility"
    )
    parser.add_argument(
        '--search',
        help='Search parameters by keyword'
    )
    parser.add_argument(
        '--param',
        help='Get details for a specific parameter'
    )
    parser.add_argument(
        '--group',
        help='List all parameters in a group'
    )
    parser.add_argument(
        '--groups',
        action='store_true',
        help='List all parameter groups'
    )
    parser.add_argument(
        '--all',
        action='store_true',
        help='List all parameters'
    )

    args = parser.parse_args()

    schema = load_schema()
    if schema is None:
        sys.exit(1)

    # Handle different query types
    if args.param:
        result = find_parameter(schema, args.param)
        if result:
            print_parameter_details(result)
        else:
            print(f"\nParameter not found: {args.param}")
            print("\nDid you mean one of these?")
            results = search_parameters(schema, args.param.split()[0])
            print_parameter_list(results)

    elif args.search:
        results = search_parameters(schema, args.search)
        print_parameter_list(results, f"Search results for '{args.search}'")

    elif args.group:
        results = get_group_parameters(schema, args.group)
        if results:
            group_label = results[0]['group']['label']
            print_parameter_list(results, f"Group: {group_label}")
        else:
            print(f"\nGroup not found: {args.group}")
            list_groups(schema)

    elif args.groups:
        list_groups(schema)

    elif args.all:
        list_all_parameters(schema)

    else:
        # Default: show summary
        print("\nParametric Guitar: Fretboard Maker — Parameter Lookup")
        print("=" * 80)
        total = sum(len(g.get('parameters', [])) for g in schema.get('groups', []))
        print(f"\nTotal Parameters: {total}")
        print(f"Groups: {len(schema.get('groups', []))}")
        print("\nUsage:")
        print("  --all                  List all parameters")
        print("  --groups               List all groups")
        print("  --group NAME           Show parameters in group")
        print("  --param NAME           Show parameter details")
        print("  --search KEYWORD       Search by keyword")
        print("\nExamples:")
        print("  python parameter_lookup.py --group body")
        print("  python parameter_lookup.py --param GuitarLength")
        print("  python parameter_lookup.py --search 'string gauge'")


if __name__ == '__main__':
    main()
