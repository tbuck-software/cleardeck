APP_DIR=app
VERSION_CMD=node -p "require('./$(APP_DIR)/package.json').version"

.PHONY: ensure-clean show-version build release release-patch release-minor release-major

# Fail fast if there are uncommitted changes
ensure-clean:
	@if [ -n "$$(git status --porcelain)" ]; then echo "Arbeitsbaum nicht sauber. Bitte erst committen/stagen."; exit 1; fi

show-version:
	@echo "Aktuelle Version: $$( $(VERSION_CMD) )"

build:
	@cd $(APP_DIR) && npm run make

release: ensure-clean build
	@echo "Release-Build fuer Version $$( $(VERSION_CMD) ) erstellt."

release-%: ensure-clean
	@cd $(APP_DIR) && npm version $* -m "chore: release v%s"
	@$(MAKE) build
	@echo "Tag v$$( $(VERSION_CMD) ) erstellt und Build erzeugt."
