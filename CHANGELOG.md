# Changelog

All notable changes to Parametric Guitar Fretboard Maker will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
-

### Changed
-

### Fixed
-

### Removed
-

## [0.1.0] - 2026-02-13

### Added
- Initial release: Parametric Guitar Fretboard Maker add-in for Autodesk Fusion 360
- Parametric fretboard design with 96 customizable parameters across 12 groups
- Fingerprint system to track fretboards created with the app (pgfm format)
- Timeline panel UI for suppressing/unsuppressing features and groups
- Batch submission model for timeline changes via UI with server-side apply
- Full timeline management system with group traversal and suppression/unsuppression
- Environment variable-based debug mode configuration (DEBUG_MODE env var)
- React-based UI with Tailwind styling and Radix UI components
- HTTP bridge for bidirectional communication between Fusion 360 and web UI
- TypeScript type definitions for all API interactions
- Comprehensive documentation: timeline management, parameter extraction, implementation guides

### Changed
- Schema version updated to 0.1.0 (was 0.3.0 from previous development)
- Improved TypeScript compilation with stricter error checking

### Fixed
- Removed unused Sheet component imports from TimelinePanel (SheetDescription, SheetHeader, SheetTitle)
- Removed unused `idx` variable in timeline items mapping
- Cleanup of build system to ensure proper TypeScript compilation

### Removed
-
