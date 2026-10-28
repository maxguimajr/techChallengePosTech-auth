output "api_endpoint" {
  description = "URL base do API Gateway"
  value       = aws_apigatewayv2_api.main.api_endpoint
}

output "auth_url" {
  description = "Endpoint de autenticacao via CPF"
  value       = "${aws_apigatewayv2_api.main.api_endpoint}/auth/cpf"
}

output "lambda_security_group_id" {
  description = "SG da Lambda (so quando roda em VPC): liberar entrada 5432 a partir dele no SG do RDS"
  value       = try(aws_security_group.lambda_auth[0].id, "")
}

output "auth_function_name" {
  value = aws_lambda_function.auth.function_name
}

output "authorizer_function_name" {
  value = aws_lambda_function.authorizer.function_name
}
