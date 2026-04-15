group "prod" {
  targets = ["backend", "frontend"]
}

group "dev" {
  targets = ["backend-dev", "frontend-dev"]
}

target "backend" {
  context = "."
  dockerfile = "apps/backend/Dockerfile"
  tags = ["autonomyai-backend:latest"]
}

target "frontend" {
  context = "."
  dockerfile = "apps/frontend/Dockerfile"
  tags = ["autonomyai-frontend:latest"]
}

target "backend-dev" {
  inherits = ["backend"]
  target = "dev"
  tags = ["autonomyai-backend:dev"]
}

target "frontend-dev" {
  inherits = ["frontend"]
  target = "dev"
  tags = ["autonomyai-frontend:dev"]
}

