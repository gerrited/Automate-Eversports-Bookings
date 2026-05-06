from datetime import date, datetime, time

from backend.models.booking_job import BookingJob
from backend.models.booking_log import BookingLog
from backend.models.user import User
from worker.worker import MAX_WORKERS, already_booked, is_due, process_job, run
from worker.email import send_admin_booking_failure_email


def _user(db, uid="u1", ev="ev1", email="a@b.com", active=True):
    u = User(id=uid, eversports_user_id=ev, email=email, encrypted_password="enc", active=active)
    db.add(u)
    db.commit()
    return u


def _job(db, jid="j1", uid="u1", weekday=1, days=4, one_time=False):
    j = BookingJob(
        id=jid, user_id=uid, weekday=weekday,
        target_time=time(18, 0), facility_id="73041",
        class_name="CrossFit", days_in_advance=days, enabled=True,
        one_time=one_time,
    )
    db.add(j)
    db.commit()
    return j


# --- is_due ---

def test_is_due_when_today_plus_advance_matches_weekday_and_hour():
    # Friday 2026-04-10 18:00 + 4 days = Tuesday 2026-04-14 (weekday=1), hour matches
    friday_18 = datetime(2026, 4, 10, 18, 0)
    job = BookingJob(weekday=1, days_in_advance=4, target_time=time(18, 0))
    assert is_due(job, friday_18) is True


def test_is_not_due_when_weekday_doesnt_match():
    thursday_18 = datetime(2026, 4, 9, 18, 0)
    job = BookingJob(weekday=1, days_in_advance=4, target_time=time(18, 0))
    assert is_due(job, thursday_18) is False


def test_is_not_due_when_hour_doesnt_match():
    # Richtige Datum-Kombination, aber falsche Stunde (07:00 statt 18:00)
    friday_07 = datetime(2026, 4, 10, 7, 0)
    job = BookingJob(weekday=1, days_in_advance=4, target_time=time(18, 0))
    assert is_due(job, friday_07) is False


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


def test_already_booked_true_when_waitlist_log_exists(db_session):
    _user(db_session)
    job = _job(db_session)
    db_session.add(BookingLog(
        job_id="j1", target_date=date(2026, 4, 14), status="waitlist", message=None
    ))
    db_session.commit()
    assert already_booked(db_session, job, date(2026, 4, 14)) is True


# --- process_job ---

def test_process_job_books_and_writes_success_log(db_session, session_factory, mocker):
    _user(db_session, uid="pj1", ev="ev_pj1", email="pj1@b.com")
    _job(db_session, jid="jpj1", uid="pj1", weekday=1, days=4)
    friday_18 = datetime(2026, 4, 10, 18, 0)

    mocker.patch("worker.worker.decrypt", return_value="plainpass")
    mocker.patch("worker.worker.book_session", return_value={"status": "success", "order_id": "ord-pj1"})

    process_job("jpj1", friday_18, session_factory, [])

    log = db_session.query(BookingLog).filter(BookingLog.job_id == "jpj1").first()
    assert log is not None
    assert log.status == "success"
    assert log.message == "ord-pj1"
    assert log.target_date == date(2026, 4, 14)


def test_process_job_skips_already_booked(db_session, session_factory, mocker):
    _user(db_session, uid="pj2", ev="ev_pj2", email="pj2@b.com")
    _job(db_session, jid="jpj2", uid="pj2", weekday=1, days=4)
    db_session.add(BookingLog(
        job_id="jpj2", target_date=date(2026, 4, 14), status="success", message="old"
    ))
    db_session.commit()

    mock_book = mocker.patch("worker.worker.book_session")
    process_job("jpj2", datetime(2026, 4, 10, 18, 0), session_factory, [])
    mock_book.assert_not_called()


def test_process_job_logs_failure_and_sends_email(db_session, session_factory, mocker):
    _user(db_session, uid="pj3", ev="ev_pj3", email="pj3@b.com")
    _job(db_session, jid="jpj3", uid="pj3", weekday=1, days=4)

    mocker.patch("worker.worker.decrypt", return_value="pass")
    mocker.patch("worker.worker.book_session", side_effect=RuntimeError("Class full"))
    mock_email = mocker.patch("worker.worker.send_booking_failure_email")

    process_job("jpj3", datetime(2026, 4, 10, 18, 0), session_factory, [])

    log = db_session.query(BookingLog).filter(BookingLog.job_id == "jpj3").first()
    assert log.status == "failed"
    assert "Class full" in log.message
    mock_email.assert_called_once()


