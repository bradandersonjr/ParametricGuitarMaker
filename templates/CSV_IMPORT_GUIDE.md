# CSV Template Import Guide

You can now import guitar templates from a CSV file! This makes it easy to:
- Create templates in Google Sheets or Excel
- Share templates with others via CSV files
- Bulk-import multiple guitar configurations

## CSV Format

Your CSV file must have:
1. **Headers** in the first row
2. **Required columns:**
   - `name` - Template name (e.g., "Standard Electric")
   - `description` - Template description (e.g., "Classic 6-string guitar")
3. **Parameter columns** - Any guitar parameter as a column (e.g., `FretCount`, `StringCount`, `ScaleLengthBass`, `ScaleLengthTreb`, `NutWidth`, `BridgeWidth`, etc.)

## Example CSV

```csv
name,description,FretCount,StringCount,ScaleLengthBass,ScaleLengthTreb,NutWidth,BridgeWidth
Standard Electric,Classic 6-string single-scale guitar,22,6,25.5,25.5,1.688,2.187
Multiscale 7-String,Fan-fret 7-string with neutral fret,24,7,27.0,25.5,1.875,2.375
Bass 4-String,Long-scale 4-string bass,21,4,34.0,34.0,1.5,2.25
```

## Workflow: Using Google Sheets

1. **Copy the shared template** (ask your admin for a link to the read-only template)
2. **Click "Make a Copy"** in Google Sheets to create your own editable version
3. **Edit your templates** - add rows for each guitar configuration you want
4. **Export as CSV:**
   - Click **File** → **Download** → **Comma Separated Values (.csv)**
   - Save the file to your computer (e.g., `my_guitars.csv`)
5. **Import in Parametric Guitar:**
   - Open the **Templates** tab in the Parametric Guitar UI
   - Click **Import CSV**
   - Select your CSV file
   - Done! Your templates are now in "My Templates"

## Workflow: Using Excel or CSV Editor

1. **Create or open a CSV file** in Excel or a text editor
2. **Add your templates** following the format above
3. **Save as CSV** (use `.csv` file extension)
4. **Import in Parametric Guitar** as described above

## Parameter Names

Common parameter columns you can use:

### Fret & String Counts
- `FretCount` - Number of frets (e.g., 22, 24)
- `StringCount` - Number of strings (e.g., 6, 7, 4)
- `NeutralFret` - Neutral fret for multiscale (optional, e.g., 7)

### Scale Lengths
- `ScaleLengthBass` - Bass side scale length in inches (e.g., 25.5, 27.0)
- `ScaleLengthTreb` - Treble side scale length in inches (e.g., 25.5, 25.0)

### Widths
- `NutWidth` - Width at the nut in inches (e.g., 1.688)
- `BridgeWidth` - Width at the bridge in inches (e.g., 2.187)

### Other Parameters
- Any parameter from your guitar design schema can be included
- If a parameter is not in the CSV, the current Fusion value will be used
- Leave cells blank if you don't want to set a particular parameter

## Tips

- **Column order doesn't matter** - You can add columns in any order
- **Partial templates** - You don't need to specify all parameters; only include what you want to customize
- **Special characters** - Avoid special characters in template names; stick to letters, numbers, hyphens, and spaces
- **Duplicate names** - If two templates have the same name, the second one will overwrite the first
- **Metric vs Imperial** - CSV values should match your document's unit system (inches for imperial documents)

## Troubleshooting

**"CSV parsing error: CSV must have 'name' and 'description' columns"**
- Make sure your first row has exactly `name` and `description` columns
- Check the spelling (lowercase)

**"Row 2: 'name' column is empty"**
- Make sure every row has a template name
- Empty rows will cause this error

**"CSV contains no data rows"**
- Your CSV only has headers but no template data
- Add at least one template row

**"Failed to save template"**
- The templates folder may not be writable
- Check your file permissions
