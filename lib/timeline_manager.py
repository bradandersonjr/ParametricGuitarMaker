"""
Timeline Manager — comprehensive timeline group and feature management for Fusion 360.

Provides utilities to:
- List all timeline items (features and groups)
- Find features/groups by name or pattern
- Suppress/unsuppress features and groups
- Manage group operations (show/hide contents)
- Get timeline state information
"""

import re
import adsk.core
import adsk.fusion
from . import fusionAddInUtils as futil

app = adsk.core.Application.get()


# ═══════════════════════════════════════════════════════════════════
# Timeline Item Retrieval
# ═══════════════════════════════════════════════════════════════════

def get_timeline(design: adsk.fusion.Design) -> adsk.fusion.Timeline:
    """Get the design's timeline object.

    Args:
        design: The active Fusion design.

    Returns:
        adsk.fusion.Timeline: The timeline, or None if invalid.
    """
    if not design:
        return None
    try:
        return design.timeline
    except Exception as e:
        futil.log(f'Timeline Manager: Failed to get timeline: {e}',
                  adsk.core.LogLevels.ErrorLogLevel)
        return None


def get_all_items(design: adsk.fusion.Design, include_suppressed: bool = True):
    """Get all timeline items (features and groups).

    Args:
        design: The active Fusion design.
        include_suppressed: Include suppressed items in results.

    Returns:
        list: Dicts with keys: name, type (Feature/Group), suppressed, index
    """
    timeline = get_timeline(design)
    if not timeline:
        return []

    items = []
    try:
        for i in range(timeline.count):
            item = timeline.item(i)
            is_suppressed = item.isSuppressed
            is_group = item.isGroup

            if not include_suppressed and is_suppressed:
                continue

            items.append({
                'name': item.name,
                'type': 'Group' if is_group else 'Feature',
                'suppressed': is_suppressed,
                'index': i,
                'object': item,
            })
    except Exception as e:
        futil.log(f'Timeline Manager: Failed to get all items: {e}',
                  adsk.core.LogLevels.ErrorLogLevel)

    return items


def find_item_by_name(design: adsk.fusion.Design, name: str, exact: bool = True):
    """Find a timeline item by name.

    Args:
        design: The active Fusion design.
        name: The item name to find.
        exact: If True, match exactly; if False, use regex.

    Returns:
        dict: Item dict (see get_all_items), or None if not found.
    """
    timeline = get_timeline(design)
    if not timeline:
        return None

    try:
        if exact:
            # Try itemByName first (works for features), then fall back to iteration
            # (needed for groups, which itemByName may not find)
            item = timeline.itemByName(name)
            if item:
                return {
                    'name': item.name,
                    'type': 'Group' if item.isGroup else 'Feature',
                    'suppressed': item.isSuppressed,
                    'object': item,
                }
            # Fallback: scan all items by name
            for item_dict in get_all_items(design, include_suppressed=True):
                if item_dict['name'] == name:
                    return item_dict
        else:
            # Regex search
            pattern = re.compile(name, re.IGNORECASE)
            for item_dict in get_all_items(design, include_suppressed=True):
                if pattern.search(item_dict['name']):
                    return item_dict
    except Exception as e:
        futil.log(f'Timeline Manager: Failed to find item "{name}": {e}',
                  adsk.core.LogLevels.ErrorLogLevel)

    return None


def find_items_by_pattern(design: adsk.fusion.Design, pattern: str):
    """Find all timeline items matching a regex pattern.

    Args:
        design: The active Fusion design.
        pattern: Regex pattern to match (e.g., "^Fret.*", ".*Slot.*").

    Returns:
        list: Matching item dicts.
    """
    items = []
    try:
        regex = re.compile(pattern, re.IGNORECASE)
        for item_dict in get_all_items(design, include_suppressed=True):
            if regex.search(item_dict['name']):
                items.append(item_dict)
    except Exception as e:
        futil.log(f'Timeline Manager: Invalid regex pattern "{pattern}": {e}',
                  adsk.core.LogLevels.ErrorLogLevel)

    return items


# ═══════════════════════════════════════════════════════════════════
# Suppress / Unsuppress Operations
# ═══════════════════════════════════════════════════════════════════

def _set_suppressed(timeline_obj, suppressed: bool) -> bool:
    """Set the suppressed state on a timeline object.

    For features, sets isSuppressed on the entity (Feature).
    For groups, sets isSuppressed on the TimelineObject directly.
    """
    # For groups, set directly on the timeline object
    if timeline_obj.isGroup:
        timeline_obj.isSuppressed = suppressed
        return True

    # For features, try the entity first (Feature.isSuppressed)
    entity = timeline_obj.entity
    if entity:
        feature = adsk.fusion.Feature.cast(entity)
        if feature:
            feature.isSuppressed = suppressed
            return True

    # Fallback: set on the timeline object itself
    timeline_obj.isSuppressed = suppressed
    return True


