"""Earnings workflow through the HTTP API: validation, persistence, isolation, summary."""

from datetime import date, timedelta

import pytest
from conftest import DEVICE, OTHER_DEVICE, entry


def test_add_entry_saves_and_returns_net(client):
    response = client.post("/api/earnings", json=entry(gross=800, expenses=150, note="Evening shift"))
    assert response.status_code == 201
    body = response.json()
    assert body["net"] == 650
    assert body["note"] == "Evening shift"
    assert client.get("/api/earnings").json()[0]["id"] == body["id"]


def test_summary_uses_stored_records(client):
    client.post("/api/earnings", json=entry(gross=800, expenses=150, hours=8))
    client.post("/api/earnings", json=entry(gross=200, expenses=50, hours=2))
    summary = client.get("/api/summary").json()
    assert summary["today"]["net"] == 800
    assert summary["week"]["hours"] == 10
    assert summary["all_time"]["entries"] == 2
    assert summary["has_data"] is True


def test_summary_empty_state(client):
    summary = client.get("/api/summary").json()
    assert summary["has_data"] is False
    assert summary["week"]["net"] == 0


@pytest.mark.parametrize(
    "overrides",
    [
        {"gross": -1},
        {"expenses": -5},
        {"hours": 24.5},
        {"hours": -1},
        {"gross": 1_000_001},
        {"gross": "lots"},
        {"entry_date": "not-a-date"},
        {"note": "x" * 201},
    ],
)
def test_invalid_numbers_are_rejected(client, overrides):
    response = client.post("/api/earnings", json=entry(**overrides))
    assert response.status_code == 422
    assert client.get("/api/earnings").json() == []  # nothing was saved


def test_future_and_ancient_dates_are_rejected(client):
    tomorrow = (date.today() + timedelta(days=2)).isoformat()
    long_ago = (date.today() - timedelta(days=400)).isoformat()
    assert client.post("/api/earnings", json=entry(entry_date=tomorrow)).status_code == 422
    assert client.post("/api/earnings", json=entry(entry_date=long_ago)).status_code == 422


def test_validation_errors_do_not_echo_input(client):
    response = client.post("/api/earnings", json=entry(gross="SECRET-TEXT"))
    assert "SECRET-TEXT" not in response.text


def test_device_header_is_required_and_checked(client):
    assert client.get("/api/earnings", headers={"X-Device-Id": ""}).status_code == 400
    assert client.get("/api/earnings", headers={"X-Device-Id": "short"}).status_code == 400
    assert client.get("/api/earnings", headers={"X-Device-Id": "x" * 16 + "'; DROP TABLE"}).status_code == 400


def test_guessable_device_ids_are_rejected(client):
    for weak in ("aaaaaaaaaaaaaaaa", "device-aaaaaaaaaaaaaaaa", "00000000-0000-0000-0000-000000000000", "1" * 36):
        assert client.get("/api/earnings", headers={"X-Device-Id": weak}).status_code == 400, weak


def test_entries_per_device_are_capped(make_client):
    client = make_client(max_entries_per_device=2)
    assert client.post("/api/earnings", json=entry()).status_code == 201
    assert client.post("/api/earnings", json=entry()).status_code == 201
    full = client.post("/api/earnings", json=entry())
    assert full.status_code == 409
    assert "limit" in full.json()["detail"].lower()
    # another device has its own allowance
    other = client.post("/api/earnings", json=entry(), headers={"X-Device-Id": OTHER_DEVICE})
    assert other.status_code == 201
    # deleting frees space
    first_id = client.get("/api/earnings").json()[0]["id"]
    assert client.delete(f"/api/earnings/{first_id}").status_code == 204
    assert client.post("/api/earnings", json=entry()).status_code == 201


def test_one_device_cannot_see_or_delete_anothers_data(client):
    created = client.post("/api/earnings", json=entry()).json()
    other = {"X-Device-Id": OTHER_DEVICE}

    assert client.get("/api/earnings", headers=other).json() == []
    assert client.get("/api/summary", headers=other).json()["has_data"] is False
    assert client.delete(f"/api/earnings/{created['id']}", headers=other).status_code == 404
    assert len(client.get("/api/earnings", headers={"X-Device-Id": DEVICE}).json()) == 1


def test_delete_entry_and_clear_all(client):
    first = client.post("/api/earnings", json=entry()).json()
    client.post("/api/earnings", json=entry())
    assert client.delete(f"/api/earnings/{first['id']}").status_code == 204
    assert len(client.get("/api/earnings").json()) == 1
    assert client.delete("/api/earnings").status_code == 204
    assert client.get("/api/earnings").json() == []
    assert client.delete(f"/api/earnings/{first['id']}").status_code == 404


def test_sql_injection_text_is_stored_as_plain_text(client):
    payload = "'); DROP TABLE earnings; --"
    client.post("/api/earnings", json=entry(note=payload))
    assert client.get("/api/earnings").json()[0]["note"] == payload
