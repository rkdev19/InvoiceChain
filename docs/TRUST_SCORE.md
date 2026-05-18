# Trust Score Engine

## Formula
Score = Reliability (40%) + Frequency (30%) + Consistency (30%)

### Reliability (40%)
If `past_invoices == 0`: score component = 24 (new user default)
Else: `(paid_on_time / past_invoices) × 100 × 0.4`

### Frequency (30%)
`min(past_invoices / 10, 1) × 100 × 0.3`
Caps at 10 invoices (full frequency score achieved).

### Consistency (30%)
`max(0, 100 - (std_deviation / avg_amount) × 100) × 0.3`
Measures invoice amount predictability.

## Final Score
```
score = floor(reliability + frequency + consistency)
```

## Risk Classification
| Score | Risk Level | Borrow Limit |
|-------|------------|--------------|
| 80–100 | LOW | 80–100% of invoice |
| 60–79 | MEDIUM | 60–79% of invoice |
| 0–59 | HIGH | 0–59% of invoice |

## Borrow Limit
```
borrow_limit = floor(invoice_amount × trust_score / 100)
```

## Future Improvements
- Real on-chain repayment history
- GST filing frequency as signal
- Buyer payment behavior tracking
- Cross-invoice consistency scoring
