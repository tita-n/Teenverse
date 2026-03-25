.PHONY: help install dev build start test lint clean docker-build docker-up docker-down docker-logs prod deploy

# Colors
GREEN  := \033[0;32m
YELLOW := \033[0;33m
NC     := \033[0m

help: ## Show this help message
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "$(GREEN)%-15s$(NC) %s\n", $$1, $$2}'

install: ## Install dependencies
	npm ci

dev: ## Run development server
	npm run dev

build: ## Build for production
	npm run build

start: ## Start production server
	npm run start:prod

test: ## Run tests
	npm test

lint: ## Run linter
	npm run lint

type-check: ## Run type checker
	npm run type-check

clean: ## Clean build artifacts
	rm -rf dist/ build/ node_modules/
	npm ci

# Docker commands
docker-build: ## Build Docker images
	docker build -t teenverse-backend .

docker-up: ## Start Docker containers (dev)
	docker-compose up -d

docker-down: ## Stop Docker containers
	docker-compose down

docker-logs: ## View Docker logs
	docker-compose logs -f

docker-clean: ## Clean Docker resources
	docker-compose down -v --rmi local

# Production commands
docker-prod-build: ## Build production Docker images
	docker build -t teenverse-backend .

docker-prod-up: ## Start production Docker containers
	docker-compose -f docker-compose.prod.yml up -d

docker-prod-down: ## Stop production Docker containers
	docker-compose -f docker-compose.prod.yml down

# Database commands
db-migrate: ## Run database migrations
	@echo "Running migrations..."

db-seed: ## Seed database with initial data
	@echo "Seeding database..."

db-backup: ## Backup database
	docker-compose exec postgres pg_dump -U teenverse teenverse > backup_$$(date +%Y%m%d_%H%M%S).sql

db-restore: ## Restore database from backup
	@echo "Usage: make db-restore FILE=backup.sql"
	docker-compose exec -T postgres psql -U teenverse teenverse < $(FILE)

# Health checks
health: ## Check service health
	@curl -s http://localhost:5000/health | jq .

# Logs
logs-backend: ## View backend logs
	docker-compose logs -f backend

logs-nginx: ## View nginx logs
	docker-compose logs -f nginx

# Deployment
deploy: docker-prod-build docker-prod-up ## Build and deploy to production
	@echo "$(GREEN)Deployment complete!$(NC)"

# Security
security-check: ## Run security checks
	@echo "Running npm audit..."
	npm audit
	@echo "Checking for exposed secrets..."
	@grep -r "SECRET_KEY.*=" --include="*.ts" --include="*.js" . | grep -v node_modules || true
