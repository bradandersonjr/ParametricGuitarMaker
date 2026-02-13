#!/usr/bin/env python3
"""
Populate parameters.schema.json from ExportedParameters.csv

This script reads the exported parameters from the Fusion template and updates
the schema JSON with actual values, expressions, and metadata.
"""

import csv
import json
import re
from pathlib import Path

def parse_csv(csv_path):
    """Parse ExportedParameters.csv and extract parameter data."""
    params = {}
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            name = row.get('Name', '').strip()
            if not name or name.startswith('→'):
                continue

            params[name] = {
                'unit': row.get('Unit', '').strip(),
                'expression': row.get('Expression', '').strip(),
                'value': row.get('Value', '').strip(),
                'comments': row.get('Comments', '').strip(),
                'favorite': row.get('Favorite', 'false').lower() == 'true',
            }
    return params

def infer_unit_kind(unit_str):
    """Infer unitKind from Unit column."""
    if unit_str == 'in':
        return 'length'
    elif unit_str == 'deg':
        return 'angle'
    else:
        return 'unitless'

def extract_numeric_value(value_str):
    """Extract numeric value from string like '25.5' or '24'."""
    match = re.search(r'[-+]?\d*\.?\d+', value_str)
    if match:
        return float(match.group())
    return None

def has_formula(expression_str):
    """
    Detect if expression is a formula (not just a numeric literal).

    Formulas contain:
    - Operators: +, -, *, /, ^, (, )
    - Functions: if, sqrt, round, etc.
    - Parameter references (capitalized words that aren't unit suffixes)
    - Unit literals at the end (e.g., ' in', ' deg')

    Pure numeric values are just numbers, optionally with units.
    """
    expr = expression_str.strip()

    # Remove trailing unit literals
    expr_clean = re.sub(r'\s+(in|deg|mm|cm)$', '', expr, flags=re.IGNORECASE)

    # Check for operators and functions
    formula_indicators = [
        r'\s*[\+\-\*/\^]\s*',  # Arithmetic operators
        r'[()]',                 # Parentheses
        r'\b(if|sqrt|round|min|max|abs)\b',  # Common functions
        r'\b[A-Z][a-zA-Z0-9]*\b(?!\s*(in|deg|mm|cm))$',  # Parameter refs (capitalized)
    ]

    for pattern in formula_indicators:
        if re.search(pattern, expr_clean):
            return True

    # If it's just a number (possibly with units), it's not a formula
    return False

def update_schema(schema_path, csv_data):
    """Update schema with data from CSV.

    Parameters with formulas are marked as read-only/non-editable to prevent
    accidental overwriting of their expressions.
    """
    with open(schema_path, 'r', encoding='utf-8') as f:
        schema = json.load(f)

    updated_count = 0
    missing_count = 0
    formula_count = 0

    for group in schema.get('groups', []):
        for param in group.get('parameters', []):
            param_name = param.get('name')

            if param_name not in csv_data:
                print(f"[!] {param_name} not found in CSV")
                missing_count += 1
                continue

            csv_param = csv_data[param_name]
            expression = csv_param['expression'].strip()

            # Detect if this parameter has a formula
            is_formula = has_formula(expression)

            if is_formula:
                # Mark formula-based params as non-editable
                param['editable'] = False
                param['deprecated'] = True  # Hide from UI
                formula_count += 1
                print(f"[*] {param_name}: Formula detected (marked non-editable)")
            else:
                # Editable parameter - update with CSV values
                param['editable'] = True
                param['deprecated'] = False

                # Update default value
                if csv_param['value']:
                    param['default'] = csv_param['value']

                # Update description from comments
                if csv_param['comments'] and csv_param['comments'] != param.get('description', ''):
                    param['description'] = csv_param['comments']

            # Update unitKind based on Unit column
            inferred_unit = infer_unit_kind(csv_param['unit'])
            if inferred_unit != param.get('unitKind'):
                param['unitKind'] = inferred_unit

            # Always store the expression for reference
            if expression:
                existing_notes = param.get('notes', '')
                formula_note = f"Expression: {expression}"
                if existing_notes and 'Expression:' not in existing_notes:
                    param['notes'] = f"{existing_notes} | {formula_note}"
                elif not existing_notes:
                    param['notes'] = formula_note

            updated_count += 1

    print(f"\n[+] Updated {updated_count} parameters")
    print(f"[*] {formula_count} formula-based parameters marked non-editable")
    if missing_count:
        print(f"[!] {missing_count} parameters missing from CSV")

    return schema

def main():
    csv_path = Path('templates/ExportedParameters.csv')
    schema_path = Path('schema/parameters.schema.json')

    if not csv_path.exists():
        print(f"[!] CSV not found: {csv_path}")
        return

    if not schema_path.exists():
        print(f"[!] Schema not found: {schema_path}")
        return

    print(f"[*] Reading CSV: {csv_path}")
    csv_data = parse_csv(csv_path)
    print(f"    Found {len(csv_data)} parameters\n")

    print(f"[*] Updating schema: {schema_path}")
    updated_schema = update_schema(schema_path, csv_data)

    print(f"\n[*] Writing updated schema...")
    with open(schema_path, 'w', encoding='utf-8') as f:
        json.dump(updated_schema, f, indent=4, ensure_ascii=False)

    print(f"[+] Done!")

if __name__ == '__main__':
    main()
