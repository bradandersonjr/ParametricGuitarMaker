# Parametric Guitar: Fretboard Maker

A specialized Fusion add-in for designing custom guitar fretboards with precise parameter control.

## Quick Start

1. Copy (or symlink) the `ParametricGuitarMaker` folder into your Fusion AddIns directory:
   - **Windows:** `%APPDATA%\Autodesk\Autodesk Fusion 360\API\AddIns\`
   - **macOS:** `~/Library/Application Support/Autodesk/Autodesk Fusion 360/API/AddIns/`
2. In Fusion, open **Utilities → Add-Ins** (Shift+S).
3. Find **ParametricGuitarMaker** in the list and click **Run**.
4. A **Parametric Guitar: Fretboard Maker** button appears in the Solid toolbar → Scripts/Add-Ins panel.
5. Click it to design custom fretboards with full parameter control.

## Project Structure

```
ParametricGuitarMaker/
├── ParametricGuitarMaker.py      # Add-in entry point
├── ParametricGuitarMaker.manifest
├── config.py                     # Global configuration
├── commands/
│   └── guitarMaker/
│       ├── entry.py              # Main command logic
│       └── resources/            # Icons for the toolbar button
├── lib/
│   └── fusionAddInUtils/         # Logging & event handler utilities
├── templates/                    # .f3d fretboard templates (inch & mm)
├── schema/
│   └── parameters.schema.json    # Parameter contract (drives UI)
├── ui/                           # React app source (Phase 5)
├── ui_dist/                      # Bundled offline UI build (Phase 6)
└── docs/
    ├── QUICKSTART.md
    └── DEV_NOTES.md
```

## Development

See [docs/DEV_NOTES.md](docs/DEV_NOTES.md) for architecture decisions and development workflow.

## License

TBD
