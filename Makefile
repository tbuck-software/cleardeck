APP_DIR=app
VERSION_CMD=node -p "require('./$(APP_DIR)/package.json').version"

.PHONY: ensure-clean show-version build release release-patch release-minor release-major

# Fail fast if there are uncommitted changes
ensure-clean:
	@if [ -n "$$(git status --porcelain)" ]; then echo "Arbeitsbaum nicht sauber. Bitte erst committen/stagen."; exit 1; fi

show-version:
	@echo "Aktuelle Version: $$( $(VERSION_CMD) )"

build:
	@cd $(APP_DIR) && SKIP_FUSES=1 npm run make

release: ensure-clean build
	@echo "Release-Build fuer Version $$( $(VERSION_CMD) ) erstellt."

release-patch: ensure-clean
	@cd $(APP_DIR) && npm version patch --no-git-tag-version
	@VERSION=$$( $(VERSION_CMD) ); \
	git add $(APP_DIR)/package.json $(APP_DIR)/package-lock.json; \
	git commit -m "chore: release v$${VERSION}"; \
	git tag v$${VERSION}; \
	$(MAKE) build; \
	git push && git push --tags; \
	echo "Tag v$${VERSION} erstellt und Build erzeugt."

release-minor: ensure-clean
	@cd $(APP_DIR) && npm version minor --no-git-tag-version
	@VERSION=$$( $(VERSION_CMD) ); \
	git add $(APP_DIR)/package.json $(APP_DIR)/package-lock.json; \
	git commit -m "chore: release v$${VERSION}"; \
	git tag v$${VERSION}; \
	$(MAKE) build; \
	git push && git push --tags; \
	echo "Tag v$${VERSION} erstellt und Build erzeugt."

release-major: ensure-clean
	@cd $(APP_DIR) && npm version major --no-git-tag-version
	@VERSION=$$( $(VERSION_CMD) ); \
	git add $(APP_DIR)/package.json $(APP_DIR)/package-lock.json; \
	git commit -m "chore: release v$${VERSION}"; \
	git tag v$${VERSION}; \
	$(MAKE) build; \
	git push && git push --tags; \
	echo "Tag v$${VERSION} erstellt und Build erzeugt."
