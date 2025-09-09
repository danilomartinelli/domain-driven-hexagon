# Makefile for Domain-Driven Hexagon Docker Operations
# Provides convenient commands to manage Docker containers and services

# Variables
DOCKER_DIR = docker
COMPOSE_PROD = $(DOCKER_DIR)/compose.prod.yml
COMPOSE_DEV = $(DOCKER_DIR)/compose.dev.yml
APP_NAME = ddh/app
VERSION ?= latest
ENVIRONMENT ?= production

# Colors for output
BLUE = \033[0;34m
GREEN = \033[0;32m
YELLOW = \033[1;33m
RED = \033[0;31m
NC = \033[0m # No Color

# Default target
.DEFAULT_GOAL := help

##@ Development Commands

.PHONY: dev
dev: ## Start development environment with hot reload
	@echo "$(BLUE)Starting development environment...$(NC)"
	docker-compose -f $(COMPOSE_DEV) up -d
	@echo "$(GREEN)Development environment started!$(NC)"
	@echo "$(YELLOW)App: http://localhost:3000$(NC)"
	@echo "$(YELLOW)PgAdmin: http://localhost:5050$(NC)"
	@echo "$(YELLOW)Database: localhost:5432$(NC)"

.PHONY: dev-logs
dev-logs: ## Follow development logs
	@echo "$(BLUE)Following development logs...$(NC)"
	docker-compose -f $(COMPOSE_DEV) logs -f

.PHONY: dev-stop
dev-stop: ## Stop development environment
	@echo "$(BLUE)Stopping development environment...$(NC)"
	docker-compose -f $(COMPOSE_DEV) down
	@echo "$(GREEN)Development environment stopped$(NC)"

.PHONY: dev-restart
dev-restart: dev-stop dev ## Restart development environment

##@ Production Commands

.PHONY: prod
prod: ## Start production environment
	@echo "$(BLUE)Starting production environment...$(NC)"
	docker-compose -f $(COMPOSE_PROD) up -d
	@echo "$(GREEN)Production environment started!$(NC)"
	@echo "$(YELLOW)App: http://localhost:3000$(NC)"

.PHONY: prod-with-nginx
prod-with-nginx: ## Start production environment with Nginx
	@echo "$(BLUE)Starting production environment with Nginx...$(NC)"
	docker-compose -f $(COMPOSE_PROD) --profile production up -d
	@echo "$(GREEN)Production environment with Nginx started!$(NC)"
	@echo "$(YELLOW)HTTP: http://localhost:80$(NC)"
	@echo "$(YELLOW)HTTPS: https://localhost:443$(NC)"

.PHONY: prod-logs
prod-logs: ## Follow production logs
	@echo "$(BLUE)Following production logs...$(NC)"
	docker-compose -f $(COMPOSE_PROD) logs -f

.PHONY: prod-stop
prod-stop: ## Stop production environment
	@echo "$(BLUE)Stopping production environment...$(NC)"
	docker-compose -f $(COMPOSE_PROD) down
	@echo "$(GREEN)Production environment stopped$(NC)"

.PHONY: prod-restart
prod-restart: prod-stop prod ## Restart production environment

##@ Build Commands

.PHONY: ssl
ssl: ## Generate SSL certificates for development
	@echo "$(BLUE)Generating SSL certificates...$(NC)"
	@if [ -x "$(DOCKER_DIR)/scripts/generate-ssl.sh" ]; then \
		cd $(DOCKER_DIR)/scripts && ./generate-ssl.sh; \
	else \
		echo "$(RED)SSL generation script not found or not executable$(NC)"; \
		echo "$(YELLOW)Run: chmod +x $(DOCKER_DIR)/scripts/generate-ssl.sh$(NC)"; \
		exit 1; \
	fi

.PHONY: build
build: ## Build production Docker image
	@echo "$(BLUE)Building production image: $(APP_NAME):$(VERSION)$(NC)"
	cd $(DOCKER_DIR) && docker build -f Dockerfile.prod -t $(APP_NAME):$(VERSION) ..
	@echo "$(GREEN)Production image built successfully$(NC)"

.PHONY: build-dev
build-dev: ## Build development Docker image
	@echo "$(BLUE)Building development image: $(APP_NAME):dev$(NC)"
	cd $(DOCKER_DIR) && docker build -f Dockerfile.dev -t $(APP_NAME):dev ..
	@echo "$(GREEN)Development image built successfully$(NC)"

.PHONY: build-optimized
build-optimized: ## Build optimized image using build script
	@echo "$(BLUE)Building optimized image with script...$(NC)"
	@if [ -x "$(DOCKER_DIR)/scripts/docker-build.sh" ]; then \
		cd $(DOCKER_DIR)/scripts && ./docker-build.sh $(APP_NAME) $(VERSION) $(ENVIRONMENT); \
	else \
		echo "$(RED)Build script not found or not executable$(NC)"; \
		echo "$(YELLOW)Run: chmod +x $(DOCKER_DIR)/scripts/docker-build.sh$(NC)"; \
		exit 1; \
	fi

.PHONY: build-all
build-all: build build-dev ## Build both production and development images

##@ Database Commands

.PHONY: db-migrate
db-migrate: ## Run database migrations
	@echo "$(BLUE)Running database migrations...$(NC)"
	docker-compose -f $(COMPOSE_PROD) exec app npm run migration:up
	@echo "$(GREEN)Database migrations completed$(NC)"

.PHONY: db-migrate-dev
db-migrate-dev: ## Run database migrations in development
	@echo "$(BLUE)Running database migrations (development)...$(NC)"
	docker-compose -f $(COMPOSE_DEV) exec app npm run migration:up
	@echo "$(GREEN)Database migrations completed$(NC)"

.PHONY: db-seed
db-seed: ## Run database seeds
	@echo "$(BLUE)Running database seeds...$(NC)"
	docker-compose -f $(COMPOSE_PROD) exec app npm run seed:up
	@echo "$(GREEN)Database seeding completed$(NC)"

.PHONY: db-console
db-console: ## Access PostgreSQL console
	@echo "$(BLUE)Opening PostgreSQL console...$(NC)"
	docker-compose -f $(COMPOSE_PROD) exec postgres psql -U user -d ddh

.PHONY: db-console-dev
db-console-dev: ## Access PostgreSQL console (development)
	@echo "$(BLUE)Opening PostgreSQL console (development)...$(NC)"
	docker-compose -f $(COMPOSE_DEV) exec postgres psql -U user -d ddh

##@ Monitoring Commands

.PHONY: status
status: ## Show container status
	@echo "$(BLUE)Container Status:$(NC)"
	@echo "$(YELLOW)Production:$(NC)"
	@docker-compose -f $(COMPOSE_PROD) ps 2>/dev/null || echo "Production environment not running"
	@echo "$(YELLOW)Development:$(NC)"
	@docker-compose -f $(COMPOSE_DEV) ps 2>/dev/null || echo "Development environment not running"

.PHONY: monitor
monitor: ## Monitor containers with detailed metrics
	@echo "$(BLUE)Starting container monitoring...$(NC)"
	@if [ -x "$(DOCKER_DIR)/scripts/container-monitor.sh" ]; then \
		cd $(DOCKER_DIR)/scripts && ./container-monitor.sh ../compose.prod.yml monitor; \
	else \
		echo "$(RED)Monitor script not found or not executable$(NC)"; \
		echo "$(YELLOW)Run: chmod +x $(DOCKER_DIR)/scripts/container-monitor.sh$(NC)"; \
	fi

.PHONY: health
health: ## Check container health status
	@echo "$(BLUE)Checking container health...$(NC)"
	@if [ -x "$(DOCKER_DIR)/scripts/container-monitor.sh" ]; then \
		cd $(DOCKER_DIR)/scripts && ./container-monitor.sh ../compose.prod.yml status; \
	else \
		echo "$(YELLOW)Using basic health check...$(NC)"; \
		docker-compose -f $(COMPOSE_PROD) ps; \
	fi

.PHONY: logs
logs: ## Show logs for all services
	@echo "$(BLUE)Showing logs for all services...$(NC)"
	@echo "$(YELLOW)Choose environment: [p]roduction or [d]evelopment?$(NC)"
	@read env && \
	if [ "$$env" = "p" ] || [ "$$env" = "production" ]; then \
		docker-compose -f $(COMPOSE_PROD) logs --tail=100; \
	elif [ "$$env" = "d" ] || [ "$$env" = "development" ]; then \
		docker-compose -f $(COMPOSE_DEV) logs --tail=100; \
	else \
		echo "$(RED)Invalid choice. Use 'p' for production or 'd' for development$(NC)"; \
	fi

##@ Testing Commands

.PHONY: test
test: ## Run tests in container
	@echo "$(BLUE)Running tests...$(NC)"
	docker-compose -f $(COMPOSE_DEV) exec app npm run test
	@echo "$(GREEN)Tests completed$(NC)"

.PHONY: test-e2e
test-e2e: ## Run end-to-end tests
	@echo "$(BLUE)Running E2E tests...$(NC)"
	docker-compose -f $(COMPOSE_DEV) exec app npm run test:e2e
	@echo "$(GREEN)E2E tests completed$(NC)"

.PHONY: test-cov
test-cov: ## Run tests with coverage
	@echo "$(BLUE)Running tests with coverage...$(NC)"
	docker-compose -f $(COMPOSE_DEV) exec app npm run test:cov
	@echo "$(GREEN)Coverage tests completed$(NC)"

.PHONY: lint
lint: ## Run linting
	@echo "$(BLUE)Running linting...$(NC)"
	docker-compose -f $(COMPOSE_DEV) exec app npm run lint
	@echo "$(GREEN)Linting completed$(NC)"

##@ Cleanup Commands

.PHONY: clean
clean: ## Stop all containers and remove them
	@echo "$(BLUE)Cleaning up containers...$(NC)"
	docker-compose -f $(COMPOSE_PROD) down 2>/dev/null || true
	docker-compose -f $(COMPOSE_DEV) down 2>/dev/null || true
	@echo "$(GREEN)Containers cleaned up$(NC)"

.PHONY: clean-volumes
clean-volumes: ## Stop containers and remove volumes (⚠️  DATA LOSS!)
	@echo "$(RED)⚠️  WARNING: This will delete all database data!$(NC)"
	@echo "$(YELLOW)Are you sure? [y/N]$(NC)"
	@read confirm && \
	if [ "$$confirm" = "y" ] || [ "$$confirm" = "Y" ]; then \
		echo "$(BLUE)Removing containers and volumes...$(NC)"; \
		docker-compose -f $(COMPOSE_PROD) down -v 2>/dev/null || true; \
		docker-compose -f $(COMPOSE_DEV) down -v 2>/dev/null || true; \
		echo "$(GREEN)Containers and volumes removed$(NC)"; \
	else \
		echo "$(YELLOW)Cancelled$(NC)"; \
	fi

.PHONY: clean-images
clean-images: ## Remove built images
	@echo "$(BLUE)Removing built images...$(NC)"
	docker rmi $(APP_NAME):$(VERSION) $(APP_NAME):dev 2>/dev/null || true
	@echo "$(GREEN)Images cleaned up$(NC)"

.PHONY: clean-all
clean-all: clean clean-images ## Full cleanup (containers, images, but not volumes)
	@echo "$(BLUE)Running Docker system cleanup...$(NC)"
	@if [ -x "$(DOCKER_DIR)/scripts/container-monitor.sh" ]; then \
		cd $(DOCKER_DIR)/scripts && ./container-monitor.sh ../compose.prod.yml cleanup; \
	else \
		docker system prune -f; \
	fi
	@echo "$(GREEN)Full cleanup completed$(NC)"

##@ Utility Commands

.PHONY: shell
shell: ## Access application container shell
	@echo "$(BLUE)Opening shell in application container...$(NC)"
	@echo "$(YELLOW)Choose environment: [p]roduction or [d]evelopment?$(NC)"
	@read env && \
	if [ "$$env" = "p" ] || [ "$$env" = "production" ]; then \
		docker-compose -f $(COMPOSE_PROD) exec app sh; \
	elif [ "$$env" = "d" ] || [ "$$env" = "development" ]; then \
		docker-compose -f $(COMPOSE_DEV) exec app sh; \
	else \
		echo "$(RED)Invalid choice. Use 'p' for production or 'd' for development$(NC)"; \
	fi

.PHONY: rebuild
rebuild: clean build ## Clean and rebuild images
	@echo "$(GREEN)Rebuild completed$(NC)"

.PHONY: reset
reset: clean-volumes build dev ## Full reset: remove everything and start fresh
	@echo "$(GREEN)Full reset completed$(NC)"

.PHONY: setup
setup: ## Initial setup: build and start development environment
	@echo "$(BLUE)Setting up development environment...$(NC)"
	@$(MAKE) build-all
	@$(MAKE) dev
	@$(MAKE) db-migrate-dev
	@echo "$(GREEN)Setup completed!$(NC)"
	@echo "$(YELLOW)Access your application at: http://localhost:3000$(NC)"
	@echo "$(YELLOW)Access PgAdmin at: http://localhost:5050$(NC)"

.PHONY: quick-start
quick-start: ## Complete automated setup with guided experience
	@echo "$(BLUE)Starting automated setup...$(NC)"
	@if [ -x "$(DOCKER_DIR)/scripts/quick-start.sh" ]; then \
		cd $(DOCKER_DIR)/scripts && ./quick-start.sh; \
	else \
		echo "$(RED)Quick-start script not found or not executable$(NC)"; \
		echo "$(YELLOW)Run: chmod +x $(DOCKER_DIR)/scripts/quick-start.sh$(NC)"; \
		exit 1; \
	fi

##@ Information Commands

.PHONY: env
env: ## Show environment information
	@echo "$(BLUE)Environment Information:$(NC)"
	@echo "Docker Directory: $(DOCKER_DIR)"
	@echo "App Name: $(APP_NAME)"
	@echo "Version: $(VERSION)"
	@echo "Environment: $(ENVIRONMENT)"
	@echo "Production Compose: $(COMPOSE_PROD)"
	@echo "Development Compose: $(COMPOSE_DEV)"
	@echo ""
	@echo "$(YELLOW)Docker Version:$(NC)"
	@docker --version 2>/dev/null || echo "Docker not found"
	@echo "$(YELLOW)Docker Compose Version:$(NC)"
	@docker-compose --version 2>/dev/null || echo "Docker Compose not found"

.PHONY: urls
urls: ## Show application URLs
	@echo "$(BLUE)Application URLs:$(NC)"
	@echo "$(YELLOW)Development:$(NC)"
	@echo "  App: http://localhost:3000"
	@echo "  PgAdmin: http://localhost:5050"
	@echo "  Database: localhost:5432"
	@echo "  Redis: localhost:6379"
	@echo ""
	@echo "$(YELLOW)Production:$(NC)"
	@echo "  App: http://localhost:3000"
	@echo "  With Nginx: http://localhost:80 | https://localhost:443"

##@ Help

.PHONY: help
help: ## Display this help message
	@echo "$(BLUE)Domain-Driven Hexagon - Docker Management$(NC)"
	@echo ""
	@echo "$(YELLOW)Usage:$(NC)"
	@echo "  make [target] [VARIABLE=value]"
	@echo ""
	@echo "$(YELLOW)Variables:$(NC)"
	@echo "  VERSION=$(VERSION)        - Docker image version"
	@echo "  ENVIRONMENT=$(ENVIRONMENT)  - Build environment"
	@echo ""
	@echo "$(YELLOW)Quick Start:$(NC)"
	@echo "  make setup           - Complete initial setup"
	@echo "  make dev            - Start development environment"
	@echo "  make prod           - Start production environment"
	@echo ""
	@awk 'BEGIN {FS = ":.*##"; printf "\n\033[1;33mAvailable Commands:\033[0m\n"} /^[a-zA-Z_-]+:.*?##/ { printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2 } /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } ' $(MAKEFILE_LIST)
	@echo ""