def suppress_item(design: adsk.fusion.Design, name: str) -> bool:
    """Suppress a timeline item by name.

    Args:
        design: The active Fusion design.
        name: The name of the item to suppress.

    Returns:
        bool: True if successful, False otherwise.
    """
    item_dict = find_item_by_name(design, name, exact=True)
    if not item_dict:
        futil.log(f'Timeline Manager: Item not found: {name}',
                  adsk.core.LogLevels.WarningLogLevel)
        return False

    try:
        _set_suppressed(item_dict['object'], True)
        futil.log(f'Timeline Manager: Suppressed {item_dict["type"].lower()} "{name}"')
        return True
    except Exception as e:
        futil.log(f'Timeline Manager: Failed to suppress "{name}": {e}',
                  adsk.core.LogLevels.ErrorLogLevel)
        return False


def unsuppress_item(design: adsk.fusion.Design, name: str) -> bool:
    """Unsuppress a timeline item by name.

    Args:
        design: The active Fusion design.
        name: The name of the item to unsuppress.

    Returns:
        bool: True if successful, False otherwise.
    """
    item_dict = find_item_by_name(design, name, exact=True)
    if not item_dict:
        futil.log(f'Timeline Manager: Item not found: {name}',
                  adsk.core.LogLevels.WarningLogLevel)
        return False

    try:
        _set_suppressed(item_dict['object'], False)
        futil.log(f'Timeline Manager: Unsuppressed {item_dict["type"].lower()} "{name}"')
        return True
    except Exception as e:
        futil.log(f'Timeline Manager: Failed to unsuppress "{name}": {e}',
                  adsk.core.LogLevels.ErrorLogLevel)
        return False


def toggle_item(design: adsk.fusion.Design, name: str) -> bool:
    """Toggle suppress state of a timeline item.

    Args:
        design: The active Fusion design.
        name: The name of the item to toggle.

    Returns:
        bool: New suppress state (True = suppressed, False = active), or None on failure.
    """
    item_dict = find_item_by_name(design, name, exact=True)
    if not item_dict:
        return None

    try:
        new_state = not item_dict['object'].isSuppressed
        _set_suppressed(item_dict['object'], new_state)
        action = 'Suppressed' if new_state else 'Unsuppressed'
        futil.log(f'Timeline Manager: {action} {item_dict["type"].lower()} "{name}"')
        return new_state
    except Exception as e:
        futil.log(f'Timeline Manager: Failed to toggle "{name}": {e}',
                  adsk.core.LogLevels.ErrorLogLevel)
        return None


def suppress_items_by_pattern(design: adsk.fusion.Design, pattern: str) -> int:
    """Suppress all items matching a regex pattern.

    Args:
        design: The active Fusion design.
        pattern: Regex pattern to match.

    Returns:
        int: Number of items successfully suppressed.
    """
    items = find_items_by_pattern(design, pattern)
    count = 0

    for item_dict in items:
        try:
            _set_suppressed(item_dict['object'], True)
            count += 1
        except Exception as e:
            futil.log(f'Timeline Manager: Failed to suppress "{item_dict["name"]}": {e}',
                      adsk.core.LogLevels.WarningLogLevel)

    if count > 0:
        futil.log(f'Timeline Manager: Suppressed {count} item(s) matching "{pattern}"')

    return count


def unsuppress_items_by_pattern(design: adsk.fusion.Design, pattern: str) -> int:
    """Unsuppress all items matching a regex pattern.

    Args:
        design: The active Fusion design.
        pattern: Regex pattern to match.

    Returns:
        int: Number of items successfully unsuppressed.
    """
    items = find_items_by_pattern(design, pattern)
    count = 0

    for item_dict in items:
        try:
            _set_suppressed(item_dict['object'], False)
            count += 1
        except Exception as e:
            futil.log(f'Timeline Manager: Failed to unsuppress "{item_dict["name"]}": {e}',
                      adsk.core.LogLevels.WarningLogLevel)

    if count > 0:
        futil.log(f'Timeline Manager: Unsuppressed {count} item(s) matching "{pattern}"')

    return count


# ═══════════════════════════════════════════════════════════════════
# Group Operations
# ═══════════════════════════════════════════════════════════════════

def is_group(design: adsk.fusion.Design, name: str) -> bool:
    """Check if a timeline item is a group.

    Args:
        design: The active Fusion design.
        name: The item name.

    Returns:
        bool: True if item is a group, False if feature, None if not found.
    """
    item_dict = find_item_by_name(design, name, exact=True)
    if not item_dict:
        return None
    return item_dict['type'] == 'Group'


