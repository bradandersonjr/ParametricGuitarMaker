# Templates Directory

This folder contains parameter templates and reference files for the Parametric Guitar Fretboard Maker.

## Quick Start

### defaults.json - Parameter Reference File
Complete list of all editable parameters with their default values (imperial and metric).

Use this to:
- Edit parameters directly in a text editor without opening the add-in
- Create new templates by copying and modifying this file
- Reference all 47 available parameters

How to use:
1. Open defaults.json in any text editor
2. Edit the parameters you want to customize
3. Save with a new name (e.g., my_bass.json)
4. Move it to presets/ subfolder
5. Load it from the add-in's Templates page

Example:
```json
{
  "name": "My Custom Guitar",
  "description": "7-string multiscale",
  "parameters": {
    "StringCount": "7",
    "ScaleLengthBass": "27.00",
    "ScaleLengthBass_metric": "686",
    "ScaleLengthTreb": "25.50",
    "ScaleLengthTreb_metric": "648"
  }
}
```

---

## Files & Folders

### defaults.json
Parameter reference file with all 47 editable parameters at their schema defaults. Located in this folder (templates/).

### Preset Templates (presets/)
Built-in templates you can load directly in the add-in:
- standard_guitar.json - 22-fret single-scale 6-string
- bass_guitar.json - 21-fret 4-string bass
- multiscale_7string.json - 24-fret fan-fret 7-string

### User Templates (user/)
Custom templates you create are saved here automatically. Populated when you use "Save as Template" in the add-in.

### Fusion Template Files
Design templates used internally:
- fretboard_imperial.f3d - Template for imperial (inch) documents
- fretboard_metric.f3d - Template for metric (mm) documents

### Parameter Reference
- ExportedParameters.csv - All 76 parameters exported from Fusion
- ParametersImperial.csv - Parameters with imperial defaults
- ParametersMetric.csv - Parameters with metric defaults

---

## Creating Custom Templates

### Step 1: Edit defaults.json
Open the file and modify only the parameters you want to customize:

```json
{
  "name": "Custom Guitar Name",
  "description": "Custom guitar description",
  "name_metric": "Custom Guitar Name",
  "description_metric": "Custom guitar description (metric)",
  "parameters": {
    "FretCount": "24",
    "StringCount": "6",
    "ScaleLengthBass": "25.50",
    "ScaleLengthBass_metric": "648"
  }
}
```

### Step 2: Save with a New Name
Save your file as presets/my_template.json (place it in the presets/ subfolder)

### Step 3: Load in the Add-in
1. Open the Parametric Guitar Fretboard Maker
2. Go to Templates page
3. Find your template in the list
4. Click "Import & Apply"

---

## Parameter Format

- Unitless parameters (counts, fractions): "FretCount": "24"
- Imperial lengths (inches): "ScaleLengthBass": "25.50"
- Metric lengths (millimeters): "ScaleLengthBass_metric": "648"

All length parameters should include both imperial and metric variants for full compatibility.

---

## Fusion Template Files (Advanced)

If you need to modify the base Fusion templates (fretboard_imperial.f3d or fretboard_metric.f3d):

Requirements:
- Both files must use the same user parameter names
- Include a TEMPLATE_VERSION user parameter (e.g., "1.0.0")
- Save with timeline marker at start (no geometry visible on initial import)
- Fretboard should be its own component (not loose geometry in the root)
