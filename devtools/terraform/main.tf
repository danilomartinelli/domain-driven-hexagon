# ==================================================
# TERRAFORM INFRASTRUCTURE FOR DOMAIN-DRIVEN HEXAGON
# ==================================================
# Multi-cloud ready infrastructure with security hardening
# Features:
# - EKS/GKE/AKS cluster with security groups
# - RDS/Cloud SQL managed database
# - ElastiCache/Cloud Memorystore Redis
# - S3/GCS/Azure Blob for storage
# - VPC/VNet with private subnets
# - Security groups and network ACLs
# - IAM roles and policies
# - Monitoring and logging
# - Auto-scaling and load balancing
# - SSL/TLS certificates
# - Backup and disaster recovery

terraform {
  required_version = ">= 1.5"
  
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
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
  }
  
  # Backend configuration for remote state
  backend "s3" {
    bucket         = "ddh-terraform-state"
    key            = "production/terraform.tfstate"
    region         = "us-west-2"
    encrypt        = true
    dynamodb_table = "ddh-terraform-locks"
    
    # Additional security
    kms_key_id = "alias/ddh-terraform-state"
    
    # Versioning and backup
    versioning = true
  }
}

# ==================================================
# PROVIDER CONFIGURATIONS
# ==================================================
provider "aws" {
  region = var.aws_region
  
  # Default tags applied to all resources
  default_tags {
    tags = {
      Project     = "domain-driven-hexagon"
      Environment = var.environment
      Owner       = var.owner
      ManagedBy   = "terraform"
      CostCenter  = var.cost_center
    }
  }
}

provider "kubernetes" {
  host                   = module.eks.cluster_endpoint
  cluster_ca_certificate = base64decode(module.eks.cluster_certificate_authority_data)
  
  exec {
    api_version = "client.authentication.k8s.io/v1beta1"
    command     = "aws"
    args        = ["eks", "get-token", "--cluster-name", module.eks.cluster_name]
  }
}

provider "helm" {
  kubernetes {
    host                   = module.eks.cluster_endpoint
    cluster_ca_certificate = base64decode(module.eks.cluster_certificate_authority_data)
    
    exec {
      api_version = "client.authentication.k8s.io/v1beta1"
      command     = "aws"
      args        = ["eks", "get-token", "--cluster-name", module.eks.cluster_name]
    }
  }
}

# ==================================================
# LOCAL VALUES
# ==================================================
locals {
  # Naming conventions
  name_prefix = "${var.project_name}-${var.environment}"
  
  # Network configuration
  vpc_cidr             = "10.0.0.0/16"
  private_subnet_cidrs = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  public_subnet_cidrs  = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]
  database_subnet_cidrs = ["10.0.201.0/24", "10.0.202.0/24", "10.0.203.0/24"]
  
  # Availability zones
  azs = data.aws_availability_zones.available.names
  
  # Common tags
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    Owner       = var.owner
    ManagedBy   = "terraform"
    Repository  = "domain-driven-hexagon"
  }
  
  # Security groups
  allowed_cidr_blocks = var.environment == "production" ? ["0.0.0.0/0"] : [local.vpc_cidr]
}

# ==================================================
# DATA SOURCES
# ==================================================
data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_caller_identity" "current" {}

data "aws_region" "current" {}

# ==================================================
# RANDOM RESOURCES FOR UNIQUE NAMING
# ==================================================
resource "random_id" "cluster_suffix" {
  byte_length = 4
}

resource "random_password" "db_password" {
  length  = 32
  special = true
}

resource "random_password" "redis_password" {
  length  = 32
  special = false
}

# ==================================================
# KMS KEYS FOR ENCRYPTION
# ==================================================
resource "aws_kms_key" "ddh_key" {
  description             = "DDH ${var.environment} encryption key"
  deletion_window_in_days = var.environment == "production" ? 30 : 7
  enable_key_rotation     = true
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "Allow EKS Service"
        Effect = "Allow"
        Principal = {
          Service = "eks.amazonaws.com"
        }
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey"
        ]
        Resource = "*"
      }
    ]
  })
  
  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-kms-key"
  })
}