def test_process_job_deletes_one_time_job_after_success(db_session, session_factory, mocker):
    _user(db_session, uid="pj4", ev="ev_pj4", email="pj4@b.com")
    _job(db_session, jid="jpj4", uid="pj4", weekday=1, days=4, one_time=True)

    mocker.patch("worker.worker.decrypt", return_value="pass")
    mocker.patch("worker.worker.book_session", return_value={"status": "success", "order_id": "ord-pj4"})

    process_job("jpj4", datetime(2026, 4, 10, 18, 0), session_factory, [])

    remaining = db_session.query(BookingJob).filter(BookingJob.id == "jpj4").first()
    assert remaining is None


# --- MAX_WORKERS ---

def test_max_workers_is_10():
    assert MAX_WORKERS == 10


# --- run (parallel) ---

def test_run_books_due_job_and_writes_success_log(db_session, session_factory, mocker):
    _user(db_session, uid="u2", ev="ev2", email="b@b.com")
    _job(db_session, jid="j2", uid="u2", weekday=1, days=4)
    friday_18 = datetime(2026, 4, 10, 18, 0)  # Friday 18:00 + 4 days = Tuesday

    mocker.patch("worker.worker.decrypt", return_value="plainpass")
    mocker.patch("worker.worker.book_session", return_value={"status": "success", "order_id": "ord-42"})

    run(friday_18, session_factory)

    log = db_session.query(BookingLog).filter(BookingLog.job_id == "j2").first()
    assert log is not None
    assert log.status == "success"
    assert log.message == "ord-42"
    assert log.target_date == date(2026, 4, 14)


def test_run_skips_not_due_job(db_session, session_factory, mocker):
    _user(db_session, uid="u3", ev="ev3", email="c@b.com")
    _job(db_session, jid="j3", uid="u3", weekday=3, days=4)  # Wednesday
    friday_18 = datetime(2026, 4, 10, 18, 0)  # Friday+4=Tuesday≠Wednesday

    mock_book = mocker.patch("worker.worker.book_session")
    run(friday_18, session_factory)
    mock_book.assert_not_called()


def test_run_skips_wrong_hour(db_session, session_factory, mocker):
    _user(db_session, uid="u3b", ev="ev3b", email="c2@b.com")
    _job(db_session, jid="j3b", uid="u3b", weekday=1, days=4)  # target 18:00
    friday_07 = datetime(2026, 4, 10, 7, 0)  # richtige Datum-Kombo, falsche Stunde

    mock_book = mocker.patch("worker.worker.book_session")
    run(friday_07, session_factory)
    mock_book.assert_not_called()


def test_run_skips_already_booked(db_session, session_factory, mocker):
    _user(db_session, uid="u4", ev="ev4", email="d@b.com")
    _job(db_session, jid="j4", uid="u4", weekday=1, days=4)
    db_session.add(BookingLog(
        job_id="j4", target_date=date(2026, 4, 14), status="success", message="old"
    ))
    db_session.commit()

    mock_book = mocker.patch("worker.worker.book_session")
    run(datetime(2026, 4, 10, 18, 0), session_factory)
    mock_book.assert_not_called()


def test_run_logs_failure_and_continues(db_session, session_factory, mocker):
    _user(db_session, uid="u5", ev="ev5", email="e@b.com")
    _user(db_session, uid="u6", ev="ev6", email="f@b.com")
    _job(db_session, jid="j5", uid="u5", weekday=1, days=4)
    _job(db_session, jid="j6", uid="u6", weekday=1, days=4)
    friday_18 = datetime(2026, 4, 10, 18, 0)

    mocker.patch("worker.worker.decrypt", return_value="pass")
    # Use email to determine outcome deterministically across threads
    def book_by_email(**kwargs):
        if kwargs["email"] == "e@b.com":
            raise RuntimeError("Class full")
        return {"status": "success", "order_id": "ord-99"}
    mocker.patch("worker.worker.book_session", side_effect=book_by_email)
    mocker.patch("worker.worker.send_booking_failure_email")

    run(friday_18, session_factory)

    log5 = db_session.query(BookingLog).filter(BookingLog.job_id == "j5").first()
    log6 = db_session.query(BookingLog).filter(BookingLog.job_id == "j6").first()
    assert log5.status == "failed"
    assert "Class full" in log5.message
    assert log6.status == "success"


