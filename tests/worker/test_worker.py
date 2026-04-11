from datetime import date, time

from backend.models.booking_job import BookingJob
from backend.models.booking_log import BookingLog
from backend.models.user import User
from worker.worker import already_booked, is_due, run


def _user(db, uid="u1", ev="ev1", email="a@b.com"):
    u = User(id=uid, eversports_user_id=ev, email=email, encrypted_password="enc")
    db.add(u)
    db.commit()
    return u


def _job(db, jid="j1", uid="u1", weekday=1, days=4):
    j = BookingJob(
        id=jid, user_id=uid, weekday=weekday,
        target_time=time(18, 0), facility_id="73041",
        class_name="CrossFit", days_in_advance=days, enabled=True,
    )
    db.add(j)
    db.commit()
    return j


# --- is_due ---

def test_is_due_when_today_plus_advance_matches_weekday():
    # Friday 2026-04-10 + 4 days = Tuesday 2026-04-14 (weekday=1)
    friday = date(2026, 4, 10)
    job = BookingJob(weekday=1, days_in_advance=4)
    assert is_due(job, friday) is True


def test_is_not_due_when_weekday_doesnt_match():
    thursday = date(2026, 4, 9)
    job = BookingJob(weekday=1, days_in_advance=4)
    assert is_due(job, thursday) is False


# --- already_booked ---

def test_already_booked_true_when_success_log_exists(db_session):
    _user(db_session)
    job = _job(db_session)
    db_session.add(BookingLog(
        job_id="j1", target_date=date(2026, 4, 14), status="success", message="ord-1"
    ))
    db_session.commit()
    assert already_booked(db_session, job, date(2026, 4, 14)) is True


def test_already_booked_false_when_no_log(db_session):
    _user(db_session)
    job = _job(db_session)
    assert already_booked(db_session, job, date(2026, 4, 14)) is False


def test_already_booked_false_when_only_failed_log(db_session):
    _user(db_session)
    job = _job(db_session)
    db_session.add(BookingLog(
        job_id="j1", target_date=date(2026, 4, 14), status="failed", message="err"
    ))
    db_session.commit()
    assert already_booked(db_session, job, date(2026, 4, 14)) is False


# --- run ---

def test_run_books_due_job_and_writes_success_log(db_session, mocker):
    _user(db_session, uid="u2", ev="ev2", email="b@b.com")
    _job(db_session, jid="j2", uid="u2", weekday=1, days=4)
    friday = date(2026, 4, 10)

    mocker.patch("worker.worker.decrypt", return_value="plainpass")
    mocker.patch("worker.worker.book_session", return_value={"status": "success", "order_id": "ord-42"})

    run(db_session, friday)

    log = db_session.query(BookingLog).filter(BookingLog.job_id == "j2").first()
    assert log is not None
    assert log.status == "success"
    assert log.message == "ord-42"
    assert log.target_date == date(2026, 4, 14)


def test_run_skips_not_due_job(db_session, mocker):
    _user(db_session, uid="u3", ev="ev3", email="c@b.com")
    _job(db_session, jid="j3", uid="u3", weekday=3, days=4)  # Wednesday
    friday = date(2026, 4, 10)  # Friday+4=Tuesday≠Wednesday

    mock_book = mocker.patch("worker.worker.book_session")
    run(db_session, friday)
    mock_book.assert_not_called()


def test_run_skips_already_booked(db_session, mocker):
    _user(db_session, uid="u4", ev="ev4", email="d@b.com")
    _job(db_session, jid="j4", uid="u4", weekday=1, days=4)
    db_session.add(BookingLog(
        job_id="j4", target_date=date(2026, 4, 14), status="success", message="old"
    ))
    db_session.commit()

    mock_book = mocker.patch("worker.worker.book_session")
    run(db_session, date(2026, 4, 10))
    mock_book.assert_not_called()


def test_run_logs_failure_and_continues(db_session, mocker):
    _user(db_session, uid="u5", ev="ev5", email="e@b.com")
    _user(db_session, uid="u6", ev="ev6", email="f@b.com")
    _job(db_session, jid="j5", uid="u5", weekday=1, days=4)
    _job(db_session, jid="j6", uid="u6", weekday=1, days=4)
    friday = date(2026, 4, 10)

    mocker.patch("worker.worker.decrypt", return_value="pass")
    mocker.patch("worker.worker.book_session", side_effect=[
        RuntimeError("Class full"),
        {"status": "success", "order_id": "ord-99"},
    ])

    run(db_session, friday)

    log5 = db_session.query(BookingLog).filter(BookingLog.job_id == "j5").first()
    log6 = db_session.query(BookingLog).filter(BookingLog.job_id == "j6").first()
    assert log5.status == "failed"
    assert "Class full" in log5.message
    assert log6.status == "success"


def test_run_skips_disabled_job(db_session, mocker):
    _user(db_session, uid="u7", ev="ev7", email="g@b.com")
    j = BookingJob(
        id="j7", user_id="u7", weekday=1,
        target_time=time(18, 0), facility_id="73041",
        class_name="CrossFit", days_in_advance=4, enabled=False,
    )
    db_session.add(j)
    db_session.commit()

    mock_book = mocker.patch("worker.worker.book_session")
    run(db_session, date(2026, 4, 10))
    mock_book.assert_not_called()
