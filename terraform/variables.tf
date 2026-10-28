variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "environment" {
  description = "homolog ou prod"
  type        = string

  validation {
    condition     = contains(["homolog", "prod"], var.environment)
    error_message = "environment deve ser homolog ou prod."
  }
}

variable "lambda_role_name" {
  description = "Role IAM existente usada pelas Lambdas (o AWS Academy Learner Lab nao permite criar roles)"
  type        = string
  default     = "LabRole"
}

variable "vpc_id" {
  description = "VPC do RDS, quando Lambda e banco estao na mesma conta. Nulo = Lambda fora de VPC"
  type        = string
  default     = null
}

variable "subnet_ids" {
  description = "Subnets para a Lambda alcancar o RDS pela rede privada. Vazio = Lambda fora de VPC (RDS publico)"
  type        = list(string)
  default     = []
}

variable "database_url" {
  description = "Connection string do PostgreSQL (output do repo techChallengePosTech-db-infra)"
  type        = string
  sensitive   = true
}

variable "db_ssl" {
  type    = bool
  default = true
}

variable "jwt_secret" {
  description = "Segredo HS256 compartilhado com a aplicacao (JWT_SECRET)"
  type        = string
  sensitive   = true
}

variable "jwt_expires_in_seconds" {
  type    = number
  default = 3600
}

variable "jwt_issuer" {
  type    = string
  default = "oficina-auth-lambda"
}

variable "app_base_url" {
  description = "URL base da aplicacao no Kubernetes (ex.: http://<elastic-ip>). Vazio = rotas da aplicacao nao sao criadas"
  type        = string
  default     = ""
}

variable "public_app_routes" {
  description = "Rotas da aplicacao que passam pelo gateway sem JWT (route key => caminho na aplicacao)"
  type        = map(string)
  default = {
    "POST /auth/login"       = "/auth/login"
    "GET /health"            = "/health"
    "GET /api/docs"          = "/api/docs"
    "GET /api/docs/{proxy+}" = "/api/docs/{proxy}"
  }
}

variable "throttling_rate_limit" {
  description = "Requisicoes por segundo permitidas no gateway"
  type        = number
  default     = 50
}

variable "throttling_burst_limit" {
  type    = number
  default = 100
}

variable "log_retention_days" {
  type    = number
  default = 7
}
