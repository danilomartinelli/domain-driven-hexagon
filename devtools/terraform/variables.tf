# ==================================================
# TERRAFORM VARIABLES FOR DOMAIN-DRIVEN HEXAGON
# ==================================================

# ==================================================
# PROJECT CONFIGURATION
# ==================================================
variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "domain-driven-hexagon"
  
  validation {
    condition     = can(regex("^[a-z][a-z0-9-]*[a-z0-9]$", var.project_name))
    error_message = "Project name must be lowercase, start with a letter, and contain only letters, numbers, and hyphens."
  }
}

variable "environment" {
  description = "Environment name (dev, staging, production)"
  type        = string
  
  validation {
    condition     = contains(["dev", "staging", "production"], var.environment)
    error_message = "Environment must be one of: dev, staging, production."
  }
}

variable "owner" {
  description = "Owner of the resources"
  type        = string
  default     = "platform-team"
}

variable "cost_center" {
  description = "Cost center for billing"
  type        = string
  default     = "engineering"
}

# ==================================================
# AWS CONFIGURATION
# ==================================================
variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-west-2"
  
  validation {
    condition     = can(regex("^[a-z]{2}-[a-z]+-[0-9]$", var.aws_region))
    error_message = "AWS region must be in the format xx-region-n (e.g., us-west-2)."
  }
}

variable "availability_zones" {
  description = "List of availability zones to use"
  type        = list(string)
  default     = []
}

# ==================================================
# KUBERNETES CONFIGURATION
# ==================================================
variable "kubernetes_version" {
  description = "Kubernetes version for EKS cluster"
  type        = string
  default     = "1.28"
  
  validation {
    condition     = can(regex("^1\\.(2[7-9]|[3-9][0-9])$", var.kubernetes_version))
    error_message = "Kubernetes version must be 1.27 or higher."
  }
}

# ==================================================
# EKS NODE GROUP CONFIGURATION
# ==================================================
variable "node_instance_types" {
  description = "Instance types for EKS worker nodes"
  type        = list(string)
  default     = ["t3.medium", "t3.large"]
  
  validation {
    condition     = length(var.node_instance_types) > 0
    error_message = "At least one instance type must be specified."
  }
}

variable "node_group_min_size" {
  description = "Minimum number of nodes in the EKS node group"
  type        = number
  default     = 1
  
  validation {
    condition     = var.node_group_min_size >= 1
    error_message = "Node group minimum size must be at least 1."
  }
}

variable "node_group_max_size" {
  description = "Maximum number of nodes in the EKS node group"
  type        = number
  default     = 10
  
  validation {
    condition     = var.node_group_max_size >= var.node_group_min_size
    error_message = "Node group maximum size must be greater than or equal to minimum size."
  }
}

variable "node_group_desired_size" {
  description = "Desired number of nodes in the EKS node group"
  type        = number
  default     = 2
  
  validation {
    condition = var.node_group_desired_size >= var.node_group_min_size && var.node_group_desired_size <= var.node_group_max_size
    error_message = "Node group desired size must be between minimum and maximum size."
  }
}

variable "node_disk_size" {
  description = "Disk size in GB for EKS worker nodes"
  type        = number
  default     = 100
  
  validation {
    condition     = var.node_disk_size >= 20 && var.node_disk_size <= 1000
    error_message = "Node disk size must be between 20 GB and 1000 GB."
  }
}

# ==================================================
# DATABASE CONFIGURATION
# ==================================================
variable "postgres_version" {
  description = "PostgreSQL version for RDS"
  type        = string
  default     = "15.4"
  
  validation {
    condition     = can(regex("^1[0-9]\\.[0-9]+$", var.postgres_version))
    error_message = "PostgreSQL version must be in the format XX.Y (e.g., 15.4)."
  }
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.micro"
  
  validation {
    condition     = can(regex("^db\\.", var.db_instance_class))
    error_message = "Database instance class must start with 'db.'."
  }
}

variable "db_allocated_storage" {
  description = "Initial allocated storage for RDS database (GB)"
  type        = number
  default     = 20
  
  validation {
    condition     = var.db_allocated_storage >= 20 && var.db_allocated_storage <= 1000
    error_message = "Database allocated storage must be between 20 GB and 1000 GB."
  }
}