def test_run_skips_disabled_job(db_session, session_factory, mocker):
    _user(db_session, uid="u7", ev="ev7", email="g@b.com")
    j = BookingJob(
        id="j7", user_id="u7", weekday=1,
        target_time=time(18, 0), facility_id="73041",
        class_name="CrossFit", days_in_advance=4, enabled=False,
    )
    db_session.add(j)
    db_session.commit()

    mock_book = mocker.patch("worker.worker.book_session")
    run(datetime(2026, 4, 10, 18, 0), session_factory)
    mock_book.assert_not_called()


def test_run_skips_inactive_user_job(db_session, session_factory, mocker):
    _user(db_session, uid="u8", ev="ev8", email="h@b.com", active=False)
    _job(db_session, jid="j8", uid="u8", weekday=1, days=4)
    friday_18 = datetime(2026, 4, 10, 18, 0)

    mocker.patch("worker.worker.decrypt", return_value="plainpass")
    mock_book = mocker.patch("worker.worker.book_session")
    run(friday_18, session_factory)
    mock_book.assert_not_called()


# --- email notifications ---

def test_run_sends_failure_email_on_booking_error(db_session, session_factory, mocker):
    _user(db_session, uid="u9", ev="ev9", email="i@b.com")
    _job(db_session, jid="j9", uid="u9", weekday=1, days=4)
    friday_18 = datetime(2026, 4, 10, 18, 0)

    mocker.patch("worker.worker.decrypt", return_value="pass")
    mocker.patch("worker.worker.book_session", side_effect=RuntimeError("Class full"))
    mock_email = mocker.patch("worker.worker.send_booking_failure_email")

    run(friday_18, session_factory)

    mock_email.assert_called_once()
    call_args = mock_email.call_args
    assert call_args[0][0] == "i@b.com"
    assert "Class full" in call_args[0][2]


def test_run_does_not_send_email_on_success(db_session, session_factory, mocker):
    _user(db_session, uid="u10", ev="ev10", email="j@b.com")
    _job(db_session, jid="j10", uid="u10", weekday=1, days=4)
    friday_18 = datetime(2026, 4, 10, 18, 0)

    mocker.patch("worker.worker.decrypt", return_value="pass")
    mocker.patch("worker.worker.book_session", return_value={"status": "success", "order_id": "ord-1"})
    mock_email = mocker.patch("worker.worker.send_booking_failure_email")

    run(friday_18, session_factory)

    mock_email.assert_not_called()


def test_run_does_not_send_email_on_already_booked(db_session, session_factory, mocker):
    _user(db_session, uid="u11", ev="ev11", email="k@b.com")
    _job(db_session, jid="j11", uid="u11", weekday=1, days=4)
    friday_18 = datetime(2026, 4, 10, 18, 0)

    mocker.patch("worker.worker.decrypt", return_value="pass")
    mocker.patch("worker.worker.book_session", return_value={"status": "already_booked"})
    mock_email = mocker.patch("worker.worker.send_booking_failure_email")

    run(friday_18, session_factory)

    mock_email.assert_not_called()


def test_run_continues_when_email_sending_fails(db_session, session_factory, mocker):
    _user(db_session, uid="u12", ev="ev12", email="l@b.com")
    _user(db_session, uid="u13", ev="ev13", email="m@b.com")
    _job(db_session, jid="j12", uid="u12", weekday=1, days=4)
    _job(db_session, jid="j13", uid="u13", weekday=1, days=4)
    friday_18 = datetime(2026, 4, 10, 18, 0)

    mocker.patch("worker.worker.decrypt", return_value="pass")
    def book_by_email(**kwargs):
        if kwargs["email"] == "l@b.com":
            raise RuntimeError("Class full")
        return {"status": "success", "order_id": "ord-99"}
    mocker.patch("worker.worker.book_session", side_effect=book_by_email)
    mocker.patch("worker.worker.send_booking_failure_email", side_effect=Exception("Resend down"))

    run(friday_18, session_factory)

    log12 = db_session.query(BookingLog).filter(BookingLog.job_id == "j12").first()
    log13 = db_session.query(BookingLog).filter(BookingLog.job_id == "j13").first()
    assert log12.status == "failed"
    assert log13.status == "success"


