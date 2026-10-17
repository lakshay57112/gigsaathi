"""Payout slip arithmetic. The model reads the slip; the sums are done here, in code."""

from ..schemas import PayoutCheck, PayoutExtraction, PayoutLine

TOLERANCE = 1.0  # rupees; slips are often rounded


def _key(label: str, amount: float | None) -> tuple[str, float | None]:
    return (" ".join(label.lower().split()), amount)


def check_payout(extraction: PayoutExtraction) -> PayoutCheck:
    seen: dict[tuple[str, float | None], int] = {}
    for line in extraction.deductions:
        key = _key(line.label, line.amount)
        seen[key] = seen.get(key, 0) + 1

    lines = [
        PayoutLine(
            **line.model_dump(),
            duplicate=line.amount is not None and seen[_key(line.label, line.amount)] > 1,
        )
        for line in extraction.deductions
    ]
    # A repeated deduction is always worth asking about, whatever the model said.
    for line in lines:
        if line.duplicate and not line.ask_about:
            line.ask_about = True

    amounts = [line.amount for line in lines if line.amount is not None]
    deductions_total = round(sum(amounts), 2) if amounts else None

    expected = difference = adds_up = None
    if extraction.total_earned is not None and extraction.paid_out is not None and deductions_total is not None:
        expected = round(extraction.total_earned - deductions_total, 2)
        difference = round(extraction.paid_out - expected, 2)
        adds_up = abs(difference) <= TOLERANCE

    return PayoutCheck(
        summary=extraction.summary,
        period=extraction.period,
        platform_name=extraction.platform_name,
        total_earned=extraction.total_earned,
        paid_out=extraction.paid_out,
        deductions=lines,
        deductions_total=deductions_total,
        expected_payout=expected,
        difference=difference,
        adds_up=adds_up,
        questions_to_ask=extraction.questions_to_ask,
        warnings=extraction.warnings,
    )