variable "db_max_allocated_storage" {
  description = "Maximum allocated storage for RDS database (GB)"
  type        = number
  default     = 100
  
  validation {
    condition     = var.db_max_allocated_storage >= var.db_allocated_storage
    error_message = "Maximum allocated storage must be greater than or equal to initial allocated storage."
  }
}

variable "db_backup_retention_period" {
  description = "Number of days to retain database backups"
  type        = number
  default     = 7
  
  validation {
    condition     = var.db_backup_retention_period >= 0 && var.db_backup_retention_period <= 35
    error_message = "Database backup retention period must be between 0 and 35 days."
  }
}

variable "db_multi_az" {
  description = "Enable Multi-AZ deployment for RDS"
  type        = bool
  default     = false
}

variable "db_performance_insights_enabled" {
  description = "Enable Performance Insights for RDS"
  type        = bool
  default     = true
}

# ==================================================
# REDIS CONFIGURATION
# ==================================================
variable "redis_version" {
  description = "Redis version for ElastiCache"
  type        = string
  default     = "7.0"
  
  validation {
    condition     = can(regex("^[0-9]\\.[0-9]$", var.redis_version))
    error_message = "Redis version must be in the format X.Y (e.g., 7.0)."
  }
}

variable "redis_node_type" {
  description = "ElastiCache node type"
  type        = string
  default     = "cache.t3.micro"
  
  validation {
    condition     = can(regex("^cache\\.", var.redis_node_type))
    error_message = "Redis node type must start with 'cache.'."
  }
}

variable "redis_num_cache_nodes" {
  description = "Number of cache nodes for Redis"
  type        = number
  default     = 1
  
  validation {
    condition     = var.redis_num_cache_nodes >= 1 && var.redis_num_cache_nodes <= 6
    error_message = "Number of cache nodes must be between 1 and 6."
  }
}

# ==================================================
# MONITORING CONFIGURATION
# ==================================================
variable "enable_monitoring" {
  description = "Enable monitoring stack (Prometheus, Grafana)"
  type        = bool
  default     = true
}

variable "monitoring_retention_days" {
  description = "Number of days to retain monitoring data"
  type        = number
  default     = 30
  
  validation {
    condition     = var.monitoring_retention_days >= 7 && var.monitoring_retention_days <= 365
    error_message = "Monitoring retention days must be between 7 and 365."
  }
}

# ==================================================
# SECURITY CONFIGURATION
# ==================================================
variable "enable_waf" {
  description = "Enable AWS WAF for the load balancer"
  type        = bool
  default     = true
}

variable "enable_shield" {
  description = "Enable AWS Shield Advanced for DDoS protection"
  type        = bool
  default     = false
}

variable "allowed_cidr_blocks" {
  description = "CIDR blocks allowed to access the application"
  type        = list(string)
  default     = ["0.0.0.0/0"]
  
  validation {
    condition = alltrue([
      for cidr in var.allowed_cidr_blocks : can(cidrhost(cidr, 0))
    ])
    error_message = "All entries must be valid CIDR blocks."
  }
}

variable "ssl_certificate_arn" {
  description = "ARN of SSL certificate for HTTPS (optional - will create if not provided)"
  type        = string
  default     = ""
}

# ==================================================
# BACKUP AND DISASTER RECOVERY
# ==================================================
variable "enable_backup" {
  description = "Enable automated backups"
  type        = bool
  default     = true
}

variable "backup_retention_period" {
  description = "Number of days to retain backups"
  type        = number
  default     = 30
  
  validation {
    condition     = var.backup_retention_period >= 1 && var.backup_retention_period <= 365
    error_message = "Backup retention period must be between 1 and 365 days."
  }
}

variable "enable_cross_region_backup" {
  description = "Enable cross-region backup replication"
  type        = bool
  default     = false
}

variable "backup_cross_region" {
  description = "Region for cross-region backup replication"
  type        = string
  default     = "us-east-1"
  
  validation {
    condition     = var.backup_cross_region != var.aws_region
    error_message = "Cross-region backup region must be different from the primary region."
  }
}

# ==================================================
# DOMAIN AND DNS CONFIGURATION
# ==================================================
variable "domain_name" {
  description = "Domain name for the application"
  type        = string
  default     = ""
}

variable "subdomain" {
  description = "Subdomain for the application (e.g., api)"
  type        = string
  default     = "api"
}

variable "route53_zone_id" {
  description = "Route53 hosted zone ID for DNS records"
  type        = string
  default     = ""
}

