# Changelog

All notable changes to Parametric Guitar Fretboard Maker will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.1] - 2026-03-08

### Changed
- Expanded parameter limits to support bass guitars, ukuleles, and extended-range instruments
  - FretCount minimum: 12 → 4 (supports ukuleles, mandolins, travel guitars)
  - StringCount range: 4–12 → 1–18 (supports ukulele, bass, extended-range, harp guitars)
  - ScaleLength range: 20–36 in → 10–45 in (ukulele ~13 in through long-scale bass ~43 in)
  - String gauges maximum: 0.1 in → 0.2 in (accommodates heavy bass strings)
  - NutLength, NutSlotSpacing, SaddleSpacing expanded for wider/narrower instruments
  - NutRadius and HeelRadius minimums reduced to 3 in for smaller instruments
  - HeelCurveRadius range: 1–12 in → 0.5–20 in
  - Neck thickness (FretThickness1/12) expanded for deeper bass necks
  - Fretboard, headstock, body, and overall guitar dimensions expanded

## [0.3.0] - 2026-03-07

### Added
- Customization Options drawer with toggles for Fret Slot Cuts, Nut Slot, Fret Markers, and Heel Curve Fillet
- Zero Fret action button: toggle Zero Fret Slot Cut suppression and ZeroFretAdjust parameter
- Blind Frets action button: toggle BlindFret parameter between enabled/disabled
- Heel Curve action button: toggle HeelCurveRadius between user value and flat (10000 in)
- Fret Markers style button: switch marker hole positions between Circles and Offset selection sets
- Fretboard radius mode buttons: Compound, Straight, and Flat — independent buttons replacing a single cycling control
- Draggable group reordering in the Parameters page, persisted via user preferences
- Persistent user preferences system synced between Python backend (filesystem) and React (localStorage)
- Beta disclaimer "Don't show again" checkbox, version-aware with per-release dismissal
- CSV template import infrastructure: backend parser, handler, guide, and sample file (UI marked Coming Soon)

### Changed
- Fret Slot Cuts toggle now automatically synchronizes Zero Fret Slot Cut suppression when Zero Fret is enabled
- Radius mode redesigned from single cycling button to three independent action buttons for clarity
- Options drawer renamed from TimelinePanel to OptionsPanel to better reflect its purpose
- "Quick Load Default" label shown on the initial-mode import button when no changes have been made

### Fixed
- Flat radius mode not applying correctly in Initial Mode before fretboard creation
- Radius mode button cycling past the last state sending an undefined selection set name to the backend
- initialChangeCount calculation using `||` (OR) instead of `+` (addition), masking zero-change state

## [0.2.0] - 2026-02-17

### Added
- Unified imperial/metric unit system with dual values stored in schema (no runtime conversion)
- Metric-specific schema fields: `defaultMetric`, `stepMetric`, `minMetric`, `maxMetric` for all length parameters
- Input validation system with min/max limits enforced in both UI and backend
- Custom parameter categories: create, delete, and assign user-defined groups persisted via Fusion comment tags
- Auto-apply new parameters immediately on creation (no staging step required)
- Unit indicator badge in header showing "Metric" or "Imperial" for current document
- Fretboard detection indicator in sidebar footer (green "Fretboard Loaded" / muted "No Fretboard")
- Batched undo/redo: entire parameter edits treated as single actions instead of per-keystroke
- History popover on undo/redo buttons showing past/future changes on hover
- Unified preset files with dual imperial/metric values (3 files instead of 6)
- Refresh button resets to schema defaults when in initial mode (before template load)
- Share page placeholder for future sharing functionality
- Dialog component (Radix UI)

### Changed
- Schema is now the single source of truth for both unit systems (76 parameters matching design + AppFingerprint)
- Schema reorganized into 13 groups (added Metadata group for AppFingerprint)
- Template loading uses smart value selection based on document unit (`_metric` key preference)
- Stepper +/- buttons auto-clamp to valid range (no error shown, always valid)
- Templates display only unit-appropriate values (metric mode shows 100% metric, no inches)
- Validation errors display unit-correct messages (e.g., "Max: 610.0 mm" in metric mode)
- Undo/redo history preserved across payload refreshes (only cleared on actual mode changes)
- Disabled ghost buttons now allow hover/tooltip display for better UX
- Backend metric conversion for live design parameters (inches → mm for metric documents)

### Fixed
- Template loading blank screen when `hasFingerprint`, `fingerprint`, and `extraParams` missing from payload
- Category combobox dropdown z-index layering behind modal dialogs (switched to fixed positioning)
- Template loading showing "Import & Apply" instead of "Apply N changes" in live mode
- Palette URL encoding to handle spaces in directory paths
- Context error handling in command execution
- Toolbar button duplicate in ADD-INS menu (cleaned up panel IDs)
- Schema parameters showing as changed (amber) in initial/metric mode when values match Fusion design
- Schema alignment with Fusion design: removed 25 parameters not present in design, renamed 5 to match actual parameter names
- Edited schema parameter descriptions now persist and display correctly after refresh in live mode

### Removed
- Unit switcher button (replaced by unit indicator badge)
- Redundant metric template files (consolidated into unified presets)
- Runtime `× 25.4` conversion for metric values (replaced by schema-stored metric defaults)

## [0.1.0] - 2026-02-13

### Added
- Initial release: Parametric Guitar Fretboard Maker add-in for Autodesk Fusion
- Parametric fretboard design with 96 customizable parameters across 12 groups
- Fingerprint system to track fretboards created with the app (pgfm format)
- Timeline panel UI for suppressing/unsuppressing features and groups
- Batch submission model for timeline changes via UI with server-side apply
- Full timeline management system with group traversal and suppression/unsuppression
- Environment variable-based debug mode configuration (DEBUG_MODE env var)
- React-based UI with Tailwind styling and Radix UI components
- HTTP bridge for bidirectional communication between AutodeskFusion and web UI
- TypeScript type definitions for all API interactions
- Comprehensive documentation: timeline management, parameter extraction, implementation guides

### Changed
- Schema version updated to 0.1.0 (was 0.3.0 from previous development)
- Improved TypeScript compilation with stricter error checking

### Fixed
- Removed unused Sheet component imports from OptionsPanel (SheetDescription, SheetHeader, SheetTitle)
- Removed unused `idx` variable in timeline items mapping
- Cleanup of build system to ensure proper TypeScript compilation

### Removed
-