def test_run_deletes_one_time_job_after_success(db_session, session_factory, mocker):
    _user(db_session, uid="ot1", ev="ev_ot1", email="ot1@b.com")
    _job(db_session, jid="jot1", uid="ot1", weekday=1, days=4, one_time=True)
    friday_18 = datetime(2026, 4, 10, 18, 0)

    mocker.patch("worker.worker.decrypt", return_value="pass")
    mocker.patch("worker.worker.book_session", return_value={"status": "success", "order_id": "ord-ot1"})

    run(friday_18, session_factory)

    remaining = db_session.query(BookingJob).filter(BookingJob.id == "jot1").first()
    assert remaining is None


def test_run_deletes_one_time_job_after_already_booked(db_session, session_factory, mocker):
    _user(db_session, uid="ot2", ev="ev_ot2", email="ot2@b.com")
    _job(db_session, jid="jot2", uid="ot2", weekday=1, days=4, one_time=True)
    friday_18 = datetime(2026, 4, 10, 18, 0)

    mocker.patch("worker.worker.decrypt", return_value="pass")
    mocker.patch("worker.worker.book_session", return_value={"status": "already_booked", "order_id": None})

    run(friday_18, session_factory)

    remaining = db_session.query(BookingJob).filter(BookingJob.id == "jot2").first()
    assert remaining is None


def test_run_keeps_one_time_job_after_failure(db_session, session_factory, mocker):
    _user(db_session, uid="ot3", ev="ev_ot3", email="ot3@b.com")
    _job(db_session, jid="jot3", uid="ot3", weekday=1, days=4, one_time=True)
    friday_18 = datetime(2026, 4, 10, 18, 0)

    mocker.patch("worker.worker.decrypt", return_value="pass")
    mocker.patch("worker.worker.book_session", side_effect=RuntimeError("Class full"))
    mocker.patch("worker.worker.send_booking_failure_email")

    run(friday_18, session_factory)

    remaining = db_session.query(BookingJob).filter(BookingJob.id == "jot3").first()
    assert remaining is not None


def test_run_keeps_regular_job_after_success(db_session, session_factory, mocker):
    _user(db_session, uid="ot4", ev="ev_ot4", email="ot4@b.com")
    _job(db_session, jid="jot4", uid="ot4", weekday=1, days=4, one_time=False)
    friday_18 = datetime(2026, 4, 10, 18, 0)

    mocker.patch("worker.worker.decrypt", return_value="pass")
    mocker.patch("worker.worker.book_session", return_value={"status": "success", "order_id": "ord-ot4"})

    run(friday_18, session_factory)

    remaining = db_session.query(BookingJob).filter(BookingJob.id == "jot4").first()
    assert remaining is not None


# --- admin failure notifications ---

def _admin(db, uid="a1", ev="ev_a1", email="admin@b.com"):
    u = User(id=uid, eversports_user_id=ev, email=email, encrypted_password="enc", active=True, role="admin")
    db.add(u)
    db.commit()
    return u


def test_run_sends_admin_failure_email_when_booking_fails(db_session, session_factory, mocker):
    _admin(db_session, uid="adm1", ev="ev_adm1", email="admin@b.com")
    _user(db_session, uid="usr1", ev="ev_usr1", email="user@b.com")
    _job(db_session, jid="jadm1", uid="usr1", weekday=1, days=4)
    friday_18 = datetime(2026, 4, 10, 18, 0)

    mocker.patch("worker.worker.decrypt", return_value="pass")
    mocker.patch("worker.worker.book_session", side_effect=RuntimeError("Class full"))
    mocker.patch("worker.worker.send_booking_failure_email")
    mock_admin_email = mocker.patch("worker.worker.send_admin_booking_failure_email")

    run(friday_18, session_factory)

    mock_admin_email.assert_called_once()
    args = mock_admin_email.call_args[0]
    assert args[0] == ["admin@b.com"]
    assert args[1] == "user@b.com"
    assert "Class full" in args[3]


