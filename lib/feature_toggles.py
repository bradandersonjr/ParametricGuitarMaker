"""
Feature toggles — zero fret, blind frets, heel curve, radius mode, and hole remapping.

Each function manipulates Fusion design parameters or timeline items directly.
Extracted from parameter_bridge.py for cleaner separation of concerns.
"""

import adsk.core
import adsk.fusion

from . import fusionAddInUtils as futil
from . import timeline_manager
from . import radius_cache
from .units import is_metric_length_unit


# ═══════════════════════════════════════════════════════════════════
# Hole remap helpers
# ═══════════════════════════════════════════════════════════════════

def _remap_fail(message: str) -> dict:
    """Return a standardized remap failure result."""
    futil.log(f'remap_hole: FAIL — {message}', force_console=True)
    return {'success': False, 'message': message}


def _collect_unique_tokens(sel_set) -> list:
    """Collect de-duplicated entity tokens from a selection set.

    Tokens survive timeline rolls; object references do not.
    """
    entities = sel_set.entities
    try:
        count = entities.count
    except AttributeError:
        count = len(entities)

    raw = []
    try:
        for i in range(count):
            raw.append(entities.item(i).entityToken)
    except AttributeError:
        for ent in entities:
            raw.append(ent.entityToken)

    seen = set()
    unique = []
    for t in raw:
        if t not in seen:
            seen.add(t)
            unique.append(t)
    if len(unique) != len(raw):
        futil.log(f'remap_hole: de-duplicated tokens {len(raw)} -> {len(unique)}', force_console=True)
    return unique


def _resolve_sketch_points(design, selection_set_name: str, tokens: list):
    """Resolve sketch points after a timeline roll.

    Primary: re-fetch the live selection set (entities may still be valid).
    Fallback: resolve each pre-collected token via design.findEntityByToken().

    Returns (ObjectCollection of SketchPoints, list of skipped objectType strings).
    """
    pts = adsk.core.ObjectCollection.create()
    skipped = []
    seen_tokens = set()

    # Primary: live re-fetch from the selection set
    try:
        live_set = design.selectionSets.itemByName(selection_set_name)
        if live_set:
            live_entities = live_set.entities
            try:
                live_iter = [live_entities.item(i) for i in range(live_entities.count)]
            except AttributeError:
                live_iter = list(live_entities)
            for ent in live_iter:
                point = adsk.fusion.SketchPoint.cast(ent)
                if point and point.isValid:
                    tok = getattr(point, 'entityToken', '')
                    if tok and tok in seen_tokens:
                        continue
                    if tok:
                        seen_tokens.add(tok)
                    pts.add(point)
    except Exception as e:
        futil.log(f'remap_hole: live re-fetch failed: {e}', force_console=True)

    # Fallback: token-based resolution (only if live path yielded nothing)
    if pts.count == 0:
        for token in tokens:
            resolved = design.findEntityByToken(token)
            if resolved and len(resolved) > 0:
                point = adsk.fusion.SketchPoint.cast(resolved[0])
                if point and point.isValid:
                    pts.add(point)
                else:
                    try:
                        skipped.append(resolved[0].objectType)
                    except Exception:
                        skipped.append('Unknown')

    return pts, skipped


# ═══════════════════════════════════════════════════════════════════
# Hole remap
# ═══════════════════════════════════════════════════════════════════

