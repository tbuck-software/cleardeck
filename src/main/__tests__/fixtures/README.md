# Upgrade fixtures

These SQL fixtures contain synthetic records in the schemas produced by the original release code. They contain no real personnel, patient data, passwords or encryption keys.

| Fixture | Release commit | Schema |
| --- | --- | ---: |
| `v1.7.1.sql` | `ace153b4df531ae70a907750646b10fd02889e15` | 10 |
| `v1.8.0.sql` | `844c934473ad7dbff4fae8b47c72a94692f23110` | 13 |

Generation on 6 September 2026: extract the release tag, run that tag's authentication registration and migrations using Electron 39.2.4 and native better-sqlite3, remove demo people in the isolated test profile, insert synthetic employee, employment periods, event, patient and visit records, then export table DDL, rows and explicit indexes. The 1.8.0 fixture also contains an instruction and competency record. `v2.1.0.sql` is a copy of `v2.0.0.sql`: release 2.1.0 added no migration, so both installed versions carry schema 21. Default catalog and settings values come from the old release.

`upgradeCompatibility.test.ts` loads these fixtures into SQLite, writes either the legacy encrypted snapshot format or a plain database, and opens them through the current production connection code. It tests automatic migration and backup, retained historical records, reopening, failure isolation and refusal to create an empty replacement for a configured profile whose database is missing.

Run: `npm test -- --run src/main/__tests__/upgradeCompatibility.test.ts`.

The native runtime matrix additionally tested the original releases' password/key/configuration format, crash leftovers and profiles with no employees. Its results and limits are in [the upgrade report](../../../../docs/reviews/2026-09-06-upgrade-171-180-und-design.md).