def get_group_items(design: adsk.fusion.Design, group_name: str):
    """Get all items within a group.

    Args:
        design: The active Fusion design.
        group_name: The name of the group.

    Returns:
        list: Item dicts for all items in the group, or [] if not a group.
    """
    timeline = get_timeline(design)
    if not timeline:
        return []

    items = []
    try:
        # itemByName may not find groups; scan all items instead
        group = None
        for i in range(timeline.count):
            candidate = timeline.item(i)
            if candidate.isGroup and candidate.name == group_name:
                group = candidate
                break

        if not group:
            return []

        # Cast to TimelineGroup to access count/item
        tg = adsk.fusion.TimelineGroup.cast(group)
        if not tg:
            return []

        for i in range(tg.count):
            child = tg.item(i)
            items.append({
                'name': child.name,
                'type': 'Group' if child.isGroup else 'Feature',
                'suppressed': child.isSuppressed,
                'index': child.index,
                'object': child,
            })
    except Exception as e:
        futil.log(f'Timeline Manager: Failed to get group items for "{group_name}": {e}',
                  adsk.core.LogLevels.ErrorLogLevel)

    return items


def suppress_group_contents(design: adsk.fusion.Design, group_name: str) -> int:
    """Suppress all items within a group (excluding the group itself).

    Args:
        design: The active Fusion design.
        group_name: The name of the group.

    Returns:
        int: Number of items suppressed, or -1 on failure.
    """
    items = get_group_items(design, group_name)
    if items is None:
        return -1

    count = 0
    for item_dict in items:
        try:
            _set_suppressed(item_dict['object'], True)
            count += 1
        except Exception as e:
            futil.log(f'Timeline Manager: Failed to suppress "{item_dict["name"]}": {e}',
                      adsk.core.LogLevels.WarningLogLevel)

    if count > 0:
        futil.log(f'Timeline Manager: Suppressed {count} item(s) in group "{group_name}"')

    return count


def unsuppress_group_contents(design: adsk.fusion.Design, group_name: str) -> int:
    """Unsuppress all items within a group (excluding the group itself).

    Args:
        design: The active Fusion design.
        group_name: The name of the group.

    Returns:
        int: Number of items unsuppressed, or -1 on failure.
    """
    items = get_group_items(design, group_name)
    if items is None:
        return -1

    count = 0
    for item_dict in items:
        try:
            _set_suppressed(item_dict['object'], False)
            count += 1
        except Exception as e:
            futil.log(f'Timeline Manager: Failed to unsuppress "{item_dict["name"]}": {e}',
                      adsk.core.LogLevels.WarningLogLevel)

    if count > 0:
        futil.log(f'Timeline Manager: Unsuppressed {count} item(s) in group "{group_name}"')

    return count


def suppress_group_with_contents(design: adsk.fusion.Design, group_name: str) -> bool:
    """Suppress a group and all its contents.

    Args:
        design: The active Fusion design.
        group_name: The name of the group.

    Returns:
        bool: True if successful.
    """
    # Suppress the group itself
    if not suppress_item(design, group_name):
        return False

    # Suppress its contents (this will cascade)
    suppress_group_contents(design, group_name)
    return True


def unsuppress_group_with_contents(design: adsk.fusion.Design, group_name: str) -> bool:
    """Unsuppress a group and all its contents.

    Args:
        design: The active Fusion design.
        group_name: The name of the group.

    Returns:
        bool: True if successful.
    """
    # Unsuppress the group first
    if not unsuppress_item(design, group_name):
        return False

    # Unsuppress its contents
    unsuppress_group_contents(design, group_name)
    return True


# ═══════════════════════════════════════════════════════════════════
# Timeline State & Information
# ═══════════════════════════════════════════════════════════════════

def get_timeline_summary(design: adsk.fusion.Design) -> dict:
    """Get a summary of the timeline state.

    Returns:
        dict: Summary with total_items, active_count, suppressed_count, groups, features.
    """
    items = get_all_items(design, include_suppressed=True)

    total = len(items)
    active = sum(1 for i in items if not i['suppressed'])
    suppressed = sum(1 for i in items if i['suppressed'])
    groups = sum(1 for i in items if i['type'] == 'Group')
    features = sum(1 for i in items if i['type'] == 'Feature')

    return {
        'total_items': total,
        'active_count': active,
        'suppressed_count': suppressed,
        'group_count': groups,
        'feature_count': features,
    }


def get_item_state(design: adsk.fusion.Design, name: str) -> dict:
    """Get detailed state of a specific item.

    Returns:
        dict: Item state (name, type, suppressed, index), or None if not found.
    """
    item_dict = find_item_by_name(design, name, exact=True)
    if not item_dict:
        return None

    item = item_dict['object']
    state = {
        'name': item_dict['name'],
        'type': item_dict['type'],
        'suppressed': item_dict['suppressed'],
        'index': item_dict['index'],
    }

    # Add group-specific info
    if item_dict['type'] == 'Group':
        try:
            state['rollUp'] = item.rollUp
            state['group_size'] = len(get_group_items(design, name))
        except Exception:
            pass

    return state