def remap_hole_to_selection_set(
    design: adsk.fusion.Design,
    hole_name: str,
    selection_set_name: str,
) -> dict:
    """Remap a HoleFeature to use sketch points from a different Selection Set.

    Rolls the timeline before the hole, calls setPositionBySketchPoints()
    with the resolved points, then restores the timeline to the end.

    Returns:
        dict: { 'success': bool, 'message': str }
    """
    timeline = design.timeline
    timeline_rolled = False

    try:
        # ── 1. Find the hole feature ─────────────────────────────
        item = timeline_manager.find_item_by_name(design, hole_name, exact=True)
        if not item:
            return _remap_fail(f'Hole feature "{hole_name}" not found in timeline')

        timeline_obj = item.get('object')
        if not timeline_obj:
            return _remap_fail(f'Hole feature "{hole_name}" has no timeline object')

        entity = timeline_obj.entity
        hole_feature = adsk.fusion.HoleFeature.cast(entity) if entity else None
        if not hole_feature or not hole_feature.isValid:
            return _remap_fail(f'"{hole_name}" is not a valid HoleFeature')

        futil.log(f'remap_hole: found "{hole_name}"', force_console=True)

        # ── 2. Collect entity tokens from selection set ──────────
        sel_set = design.selectionSets.itemByName(selection_set_name)
        if not sel_set:
            return _remap_fail(f'Selection set "{selection_set_name}" not found')

        tokens = _collect_unique_tokens(sel_set)
        if not tokens:
            return _remap_fail(f'Selection set "{selection_set_name}" is empty')

        futil.log(f'remap_hole: {len(tokens)} tokens from "{selection_set_name}"', force_console=True)

        # ── 3. Expand parent group if collapsed ─────────────────
        parent_group = None
        was_collapsed = False
        try:
            pg = timeline_obj.parentGroup
            if pg:
                parent_group = adsk.fusion.TimelineGroup.cast(pg)
                if parent_group and parent_group.isCollapsed:
                    was_collapsed = True
                    parent_group.isCollapsed = False
                    futil.log('remap_hole: expanded parent group', force_console=True)
        except Exception:
            pass

        # ── 4. Roll timeline before the hole (exclusive) ─────────
        timeline_obj.rollTo(True)
        timeline_rolled = True

        # ── 5. Resolve tokens to SketchPoints after roll ─────────
        pts, skipped = _resolve_sketch_points(design, selection_set_name, tokens)

        if pts.count == 0:
            return _remap_fail('No sketch points could be resolved after timeline roll')
        if skipped:
            return _remap_fail(
                'Selection set contains non-SketchPoint entities: '
                + ', '.join(sorted(set(skipped)))
            )

        futil.log(f'remap_hole: resolved {pts.count} sketch points', force_console=True)

        # ── 6. Surgical remap ────────────────────────────────────
        hole_feature.setPositionBySketchPoints(pts)

        futil.log(
            f'remap_hole: remapped to {pts.count} point(s) from "{selection_set_name}"',
            force_console=True,
        )
        return {
            'success': True,
            'message': f'Remapped "{hole_name}" to {pts.count} point(s) from "{selection_set_name}"',
        }

    except Exception as e:
        futil.log(f'remap_hole: error: {e}', force_console=True)
        return _remap_fail(str(e))

    finally:
        if timeline_rolled:
            try:
                timeline.moveToEnd()
                futil.log('remap_hole: timeline restored', force_console=True)
            except Exception as restore_err:
                futil.log(f'remap_hole: failed to restore timeline: {restore_err}',
                          force_console=True)
        if was_collapsed and parent_group:
            try:
                parent_group.isCollapsed = True
            except Exception:
                pass


# ═══════════════════════════════════════════════════════════════════
# Zero Fret toggle
# ═══════════════════════════════════════════════════════════════════

def toggle_zero_fret(design: adsk.fusion.Design, enabled: bool) -> dict:
    """Toggle the Zero Fret feature on/off.

    When enabled: unsuppress 'Zero Fret Slot Cut' group, set ZeroFretAdjust to FretCrownWidth * 1
    When disabled: suppress 'Zero Fret Slot Cut' group, set ZeroFretAdjust to FretCrownWidth * 0
    """
    try:
        item = timeline_manager.find_item_by_name(design, 'Zero Fret Slot Cut', exact=True)
        if not item:
            return {'success': False, 'message': 'Zero Fret Slot Cut group not found in timeline'}

        timeline_obj = item.get('object')
        if not timeline_obj:
            return {'success': False, 'message': 'Zero Fret Slot Cut has no timeline object'}

        try:
            timeline_obj.isSuppressed = not enabled
            futil.log(f'toggle_zero_fret: set suppressed={not enabled}', force_console=True)
        except Exception as e:
            futil.log(f'toggle_zero_fret: failed to set suppression: {e}', force_console=True)
            return {'success': False, 'message': f'Failed to set suppression state: {str(e)}'}

        # Update ZeroFretAdjust parameter (non-fatal)
        try:
            new_expr = 'FretCrownWidth * 1' if enabled else 'FretCrownWidth * 0'
            zero_fret_adjust = design.userParameters.itemByName('ZeroFretAdjust')
            if zero_fret_adjust:
                zero_fret_adjust.expression = new_expr
                futil.log(f'toggle_zero_fret: set ZeroFretAdjust = "{new_expr}"', force_console=True)
            else:
                futil.log('toggle_zero_fret: ZeroFretAdjust parameter not found', force_console=True)
        except Exception as e:
            futil.log(f'toggle_zero_fret: failed to update parameter: {e}', force_console=True)

        status = 'enabled' if enabled else 'disabled'
        return {'success': True, 'message': f'Zero Fret {status}'}

    except Exception as e:
        futil.log(f'toggle_zero_fret: error: {e}', force_console=True)
        return {'success': False, 'message': str(e)}


