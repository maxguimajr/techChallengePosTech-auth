resource "aws_apigatewayv2_api" "main" {
  name          = "oficina-api-${var.environment}"
  protocol_type = "HTTP"
  description   = "API Gateway da oficina: autenticacao via CPF e roteamento para a aplicacao no Kubernetes"

  cors_configuration {
    allow_origins = ["*"]
    allow_methods = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
    allow_headers = ["authorization", "content-type", "x-correlation-id"]
    max_age       = 300
  }
}

resource "aws_cloudwatch_log_group" "api_access" {
  name              = "/aws/apigateway/oficina-api-${var.environment}"
  retention_in_days = var.log_retention_days
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.main.id
  name        = "$default"
  auto_deploy = true

  default_route_settings {
    throttling_rate_limit  = var.throttling_rate_limit
    throttling_burst_limit = var.throttling_burst_limit
  }

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_access.arn
    format = jsonencode({
      requestId          = "$context.requestId"
      ip                 = "$context.identity.sourceIp"
      method             = "$context.httpMethod"
      path               = "$context.path"
      routeKey           = "$context.routeKey"
      status             = "$context.status"
      latencyMs          = "$context.responseLatency"
      integrationLatency = "$context.integrationLatency"
      integrationError   = "$context.integrationErrorMessage"
      authorizerError    = "$context.authorizer.error"
      clienteId          = "$context.authorizer.sub"
    })
  }
}

# ── POST /auth/cpf → Lambda de autenticacao (publica) ─────────────────────────

resource "aws_apigatewayv2_integration" "auth" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.auth.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "auth" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /auth/cpf"
  target    = "integrations/${aws_apigatewayv2_integration.auth.id}"
}

resource "aws_lambda_permission" "auth" {
  statement_id  = "AllowApiGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.auth.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

# ── Lambda Authorizer (JWT HS256) ─────────────────────────────────────────────
# O JWT Authorizer nativo do HTTP API so aceita emissores OIDC com JWKS (RS256),
# por isso a validacao do HS256 e feita por uma Lambda.

resource "aws_apigatewayv2_authorizer" "jwt" {
  api_id                            = aws_apigatewayv2_api.main.id
  name                              = "jwt-cpf"
  authorizer_type                   = "REQUEST"
  authorizer_uri                    = aws_lambda_function.authorizer.invoke_arn
  authorizer_payload_format_version = "2.0"
  enable_simple_responses           = true
  identity_sources                  = ["$request.header.Authorization"]
  authorizer_result_ttl_in_seconds  = 300
}

resource "aws_lambda_permission" "authorizer" {
  statement_id  = "AllowApiGatewayInvokeAuthorizer"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.authorizer.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/authorizers/${aws_apigatewayv2_authorizer.jwt.id}"
}

# ── Rotas da aplicacao no Kubernetes ──────────────────────────────────────────
# Criadas apenas quando app_base_url e informado (endpoint estavel do repo k8s-infra).

locals {
  app_enabled = var.app_base_url != ""
  app_url     = trimsuffix(var.app_base_url, "/")
}

resource "aws_apigatewayv2_integration" "app_protegida" {
  count = local.app_enabled ? 1 : 0

  api_id             = aws_apigatewayv2_api.main.id
  integration_type   = "HTTP_PROXY"
  integration_method = "ANY"
  integration_uri    = "${local.app_url}/{proxy}"

  # Headers sobrescritos pelo gateway: o cliente nao consegue forja-los
  request_parameters = {
    "overwrite:header.x-correlation-id" = "$context.requestId"
    "overwrite:header.x-cliente-id"     = "$context.authorizer.sub"
    "overwrite:header.x-usuario-papel"  = "$context.authorizer.papel"
  }
}

resource "aws_apigatewayv2_route" "app_protegida" {
  count = local.app_enabled ? 1 : 0

  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "ANY /{proxy+}"
  target             = "integrations/${aws_apigatewayv2_integration.app_protegida[0].id}"
  authorization_type = "CUSTOM"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

resource "aws_apigatewayv2_integration" "app_publica" {
  for_each = local.app_enabled ? var.public_app_routes : {}

  api_id             = aws_apigatewayv2_api.main.id
  integration_type   = "HTTP_PROXY"
  integration_method = split(" ", each.key)[0]
  integration_uri    = "${local.app_url}${each.value}"

  request_parameters = {
    "overwrite:header.x-correlation-id" = "$context.requestId"
  }
}

resource "aws_apigatewayv2_route" "app_publica" {
  for_each = aws_apigatewayv2_integration.app_publica

  api_id    = aws_apigatewayv2_api.main.id
  route_key = each.key
  target    = "integrations/${each.value.id}"
}