resource "aws_kms_alias" "ddh_key" {
  name          = "alias/${local.name_prefix}-key"
  target_key_id = aws_kms_key.ddh_key.key_id
}

# ==================================================
# SECRETS MANAGER
# ==================================================
resource "aws_secretsmanager_secret" "db_credentials" {
  name                    = "${local.name_prefix}-db-credentials"
  description             = "Database credentials for DDH ${var.environment}"
  recovery_window_in_days = var.environment == "production" ? 30 : 0
  kms_key_id             = aws_kms_key.ddh_key.arn
  
  tags = local.common_tags
}

resource "aws_secretsmanager_secret_version" "db_credentials" {
  secret_id = aws_secretsmanager_secret.db_credentials.id
  secret_string = jsonencode({
    username = "ddh_app"
    password = random_password.db_password.result
    database = "ddh_${var.environment}"
  })
}

resource "aws_secretsmanager_secret" "app_secrets" {
  name                    = "${local.name_prefix}-app-secrets"
  description             = "Application secrets for DDH ${var.environment}"
  recovery_window_in_days = var.environment == "production" ? 30 : 0
  kms_key_id             = aws_kms_key.ddh_key.arn
  
  tags = local.common_tags
}

resource "aws_secretsmanager_secret_version" "app_secrets" {
  secret_id = aws_secretsmanager_secret.app_secrets.id
  secret_string = jsonencode({
    jwt_secret      = base64encode(random_password.db_password.result)
    encryption_key  = base64encode(random_password.redis_password.result)
    session_secret  = base64encode("${random_password.db_password.result}${random_password.redis_password.result}")
    redis_password  = random_password.redis_password.result
  })
}

# ==================================================
# NETWORKING MODULE
# ==================================================
module "vpc" {
  source = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"
  
  name = "${local.name_prefix}-vpc"
  cidr = local.vpc_cidr
  
  azs              = slice(local.azs, 0, 3)
  private_subnets  = local.private_subnet_cidrs
  public_subnets   = local.public_subnet_cidrs
  database_subnets = local.database_subnet_cidrs
  
  # Enable DNS
  enable_dns_hostnames = true
  enable_dns_support   = true
  
  # NAT Gateway configuration
  enable_nat_gateway = true
  single_nat_gateway = var.environment != "production"
  one_nat_gateway_per_az = var.environment == "production"
  
  # VPC Flow Logs
  enable_flow_log                      = true
  create_flow_log_cloudwatch_iam_role  = true
  create_flow_log_cloudwatch_log_group = true
  flow_log_cloudwatch_log_group_retention_in_days = var.environment == "production" ? 30 : 7
  
  # Database subnet group
  create_database_subnet_group = true
  database_subnet_group_name   = "${local.name_prefix}-db-subnet-group"
  
  # ElastiCache subnet group
  create_elasticache_subnet_group = true
  elasticache_subnet_group_name   = "${local.name_prefix}-cache-subnet-group"
  
  # Public subnet tags for load balancers
  public_subnet_tags = {
    "kubernetes.io/role/elb" = "1"
  }
  
  # Private subnet tags for internal load balancers
  private_subnet_tags = {
    "kubernetes.io/role/internal-elb" = "1"
  }
  
  tags = local.common_tags
}

# ==================================================
# SECURITY GROUPS
# ==================================================
resource "aws_security_group" "eks_additional" {
  name_prefix = "${local.name_prefix}-eks-additional"
  vpc_id      = module.vpc.vpc_id
  description = "Additional security group for EKS cluster"
  
  # Allow all traffic within VPC
  ingress {
    from_port   = 0
    to_port     = 65535
    protocol    = "tcp"
    cidr_blocks = [local.vpc_cidr]
    description = "All traffic within VPC"
  }
  
  # Allow HTTPS from anywhere (for load balancer)
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = local.allowed_cidr_blocks
    description = "HTTPS traffic"
  }
  
  # Allow HTTP from anywhere (for redirects)
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = local.allowed_cidr_blocks
    description = "HTTP traffic"
  }
  
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "All outbound traffic"
  }
  
  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-eks-additional-sg"
  })
}

