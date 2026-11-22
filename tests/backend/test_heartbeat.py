from datetime import datetime, timedelta, timezone

from backend.core.heartbeat import check_and_alert, get_status, record_finish, record_start
from backend.models.user import User
from backend.models.worker_heartbeat import WorkerHeartbeat
from tests.backend.test_api_admin import _auth_header, _make_admin, _make_user

T0 = datetime(2026, 11, 22, 7, 0, tzinfo=timezone.utc)


def test_status_ohne_heartbeat_ist_nicht_veraltet(db_session):
    status = get_status(db_session, T0)
    assert status["last_started_at"] is None
    assert status["stale"] is False


def test_record_start_und_finish(db_session):
    record_start(db_session, T0)
    record_finish(db_session, T0 + timedelta(minutes=3), 5)
    status = get_status(db_session, T0 + timedelta(minutes=10))
    assert status["last_started_at"] == T0
    assert status["last_finished_at"] == T0 + timedelta(minutes=3)
    assert status["last_job_count"] == 5
    assert status["stale"] is False


def test_veraltet_nach_35_minuten(db_session):
    record_start(db_session, T0)
    assert get_status(db_session, T0 + timedelta(minutes=35))["stale"] is False
    assert get_status(db_session, T0 + timedelta(minutes=36))["stale"] is True


def test_alarm_genau_einmal_pro_ausfall(db_session):
    _make_admin(db_session)
    _make_user(db_session)
    record_start(db_session, T0)
    sent = []

    def send(emails, last_started, minutes):
        sent.append((emails, last_started, minutes))

    later = T0 + timedelta(hours=1)
    assert check_and_alert(db_session, later, send) is True
    assert check_and_alert(db_session, later + timedelta(minutes=5), send) is False
    assert sent == [(["admin@x.com"], T0, 35)]


def test_kein_alarm_wenn_worker_laeuft(db_session):
    _make_admin(db_session)
    record_start(db_session, T0)
    sent = []
    assert check_and_alert(db_session, T0 + timedelta(minutes=10), lambda *a: sent.append(a)) is False
    assert sent == []


def test_neuer_start_setzt_alarm_zurueck(db_session):
    _make_admin(db_session)
    record_start(db_session, T0)
    sent = []
    check_and_alert(db_session, T0 + timedelta(hours=1), lambda *a: sent.append(a))
    record_start(db_session, T0 + timedelta(hours=2))
    assert db_session.get(WorkerHeartbeat, "worker").alert_sent_at is None
    # zweiter Ausfall alarmiert erneut
    check_and_alert(db_session, T0 + timedelta(hours=3), lambda *a: sent.append(a))
    assert len(sent) == 2


def test_inaktive_admins_werden_nicht_alarmiert(db_session):
    db_session.add(User(eversports_user_id="ev-x", email="old@x.com", encrypted_password="x", active=False, role="admin"))
    db_session.commit()
    record_start(db_session, T0)
    sent = []
    check_and_alert(db_session, T0 + timedelta(hours=1), lambda emails, *a: sent.append(emails))
    assert sent == [[]]


# --- API ---

def test_worker_status_nur_fuer_admins(client, db_session):
    user = _make_user(db_session)
    assert client.get("/api/admin/worker-status", headers=_auth_header(user.id)).status_code == 403


def test_worker_status_liefert_heartbeat(client, db_session):
    admin = _make_admin(db_session)
    now = datetime.now(timezone.utc)
    record_start(db_session, now - timedelta(minutes=5))
    record_finish(db_session, now - timedelta(minutes=4), 2)

    resp = client.get("/api/admin/worker-status", headers=_auth_header(admin.id))
    assert resp.status_code == 200
    body = resp.json()
    assert body["stale"] is False
    assert body["last_job_count"] == 2
    assert body["stale_after_minutes"] == 35
    assert datetime.fromisoformat(body["last_started_at"]).tzinfo is not None


def test_worker_status_meldet_ausfall(client, db_session):
    admin = _make_admin(db_session)
    record_start(db_session, datetime.now(timezone.utc) - timedelta(hours=2))
    body = client.get("/api/admin/worker-status", headers=_auth_header(admin.id)).json()
    assert body["stale"] is True


def test_worker_stale_email_template_rendert(mocker):
    from backend.core import email
    mocker.patch.dict("os.environ", {"RESEND_API_KEY": "k", "FROM_EMAIL": "f@x.com"})
    send = mocker.patch.object(email, "_send")
    email.send_worker_stale_email(["admin@x.com"], T0, 35)
    to, subject, html = send.call_args.args
    assert to == ["admin@x.com"]
    assert "22.11.2026 08:00" in html  # Berliner Zeit
    assert "35 Minuten" in html
