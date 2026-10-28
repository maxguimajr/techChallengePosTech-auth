environment = "prod"
aws_region  = "us-east-1"

# Lambda fora de VPC, conectando no endpoint publico do RDS (ver homolog.tfvars)

throttling_rate_limit  = 100
throttling_burst_limit = 200
log_retention_days     = 14

# Segredos (database_url, jwt_secret) e app_base_url vem do GitHub Actions via TF_VAR_*