def test_run_does_not_send_admin_failure_email_on_success(db_session, session_factory, mocker):
    _admin(db_session, uid="adm2", ev="ev_adm2", email="admin2@b.com")
    _user(db_session, uid="usr2", ev="ev_usr2", email="user2@b.com")
    _job(db_session, jid="jadm2", uid="usr2", weekday=1, days=4)
    friday_18 = datetime(2026, 4, 10, 18, 0)

    mocker.patch("worker.worker.decrypt", return_value="pass")
    mocker.patch("worker.worker.book_session", return_value={"status": "success", "order_id": "ord-1"})
    mock_admin_email = mocker.patch("worker.worker.send_admin_booking_failure_email")

    run(friday_18, session_factory)

    mock_admin_email.assert_not_called()


def test_run_does_not_send_admin_failure_email_when_no_admins(db_session, session_factory, mocker):
    _user(db_session, uid="usr3", ev="ev_usr3", email="user3@b.com")
    _job(db_session, jid="jadm3", uid="usr3", weekday=1, days=4)
    friday_18 = datetime(2026, 4, 10, 18, 0)

    mocker.patch("worker.worker.decrypt", return_value="pass")
    mocker.patch("worker.worker.book_session", side_effect=RuntimeError("Class full"))
    mocker.patch("worker.worker.send_booking_failure_email")
    mock_admin_email = mocker.patch("worker.worker.send_admin_booking_failure_email")

    run(friday_18, session_factory)

    mock_admin_email.assert_not_called()


def test_run_sends_admin_email_to_all_active_admins(db_session, session_factory, mocker):
    _admin(db_session, uid="adm3a", ev="ev_adm3a", email="admin3a@b.com")
    _admin(db_session, uid="adm3b", ev="ev_adm3b", email="admin3b@b.com")
    _user(db_session, uid="usr4", ev="ev_usr4", email="user4@b.com")
    _job(db_session, jid="jadm4", uid="usr4", weekday=1, days=4)
    friday_18 = datetime(2026, 4, 10, 18, 0)

    mocker.patch("worker.worker.decrypt", return_value="pass")
    mocker.patch("worker.worker.book_session", side_effect=RuntimeError("Class full"))
    mocker.patch("worker.worker.send_booking_failure_email")
    mock_admin_email = mocker.patch("worker.worker.send_admin_booking_failure_email")

    run(friday_18, session_factory)

    mock_admin_email.assert_called_once()
    admin_emails_arg = mock_admin_email.call_args[0][0]
    assert set(admin_emails_arg) == {"admin3a@b.com", "admin3b@b.com"}


def test_process_job_logs_waitlist_status(db_session, session_factory, mocker):
    _user(db_session, uid="wl1", ev="ev_wl1", email="wl1@b.com")
    _job(db_session, jid="jwl1", uid="wl1", weekday=1, days=4)

    mocker.patch("worker.worker.decrypt", return_value="pass")
    mocker.patch("worker.worker.book_session", return_value={"status": "waitlist", "order_id": None, "event_type": "class"})
    mock_waitlist_email = mocker.patch("worker.worker.send_waitlist_notification")
    mock_failure_email = mocker.patch("worker.worker.send_booking_failure_email")

    process_job("jwl1", datetime(2026, 4, 10, 18, 0), session_factory, [])

    log_entry = db_session.query(BookingLog).filter(BookingLog.job_id == "jwl1").first()
    assert log_entry.status == "waitlist"
    mock_waitlist_email.assert_called_once()
    mock_failure_email.assert_not_called()


def test_run_sends_waitlist_email_on_waitlist_status(db_session, session_factory, mocker):
    _user(db_session, uid="wl2", ev="ev_wl2", email="wl2@b.com")
    _job(db_session, jid="jwl2", uid="wl2", weekday=1, days=4)
    friday_18 = datetime(2026, 4, 10, 18, 0)

    mocker.patch("worker.worker.decrypt", return_value="pass")
    mocker.patch("worker.worker.book_session", return_value={"status": "waitlist", "order_id": None, "event_type": "class"})
    mock_waitlist_email = mocker.patch("worker.worker.send_waitlist_notification")

    run(friday_18, session_factory)

    mock_waitlist_email.assert_called_once()
    log_entry = db_session.query(BookingLog).filter(BookingLog.job_id == "jwl2").first()
    assert log_entry.status == "waitlist"