# ═══════════════════════════════════════════════════════════════════
# Blind Frets toggle
# ═══════════════════════════════════════════════════════════════════

def toggle_blind_frets(design: adsk.fusion.Design, enabled: bool) -> dict:
    """Toggle the Blind Frets feature on/off by updating the BlindFret parameter.

    When enabled: BlindFret = 0.0625 in * 1
    When disabled: BlindFret = 0.0625 in * -1
    """
    try:
        blind_fret = design.userParameters.itemByName('BlindFret')
        if not blind_fret:
            return {'success': False, 'message': 'BlindFret parameter not found'}

        new_expr = '0.0625 in * 1' if enabled else '0.0625 in * -1'
        blind_fret.expression = new_expr
        futil.log(f'toggle_blind_frets: set BlindFret = "{new_expr}"', force_console=True)

        status = 'enabled' if enabled else 'disabled'
        return {'success': True, 'message': f'Blind Frets {status}'}

    except Exception as e:
        futil.log(f'toggle_blind_frets: error: {e}', force_console=True)
        return {'success': False, 'message': str(e)}


# ═══════════════════════════════════════════════════════════════════
# Document cache key (shared by radius mode and heel curve)
# ═══════════════════════════════════════════════════════════════════

def get_doc_cache_key(design: adsk.fusion.Design) -> str:
    """Build a stable key for radius cache lookups.

    Tries multiple strategies in order:
    1. datafile.id (most stable for cloud-based designs)
    2. document.fullPathName (for local files)
    3. document.name (fallback for unsaved docs)
    """
    try:
        doc = design.parentDocument
        if not doc:
            return ''

        data_file = getattr(doc, 'dataFile', None)
        data_file_id = getattr(data_file, 'id', '') if data_file else ''
        if data_file_id:
            return f'datafile:{data_file_id}'

        full_path = getattr(doc, 'fullPathName', '') or ''
        if full_path:
            return f'path:{full_path.lower()}'

        name = getattr(doc, 'name', '') or ''
        if name:
            return f'unsaved:{name}'
    except Exception:
        pass
    return ''


# ═══════════════════════════════════════════════════════════════════
# Radius mode
# ═══════════════════════════════════════════════════════════════════