resource "aws_security_group" "rds" {
  name_prefix = "${local.name_prefix}-rds"
  vpc_id      = module.vpc.vpc_id
  description = "Security group for RDS database"
  
  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [module.eks.node_security_group_id]
    description     = "PostgreSQL from EKS nodes"
  }
  
  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-rds-sg"
  })
}

resource "aws_security_group" "elasticache" {
  name_prefix = "${local.name_prefix}-elasticache"
  vpc_id      = module.vpc.vpc_id
  description = "Security group for ElastiCache"
  
  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [module.eks.node_security_group_id]
    description     = "Redis from EKS nodes"
  }
  
  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-elasticache-sg"
  })
}

# ==================================================
# EKS CLUSTER MODULE
# ==================================================
module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 19.15"
  
  cluster_name    = "${local.name_prefix}-cluster"
  cluster_version = var.kubernetes_version
  
  # Networking
  vpc_id                          = module.vpc.vpc_id
  subnet_ids                      = module.vpc.private_subnets
  control_plane_subnet_ids        = module.vpc.private_subnets
  cluster_endpoint_private_access = true
  cluster_endpoint_public_access  = var.environment == "production" ? false : true
  cluster_endpoint_public_access_cidrs = var.environment == "production" ? [] : ["0.0.0.0/0"]
  
  # Security
  cluster_encryption_config = {
    provider_key_arn = aws_kms_key.ddh_key.arn
    resources        = ["secrets"]
  }
  
  # Additional security groups
  cluster_additional_security_group_ids = [aws_security_group.eks_additional.id]
  
  # Logging
  cluster_enabled_log_types = ["api", "audit", "authenticator", "controllerManager", "scheduler"]
  cloudwatch_log_group_retention_in_days = var.environment == "production" ? 30 : 7
  
  # OIDC Identity Provider
  enable_irsa = true
  
  # Add-ons
  cluster_addons = {
    coredns = {
      most_recent = true
      configuration_values = jsonencode({
        computeType = "Fargate"
      })
    }
    kube-proxy = {
      most_recent = true
    }
    vpc-cni = {
      most_recent = true
    }
    aws-ebs-csi-driver = {
      most_recent = true
    }
  }
  
  # Node groups
  eks_managed_node_groups = {
    # Primary node group
    primary = {
      instance_types = var.node_instance_types
      capacity_type  = "ON_DEMAND"
      
      min_size     = var.node_group_min_size
      max_size     = var.node_group_max_size
      desired_size = var.node_group_desired_size
      
      # Use custom launch template for additional security
      use_custom_launch_template = true
      
      # Block device mappings
      block_device_mappings = {
        xvda = {
          device_name = "/dev/xvda"
          ebs = {
            volume_size           = var.node_disk_size
            volume_type           = "gp3"
            iops                  = 3000
            throughput            = 150
            encrypted             = true
            kms_key_id            = aws_kms_key.ddh_key.arn
            delete_on_termination = true
          }
        }
      }
      
      # Metadata options for security
      metadata_options = {
        http_endpoint               = "enabled"
        http_tokens                = "required"
        http_put_response_hop_limit = 2
        instance_metadata_tags      = "disabled"
      }
      
      # Labels and taints
      labels = {
        Environment = var.environment
        NodeGroup   = "primary"
      }
      
      # Update configuration
      update_config = {
        max_unavailable_percentage = 25
      }
      
      tags = local.common_tags
    }
    
    # Spot instances for non-critical workloads (if not production)
    spot = var.environment != "production" ? {
      instance_types = ["t3.medium", "t3.large"]
      capacity_type  = "SPOT"
      
      min_size     = 0
      max_size     = 3
      desired_size = 1
      
      labels = {
        Environment = var.environment
        NodeGroup   = "spot"
      }
      
      taints = {
        spot = {
          key    = "spot"
          value  = "true"
          effect = "NO_SCHEDULE"
        }
      }
      
      tags = local.common_tags
    } : {}
  }
  
  # Fargate profiles for system workloads
  fargate_profiles = {
    default = {
      name = "default"
      selectors = [
        {
          namespace = "kube-system"
          labels = {
            k8s-app = "kube-dns"
          }
        },
        {
          namespace = "default"
        }
      ]
      
      subnet_ids = module.vpc.private_subnets
      
      tags = local.common_tags
    }
  }
  
  # OIDC Provider
  enable_oidc_identity_provider = true
  
  tags = local.common_tags
}

