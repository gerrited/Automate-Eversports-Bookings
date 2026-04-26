from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape

BACKEND_DIR = Path(__file__).parent.parent.parent / "backend" / "templates" / "email"
WORKER_DIR = Path(__file__).parent.parent.parent / "worker" / "templates" / "email"
FRONTEND_URL = "https://app.example.de"


def _env(path: Path) -> Environment:
    return Environment(loader=FileSystemLoader(path), autoescape=select_autoescape(["html"]))


def test_booking_failure_renders():
    html = _env(BACKEND_DIR).get_template("booking_failure.html").render(
        class_name="Yoga Basics",
        time_str="18:00",
        weekday_str="Montag",
        date_str="28.04.2026",
        facility_name="FitnessPark Mitte",
        error_message="Kurs bereits ausgebucht",
        frontend_url=FRONTEND_URL,
    )
    assert "Yoga Basics" in html
    assert "Kurs bereits ausgebucht" in html
    assert FRONTEND_URL in html
    assert "#004349" in html
    assert "Buchung fehlgeschlagen" in html


def test_debug_cancel_failure_renders():
    html = _env(BACKEND_DIR).get_template("debug_cancel_failure.html").render(
        class_name="Yoga Basics",
        time_str="18:00",
        weekday_str="Montag",
        date_str="28.04.2026",
        facility_name="FitnessPark Mitte",
        error_message="Verbindung fehlgeschlagen",
        frontend_url=FRONTEND_URL,
    )
    assert "Yoga Basics" in html
    assert "Verbindung fehlgeschlagen" in html
    assert FRONTEND_URL in html
    assert "#004349" in html
    assert "Debug-Stornierung" in html


def test_account_activated_renders():
    html = _env(BACKEND_DIR).get_template("account_activated.html").render(
        frontend_url=FRONTEND_URL,
    )
    assert FRONTEND_URL in html
    assert "#004349" in html
    assert "freigeschaltet" in html


def test_account_deactivated_renders():
    html = _env(BACKEND_DIR).get_template("account_deactivated.html").render(
        frontend_url=FRONTEND_URL,
    )
    assert FRONTEND_URL in html
    assert "#004349" in html
    assert "deaktiviert" in html


def test_new_user_notification_renders():
    html = _env(BACKEND_DIR).get_template("new_user_notification.html").render(
        new_user_email="test@example.com",
        now="28.04.2026 14:23",
        users_url=f"{FRONTEND_URL}/dashboard#users",
        frontend_url=FRONTEND_URL,
    )
    assert "test@example.com" in html
    assert "28.04.2026 14:23" in html
    assert f"{FRONTEND_URL}/dashboard#users" in html
    assert "#004349" in html
    assert "Freigabe" in html


def test_worker_booking_failure_renders():
    html = _env(WORKER_DIR).get_template("booking_failure.html").render(
        class_name="Yoga Basics",
        time_str="18:00",
        weekday_str="Montag",
        date_str="28.04.2026",
        facility_name="FitnessPark Mitte",
        error_message="Kurs bereits ausgebucht",
        frontend_url=FRONTEND_URL,
    )
    assert "Yoga Basics" in html
    assert "#004349" in html


def test_worker_debug_cancel_failure_renders():
    html = _env(WORKER_DIR).get_template("debug_cancel_failure.html").render(
        class_name="Yoga Basics",
        time_str="18:00",
        weekday_str="Montag",
        date_str="28.04.2026",
        facility_name="FitnessPark Mitte",
        error_message="Verbindung fehlgeschlagen",
        frontend_url=FRONTEND_URL,
    )
    assert "Yoga Basics" in html
    assert "#004349" in html


def test_worker_admin_booking_failure_renders():
    html = _env(WORKER_DIR).get_template("admin_booking_failure.html").render(
        class_name="Yoga Basics",
        time_str="18:00",
        weekday_str="Montag",
        date_str="28.04.2026",
        facility_name="FitnessPark Mitte",
        error_message="Kurs bereits ausgebucht",
        frontend_url=FRONTEND_URL,
        user_email="user@example.com",
        job_id="job-42",
    )
    assert "Yoga Basics" in html
    assert "Kurs bereits ausgebucht" in html
    assert "user@example.com" in html
    assert "job-42" in html
    assert "#004349" in html


def test_worker_booking_waitlist_renders():
    html = _env(WORKER_DIR).get_template("booking_waitlist.html").render(
        class_name="CrossFit",
        time_str="18:00",
        weekday_str="Freitag",
        date_str="10.04.2026",
        facility_name="Sport-Club Hundsmühlen e.V.",
        frontend_url=FRONTEND_URL,
    )
    assert "CrossFit" in html
    assert "18:00" in html
    assert "Freitag" in html
    assert "10.04.2026" in html
    assert "Sport-Club Hundsmühlen e.V." in html
    assert "Warteliste" in html
    assert FRONTEND_URL in html
    assert "#004349" in html


def test_admin_message_renders():
    html = _env(BACKEND_DIR).get_template("admin_message.html").render(
        subject="Wichtige Information",
        content="Hallo,\ndies ist eine Nachricht vom Admin.",
        frontend_url=FRONTEND_URL,
    )
    assert "Wichtige Information" in html
    assert "Hallo," in html
    assert "dies ist eine Nachricht vom Admin." in html
    assert FRONTEND_URL in html
    assert "#004349" in html
