# Issue 30 visual evidence

These screenshots use synthetic demo records in the real Electron app at 1440×1000. No original user photo, audio, names, or personal data is included.

The two `before` images were captured on released baseline `b792f4f8960ccfd56c54707bd8db0b85f193345d`. The overlap fixture ended on 2026-12-31, so that baseline list state is a planned future departure. The separate inherited-hours fixture was created through the real history flow and visibly showed 36 h / 1,00 VZÄ on the earlier training section.

The `after` images were captured on production code `73fc6f398dca409f0843477a3fbdc835574b228c` (test-only follow-up `de0cf58`). A separate synthetic overlap fixture ended on 2026-08-31. The general editor changed only its selected period FTE from 1 to 0; 36 weekly hours and the 2025-01-01 effective date remained unchanged, and year-2026 Team totals updated to 1,00 VZÄ.

For the historical initialization flow, the earlier training period first appeared with unknown hours/FTE. The real editor then recorded explicit FTE 0 effective 2025-09-01. Its history shows `— Std./Woche · 0,00 VZÄ`, while the later qualified period remains 36 h / 1,00 VZÄ in the year-2026 Team view. The manifests contain the exact fixture dates and read-only database verification.
