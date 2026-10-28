locals {
  name_prefix = "oficina-auth-${var.environment}"
  dist_dir    = "${path.module}/../dist"
  # Sem subnets a Lambda roda fora de VPC e acessa o RDS pelo endpoint publico (RDS em outra conta)
  vpc_enabled = length(var.subnet_ids) > 0
}

data "aws_iam_role" "lambda" {
  name = var.lambda_role_name
}

data "archive_file" "auth" {
  type        = "zip"
  source_file = "${local.dist_dir}/auth.js"
  output_path = "${path.module}/build/auth.zip"
}

data "archive_file" "authorizer" {
  type        = "zip"
  source_file = "${local.dist_dir}/authorizer.js"
  output_path = "${path.module}/build/authorizer.zip"
}

resource "aws_security_group" "lambda_auth" {
  count = local.vpc_enabled ? 1 : 0

  name        = "${local.name_prefix}-lambda"
  description = "Lambda de autenticacao - acesso de saida ao RDS"
  vpc_id      = var.vpc_id

  egress {
    description = "Saida para o RDS (a regra de entrada fica no SG do banco)"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_cloudwatch_log_group" "auth" {
  name              = "/aws/lambda/${local.name_prefix}"
  retention_in_days = var.log_retention_days
}

resource "aws_cloudwatch_log_group" "authorizer" {
  name              = "/aws/lambda/${local.name_prefix}-authorizer"
  retention_in_days = var.log_retention_days
}

resource "aws_lambda_function" "auth" {
  function_name    = local.name_prefix
  description      = "Valida CPF, consulta o cliente no banco e emite JWT"
  role             = data.aws_iam_role.lambda.arn
  runtime          = "nodejs22.x"
  handler          = "auth.handler"
  filename         = data.archive_file.auth.output_path
  source_code_hash = data.archive_file.auth.output_base64sha256
  memory_size      = 256
  timeout          = 10

  dynamic "vpc_config" {
    for_each = local.vpc_enabled ? [1] : []
    content {
      subnet_ids         = var.subnet_ids
      security_group_ids = [aws_security_group.lambda_auth[0].id]
    }
  }

  environment {
    variables = {
      DATABASE_URL           = var.database_url
      DB_SSL                 = tostring(var.db_ssl)
      JWT_SECRET             = var.jwt_secret
      JWT_EXPIRES_IN_SECONDS = tostring(var.jwt_expires_in_seconds)
      JWT_ISSUER             = var.jwt_issuer
      SERVICE_NAME           = local.name_prefix
    }
  }

  depends_on = [aws_cloudwatch_log_group.auth]
}

resource "aws_lambda_function" "authorizer" {
  function_name    = "${local.name_prefix}-authorizer"
  description      = "Lambda Authorizer do API Gateway - valida o JWT das rotas protegidas"
  role             = data.aws_iam_role.lambda.arn
  runtime          = "nodejs22.x"
  handler          = "authorizer.handler"
  filename         = data.archive_file.authorizer.output_path
  source_code_hash = data.archive_file.authorizer.output_base64sha256
  memory_size      = 128
  timeout          = 5

  environment {
    variables = {
      JWT_SECRET   = var.jwt_secret
      SERVICE_NAME = "${local.name_prefix}-authorizer"
    }
  }

  depends_on = [aws_cloudwatch_log_group.authorizer]
}
