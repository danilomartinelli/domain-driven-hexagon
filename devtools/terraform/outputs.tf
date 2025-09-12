# ==================================================
# TERRAFORM OUTPUTS FOR DOMAIN-DRIVEN HEXAGON
# ==================================================

# ==================================================
# CLUSTER INFORMATION
# ==================================================
output "cluster_name" {
  description = "Name of the EKS cluster"
  value       = module.eks.cluster_name
}

output "cluster_endpoint" {
  description = "Endpoint for EKS control plane"
  value       = module.eks.cluster_endpoint
}

output "cluster_security_group_id" {
  description = "Security group ID attached to the EKS cluster"
  value       = module.eks.cluster_security_group_id
}

output "cluster_iam_role_arn" {
  description = "IAM role ARN associated with EKS cluster"
  value       = module.eks.cluster_iam_role_arn
}

output "cluster_certificate_authority_data" {
  description = "Base64 encoded certificate data required to communicate with the cluster"
  value       = module.eks.cluster_certificate_authority_data
  sensitive   = true
}

output "cluster_version" {
  description = "The Kubernetes version for the EKS cluster"
  value       = module.eks.cluster_version
}

output "cluster_oidc_issuer_url" {
  description = "The URL on the EKS cluster OIDC Issuer"
  value       = module.eks.cluster_oidc_issuer_url
}

output "oidc_provider_arn" {
  description = "The ARN of the OIDC Provider if enabled"
  value       = module.eks.oidc_provider_arn
}

# ==================================================
# NODE GROUP INFORMATION
# ==================================================
output "node_groups" {
  description = "Map of attribute maps for all EKS managed node groups created"
  value       = module.eks.eks_managed_node_groups
  sensitive   = true
}

output "node_security_group_id" {
  description = "ID of the node shared security group"
  value       = module.eks.node_security_group_id
}

# ==================================================
# NETWORKING INFORMATION
# ==================================================
output "vpc_id" {
  description = "ID of the VPC where the cluster is deployed"
  value       = module.vpc.vpc_id
}

output "vpc_cidr_block" {
  description = "The CIDR block of the VPC"
  value       = module.vpc.vpc_cidr_block
}

output "private_subnets" {
  description = "List of IDs of private subnets"
  value       = module.vpc.private_subnets
}

output "public_subnets" {
  description = "List of IDs of public subnets"
  value       = module.vpc.public_subnets
}

output "database_subnets" {
  description = "List of IDs of database subnets"
  value       = module.vpc.database_subnets
}

output "nat_gateway_ips" {
  description = "List of public Elastic IPs created for AWS NAT Gateway"
  value       = module.vpc.nat_public_ips
}

# ==================================================
# DATABASE INFORMATION
# ==================================================
output "db_instance_endpoint" {
  description = "RDS instance endpoint"
  value       = module.rds.db_instance_endpoint
}

output "db_instance_port" {
  description = "RDS instance port"
  value       = module.rds.db_instance_port
}

output "db_instance_id" {
  description = "RDS instance ID"
  value       = module.rds.db_instance_id
}

output "db_instance_arn" {
  description = "RDS instance ARN"
  value       = module.rds.db_instance_arn
}

output "db_subnet_group_id" {
  description = "ID of the database subnet group"
  value       = module.rds.db_subnet_group_id
}

output "db_parameter_group_id" {
  description = "ID of the database parameter group"
  value       = module.rds.db_parameter_group_id
}

# ==================================================
# CACHE INFORMATION
# ==================================================
output "redis_cluster_id" {
  description = "ID of the ElastiCache replication group"
  value       = aws_elasticache_replication_group.redis.id
}

output "redis_primary_endpoint" {
  description = "Address of the endpoint for the primary node in the replication group"
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
}

output "redis_reader_endpoint" {
  description = "Address of the endpoint for the reader node in the replication group"
  value       = aws_elasticache_replication_group.redis.reader_endpoint_address
}

output "redis_port" {
  description = "Port number on which the Redis nodes accept connections"
  value       = aws_elasticache_replication_group.redis.port
}

# ==================================================
# LOAD BALANCER INFORMATION
# ==================================================
output "load_balancer_dns_name" {
  description = "DNS name of the load balancer"
  value       = aws_lb.app.dns_name
}

output "load_balancer_zone_id" {
  description = "Canonical hosted zone ID of the load balancer"
  value       = aws_lb.app.zone_id
}

output "load_balancer_arn" {
  description = "ARN of the load balancer"
  value       = aws_lb.app.arn
}

# ==================================================
# STORAGE INFORMATION
# ==================================================
output "s3_bucket_name" {
  description = "Name of the S3 bucket for application storage"
  value       = aws_s3_bucket.app_storage.id
}

output "s3_bucket_arn" {
  description = "ARN of the S3 bucket for application storage"
  value       = aws_s3_bucket.app_storage.arn
}

output "s3_bucket_regional_domain_name" {
  description = "Regional domain name of the S3 bucket"
  value       = aws_s3_bucket.app_storage.bucket_regional_domain_name
}

# ==================================================
# SECURITY INFORMATION
# ==================================================
output "kms_key_id" {
  description = "The globally unique identifier for the key"
  value       = aws_kms_key.ddh_key.key_id
}

output "kms_key_arn" {
  description = "The Amazon Resource Name (ARN) of the key"
  value       = aws_kms_key.ddh_key.arn
}

output "secrets_manager_db_secret_arn" {
  description = "ARN of the database credentials secret"
  value       = aws_secretsmanager_secret.db_credentials.arn
  sensitive   = true
}

