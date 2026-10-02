.PHONY: up up-prod down logs ps migrate reset init build clean test

# Comando por defecto: levantar stack
up:
	@chmod +x ./streamflow.sh 2>/dev/null || true
	./streamflow.sh up

up-prod:
	@chmod +x ./streamflow.sh 2>/dev/null || true
	./streamflow.sh up --prod

down:
	@chmod +x ./streamflow.sh 2>/dev/null || true
	./streamflow.sh down

logs:
	@chmod +x ./streamflow.sh 2>/dev/null || true
	./streamflow.sh logs

ps:
	@chmod +x ./streamflow.sh 2>/dev/null || true
	./streamflow.sh ps

migrate:
	@chmod +x ./streamflow.sh 2>/dev/null || true
	./streamflow.sh migrate

reset:
	@chmod +x ./streamflow.sh 2>/dev/null || true
	./streamflow.sh reset

init:
	@chmod +x ./streamflow.sh 2>/dev/null || true
	./streamflow.sh init

build:
	npm run build

clean:
	npm run clean