def test_one_time_job_not_deleted_on_waitlist(db_session, session_factory, mocker):
    _user(db_session, uid="wl3", ev="ev_wl3", email="wl3@b.com")
    _job(db_session, jid="jwl3", uid="wl3", weekday=1, days=4, one_time=True)

    mocker.patch("worker.worker.decrypt", return_value="pass")
    mocker.patch("worker.worker.book_session", return_value={"status": "waitlist", "order_id": None, "event_type": "class"})
    mocker.patch("worker.worker.send_waitlist_notification")

    process_job("jwl3", datetime(2026, 4, 10, 18, 0), session_factory, [])

    remaining = db_session.query(BookingJob).filter(BookingJob.id == "jwl3").first()
    assert remaining is not None


def test_process_job_increments_counter_on_success(db_session, session_factory, mocker):
    user = _user(db_session, uid="cnt1", ev="ev_cnt1", email="cnt1@b.com")
    _job(db_session, jid="jcnt1", uid="cnt1", weekday=1, days=4)

    mocker.patch("worker.worker.decrypt", return_value="pass")
    mocker.patch("worker.worker.book_session", return_value={"status": "success", "order_id": "ord"})

    process_job("jcnt1", datetime(2026, 4, 10, 18, 0), session_factory, [])

    db_session.refresh(user)
    assert user.total_bookings_executed == 1


def test_process_job_increments_counter_on_already_booked(db_session, session_factory, mocker):
    user = _user(db_session, uid="cnt2", ev="ev_cnt2", email="cnt2@b.com")
    _job(db_session, jid="jcnt2", uid="cnt2", weekday=1, days=4)

    mocker.patch("worker.worker.decrypt", return_value="pass")
    mocker.patch("worker.worker.book_session", return_value={"status": "already_booked"})

    process_job("jcnt2", datetime(2026, 4, 10, 18, 0), session_factory, [])

    db_session.refresh(user)
    assert user.total_bookings_executed == 1


def test_process_job_increments_counter_on_waitlist(db_session, session_factory, mocker):
    user = _user(db_session, uid="cnt3", ev="ev_cnt3", email="cnt3@b.com")
    _job(db_session, jid="jcnt3", uid="cnt3", weekday=1, days=4)

    mocker.patch("worker.worker.decrypt", return_value="pass")
    mocker.patch("worker.worker.book_session", return_value={"status": "waitlist"})
    mocker.patch("worker.worker.send_waitlist_notification")

    process_job("jcnt3", datetime(2026, 4, 10, 18, 0), session_factory, [])

    db_session.refresh(user)
    assert user.total_bookings_executed == 1


def test_process_job_does_not_increment_counter_on_failure(db_session, session_factory, mocker):
    user = _user(db_session, uid="cnt4", ev="ev_cnt4", email="cnt4@b.com")
    _job(db_session, jid="jcnt4", uid="cnt4", weekday=1, days=4)

    mocker.patch("worker.worker.decrypt", return_value="pass")
    mocker.patch("worker.worker.book_session", side_effect=RuntimeError("Fehler"))
    mocker.patch("worker.worker.send_booking_failure_email")

    process_job("jcnt4", datetime(2026, 4, 10, 18, 0), session_factory, [])

    db_session.refresh(user)
    assert user.total_bookings_executed == 0


from unittest.mock import patch
from backend.models.push_subscription import PushSubscription


def test_run_calls_push_notifications_for_subscribed_users(db_session, session_factory):
    from backend.core.encryption import encrypt
    u = User(
        id="u-push",
        eversports_user_id="ev-push",
        email="push@example.com",
        encrypted_password=encrypt("secret"),
        active=True,
        notification_advance_minutes=60,
    )
    db_session.add(u)
    sub = PushSubscription(user_id="u-push", endpoint="https://push.example.com/x", p256dh="k", auth="a")
    db_session.add(sub)
    db_session.commit()

    now = datetime(2026, 5, 6, 9, 0)

    with patch("worker.worker.fetch_upcoming_bookings", return_value=[]) as mock_fetch, \
         patch("worker.worker.send_push_notifications") as mock_notify:
        run(now, session_factory)
        mock_fetch.assert_called_once_with("push@example.com", "secret")
        mock_notify.assert_called_once()
