"""Admin API: auth, every route, self-protection, last-admin protection, and purge scoping."""

from __future__ import annotations

import re

import pytest
from admin_helpers import admin_app, call

POLICY = re.compile(r"^(?=.*[A-Z])(?=.*[a-z])(?=.*\d).{8,}$")


@pytest.fixture
def people(world):
    owner = world.person("owner@example.com", admin=True)
    world.confirm(owner)
    friend = world.person("friend@example.com")
    world.confirm(friend)
    invited = world.person("invited@example.com")
    return owner, friend, invited


# ── auth ───────────────────────────────────────────────────────────────
@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("GET", "/api/admin/users"),
        ("POST", "/api/admin/users"),
        ("POST", "/api/admin/users/x/disable"),
        ("POST", "/api/admin/users/x/enable"),
        ("POST", "/api/admin/users/x/reset-password"),
        ("POST", "/api/admin/users/x/resend"),
        ("POST", "/api/admin/users/x/admin"),
        ("DELETE", "/api/admin/users/x"),
    ],
)
def test_non_admin_gets_403_on_every_route(world, people, method, path):
    _owner, friend, _ = people
    status, body = call(method, path, friend, groups=None, body={"email": "a@b.co", "admin": True})
    assert status == 403
    assert body["error"]


def test_other_groups_are_not_admin(world, people):
    _owner, friend, _ = people
    assert call("GET", "/api/admin/users", friend, groups="[viewers]")[0] == 403


def test_signed_out_is_401(world, people):
    assert call("GET", "/api/admin/users", None)[0] == 401


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("[admin]", ["admin"]),
        ("[viewers admin]", ["viewers", "admin"]),
        ('["admin","x"]', ["admin", "x"]),
        (["admin"], ["admin"]),
        ("admin", ["admin"]),
        ("", []),
        (None, []),
        ("[]", []),
    ],
)
def test_parse_groups(raw, expected):
    assert admin_app.parse_groups(raw) == expected


# ── list ───────────────────────────────────────────────────────────────
def test_list_users(world, people):
    owner, friend, invited = people
    status, users = call("GET", "/api/admin/users", owner, groups=["admin"])
    assert status == 200
    assert [u["email"] for u in users] == ["friend@example.com", "invited@example.com", "owner@example.com"]
    by = {u["email"]: u for u in users}
    assert by["owner@example.com"]["isAdmin"] is True
    assert by["owner@example.com"]["isSelf"] is True
    assert by["friend@example.com"]["isAdmin"] is False
    assert by["friend@example.com"]["status"] == "CONFIRMED"
    assert by["invited@example.com"]["status"] == "FORCE_CHANGE_PASSWORD"
    for u in users:
        assert set(u) >= {"username", "email", "status", "enabled", "createdAt", "isAdmin", "lastModified"}
        assert u["enabled"] is True


# ── invite ─────────────────────────────────────────────────────────────
def test_invite_creates_user_with_policy_password(world, people):
    owner, *_ = people
    status, body = call("POST", "/api/admin/users", owner, body={"email": "  New@Example.com "})
    assert status == 201
    assert POLICY.match(body["temporaryPassword"])
    assert body["user"]["email"] == "new@example.com"
    assert body["user"]["status"] == "FORCE_CHANGE_PASSWORD"
    assert body["user"]["isAdmin"] is False
    attrs = {
        a["Name"]: a["Value"]
        for a in world.idp.admin_get_user(UserPoolId=world.pool, Username=body["user"]["username"])[
            "UserAttributes"
        ]
    }
    assert attrs["email_verified"] == "true"


def test_invite_as_admin(world, people):
    owner, *_ = people
    status, body = call("POST", "/api/admin/users", owner, body={"email": "boss@example.com", "admin": True})
    assert status == 201
    assert body["user"]["isAdmin"] is True
    assert body["user"]["username"] in world.admins()


@pytest.mark.parametrize("email", ["", "nope", "a@b", "a b@c.com", None, 42, "x@" + "a" * 260 + ".com"])
def test_invite_rejects_bad_email(world, people, email):
    owner, *_ = people
    assert call("POST", "/api/admin/users", owner, body={"email": email})[0] == 400


def test_invite_rejects_non_bool_admin(world, people):
    owner, *_ = people
    assert call("POST", "/api/admin/users", owner, body={"email": "x@example.com", "admin": "yes"})[0] == 400


def test_invite_existing_email_is_409(world, people):
    owner, *_ = people
    assert call("POST", "/api/admin/users", owner, body={"email": "friend@example.com"})[0] == 409


# ── disable / enable ───────────────────────────────────────────────────
def test_disable_then_enable(world, people):
    owner, friend, _ = people
    status, body = call("POST", f"/api/admin/users/{friend.username}/disable", owner)
    assert status == 200
    assert body["user"]["enabled"] is False
    assert world.get(friend)["Enabled"] is False
    status, body = call("POST", f"/api/admin/users/{friend.username}/enable", owner)
    assert status == 200
    assert body["user"]["enabled"] is True


def test_cannot_disable_self(world, people):
    owner, *_ = people
    status, body = call("POST", f"/api/admin/users/{owner.username}/disable", owner)
    assert status == 409
    assert world.get(owner)["Enabled"] is True
    assert "own" in body["error"]


def test_unknown_user_is_404(world, people):
    owner, *_ = people
    assert call("POST", "/api/admin/users/00000000-0000-0000-0000-000000000000/disable", owner)[0] == 404


