# Fake News Generator - Dev/Prod helpers

# Default environment (dev uses docker-compose.dev.yml overlay)
# Supported: dev | prod | local
env ?= dev

# Colors
CYAN  := \033[0;36m
GREEN := \033[0;32m
YELLOW := \033[0;33m
RED   := \033[0;31m
RESET := \033[0m

ENV_FILE := .env

PROJECT_NAME ?= autonomyai-$(env)
COMPOSE_ENV = COMPOSE_PROJECT_NAME=$(PROJECT_NAME)

COMPOSE_CMD = docker compose -f docker-compose.yml
ifeq ($(env),dev)
COMPOSE_CMD += -f docker-compose.dev.yml
endif

# If service= is not provided, operate on everything.
SERVICES = $(if $(service),$(service),)

.PHONY: help envfile install up down stop start restart ps logs build prune shell _validate_shell_service \
        infra-up apps-stop dev local test build-app prisma-generate migrate studio repl spelunker dev-reset

## help: Show this help message
help:
	@echo "$(CYAN)╔════════════════════════════════════════════╗$(RESET)"
	@echo "$(CYAN)║  Fake News Generator                       ║$(RESET)"
	@echo "$(CYAN)╚════════════════════════════════════════════╝$(RESET)"
	@echo ""
	@echo "$(CYAN)Usage:$(RESET)"
	@echo "  make <target> [env=dev|prod|local] [service=<name>]"
	@echo ""
	@echo "$(CYAN)Targets:$(RESET)"
	@grep -E '^## .+: .*$$' $(MAKEFILE_LIST) | sort | awk -v GREEN="$(GREEN)" -v RESET="$(RESET)" 'BEGIN {FS = ": "}; {printf "  %s%-18s%s %s\n", GREEN, substr($$1, 4), RESET, $$2}'
	@echo ""
	@echo "$(CYAN)Quick Start:$(RESET)"
	@echo "  $(GREEN)make install env=dev$(RESET)      # prompt OPENAI_* -> write .env -> run full dev docker stack"
	@echo "  $(GREEN)make install env=prod$(RESET)     # prompt OPENAI_* -> write .env -> run full prod docker stack"
	@echo "  $(GREEN)make install env=local$(RESET)    # prompt OPENAI_* -> write .env -> run infra in docker + apps on host"
	@echo "  $(GREEN)make studio$(RESET)              # Prisma Studio on :5555"
	@echo ""

## envfile: Create/update .env by prompting for OPENAI_* (skips prompts if already set)
envfile:
	@set -e; \
	OPENAI_MODEL_VAL="$${OPENAI_MODEL:-}"; \
	OPENAI_BASE_URL_VAL="$${OPENAI_BASE_URL:-}"; \
	OPENAI_API_KEY_VAL="$${OPENAI_API_KEY:-}"; \
	SCRAPE_CRON_VAL="$${SCRAPE_CRON:-}"; \
	if [ -f "$(ENV_FILE)" ]; then \
	  if [ -z "$$OPENAI_MODEL_VAL" ]; then OPENAI_MODEL_VAL="$$(grep -E '^OPENAI_MODEL=' "$(ENV_FILE)" | tail -n 1 | cut -d= -f2- || true)"; fi; \
	  if [ -z "$$OPENAI_BASE_URL_VAL" ]; then OPENAI_BASE_URL_VAL="$$(grep -E '^OPENAI_BASE_URL=' "$(ENV_FILE)" | tail -n 1 | cut -d= -f2- || true)"; fi; \
	  if [ -z "$$OPENAI_API_KEY_VAL" ]; then OPENAI_API_KEY_VAL="$$(grep -E '^OPENAI_API_KEY=' "$(ENV_FILE)" | tail -n 1 | cut -d= -f2- || true)"; fi; \
	  if [ -z "$$SCRAPE_CRON_VAL" ]; then SCRAPE_CRON_VAL="$$(grep -E '^SCRAPE_CRON=' "$(ENV_FILE)" | tail -n 1 | cut -d= -f2- || true)"; fi; \
	fi; \
	if [ -z "$$SCRAPE_CRON_VAL" ]; then SCRAPE_CRON_VAL="*/5 * * * *"; fi; \
	if [ -z "$$OPENAI_MODEL_VAL" ]; then \
	  printf "OPENAI_MODEL (default: gpt-4.1-nano-2025-04-14): "; \
	  read -r OPENAI_MODEL_VAL; \
	  if [ -z "$$OPENAI_MODEL_VAL" ]; then OPENAI_MODEL_VAL="gpt-4.1-nano-2025-04-14"; fi; \
	fi; \
	if [ -z "$$OPENAI_BASE_URL_VAL" ]; then \
	  printf "OPENAI_BASE_URL (optional, press Enter to skip): "; \
	  read -r OPENAI_BASE_URL_VAL; \
	fi; \
	if [ -z "$$OPENAI_API_KEY_VAL" ]; then \
	  printf "OPENAI_API_KEY (input hidden): "; \
	  stty -echo; read -r OPENAI_API_KEY_VAL; stty echo; printf "\n"; \
	fi; \
	if [ -z "$$OPENAI_API_KEY_VAL" ]; then \
	  echo "$(RED)OPENAI_API_KEY is required.$(RESET)"; \
	  exit 1; \
	fi; \
	if [ -f "$(ENV_FILE)" ]; then \
	  grep -vE '^(OPENAI_MODEL|OPENAI_BASE_URL|OPENAI_API_KEY|SCRAPE_CRON)=' "$(ENV_FILE)" > "$(ENV_FILE).tmp" || true; \
	else \
	  : > "$(ENV_FILE).tmp"; \
	fi; \
	{ \
	  cat "$(ENV_FILE).tmp"; \
	  echo "OPENAI_MODEL=$$OPENAI_MODEL_VAL"; \
	  if [ -n "$$OPENAI_BASE_URL_VAL" ]; then echo "OPENAI_BASE_URL=$$OPENAI_BASE_URL_VAL"; fi; \
	  echo "OPENAI_API_KEY=$$OPENAI_API_KEY_VAL"; \
	  echo "SCRAPE_CRON=$$SCRAPE_CRON_VAL"; \
	} > "$(ENV_FILE)"; \
	rm -f "$(ENV_FILE).tmp"; \
	echo "$(GREEN)Wrote $(ENV_FILE).$(RESET)"

## install: Prompt OPENAI_* -> write .env -> run stack by env=dev|prod|local
install: envfile
	@if [ "$(env)" = "prod" ]; then \
	  $(MAKE) up env=prod; \
	elif [ "$(env)" = "dev" ]; then \
	  $(MAKE) up env=dev; \
	elif [ "$(env)" = "local" ]; then \
	  @pnpm install; \
	  $(MAKE) local; \
	else \
	  echo "$(RED)Unknown env=$(env). Use env=dev|prod|local$(RESET)"; \
	  exit 1; \
	fi

## up: Start docker services (env=dev adds docker-compose.dev.yml)
up:
	@echo "$(YELLOW)Starting docker services (env=$(env))...$(RESET)"
	@$(COMPOSE_ENV) $(COMPOSE_CMD) up -d --build $(SERVICES)

## down: Stop and remove docker services
down:
	@echo "$(YELLOW)Stopping docker services...$(RESET)"
	@$(COMPOSE_ENV) $(COMPOSE_CMD) down

## stop: Stop running docker containers (keeps volumes)
stop:
	@echo "$(YELLOW)Stopping containers...$(RESET)"
	@$(COMPOSE_ENV) $(COMPOSE_CMD) stop $(SERVICES)

## start: Start existing docker containers
start:
	@echo "$(YELLOW)Starting containers...$(RESET)"
	@$(COMPOSE_ENV) $(COMPOSE_CMD) start $(SERVICES)

## restart: Restart docker containers
restart:
	@echo "$(YELLOW)Restarting containers...$(RESET)"
	@$(COMPOSE_ENV) $(COMPOSE_CMD) restart $(SERVICES)

## ps: Show docker container status
ps:
	@$(COMPOSE_ENV) $(COMPOSE_CMD) ps

## logs: Tail docker logs (optionally service=<name>)
logs:
	@$(COMPOSE_ENV) $(COMPOSE_CMD) logs -f --tail=200 $(SERVICES)

## shell: Open interactive shell in a service (requires service=<name>, respects env=dev|prod)
shell: _validate_shell_service
	@echo "$(CYAN)Opening shell in $(service)...$(RESET)"
	@$(COMPOSE_ENV) $(COMPOSE_CMD) exec $(service) sh -c 'if command -v bash >/dev/null 2>&1; then bash; else sh; fi'

_validate_shell_service:
	@if [ -z "$(service)" ]; then \
	  echo "$(RED)Error: service parameter required$(RESET)"; \
	  echo "$(YELLOW)Available services: backend, frontend, postgres, redis, prisma-studio$(RESET)"; \
	  exit 1; \
	fi

## build: Build docker images with bake (env=dev|prod)
build:
	@echo "$(YELLOW)Building images with docker bake (env=$(env))...$(RESET)"
	@if [ "$(env)" = "dev" ]; then docker buildx bake -f docker-bake.hcl dev; else docker buildx bake -f docker-bake.hcl prod; fi

## prune: Aggressive docker cleanup
prune:
	@echo "$(RED)Pruning docker system...$(RESET)"
	@docker system prune -af --volumes

## dev-reset: Remove dev volumes (use after deps changes if Docker dev uses node_modules volumes)
dev-reset:
	@echo "$(YELLOW)Resetting dev volumes...$(RESET)"
	@COMPOSE_PROJECT_NAME=autonomyai-dev docker compose -f docker-compose.yml -f docker-compose.dev.yml down -v

## infra-up: Start only postgres + redis (for running apps on host OS)
infra-up:
	@$(COMPOSE_ENV) docker compose -f docker-compose.yml up -d postgres redis

## apps-stop: Stop backend/frontend docker containers (keep infra running)
apps-stop:
	@COMPOSE_PROJECT_NAME=autonomyai-prod docker compose -f docker-compose.yml stop backend frontend || true
	@COMPOSE_PROJECT_NAME=autonomyai-dev docker compose -f docker-compose.yml -f docker-compose.dev.yml stop backend frontend || true

## dev: Run shared watch + backend debug + frontend dev on host OS
dev:
	@echo "$(YELLOW)Starting local dev processes...$(RESET)"
	@pnpm --filter @fakenews/shared dev & pnpm --filter backend start:debug & pnpm --filter frontend dev

## local: Run infra in docker and apps on host OS (loads OPENAI_* from .env)
local: infra-up
	@echo "$(YELLOW)Starting host apps (env=local)...$(RESET)"
	@set -a; . ./$(ENV_FILE); set +a; \
	  DATABASE_URL="$${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/fakenews}"; \
	  REDIS_URL="$${REDIS_URL:-redis://localhost:6379}"; \
	  NEXT_PUBLIC_API_URL="$${NEXT_PUBLIC_API_URL:-http://localhost:3001}"; \
	  pnpm --filter @fakenews/shared dev & \
	  DATABASE_URL="$$DATABASE_URL" REDIS_URL="$$REDIS_URL" pnpm --filter backend start:debug & \
	  NEXT_PUBLIC_API_URL="$$NEXT_PUBLIC_API_URL" pnpm --filter frontend dev

## test: Run all tests
test:
	@pnpm test

## build-app: Build all packages (tsc + nest swc + next build)
build-app:
	@pnpm build

## prisma-generate: Generate Prisma client
prisma-generate:
	@pnpm --filter backend prisma:generate

## migrate: Create/apply a dev migration (interactive)
migrate:
	@pnpm --filter backend migrate:dev

## studio: Run Prisma Studio on http://localhost:5555
studio:
	@echo "$(YELLOW)Starting Prisma Studio on :5555...$(RESET)"
	@$(COMPOSE_ENV) $(COMPOSE_CMD) up -d --build prisma-studio

## repl: Start Nest REPL (host OS)
repl:
	@pnpm --filter backend repl

## spelunker: Generate Nest module graph (host OS)
spelunker:
	@pnpm --filter backend spelunker
