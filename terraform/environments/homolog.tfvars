environment = "homolog"
aws_region  = "us-east-1"

# A Lambda roda na conta AWS Academy do responsavel pelo repo auth e o RDS fica na conta
# do repo db-infra. Como sao contas diferentes, a Lambda roda fora de VPC e conecta no
# endpoint publico do RDS (com SSL). Para rodar na mesma conta do banco, informe vpc_id e subnet_ids.

# Segredos (database_url, jwt_secret) e app_base_url vem do GitHub Actions via TF_VAR_*
