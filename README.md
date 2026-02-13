# Parametric Guitar Fretboard Maker

A specialized Autodesk Fusion 360 add-in for designing custom guitar fretboards with precise parameter control. Create perfectly tailored fretboards based on your exact specifications—scale length, fret count, radius, and more.

## Features

- **Parametric Design**: Adjust fretboard dimensions on-the-fly with instant visual feedback
- **Template Support**: Pre-built templates for inch and millimeter measurements
- **Full Parameter Control**: Fine-tune:
  - Scale length
  - Number of frets
  - Fretboard radius (compound or constant)
  - Nut width and thickness
  - Fret wire dimensions
  - And more
- **Real-time Updates**: Changes propagate instantly through the design timeline
- **Clean Workflow**: Integrated palette UI for parameter management
- **Smart Detection**: Automatically detects if a fretboard was created with this app

## Installation

1. Copy (or symlink) the `ParametricGuitarFretboardMaker` folder into your Fusion add-ins directory:
   - **Windows:** `%APPDATA%\Autodesk\Autodesk Fusion 360\API\AddIns\`
   - **macOS:** `~/Library/Application Support/Autodesk/Autodesk Fusion 360/API/AddIns/`
2. In Fusion, open **Utilities → Add-Ins** (Shift+S).
3. Find **ParametricGuitarFretboardMaker** in the list and click **Run**.
4. A **Parametric Guitar Fretboard Maker** button appears in the Solid toolbar under **Create**.
5. Click it to start designing custom fretboards.

## Quick Start

1. Click the **Parametric Guitar Fretboard Maker** button in the toolbar
2. Choose a template (inch or mm) to begin
3. A palette opens on the right with all parameter controls
4. Adjust parameters and click **Apply** to update the design
5. Export your fretboard as a .f3d file or use it for manufacturing

## Project Structure

```
ParametricGuitarFretboardMaker/
├── ParametricGuitarFretboardMaker.py    # Add-in entry point
├── ParametricGuitarFretboardMaker.manifest
├── config.py                            # Global configuration
├── commands/
│   └── guitarMaker/
│       ├── entry.py                     # Main command logic & event handlers
│       └── resources/                   # Toolbar button icons
├── lib/
│   ├── fusionAddInUtils/                # Logging, event handlers, error handling
│   └── parameter_bridge.py              # HTML ↔ Python parameter sync
├── templates/                           # .f3d fretboard templates (inch & mm)
├── schema/
│   └── parameters.schema.json           # Parameter contract (drives UI)
├── ui/                                  # React app source
│   ├── src/
│   │   ├── pages/                       # Page components
│   │   ├── components/                  # Reusable UI components
│   │   └── App.tsx                      # Main React app
│   └── package.json
├── ui_dist/                             # Bundled offline UI build
├── docs/
│   ├── DEV_NOTES.md                     # Architecture & development workflow
│   ├── QUICKSTART.md                    # Quick reference
│   └── FINGERPRINT_IMPLEMENTATION.md    # Smart detection system
└── README.md
```

## Architecture

### Core Systems

**Parameter System**: All fretboard parameters are defined in `schema/parameters.schema.json`. This drives both the UI form and the Python parameter bridge.

**Timeline Integration**: The design uses Fusion's timeline for non-destructive parameter management. Parameters are stored as design attributes and automatically updated through custom events.

**UI Bridge**: A bidirectional sync system keeps the React palette and Fusion design in lockstep:
- User changes in UI → Python applies to design
- Design changes → Payload sent back to UI for confirmation
- Batch submit pattern prevents conflicting updates

**Fingerprint System**: Automatically detects if a fretboard was created with this app, enabling smart defaults and parameter reset to template values.

### Key Technologies

- **Python 3**: Fusion add-in scripting
- **React + TypeScript**: Palette UI
- **Vite**: UI build tooling
- **Fusion 360 API**: Design automation and parameter management

## Development

### Setup

1. Clone the repository
2. Install Node dependencies: `cd ui && npm install`
3. Build the UI: `npm run build`
4. The add-in is ready to run in Fusion

### Development Workflow

See [docs/DEV_NOTES.md](docs/DEV_NOTES.md) for:
- Architecture decisions
- Event handling patterns
- Parameter sync protocol
- Timeline system constraints
- Testing strategies

### Building the UI

```bash
cd ui
npm run dev      # Development server
npm run build    # Production build
npm run preview  # Preview production build
```

The production build is bundled into `ui_dist/` for offline use in Fusion.

## Documentation

- **[QUICKSTART.md](docs/QUICKSTART.md)** — Quick reference for users and developers
- **[DEV_NOTES.md](docs/DEV_NOTES.md)** — Architecture, constraints, and development patterns
- **[FINGERPRINT_IMPLEMENTATION.md](docs/FINGERPRINT_IMPLEMENTATION.md)** — Smart app detection system

## License

TBD

## Author

Built by [brad anderson jr.](https://bradandersonjr.com)

Maker, builder, and open-source enthusiast.
