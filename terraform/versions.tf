terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.7"
    }
  }

  # Configuracao parcial: bucket, key e region vem do pipeline via -backend-config
  backend "s3" {}
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "oficina-mecanica"
      Component   = "auth"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}
