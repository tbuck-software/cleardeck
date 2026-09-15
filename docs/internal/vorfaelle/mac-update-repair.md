# macOS update failure on 5 September 2026

The installed `/Applications/ClearDeck.app` is version 1.7.2. Its update attempt downloaded the 1.8.0 ZIP successfully. The macOS unified log for the application's own PID recorded Squirrel download completion at 20:24:13 CEST and security error **-67056** one second later. `security error -67056` resolves to `code has no resources but signature indicates they must be present`. The existing application remained running; no successful installation was observed.

`codesign --verify --deep --strict` reproduced that exact failure for both the installed app and an isolated extraction of the cached 1.8.0 update. Inspection found the original Electron linker ad-hoc signature with no sealed resources.

The Forge `postPackage` hook used `packagePaths`. Forge 7.10.2 supplies `outputPaths`, so the hook returned before its final signing step. The corrected hook uses the actual payload, requires an app bundle, seals local ad-hoc packages, and verifies the entire resulting bundle. It preserves Packager's configured Developer ID signature. CI releases must provide a Developer ID Application identity instead of silently shipping ad-hoc bundles.

## Compatibility limitation

Re-signing only the temporary extracted bundle fixed its resource verification. It did **not** satisfy the installed 1.7.2 application's designated requirement: that requirement is an exact code hash. Squirrel.Mac verifies the replacement against the current application's requirement. Consequently, a newly sealed ad-hoc release alone does not establish an automatic migration path for this legacy client.

A durable Mac distribution path still needs a Developer ID Application signing identity and appropriate release configuration, followed by native update/migration validation. No such Developer ID identity was available locally during this investigation. Certificate/account setup and publishing are pending, not completed. Plan for a one-time manual installation of a properly signed release for affected legacy clients unless a compatible migration is proven first. Reinstalling the unchanged 1.8.0 release does not fix the release-signing defect.

Only a disposable extraction of the cached ZIP was re-signed. The installed production application, its profile/database and its original update cache were not changed. The distinct development application was used for the diagnostics UI work.

References: [Forge hook contract](https://www.electronforge.io/config/hooks), [Squirrel.Mac signature verification](https://github.com/Squirrel/Squirrel.Mac/blob/master/Squirrel/SQRLCodeSignature.m).
