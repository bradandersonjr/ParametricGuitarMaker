# Parametric Guitar: Fretboard Maker — Global Configuration
# Shared variables accessible across all modules.

import os

# Debug mode: set True during development, False for distribution.
DEBUG = False

# Add-in identity — derived from the folder name automatically.
ADDIN_NAME = os.path.basename(os.path.dirname(__file__))
COMPANY_NAME = 'ParametricGuitar'

# Palette configuration
PALETTE_ID = f'{COMPANY_NAME}_{ADDIN_NAME}_palette'
PALETTE_NAME = 'Parametric Guitar: Fretboard Maker [BETA]'

# Add-in root directory (absolute path to this folder)
ADDIN_ROOT = os.path.dirname(os.path.abspath(__file__))

# Palette UI — always served from the local build.
# For development: run `npm run dev` in ui/ and set to 'http://localhost:5173/'
# For production: leave as None to use ui_dist/index.html
PALETTE_DEV_URL = 'http://localhost:5173/' if DEBUG else None