# ==================================================
# FEATURE FLAGS
# ==================================================
variable "enable_nat_gateway" {
  description = "Enable NAT Gateway for private subnets"
  type        = bool
  default     = true
}

variable "single_nat_gateway" {
  description = "Use single NAT Gateway for all private subnets (cost optimization)"
  type        = bool
  default     = false
}

variable "enable_vpc_flow_logs" {
  description = "Enable VPC Flow Logs"
  type        = bool
  default     = true
}

variable "enable_container_insights" {
  description = "Enable CloudWatch Container Insights for EKS"
  type        = bool
  default     = true
}

variable "enable_irsa" {
  description = "Enable IAM Roles for Service Accounts (IRSA)"
  type        = bool
  default     = true
}

# ==================================================
# COST OPTIMIZATION
# ==================================================
variable "use_spot_instances" {
  description = "Use Spot Instances for worker nodes (not recommended for production)"
  type        = bool
  default     = false
}

variable "spot_instance_types" {
  description = "Instance types for Spot Instances"
  type        = list(string)
  default     = ["t3.medium", "t3.large", "t3.xlarge"]
}

variable "enable_cluster_autoscaler" {
  description = "Enable Cluster Autoscaler"
  type        = bool
  default     = true
}

# ==================================================
# DEVELOPMENT SETTINGS
# ==================================================
variable "enable_public_access" {
  description = "Enable public access to EKS cluster API (for development)"
  type        = bool
  default     = false
}

variable "enable_bastion_host" {
  description = "Enable bastion host for SSH access"
  type        = bool
  default     = false
}

variable "enable_development_tools" {
  description = "Enable development tools (port forwarding, debug endpoints)"
  type        = bool
  default     = false
}

# ==================================================
# NOTIFICATION CONFIGURATION
# ==================================================
variable "notification_email" {
  description = "Email address for notifications"
  type        = string
  default     = ""
  
  validation {
    condition = var.notification_email == "" || can(regex("^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$", var.notification_email))
    error_message = "Notification email must be a valid email address or empty."
  }
}

variable "slack_webhook_url" {
  description = "Slack webhook URL for notifications"
  type        = string
  default     = ""
  sensitive   = true
}

# ==================================================
# COMPLIANCE AND GOVERNANCE
# ==================================================
variable "compliance_framework" {
  description = "Compliance framework to adhere to (SOC2, HIPAA, PCI, etc.)"
  type        = string
  default     = ""
  
  validation {
    condition = contains(["", "SOC2", "HIPAA", "PCI", "GDPR", "ISO27001"], var.compliance_framework)
    error_message = "Compliance framework must be one of: SOC2, HIPAA, PCI, GDPR, ISO27001, or empty."
  }
}

variable "data_classification" {
  description = "Data classification level (public, internal, confidential, restricted)"
  type        = string
  default     = "internal"
  
  validation {
    condition     = contains(["public", "internal", "confidential", "restricted"], var.data_classification)
    error_message = "Data classification must be one of: public, internal, confidential, restricted."
  }
}

variable "enable_encryption_in_transit" {
  description = "Enable encryption in transit for all services"
  type        = bool
  default     = true
}

variable "enable_encryption_at_rest" {
  description = "Enable encryption at rest for all services"
  type        = bool
  default     = true
}

# ==================================================
# RESOURCE TAGGING
# ==================================================
variable "additional_tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default     = {}
}

# ==================================================
# AUTOSCALING CONFIGURATION
# ==================================================
variable "enable_horizontal_pod_autoscaler" {
  description = "Enable Horizontal Pod Autoscaler"
  type        = bool
  default     = true
}

variable "enable_vertical_pod_autoscaler" {
  description = "Enable Vertical Pod Autoscaler"
  type        = bool
  default     = false
}

variable "hpa_cpu_target_percentage" {
  description = "Target CPU utilization percentage for HPA"
  type        = number
  default     = 70
  
  validation {
    condition     = var.hpa_cpu_target_percentage > 0 && var.hpa_cpu_target_percentage <= 100
    error_message = "HPA CPU target percentage must be between 1 and 100."
  }
}

variable "hpa_memory_target_percentage" {
  description = "Target memory utilization percentage for HPA"
  type        = number
  default     = 80
  
  validation {
    condition     = var.hpa_memory_target_percentage > 0 && var.hpa_memory_target_percentage <= 100
    error_message = "HPA memory target percentage must be between 1 and 100."
  }
}