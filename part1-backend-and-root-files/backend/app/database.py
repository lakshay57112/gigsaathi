"""SQLite persistence. Every query is parameterised and scoped to one device id."""

import sqlite3
from collections.abc import Iterator
from threading import Lock

SCHEMA = """
CREATE TABLE IF NOT EXISTS earnings (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id  TEXT    NOT NULL,
    entry_date TEXT    NOT NULL,
    gross      REAL    NOT NULL CHECK (gross >= 0),
    hours      REAL    NOT NULL CHECK (hours >= 0 AND hours <= 24),
    expenses   REAL    NOT NULL CHECK (expenses >= 0),
    note       TEXT    NOT NULL DEFAULT '',
    created_at TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_earnings_device_date ON earnings (device_id, entry_date);
"""

_initialised: set[str] = set()
_init_lock = Lock()


def connect(path: str) -> sqlite3.Connection:
    """Open a connection and make sure the schema exists (once per database file)."""
    # check_same_thread=False: a request's connection may hop between worker threads,
    # but a connection is never shared between requests.
    conn = sqlite3.connect(path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    with _init_lock:
        if path not in _initialised:
            conn.executescript(SCHEMA)
            _initialised.add(path)
    return conn


def connection_scope(path: str) -> Iterator[sqlite3.Connection]:
    conn = connect(path)
    try:
        yield conn
    finally:
        conn.close()