def set_radius_mode(design: adsk.fusion.Design, mode_data: dict) -> dict:
    """Set the fretboard radius mode.

    Modes:
    - 'straight': HeelRadius = NutRadius (parameter reference)
    - 'compound': HeelRadius has independent value (default behavior)
    - 'flat': Both NutRadius and HeelRadius = 10000 in
    """
    def _detect_current_mode(nut_expr: str, heel_expr: str) -> str:
        nut_clean = (nut_expr or '').strip().lower()
        heel_clean = (heel_expr or '').strip().lower()
        if heel_clean == 'nutradius':
            return 'straight'
        if nut_clean == heel_clean and ('10000 in' in nut_clean or '254000 mm' in nut_clean):
            return 'flat'
        return 'compound'

    try:
        mode = mode_data.get('mode', 'compound')
        futil.log(f'set_radius_mode: Setting radius mode to {mode}', force_console=True)

        params = design.userParameters
        nut_radius = params.itemByName('NutRadius')
        heel_radius = params.itemByName('HeelRadius')

        if not nut_radius:
            return {'success': False, 'message': 'NutRadius parameter not found'}
        if not heel_radius:
            return {'success': False, 'message': 'HeelRadius parameter not found'}

        doc_cache_key = get_doc_cache_key(design)
        current_nut_expr = nut_radius.expression
        current_heel_expr = heel_radius.expression
        current_mode = _detect_current_mode(current_nut_expr, current_heel_expr)

        # Persist compound expressions before switching into a derived mode.
        if mode in ('flat', 'straight') and current_mode == 'compound' and doc_cache_key:
            radius_cache.set_cached_radii(doc_cache_key, current_nut_expr, current_heel_expr)
            futil.log(f'set_radius_mode: cached compound radii for key "{doc_cache_key}"', force_console=True)

        # Persist straight NutRadius before switching to flat.
        if mode == 'flat' and current_mode == 'straight' and doc_cache_key:
            radius_cache.set_cached_straight_nut(doc_cache_key, current_nut_expr)
            futil.log(f'set_radius_mode: cached straight nut radius for key "{doc_cache_key}"', force_console=True)

        doc_unit = design.fusionUnitsManager.defaultLengthUnits

        if mode == 'flat':
            flat_expr = '254000 mm' if is_metric_length_unit(doc_unit) else '10000 in'
            nut_radius.expression = flat_expr
            heel_radius.expression = flat_expr
            futil.log(f'set_radius_mode: Set both radii to {flat_expr} (flat mode)', force_console=True)
            message = 'Fretboard radius set to Flat'

        elif mode == 'straight':
            if current_mode == 'flat' and doc_cache_key:
                cached_straight_nut = radius_cache.get_cached_straight_nut(doc_cache_key)
                if cached_straight_nut:
                    nut_radius.expression = cached_straight_nut
                    futil.log(f'set_radius_mode: restored straight nut radius for key "{doc_cache_key}"', force_console=True)
            heel_radius.expression = 'NutRadius'
            futil.log('set_radius_mode: Set HeelRadius = NutRadius (straight mode)', force_console=True)
            message = 'Fretboard radius set to Straight'

        elif mode == 'compound':
            restored = False
            if doc_cache_key:
                cached = radius_cache.get_cached_radii(doc_cache_key)
                if cached:
                    cached_nut = cached.get('nutRadius')
                    cached_heel = cached.get('heelRadius')
                    if cached_nut and cached_heel:
                        nut_radius.expression = cached_nut
                        heel_radius.expression = cached_heel
                        restored = True
                        futil.log(f'set_radius_mode: restored cached compound radii for key "{doc_cache_key}"', force_console=True)

            if not restored:
                current_expr = heel_radius.expression
                if current_expr.strip() == 'NutRadius':
                    resolved_value = nut_radius.value
                    heel_radius.value = resolved_value
                    futil.log(f'set_radius_mode: Converted HeelRadius from reference to independent value {heel_radius.expression}', force_console=True)
                else:
                    futil.log('set_radius_mode: HeelRadius already independent (compound mode)', force_console=True)
            message = 'Fretboard radius set to Compound'

        else:
            return {'success': False, 'message': f'Unknown radius mode: {mode}'}

        return {'success': True, 'message': message}

    except Exception as e:
        futil.log(f'set_radius_mode: error: {e}', force_console=True)
        return {'success': False, 'message': str(e)}


# ═══════════════════════════════════════════════════════════════════
# Heel Curve toggle
# ═══════════════════════════════════════════════════════════════════

def toggle_heel_curve(design: adsk.fusion.Design, enabled: bool) -> dict:
    """Toggle the Heel Curve between user value and flat (10000 in / 254000 mm).

    When disabling (enabled=False): Cache current value, then set to flat
    When enabling (enabled=True): Restore cached value (or schema default)
    """
    try:
        heel_curve = design.userParameters.itemByName('HeelCurveRadius')
        if not heel_curve:
            return {'success': False, 'message': 'HeelCurveRadius parameter not found'}

        doc_unit = design.fusionUnitsManager.defaultLengthUnits
        doc_cache_key = get_doc_cache_key(design)
        current_expr = heel_curve.expression
        flat_expr = '10000 in' if doc_unit == 'in' else '254000 mm'

        if enabled:
            restored = False
            if doc_cache_key:
                cached_value = radius_cache.get_cached_heel_curve(doc_cache_key)
                if cached_value:
                    heel_curve.expression = cached_value
                    restored = True
                    futil.log(f'toggle_heel_curve: restored cached value "{cached_value}"', force_console=True)

            if not restored:
                default_expr = '4 in' if doc_unit == 'in' else '102 mm'
                heel_curve.expression = default_expr
                futil.log(f'toggle_heel_curve: no cache, using schema default "{default_expr}"', force_console=True)

            message = 'Heel Curve enabled'
        else:
            if doc_cache_key and current_expr != flat_expr:
                radius_cache.set_cached_heel_curve(doc_cache_key, current_expr)
                futil.log(f'toggle_heel_curve: cached current value "{current_expr}"', force_console=True)

            heel_curve.expression = flat_expr
            futil.log(f'toggle_heel_curve: set to flat "{flat_expr}"', force_console=True)
            message = 'Heel Curve disabled (flat)'

        return {'success': True, 'message': message}

    except Exception as e:
        futil.log(f'toggle_heel_curve: error: {e}', force_console=True)
        return {'success': False, 'message': str(e)}
