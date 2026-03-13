VERSION_CMD=node -p "require('./package.json').version"

.PHONY: ensure-clean show-version build allow allow-out reseed-dev reseed-prod release release-patch release-minor release-major

# Fail fast if there are uncommitted changes
ensure-clean:
	@if [ -n "$$(git status --porcelain)" ]; then echo "Arbeitsbaum nicht sauber. Bitte erst committen/stagen."; exit 1; fi

show-version:
	@echo "Aktuelle Version: $$( $(VERSION_CMD) )"

build:
	@SKIP_FUSES=1 npm run make:release

allow:
	@./scripts/macos-allow-app.sh "$(APP)"

allow-out:
	@./scripts/macos-allow-app.sh --out "$(APP)"

reseed-dev:
	@node ./scripts/reseed-dev.js --profile=dev

reseed-prod:
	@node ./scripts/reseed-dev.js --profile=prod

release: ensure-clean build
	@echo "Release-Build fuer Version $$( $(VERSION_CMD) ) erstellt."

release-patch: ensure-clean
	@npm version patch --no-git-tag-version
	@VERSION=$$( $(VERSION_CMD) ); \
	git add package.json package-lock.json; \
	git commit -m "chore: release v$${VERSION}"; \
	git tag v$${VERSION}; \
	$(MAKE) build; \
	git push && git push --tags; \
	echo "Tag v$${VERSION} erstellt und Build erzeugt."

release-minor: ensure-clean
	@npm version minor --no-git-tag-version
	@VERSION=$$( $(VERSION_CMD) ); \
	git add package.json package-lock.json; \
	git commit -m "chore: release v$${VERSION}"; \
	git tag v$${VERSION}; \
	$(MAKE) build; \
	git push && git push --tags; \
	echo "Tag v$${VERSION} erstellt und Build erzeugt."

release-major: ensure-clean
	@npm version major --no-git-tag-version
	@VERSION=$$( $(VERSION_CMD) ); \
	git add package.json package-lock.json; \
	git commit -m "chore: release v$${VERSION}"; \
	git tag v$${VERSION}; \
	$(MAKE) build; \
	git push && git push --tags; \
	echo "Tag v$${VERSION} erstellt und Build erzeugt."
