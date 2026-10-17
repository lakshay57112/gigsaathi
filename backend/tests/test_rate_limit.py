from app.services.rate_limit import SlidingWindowLimiter


class FakeClock:
    def __init__(self) -> None:
        self.now = 0.0

    def __call__(self) -> float:
        return self.now


def test_allows_up_to_the_limit_then_blocks_with_retry_hint():
    clock = FakeClock()
    limiter = SlidingWindowLimiter(2, 60, clock)
    assert limiter.check("a") == 0
    assert limiter.check("a") == 0
    assert limiter.check("a") > 0


def test_window_slides_and_keys_are_independent():
    clock = FakeClock()
    limiter = SlidingWindowLimiter(1, 60, clock)
    assert limiter.check("a") == 0
    assert limiter.check("b") == 0
    assert limiter.check("a") > 0
    clock.now = 61
    assert limiter.check("a") == 0
