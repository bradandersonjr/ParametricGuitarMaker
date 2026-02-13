# Commands package for Parametric Guitar: Fretboard Maker
# Each command module provides start() and stop() functions.

from .guitarMaker import entry as guitarMaker

# List of all command modules. Fusion calls start() and stop() on each.
commands = [
    guitarMaker,
]


def start():
    for command in commands:
        command.start()


def stop():
    for command in commands:
        command.stop()
