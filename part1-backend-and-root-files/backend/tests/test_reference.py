"""Welfare schemes, safety content, metadata and security headers."""

from datetime import date

import pytest
from app.services import scheme_service


def test_every_scheme_has_a_source_a_date_and_a_status():
    for scheme in scheme_service.load_reference()["schemes"]:
        assert scheme["source_url"].startswith("https://"), scheme["id"]
        date.fromisoformat(scheme["last_verified"])
        assert scheme["verification_status"] in scheme_service.VERIFICATION_STATUSES
        if scheme["verification_status"] != "verified":
            assert scheme["unverified_notes"], f"{scheme['id']} must say what is unverified"


def test_scheme_links_are_only_the_verified_ones():
    allowed = {None, "https://register.eshram.gov.in"}
    urls = {s["official_url"] for s in scheme_service.load_reference()["schemes"]}
    assert urls <= allowed


def test_schemes_filter_by_occupation_and_state(client):
    body = client.get("/api/schemes", params={"occupation": "delivery_partner", "state": "Karnataka"}).json()
    ids = {s["id"] for s in body["schemes"]}
    assert {"e-shram", "pmjay-gig", "state-gig-laws"} <= ids

    body = client.get("/api/schemes", params={"occupation": "daily_wage", "state": "Punjab"}).json()
    ids = {s["id"] for s in body["schemes"]}
    assert "pmjay-gig" not in ids and "state-gig-laws" not in ids
    assert any("No state-specific information for Punjab" in note for note in body["notes"])


@pytest.mark.parametrize("params", [{"occupation": "pirate", "state": "Punjab"}, {"occupation": "driver", "state": "Atlantis"}])
def test_schemes_reject_unknown_values(client, params):
    assert client.get("/api/schemes", params=params).status_code == 422


def test_schemes_lookup_makes_no_ai_call(make_client):
    def handler(request):
        raise AssertionError("the scheme lookup must not call the AI")

    client = make_client(handler)
    assert client.get("/api/schemes", params={"occupation": "driver", "state": "Delhi"}).status_code == 200


def test_assistant_scheme_tool_only_returns_verified_reference_data(make_client):
    import json

    import httpx
    from conftest import gemini_call, gemini_text

    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        last = json.loads(request.content)["contents"][-1]["parts"][0]
        if "functionResponse" not in last:
            return gemini_call("find_verified_schemes", {"occupation": "driver", "state": "Delhi"})
        seen["result"] = last["functionResponse"]["response"]["result"]
        return gemini_text("See e-Shram.")

    body = make_client(handler).post("/api/assistant/chat", json={"message": "schemes?"}).json()
    assert body["used_scheme_data"] is True
    assert {s["id"] for s in seen["result"]["schemes"]} >= {"e-shram"}


def test_safety_content_separates_guidance_from_emergency_help(client):
    body = client.get("/api/safety").json()
    assert body["emergency"]["can_app_call_for_help"] is False
    assert "112" in {n["number"] for n in body["emergency"]["numbers"]}
    assert "cannot call anyone" in body["disclaimer"]
    assert {s["id"] for s in body["sections"]} >= {"night", "road", "emergency-prep"}


def test_meta_reports_real_ai_configuration(make_client):
    body = make_client().get("/api/meta").json()
    assert body["ai"] == {"configured": True, "provider": "Google Gemini", "model": "gemini-3.8-flash"}
    assert {"en", "hi", "ta", "pa"} <= {lang["code"] for lang in body["languages"]}
    assert "api_key" not in str(body).lower()

    assert make_client(configured=False).get("/api/meta").json()["ai"]["configured"] is False


def test_app_name_is_configurable(settings):
    from app.main import create_app
    from fastapi.testclient import TestClient

    app = create_app(settings.model_copy(update={"app_name": "MyApp"}))
    assert TestClient(app).get("/api/meta").json()["app_name"] == "MyApp"


def test_security_headers_present(client):
    response = client.get("/api/health")
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"
    assert "default-src 'self'" in response.headers["content-security-policy"]
    assert response.headers["cache-control"] == "no-store"


def test_unexpected_errors_do_not_leak_internals(make_client, monkeypatch):
    from fastapi.testclient import TestClient

    client = make_client()

    def explode(*args, **kwargs):
        raise RuntimeError("secret stack detail /etc/passwd")

    monkeypatch.setattr("app.routes.earnings.earnings_repo.list_entries", explode)
    quiet = TestClient(client.app, headers=client.headers, raise_server_exceptions=False)
    response = quiet.get("/api/earnings")
    assert response.status_code == 500
    assert "secret" not in response.text and "passwd" not in response.text
