variable "environment" {
  description = "Environment name"
  type        = string
}

variable "vpc_id" {
  description = "ID of the VPC"
  type        = string
}

variable "private_subnet_ids" {
  description = "IDs of private subnets"
  type        = list(string)
}

variable "security_groups" {
  description = "Map of security group IDs"
  type = object({
    rds   = string
    redis = string
  })
}

variable "kms_key_id" {
  description = "ID of the KMS key"
  type        = string
}