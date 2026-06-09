from backend.core.rate_limit import RateLimiter


def test_erlaubt_requests_bis_zum_limit():
    limiter = RateLimiter(max_requests=3, window_seconds=60)
    assert limiter.allow("1.2.3.4", now=100.0)
    assert limiter.allow("1.2.3.4", now=101.0)
    assert limiter.allow("1.2.3.4", now=102.0)


def test_blockiert_requests_ueber_dem_limit():
    limiter = RateLimiter(max_requests=3, window_seconds=60)
    for i in range(3):
        limiter.allow("1.2.3.4", now=100.0 + i)
    assert not limiter.allow("1.2.3.4", now=103.0)


def test_limit_gilt_pro_schluessel():
    limiter = RateLimiter(max_requests=1, window_seconds=60)
    assert limiter.allow("1.2.3.4", now=100.0)
    assert limiter.allow("5.6.7.8", now=100.0)
    assert not limiter.allow("1.2.3.4", now=101.0)


def test_alte_requests_fallen_aus_dem_fenster():
    limiter = RateLimiter(max_requests=2, window_seconds=60)
    limiter.allow("1.2.3.4", now=100.0)
    limiter.allow("1.2.3.4", now=110.0)
    assert not limiter.allow("1.2.3.4", now=120.0)
    # Nach Ablauf des Fensters für den ersten Request ist wieder Platz
    assert limiter.allow("1.2.3.4", now=161.0)


def test_reset_leert_alle_eintraege():
    limiter = RateLimiter(max_requests=1, window_seconds=60)
    limiter.allow("1.2.3.4", now=100.0)
    limiter.reset()
    assert limiter.allow("1.2.3.4", now=101.0)
