terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.20"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.10"
    }
  }
  
  backend "s3" {
    bucket = "aws-devops-terraform-state"
    key    = "infrastructure/terraform.tfstate"
    region = "us-west-2"
  }
}

provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = {
      Project     = "aws-devops-test"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# Data sources
data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_caller_identity" "current" {}

# Networking Module
module "networking" {
  source = "./modules/networking"
  
  environment         = var.environment
  vpc_cidr           = var.vpc_cidr
  availability_zones = data.aws_availability_zones.available.names
  public_subnet_cidrs = var.public_subnet_cidrs
  private_subnet_cidrs = var.private_subnet_cidrs
}

# Security Module
module "security" {
  source = "./modules/security"
  
  environment = var.environment
  vpc_id     = module.networking.vpc_id
  
  depends_on = [module.networking]
}

# Storage Module
module "storage" {
  source = "./modules/storage"
  
  environment     = var.environment
  vpc_id         = module.networking.vpc_id
  private_subnet_ids = module.networking.private_subnet_ids
  security_groups = module.security.security_groups
  kms_key_id     = module.security.kms_key_id
}

# Compute Module
module "compute" {
  source = "./modules/compute"
  
  environment     = var.environment
  vpc_id         = module.networking.vpc_id
  private_subnet_ids = module.networking.private_subnet_ids
  security_groups = module.security.security_groups
  
  depends_on = [module.networking, module.security]
}

# Monitoring Module
module "monitoring" {
  source = "./modules/monitoring"
  
  environment = var.environment
  eks_cluster_name = module.compute.eks_cluster_name
  rds_instance_id = module.storage.rds_instance_id
  
  depends_on = [module.compute, module.storage]
}