def test_bad_username_is_400(world, people):
    owner, *_ = people
    assert call("POST", "/api/admin/users/bad%20name%3B/disable", owner)[0] == 400


# ── reset password / resend ────────────────────────────────────────────
def test_reset_password(world, people):
    owner, friend, _ = people
    status, body = call("POST", f"/api/admin/users/{friend.username}/reset-password", owner)
    assert status == 200
    assert POLICY.match(body["temporaryPassword"])
    assert world.get(friend)["UserStatus"] == "FORCE_CHANGE_PASSWORD"


def test_cannot_reset_own_password(world, people):
    owner, *_ = people
    assert call("POST", f"/api/admin/users/{owner.username}/reset-password", owner)[0] == 409


def test_resend_for_invited(world, people, monkeypatch):
    # moto treats RESEND-by-alias as a brand-new user, so record the call instead of letting moto run it.
    owner, _, invited = people
    sent: list[dict] = []
    client = admin_app.cognito()
    real = client.admin_create_user
    monkeypatch.setattr(
        client,
        "admin_create_user",
        lambda **kw: sent.append(kw) or {} if kw.get("MessageAction") == "RESEND" else real(**kw),
    )
    status, body = call("POST", f"/api/admin/users/{invited.username}/resend", owner)
    assert status == 200
    assert POLICY.match(body["temporaryPassword"])
    assert body["user"]["status"] == "FORCE_CHANGE_PASSWORD"
    assert len(sent) == 1
    assert sent[0]["Username"] == "invited@example.com"
    assert sent[0]["MessageAction"] == "RESEND"
    assert sent[0]["DesiredDeliveryMediums"] == ["EMAIL"]
    assert sent[0]["TemporaryPassword"] == body["temporaryPassword"]


def test_resend_for_confirmed_is_409(world, people):
    owner, friend, _ = people
    assert call("POST", f"/api/admin/users/{friend.username}/resend", owner)[0] == 409


# ── admin toggle ───────────────────────────────────────────────────────
def test_promote_and_demote(world, people):
    owner, friend, _ = people
    status, body = call("POST", f"/api/admin/users/{friend.username}/admin", owner, body={"admin": True})
    assert status == 200
    assert body["user"]["isAdmin"] is True
    assert friend.username in world.admins()
    status, body = call("POST", f"/api/admin/users/{friend.username}/admin", owner, body={"admin": False})
    assert status == 200
    assert body["user"]["isAdmin"] is False
    assert friend.username not in world.admins()


def test_cannot_demote_self(world, people):
    owner, friend, _ = people
    call("POST", f"/api/admin/users/{friend.username}/admin", owner, body={"admin": True})
    status, body = call("POST", f"/api/admin/users/{owner.username}/admin", owner, body={"admin": False})
    assert status == 409
    assert body["error"] == "You can't remove your own admin access."
    assert owner.username in world.admins()


def test_admin_toggle_requires_bool(world, people):
    owner, friend, _ = people
    assert call("POST", f"/api/admin/users/{friend.username}/admin", owner, body={})[0] == 400


def test_last_admin_cannot_be_demoted_or_deleted(world, people):
    # A stale token: `friend` still claims admin, but the owner is the only real admin left.
    owner, friend, _ = people
    status, body = call("POST", f"/api/admin/users/{owner.username}/admin", friend, body={"admin": False})
    assert status == 409
    assert "at least one admin" in body["error"]
    assert call("DELETE", f"/api/admin/users/{owner.username}", friend)[0] == 409
    assert call("POST", f"/api/admin/users/{owner.username}/disable", friend)[0] == 409
    assert owner.username in world.admins()


def test_other_admin_can_be_removed_when_two_remain(world, people):
    owner, friend, _ = people
    call("POST", f"/api/admin/users/{friend.username}/admin", owner, body={"admin": True})
    assert call("DELETE", f"/api/admin/users/{friend.username}", owner)[0] == 200
    assert world.admins() == {owner.username}


# ── delete / purge ─────────────────────────────────────────────────────
def test_delete_without_purge_keeps_data(world, people):
    owner, friend, _ = people
    world.seed_data(friend)
    status, body = call("DELETE", f"/api/admin/users/{friend.username}", owner)
    assert status == 200
    assert body == {"deleted": True, "purged": {"items": 0, "photos": 0}}
    assert world.item_count(friend) == 4
    assert world.photo_count(friend) == 2
    users = world.idp.list_users(UserPoolId=world.pool)["Users"]
    assert friend.username not in {u["Username"] for u in users}


def test_purge_deletes_only_that_users_data(world, people):
    owner, friend, invited = people
    world.seed_data(friend, n=30)
    world.seed_data(owner)
    world.seed_data(invited)
    status, body = call("DELETE", f"/api/admin/users/{friend.username}", owner, query="purge=true")
    assert status == 200
    assert body["purged"] == {"items": 31, "photos": 2}
    assert world.item_count(friend) == 0
    assert world.photo_count(friend) == 0
    assert world.item_count(owner) == 4
    assert world.photo_count(owner) == 2
    assert world.item_count(invited) == 4
    assert world.photo_count(invited) == 2


def test_cannot_delete_self(world, people):
    owner, *_ = people
    world.seed_data(owner)
    assert call("DELETE", f"/api/admin/users/{owner.username}", owner, query="purge=true")[0] == 409
    assert world.item_count(owner) == 4


def test_unknown_route_is_404(world, people):
    owner, *_ = people
    assert call("GET", "/api/admin/nope", owner)[0] == 404