output "secrets_manager_app_secret_arn" {
  description = "ARN of the application secrets"
  value       = aws_secretsmanager_secret.app_secrets.arn
  sensitive   = true
}

# ==================================================
# IAM ROLES INFORMATION
# ==================================================
output "ebs_csi_driver_role_arn" {
  description = "ARN of the EBS CSI Driver IAM role"
  value       = module.ebs_csi_irsa_role.iam_role_arn
}

output "load_balancer_controller_role_arn" {
  description = "ARN of the Load Balancer Controller IAM role"
  value       = module.load_balancer_controller_irsa_role.iam_role_arn
}

output "external_secrets_role_arn" {
  description = "ARN of the External Secrets IAM role"
  value       = module.external_secrets_irsa_role.iam_role_arn
}

# ==================================================
# MONITORING AND LOGGING
# ==================================================
output "cloudwatch_log_groups" {
  description = "Map of CloudWatch log groups created"
  value = {
    eks_cluster        = module.eks.cloudwatch_log_group_name
    elasticache_slow   = aws_cloudwatch_log_group.elasticache_slow_log.name
  }
}

# ==================================================
# RESOURCE TAGS
# ==================================================
output "common_tags" {
  description = "Common tags applied to all resources"
  value       = local.common_tags
}

# ==================================================
# KUBECTL CONFIGURATION
# ==================================================
output "kubectl_config" {
  description = "kubectl configuration command"
  value       = "aws eks update-kubeconfig --region ${var.aws_region} --name ${module.eks.cluster_name}"
}

# ==================================================
# CONNECTION INFORMATION
# ==================================================
output "connection_info" {
  description = "Connection information for external services"
  value = {
    database = {
      host     = module.rds.db_instance_endpoint
      port     = module.rds.db_instance_port
      database = "ddh_${var.environment}"
      username = "ddh_app"
      # Note: Password is stored in AWS Secrets Manager
      secret_arn = aws_secretsmanager_secret.db_credentials.arn
    }
    redis = {
      primary_endpoint = aws_elasticache_replication_group.redis.primary_endpoint_address
      reader_endpoint  = aws_elasticache_replication_group.redis.reader_endpoint_address
      port            = aws_elasticache_replication_group.redis.port
      # Note: Auth token is stored in AWS Secrets Manager
      secret_arn = aws_secretsmanager_secret.app_secrets.arn
    }
    load_balancer = {
      dns_name = aws_lb.app.dns_name
      url      = "https://${aws_lb.app.dns_name}"
    }
  }
  sensitive = true
}

# ==================================================
# DEPLOYMENT INFORMATION
# ==================================================
output "deployment_info" {
  description = "Information needed for deployment"
  value = {
    cluster_name               = module.eks.cluster_name
    cluster_endpoint          = module.eks.cluster_endpoint
    node_instance_role_arn    = module.eks.eks_managed_node_groups["primary"].iam_role_arn
    vpc_id                    = module.vpc.vpc_id
    private_subnet_ids        = module.vpc.private_subnets
    public_subnet_ids         = module.vpc.public_subnets
    security_group_ids = {
      cluster = module.eks.cluster_security_group_id
      nodes   = module.eks.node_security_group_id
      rds     = aws_security_group.rds.id
      redis   = aws_security_group.elasticache.id
      alb     = aws_security_group.alb.id
    }
  }
}

# ==================================================
# COST ESTIMATION
# ==================================================
output "estimated_monthly_costs" {
  description = "Estimated monthly costs for major components (USD)"
  value = {
    note = "These are rough estimates and actual costs may vary based on usage patterns and AWS pricing changes"
    eks_cluster     = "$73.00"  # EKS cluster management fee
    ec2_nodes       = "Depends on instance types and count"
    rds_database    = "Varies by instance class and storage"
    elasticache     = "Varies by node type"
    nat_gateways    = "~$45/month per NAT Gateway"
    load_balancer   = "~$22.50/month for ALB"
    data_transfer   = "Varies by traffic volume"
  }
}

# ==================================================
# NEXT STEPS
# ==================================================
output "next_steps" {
  description = "Next steps after infrastructure deployment"
  value = [
    "1. Update kubeconfig: ${format("aws eks update-kubeconfig --region %s --name %s", var.aws_region, module.eks.cluster_name)}",
    "2. Install AWS Load Balancer Controller",
    "3. Install External Secrets Operator",
    "4. Deploy application using Kubernetes manifests",
    "5. Configure DNS records for the load balancer",
    "6. Set up monitoring and alerting",
    "7. Configure backup and disaster recovery",
    "8. Review security settings and compliance requirements",
    "9. Set up CI/CD pipeline for automated deployments",
    "10. Test application functionality and performance"
  ]
}

# ==================================================
# SECURITY CHECKLIST
# ==================================================
output "security_checklist" {
  description = "Security checklist for post-deployment verification"
  value = [
    "✓ EKS cluster endpoint is private (production)",
    "✓ All data is encrypted at rest using KMS",
    "✓ Network traffic is encrypted in transit",
    "✓ Security groups follow principle of least privilege",
    "✓ IAM roles use least privilege access",
    "✓ Secrets are stored in AWS Secrets Manager",
    "✓ VPC Flow Logs are enabled",
    "✓ CloudWatch logging is configured",
    "✓ Resource tagging is consistent",
    "✓ Backup and retention policies are configured",
    "□ Security scanning is implemented in CI/CD",
    "□ Runtime security monitoring is configured",
    "□ Incident response procedures are documented",
    "□ Compliance requirements are met",
    "□ Regular security assessments are scheduled"
  ]
}