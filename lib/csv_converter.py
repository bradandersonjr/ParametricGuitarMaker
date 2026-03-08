"""
Convert CSV format to template JSON.

CSV Format:
  - First row: header with column names
  - "name" and "description" are required
  - Additional columns are parameter names (e.g. FretCount, StringCount, etc.)
  - Each subsequent row is a template

Example:
  name,description,FretCount,StringCount,ScaleLengthBass,ScaleLengthTreb
  My Guitar,A custom guitar,22,6,25.5,25.5
"""

import csv
from io import StringIO


def csv_to_templates(csv_content: str):
    """
    Parse CSV content and return a list of template dicts.

    Args:
        csv_content: Raw CSV content as a string

    Returns:
        List of template dicts: [{'name': str, 'description': str, 'parameters': {...}}, ...]

    Raises:
        ValueError: If CSV is malformed or missing required columns
    """
    templates = []

    try:
        reader = csv.DictReader(StringIO(csv_content))

        if reader.fieldnames is None or len(reader.fieldnames) == 0:
            raise ValueError("CSV is empty or has no headers")

        required_fields = {'name', 'description'}
        if not required_fields.issubset(set(reader.fieldnames or [])):
            raise ValueError(f"CSV must have 'name' and 'description' columns. Found: {reader.fieldnames}")

        for i, row in enumerate(reader, start=2):  # Start at 2 because row 1 is headers
            if not row.get('name', '').strip():
                raise ValueError(f"Row {i}: 'name' column is empty")

            # Extract name and description
            template = {
                'name': row['name'].strip(),
                'description': row['description'].strip() if row.get('description') else '',
                'parameters': {},
            }

            # All other columns are parameters
            for col_name, col_value in row.items():
                if col_name not in ('name', 'description') and col_value and col_value.strip():
                    template['parameters'][col_name] = col_value.strip()

            templates.append(template)

        if not templates:
            raise ValueError("CSV contains no data rows")

        return templates

    except csv.Error as e:
        raise ValueError(f"CSV parsing error: {e}")
    except Exception as e:
        raise ValueError(f"Failed to parse CSV: {e}")


def validate_csv(csv_content: str) -> tuple[bool, str]:
    """
    Validate CSV format without raising exceptions.

    Returns:
        Tuple of (is_valid, error_message)
    """
    try:
        csv_to_templates(csv_content)
        return True, ""
    except ValueError as e:
        return False, str(e)