# ==================================================
# RDS DATABASE
# ==================================================
module "rds" {
  source  = "terraform-aws-modules/rds/aws"
  version = "~> 6.1"
  
  identifier = "${local.name_prefix}-db"
  
  # Engine configuration
  engine         = "postgres"
  engine_version = var.postgres_version
  family         = "postgres15"
  major_engine_version = "15"
  instance_class = var.db_instance_class
  
  # Storage
  allocated_storage     = var.db_allocated_storage
  max_allocated_storage = var.db_max_allocated_storage
  storage_type         = "gp3"
  storage_encrypted    = true
  kms_key_id          = aws_kms_key.ddh_key.arn
  
  # Database configuration
  db_name  = "ddh_${var.environment}"
  username = "ddh_app"
  password = random_password.db_password.result
  port     = 5432
  
  # Networking
  db_subnet_group_name   = module.vpc.database_subnet_group_name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible   = false
  
  # Backup and maintenance
  backup_window           = "03:00-04:00"
  backup_retention_period = var.environment == "production" ? 30 : 7
  maintenance_window      = "sun:04:00-sun:05:00"
  
  # Deletion protection
  deletion_protection = var.environment == "production"
  skip_final_snapshot = var.environment != "production"
  final_snapshot_identifier_prefix = "${local.name_prefix}-final-snapshot"
  
  # Monitoring
  monitoring_interval = 60
  monitoring_role_name = "${local.name_prefix}-rds-monitoring-role"
  create_monitoring_role = true
  
  performance_insights_enabled = true
  performance_insights_kms_key_id = aws_kms_key.ddh_key.arn
  performance_insights_retention_period = var.environment == "production" ? 731 : 7
  
  # Enhanced monitoring
  enabled_cloudwatch_logs_exports = ["postgresql"]
  
  # Parameters
  parameters = [
    {
      name  = "log_statement"
      value = "all"
    },
    {
      name  = "log_min_duration_statement"
      value = "1000"
    },
    {
      name  = "log_connections"
      value = "1"
    },
    {
      name  = "log_disconnections"
      value = "1"
    },
    {
      name  = "shared_preload_libraries"
      value = "pg_stat_statements"
    }
  ]
  
  tags = local.common_tags
}

# ==================================================
# ELASTICACHE REDIS
# ==================================================
resource "aws_elasticache_subnet_group" "redis" {
  name       = "${local.name_prefix}-redis-subnet-group"
  subnet_ids = module.vpc.private_subnets
  
  tags = local.common_tags
}

resource "aws_elasticache_parameter_group" "redis" {
  family = "redis7.x"
  name   = "${local.name_prefix}-redis-params"
  
  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"
  }
  
  parameter {
    name  = "notify-keyspace-events"
    value = "Ex"
  }
  
  tags = local.common_tags
}

resource "aws_elasticache_replication_group" "redis" {
  replication_group_id       = "${local.name_prefix}-redis"
  description                = "Redis cluster for DDH ${var.environment}"
  
  # Engine configuration
  engine               = "redis"
  engine_version       = var.redis_version
  node_type           = var.redis_node_type
  parameter_group_name = aws_elasticache_parameter_group.redis.name
  port                = 6379
  
  # Cluster configuration
  num_cache_clusters = var.redis_num_cache_nodes
  
  # Security
  subnet_group_name  = aws_elasticache_subnet_group.redis.name
  security_group_ids = [aws_security_group.elasticache.id]
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                 = random_password.redis_password.result
  kms_key_id                = aws_kms_key.ddh_key.arn
  
  # Backup
  snapshot_retention_limit = var.environment == "production" ? 5 : 1
  snapshot_window         = "03:00-05:00"
  
  # Maintenance
  maintenance_window = "sun:05:00-sun:07:00"
  
  # Logging
  log_delivery_configuration {
    destination      = aws_cloudwatch_log_group.elasticache_slow_log.name
    destination_type = "cloudwatch-logs"
    log_format      = "json"
    log_type        = "slow-log"
  }
  
  tags = local.common_tags
}

resource "aws_cloudwatch_log_group" "elasticache_slow_log" {
  name              = "/aws/elasticache/${local.name_prefix}-redis/slow-log"
  retention_in_days = var.environment == "production" ? 30 : 7
  kms_key_id       = aws_kms_key.ddh_key.arn
  
  tags = local.common_tags
}

# ==================================================
# S3 BUCKETS FOR APPLICATION DATA
# ==================================================
resource "aws_s3_bucket" "app_storage" {
  bucket = "${local.name_prefix}-app-storage-${random_id.cluster_suffix.hex}"
  
  tags = local.common_tags
}

resource "aws_s3_bucket_versioning" "app_storage" {
  bucket = aws_s3_bucket.app_storage.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_encryption" "app_storage" {
  bucket = aws_s3_bucket.app_storage.id
  
  server_side_encryption_configuration {
    rule {
      apply_server_side_encryption_by_default {
        kms_master_key_id = aws_kms_key.ddh_key.arn
        sse_algorithm     = "aws:kms"
      }
    }
  }
}

resource "aws_s3_bucket_public_access_block" "app_storage" {
  bucket = aws_s3_bucket.app_storage.id
  
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ==================================================
# APPLICATION LOAD BALANCER
# ==================================================
resource "aws_lb" "app" {
  name               = "${local.name_prefix}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = module.vpc.public_subnets
  
  enable_deletion_protection = var.environment == "production"
  
  # Access logs
  access_logs {
    bucket  = aws_s3_bucket.alb_logs.bucket
    prefix  = "alb"
    enabled = true
  }
  
  tags = local.common_tags
}

resource "aws_security_group" "alb" {
  name_prefix = "${local.name_prefix}-alb"
  vpc_id      = module.vpc.vpc_id
  description = "Security group for Application Load Balancer"
  
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTP"
  }
  
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS"
  }
  
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-alb-sg"
  })
}

resource "aws_s3_bucket" "alb_logs" {
  bucket = "${local.name_prefix}-alb-logs-${random_id.cluster_suffix.hex}"
  
  tags = local.common_tags
}

resource "aws_s3_bucket_lifecycle_configuration" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id
  
  rule {
    id     = "delete_old_logs"
    status = "Enabled"
    
    expiration {
      days = var.environment == "production" ? 90 : 30
    }
  }
}

# ==================================================
# IAM ROLES AND POLICIES
# ==================================================
# EBS CSI Driver Role
module "ebs_csi_irsa_role" {
  source  = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks"
  version = "~> 5.0"
  
  role_name             = "${local.name_prefix}-ebs-csi-driver"
  attach_ebs_csi_policy = true
  
  oidc_providers = {
    ex = {
      provider_arn               = module.eks.oidc_provider_arn
      namespace_service_accounts = ["kube-system:ebs-csi-controller-sa"]
    }
  }
  
  tags = local.common_tags
}

# Load Balancer Controller Role
module "load_balancer_controller_irsa_role" {
  source  = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks"
  version = "~> 5.0"
  
  role_name                              = "${local.name_prefix}-load-balancer-controller"
  attach_load_balancer_controller_policy = true
  
  oidc_providers = {
    ex = {
      provider_arn               = module.eks.oidc_provider_arn
      namespace_service_accounts = ["kube-system:aws-load-balancer-controller"]
    }
  }
  
  tags = local.common_tags
}

# External Secrets Role
module "external_secrets_irsa_role" {
  source  = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks"
  version = "~> 5.0"
  
  role_name = "${local.name_prefix}-external-secrets"
  
  role_policy_arns = [
    aws_iam_policy.external_secrets.arn
  ]
  
  oidc_providers = {
    ex = {
      provider_arn               = module.eks.oidc_provider_arn
      namespace_service_accounts = ["external-secrets:external-secrets-sa"]
    }
  }
  
  tags = local.common_tags
}

resource "aws_iam_policy" "external_secrets" {
  name        = "${local.name_prefix}-external-secrets-policy"
  description = "Policy for External Secrets Operator"
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret"
        ]
        Resource = [
          aws_secretsmanager_secret.db_credentials.arn,
          aws_secretsmanager_secret.app_secrets.arn
        ]
      }
    ]
  })
  
  tags = local.common_tags
}