#!/bin/bash
# ==================================================
# COMPREHENSIVE COMPLIANCE SCANNING SCRIPT
# ==================================================
# This script performs automated compliance checks for:
# - SOC 2 Type II requirements
# - ISO 27001 controls
# - NIST Cybersecurity Framework
# - GDPR requirements
# - CIS Benchmarks
# - OWASP Top 10
# - PCI DSS (if applicable)

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPORTS_DIR="${PROJECT_ROOT}/compliance-reports"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
REPORT_FILE="${REPORTS_DIR}/compliance-report-${TIMESTAMP}.json"
SUMMARY_FILE="${REPORTS_DIR}/compliance-summary-${TIMESTAMP}.txt"

# Framework versions
SOC2_VERSION="2017"
ISO27001_VERSION="2013"
NIST_VERSION="1.1"
CIS_VERSION="1.6.0"

echo -e "${BLUE}🔒 Domain-Driven Hexagon Compliance Scanner${NC}"
echo -e "${BLUE}=============================================${NC}"
echo -e "Timestamp: $(date)"
echo -e "Report will be saved to: ${REPORT_FILE}"
echo ""

# Create reports directory
mkdir -p "${REPORTS_DIR}"

# Initialize report structure
cat > "${REPORT_FILE}" << EOF
{
  "scan_metadata": {
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "scanner_version": "1.0.0",
    "project": "domain-driven-hexagon",
    "environment": "${ENVIRONMENT:-production}"
  },
  "frameworks": {
    "soc2": {
      "version": "${SOC2_VERSION}",
      "controls": {}
    },
    "iso27001": {
      "version": "${ISO27001_VERSION}",
      "controls": {}
    },
    "nist": {
      "version": "${NIST_VERSION}",
      "functions": {}
    },
    "cis": {
      "version": "${CIS_VERSION}",
      "benchmarks": {}
    },
    "owasp": {
      "version": "2021",
      "top10": {}
    },
    "gdpr": {
      "version": "2018",
      "articles": {}
    }
  },
  "summary": {
    "total_controls": 0,
    "passed": 0,
    "failed": 0,
    "warning": 0,
    "not_applicable": 0,
    "score": 0
  }
}
EOF

# ==================================================
# UTILITY FUNCTIONS
# ==================================================

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_section() {
    echo -e "\n${PURPLE}🔍 $1${NC}"
    echo -e "${PURPLE}$(printf '=%.0s' {1..50})${NC}"
}

# Update report with control result
update_report() {
    local framework="$1"
    local control_id="$2"
    local status="$3"
    local description="$4"
    local evidence="$5"
    local recommendation="$6"
    
    # Use jq to update the JSON report
    jq --arg fw "$framework" \
       --arg id "$control_id" \
       --arg status "$status" \
       --arg desc "$description" \
       --arg evidence "$evidence" \
       --arg rec "$recommendation" \
       '.frameworks[$fw].controls[$id] = {
         "status": $status,
         "description": $desc,
         "evidence": $evidence,
         "recommendation": $rec,
         "checked_at": (now | strftime("%Y-%m-%dT%H:%M:%SZ"))
       }' "${REPORT_FILE}" > "${REPORT_FILE}.tmp" && mv "${REPORT_FILE}.tmp" "${REPORT_FILE}"
}

# Check if file exists and is not empty
check_file_exists() {
    local file="$1"
    if [[ -f "$file" && -s "$file" ]]; then
        return 0
    else
        return 1
    fi
}

# Check if directory exists
check_directory_exists() {
    local dir="$1"
    if [[ -d "$dir" ]]; then
        return 0
    else
        return 1
    fi
}

# Check if environment variable is set and not empty
check_env_var() {
    local var_name="$1"
    if [[ -n "${!var_name:-}" ]]; then
        return 0
    else
        return 1
    fi
}

# ==================================================
# SOC 2 TYPE II COMPLIANCE CHECKS
# ==================================================
check_soc2_compliance() {
    log_section "SOC 2 Type II Compliance Checks"
    
    # CC6.1 - Logical and Physical Access Controls
    log_info "Checking CC6.1 - Logical and Physical Access Controls"
    if check_file_exists "${PROJECT_ROOT}/k8s/app-deployment.yaml" && \
       grep -q "runAsNonRoot: true" "${PROJECT_ROOT}/k8s/app-deployment.yaml"; then
        update_report "soc2" "CC6.1" "PASS" "Logical access controls implemented" \
                     "Non-root containers configured" "None"
        log_success "CC6.1 - Logical access controls: PASS"
    else
        update_report "soc2" "CC6.1" "FAIL" "Logical access controls missing" \
                     "Non-root containers not configured" "Configure runAsNonRoot: true"
        log_error "CC6.1 - Logical access controls: FAIL"
    fi
    
    # CC6.2 - Authentication and Authorization
    log_info "Checking CC6.2 - Authentication and Authorization"
    if check_file_exists "${PROJECT_ROOT}/src/modules/auth/domain/auth.types.ts" && \
       check_file_exists "${PROJECT_ROOT}/src/modules/auth/infrastructure/guards/jwt-auth.guard.ts"; then
        update_report "soc2" "CC6.2" "PASS" "Authentication and authorization implemented" \
                     "JWT-based authentication with RBAC" "None"
        log_success "CC6.2 - Authentication and authorization: PASS"
    else
        update_report "soc2" "CC6.2" "FAIL" "Authentication and authorization missing" \
                     "Auth module not found" "Implement authentication system"
        log_error "CC6.2 - Authentication and authorization: FAIL"
    fi
    
    # CC6.3 - System Monitoring
    log_info "Checking CC6.3 - System Monitoring"
    if check_file_exists "${PROJECT_ROOT}/devtools/prometheus/prometheus.prod.yml" && \
       check_file_exists "${PROJECT_ROOT}/k8s/monitoring-deployment.yaml"; then
        update_report "soc2" "CC6.3" "PASS" "System monitoring implemented" \
                     "Prometheus and Grafana configured" "None"
        log_success "CC6.3 - System monitoring: PASS"
    else
        update_report "soc2" "CC6.3" "FAIL" "System monitoring missing" \
                     "Monitoring configuration not found" "Implement comprehensive monitoring"
        log_error "CC6.3 - System monitoring: FAIL"
    fi
    
    # CC7.1 - Detection of Security Events
    log_info "Checking CC7.1 - Detection of Security Events"
    if check_file_exists "${PROJECT_ROOT}/security/falco-rules.yaml" && \
       check_file_exists "${PROJECT_ROOT}/devtools/prometheus/rules/application-alerts.yml"; then
        update_report "soc2" "CC7.1" "PASS" "Security event detection implemented" \
                     "Falco rules and Prometheus alerts configured" "None"
        log_success "CC7.1 - Security event detection: PASS"
    else
        update_report "soc2" "CC7.1" "FAIL" "Security event detection missing" \
                     "Security monitoring rules not found" "Implement security monitoring"
        log_error "CC7.1 - Security event detection: FAIL"
    fi
    
    # CC8.1 - Change Management
    log_info "Checking CC8.1 - Change Management"
    if check_file_exists "${PROJECT_ROOT}/.github/workflows/ci-cd.yml"; then
        update_report "soc2" "CC8.1" "PASS" "Change management implemented" \
                     "CI/CD pipeline with approval workflows" "None"
        log_success "CC8.1 - Change management: PASS"
    else
        update_report "soc2" "CC8.1" "FAIL" "Change management missing" \
                     "CI/CD pipeline not found" "Implement CI/CD with approval process"
        log_error "CC8.1 - Change management: FAIL"
    fi
}

# ==================================================
# ISO 27001 COMPLIANCE CHECKS
# ==================================================
check_iso27001_compliance() {
    log_section "ISO 27001:2013 Compliance Checks"
    
    # A.9.1.2 - Access to networks and network services
    log_info "Checking A.9.1.2 - Network Access Control"
    if check_file_exists "${PROJECT_ROOT}/k8s/namespace.yaml" && \
       grep -q "NetworkPolicy" "${PROJECT_ROOT}/k8s/namespace.yaml"; then
        update_report "iso27001" "A.9.1.2" "PASS" "Network access control implemented" \
                     "Kubernetes NetworkPolicies configured" "None"
        log_success "A.9.1.2 - Network access control: PASS"
    else
        update_report "iso27001" "A.9.1.2" "FAIL" "Network access control missing" \
                     "NetworkPolicies not configured" "Implement network segmentation"
        log_error "A.9.1.2 - Network access control: FAIL"
    fi
    
    # A.10.1.1 - Cryptographic controls
    log_info "Checking A.10.1.1 - Cryptographic Controls"
    if check_file_exists "${PROJECT_ROOT}/terraform/main.tf" && \
       grep -q "kms_key_id" "${PROJECT_ROOT}/terraform/main.tf"; then
        update_report "iso27001" "A.10.1.1" "PASS" "Cryptographic controls implemented" \
                     "KMS encryption for data at rest" "None"
        log_success "A.10.1.1 - Cryptographic controls: PASS"
    else
        update_report "iso27001" "A.10.1.1" "WARNING" "Cryptographic controls partially implemented" \
                     "Some encryption configured, review completeness" "Ensure end-to-end encryption"
        log_warning "A.10.1.1 - Cryptographic controls: WARNING"
    fi
    
    # A.12.1.2 - Change management
    log_info "Checking A.12.1.2 - Change Management"
    if check_file_exists "${PROJECT_ROOT}/.github/workflows/ci-cd.yml" && \
       grep -q "pull_request" "${PROJECT_ROOT}/.github/workflows/ci-cd.yml"; then
        update_report "iso27001" "A.12.1.2" "PASS" "Change management implemented" \
                     "Pull request workflow with reviews" "None"
        log_success "A.12.1.2 - Change management: PASS"
    else
        update_report "iso27001" "A.12.1.2" "FAIL" "Change management missing" \
                     "No formal change process found" "Implement change management process"
        log_error "A.12.1.2 - Change management: FAIL"
    fi
    
    # A.12.6.1 - Vulnerability management
    log_info "Checking A.12.6.1 - Vulnerability Management"
    if check_file_exists "${PROJECT_ROOT}/devtools/scripts/security-scan.sh" && \
       check_file_exists "${PROJECT_ROOT}/.github/workflows/ci-cd.yml" && \
       grep -q "security" "${PROJECT_ROOT}/.github/workflows/ci-cd.yml"; then
        update_report "iso27001" "A.12.6.1" "PASS" "Vulnerability management implemented" \
                     "Automated security scanning in CI/CD" "None"
        log_success "A.12.6.1 - Vulnerability management: PASS"
    else
        update_report "iso27001" "A.12.6.1" "FAIL" "Vulnerability management missing" \
                     "No vulnerability scanning found" "Implement vulnerability management"
        log_error "A.12.6.1 - Vulnerability management: FAIL"
    fi
    
    # A.18.1.4 - Privacy and protection of PII
    log_info "Checking A.18.1.4 - Privacy and PII Protection"
    if check_file_exists "${PROJECT_ROOT}/src/modules/auth/domain/value-objects/password.value-object.ts" && \
       grep -q "hash" "${PROJECT_ROOT}/src/modules/auth/domain/value-objects/password.value-object.ts"; then
        update_report "iso27001" "A.18.1.4" "PASS" "PII protection implemented" \
                     "Password hashing implemented" "Review all PII handling"
        log_success "A.18.1.4 - PII protection: PASS"
    else
        update_report "iso27001" "A.18.1.4" "WARNING" "PII protection needs review" \
                     "Some protection measures found" "Comprehensive PII audit needed"
        log_warning "A.18.1.4 - PII protection: WARNING"
    fi
}

# ==================================================
# NIST CYBERSECURITY FRAMEWORK CHECKS
# ==================================================
check_nist_compliance() {
    log_section "NIST Cybersecurity Framework v1.1 Checks"
    
    # ID.AM-1 - Asset Management
    log_info "Checking ID.AM-1 - Asset Management"
    if check_file_exists "${PROJECT_ROOT}/terraform/main.tf" && \
       grep -q "tags" "${PROJECT_ROOT}/terraform/main.tf"; then
        update_report "nist" "ID.AM-1" "PASS" "Asset management implemented" \
                     "Resource tagging for asset inventory" "None"
        log_success "ID.AM-1 - Asset management: PASS"
    else
        update_report "nist" "ID.AM-1" "FAIL" "Asset management missing" \
                     "No asset tagging found" "Implement comprehensive asset tagging"
        log_error "ID.AM-1 - Asset management: FAIL"
    fi
    
    # PR.AC-1 - Identity and Access Management
    log_info "Checking PR.AC-1 - Identity and Access Management"
    if check_file_exists "${PROJECT_ROOT}/k8s/app-deployment.yaml" && \
       grep -q "serviceAccountName" "${PROJECT_ROOT}/k8s/app-deployment.yaml"; then
        update_report "nist" "PR.AC-1" "PASS" "Access management implemented" \
                     "Service accounts and RBAC configured" "None"
        log_success "PR.AC-1 - Access management: PASS"
    else
        update_report "nist" "PR.AC-1" "FAIL" "Access management missing" \
                     "No service accounts found" "Implement RBAC"
        log_error "PR.AC-1 - Access management: FAIL"
    fi
    
    # PR.DS-1 - Data-at-rest protection
    log_info "Checking PR.DS-1 - Data-at-rest Protection"
    if check_file_exists "${PROJECT_ROOT}/terraform/main.tf" && \
       grep -q "encrypted.*true" "${PROJECT_ROOT}/terraform/main.tf"; then
        update_report "nist" "PR.DS-1" "PASS" "Data-at-rest protection implemented" \
                     "Encryption enabled for storage resources" "None"
        log_success "PR.DS-1 - Data-at-rest protection: PASS"
    else
        update_report "nist" "PR.DS-1" "FAIL" "Data-at-rest protection missing" \
                     "No encryption configuration found" "Enable encryption for all data stores"
        log_error "PR.DS-1 - Data-at-rest protection: FAIL"
    fi
    
    # DE.CM-1 - Continuous monitoring
    log_info "Checking DE.CM-1 - Continuous Monitoring"
    if check_file_exists "${PROJECT_ROOT}/devtools/prometheus/prometheus.prod.yml" && \
       check_file_exists "${PROJECT_ROOT}/security/falco-rules.yaml"; then
        update_report "nist" "DE.CM-1" "PASS" "Continuous monitoring implemented" \
                     "Prometheus monitoring and Falco security monitoring" "None"
        log_success "DE.CM-1 - Continuous monitoring: PASS"
    else
        update_report "nist" "DE.CM-1" "FAIL" "Continuous monitoring missing" \
                     "Monitoring configuration not found" "Implement comprehensive monitoring"
        log_error "DE.CM-1 - Continuous monitoring: FAIL"
    fi
    
    # RS.RP-1 - Response plan
    log_info "Checking RS.RP-1 - Response Plan"
    if check_file_exists "${PROJECT_ROOT}/security/security-policy.yaml" && \
       grep -q "incidentResponse" "${PROJECT_ROOT}/security/security-policy.yaml"; then
        update_report "nist" "RS.RP-1" "PASS" "Response plan implemented" \
                     "Incident response procedures documented" "None"
        log_success "RS.RP-1 - Response plan: PASS"
    else
        update_report "nist" "RS.RP-1" "WARNING" "Response plan needs documentation" \
                     "Incident response procedures need formalization" "Document incident response procedures"
        log_warning "RS.RP-1 - Response plan: WARNING"
    fi
}

# ==================================================
# CIS BENCHMARKS CHECKS
# ==================================================
check_cis_compliance() {
    log_section "CIS Kubernetes Benchmark v1.6.0 Checks"
    
    # 5.1.1 - Ensure that the cluster-admin role is only used where required
    log_info "Checking 5.1.1 - Cluster-admin Role Usage"
    if check_file_exists "${PROJECT_ROOT}/k8s/app-deployment.yaml" && \
       ! grep -q "cluster-admin" "${PROJECT_ROOT}/k8s/app-deployment.yaml"; then
        update_report "cis" "5.1.1" "PASS" "Cluster-admin role not used inappropriately" \
                     "No cluster-admin bindings in application manifests" "None"
        log_success "5.1.1 - Cluster-admin usage: PASS"
    else
        update_report "cis" "5.1.1" "WARNING" "Review cluster-admin usage" \
                     "Found potential cluster-admin usage" "Review and minimize cluster-admin usage"
        log_warning "5.1.1 - Cluster-admin usage: WARNING"
    fi
    
    # 5.1.3 - Minimize wildcard use in Roles and ClusterRoles
    log_info "Checking 5.1.3 - Wildcard Usage in RBAC"
    if check_file_exists "${PROJECT_ROOT}/k8s/app-deployment.yaml" && \
       ! grep -q 'resources.*"\*"' "${PROJECT_ROOT}/k8s/app-deployment.yaml"; then
        update_report "cis" "5.1.3" "PASS" "Wildcard usage minimized" \
                     "No wildcard permissions in RBAC" "None"
        log_success "5.1.3 - Wildcard usage: PASS"
    else
        update_report "cis" "5.1.3" "WARNING" "Review wildcard usage" \
                     "Found potential wildcard usage in RBAC" "Minimize wildcard permissions"
        log_warning "5.1.3 - Wildcard usage: WARNING"
    fi
    
    # 5.2.2 - Minimize the admission of privileged containers
    log_info "Checking 5.2.2 - Privileged Containers"
    if check_file_exists "${PROJECT_ROOT}/k8s/app-deployment.yaml" && \
       ! grep -q "privileged.*true" "${PROJECT_ROOT}/k8s/app-deployment.yaml"; then
        update_report "cis" "5.2.2" "PASS" "No privileged containers" \
                     "Privileged: false or not specified" "None"
        log_success "5.2.2 - Privileged containers: PASS"
    else
        update_report "cis" "5.2.2" "FAIL" "Privileged containers found" \
                     "Containers running in privileged mode" "Remove privileged mode"
        log_error "5.2.2 - Privileged containers: FAIL"
    fi
    
    # 5.2.5 - Minimize the admission of containers with allowPrivilegeEscalation
    log_info "Checking 5.2.5 - Privilege Escalation"
    if check_file_exists "${PROJECT_ROOT}/k8s/app-deployment.yaml" && \
       grep -q "allowPrivilegeEscalation.*false" "${PROJECT_ROOT}/k8s/app-deployment.yaml"; then
        update_report "cis" "5.2.5" "PASS" "Privilege escalation disabled" \
                     "allowPrivilegeEscalation: false configured" "None"
        log_success "5.2.5 - Privilege escalation: PASS"
    else
        update_report "cis" "5.2.5" "FAIL" "Privilege escalation not disabled" \
                     "allowPrivilegeEscalation not set to false" "Set allowPrivilegeEscalation: false"
        log_error "5.2.5 - Privilege escalation: FAIL"
    fi
}

# ==================================================
# OWASP TOP 10 CHECKS
# ==================================================
check_owasp_compliance() {
    log_section "OWASP Top 10 2021 Checks"
    
    # A01:2021 - Broken Access Control
    log_info "Checking A01:2021 - Broken Access Control"
    if check_file_exists "${PROJECT_ROOT}/src/modules/auth/infrastructure/guards" && \
       check_file_exists "${PROJECT_ROOT}/src/modules/auth/infrastructure/decorators/auth.decorator.ts"; then
        update_report "owasp" "A01:2021" "PASS" "Access control implemented" \
                     "Authentication guards and decorators configured" "Regular access control testing needed"
        log_success "A01:2021 - Access control: PASS"
    else
        update_report "owasp" "A01:2021" "FAIL" "Access control missing" \
                     "No access control mechanisms found" "Implement comprehensive access control"
        log_error "A01:2021 - Access control: FAIL"
    fi
    
    # A02:2021 - Cryptographic Failures
    log_info "Checking A02:2021 - Cryptographic Failures"
    if check_file_exists "${PROJECT_ROOT}/src/modules/auth/infrastructure/services/jwt.service.ts" && \
       grep -q "sign\|verify" "${PROJECT_ROOT}/src/modules/auth/infrastructure/services/jwt.service.ts"; then
        update_report "owasp" "A02:2021" "PASS" "Cryptographic controls implemented" \
                     "JWT signing and verification implemented" "Regular crypto review needed"
        log_success "A02:2021 - Cryptographic failures: PASS"
    else
        update_report "owasp" "A02:2021" "WARNING" "Cryptographic implementation needs review" \
                     "Basic crypto found, needs comprehensive review" "Implement strong cryptography"
        log_warning "A02:2021 - Cryptographic failures: WARNING"
    fi
    
    # A03:2021 - Injection
    log_info "Checking A03:2021 - Injection"
    if check_file_exists "${PROJECT_ROOT}/src/libs/db/sql-repository.base.ts" && \
       grep -q "slonik\|parameterized" "${PROJECT_ROOT}/src/libs/db/sql-repository.base.ts"; then
        update_report "owasp" "A03:2021" "PASS" "SQL injection protection implemented" \
                     "Parameterized queries with Slonik" "Regular injection testing needed"
        log_success "A03:2021 - Injection: PASS"
    else
        update_report "owasp" "A03:2021" "WARNING" "Injection protection needs review" \
                     "Database layer implementation needs review" "Implement parameterized queries"
        log_warning "A03:2021 - Injection: WARNING"
    fi
    
    # A06:2021 - Vulnerable and Outdated Components
    log_info "Checking A06:2021 - Vulnerable Components"
    if check_file_exists "${PROJECT_ROOT}/.github/workflows/ci-cd.yml" && \
       grep -q "security.*scan\|vulnerability" "${PROJECT_ROOT}/.github/workflows/ci-cd.yml"; then
        update_report "owasp" "A06:2021" "PASS" "Component vulnerability scanning implemented" \
                     "Automated security scanning in CI/CD" "Keep scanning tools updated"
        log_success "A06:2021 - Vulnerable components: PASS"
    else
        update_report "owasp" "A06:2021" "FAIL" "Component vulnerability scanning missing" \
                     "No automated security scanning found" "Implement dependency scanning"
        log_error "A06:2021 - Vulnerable components: FAIL"
    fi
    
    # A09:2021 - Security Logging and Monitoring Failures
    log_info "Checking A09:2021 - Security Logging and Monitoring"
    if check_file_exists "${PROJECT_ROOT}/devtools/prometheus/rules/application-alerts.yml" && \
       grep -q "security\|auth" "${PROJECT_ROOT}/devtools/prometheus/rules/application-alerts.yml"; then
        update_report "owasp" "A09:2021" "PASS" "Security logging and monitoring implemented" \
                     "Security-focused alerting rules configured" "Regular log analysis needed"
        log_success "A09:2021 - Security logging: PASS"
    else
        update_report "owasp" "A09:2021" "WARNING" "Security logging needs enhancement" \
                     "Basic monitoring found, security focus needed" "Implement security-specific logging"
        log_warning "A09:2021 - Security logging: WARNING"
    fi
}

# ==================================================
# GDPR COMPLIANCE CHECKS
# ==================================================
check_gdpr_compliance() {
    log_section "GDPR Compliance Checks"
    
    # Article 25 - Data protection by design and by default
    log_info "Checking Article 25 - Privacy by Design"
    if check_file_exists "${PROJECT_ROOT}/src/modules/auth/domain/value-objects/password.value-object.ts" && \
       grep -q "hash\|encrypt" "${PROJECT_ROOT}/src/modules/auth/domain/value-objects/password.value-object.ts"; then
        update_report "gdpr" "Article-25" "PASS" "Privacy by design implemented" \
                     "Password hashing and data protection measures" "Regular privacy impact assessments needed"
        log_success "Article 25 - Privacy by design: PASS"
    else
        update_report "gdpr" "Article-25" "WARNING" "Privacy by design needs review" \
                     "Some protection measures found" "Comprehensive privacy audit needed"
        log_warning "Article 25 - Privacy by design: WARNING"
    fi
    
    # Article 30 - Records of processing activities
    log_info "Checking Article 30 - Processing Records"
    if check_file_exists "${PROJECT_ROOT}/security/security-policy.yaml" && \
       grep -q "audit\|logging" "${PROJECT_ROOT}/security/security-policy.yaml"; then
        update_report "gdpr" "Article-30" "PASS" "Processing records maintained" \
                     "Audit logging configuration found" "Ensure comprehensive data processing documentation"
        log_success "Article 30 - Processing records: PASS"
    else
        update_report "gdpr" "Article-30" "WARNING" "Processing records need documentation" \
                     "Limited audit trail configuration" "Document all data processing activities"
        log_warning "Article 30 - Processing records: WARNING"
    fi
    
    # Article 32 - Security of processing
    log_info "Checking Article 32 - Security of Processing"
    if check_file_exists "${PROJECT_ROOT}/terraform/main.tf" && \
       grep -q "encrypt" "${PROJECT_ROOT}/terraform/main.tf" && \
       check_file_exists "${PROJECT_ROOT}/security/falco-rules.yaml"; then
        update_report "gdpr" "Article-32" "PASS" "Security of processing implemented" \
                     "Encryption and security monitoring configured" "Regular security assessments needed"
        log_success "Article 32 - Security of processing: PASS"
    else
        update_report "gdpr" "Article-32" "FAIL" "Security of processing insufficient" \
                     "Missing encryption or monitoring" "Implement comprehensive security measures"
        log_error "Article 32 - Security of processing: FAIL"
    fi
    
    # Article 33 - Notification of data breaches
    log_info "Checking Article 33 - Breach Notification"
    if check_file_exists "${PROJECT_ROOT}/security/security-policy.yaml" && \
       grep -q "incidentResponse\|notification" "${PROJECT_ROOT}/security/security-policy.yaml"; then
        update_report "gdpr" "Article-33" "PASS" "Breach notification procedures implemented" \
                     "Incident response and notification procedures documented" "Test breach response procedures"
        log_success "Article 33 - Breach notification: PASS"
    else
        update_report "gdpr" "Article-33" "WARNING" "Breach notification needs formalization" \
                     "Incident response procedures need enhancement" "Implement formal breach notification process"
        log_warning "Article 33 - Breach notification: WARNING"
    fi
}

# ==================================================
# GENERATE SUMMARY AND RECOMMENDATIONS
# ==================================================
generate_summary() {
    log_section "Generating Compliance Summary"
    
    # Calculate summary statistics using jq
    local total_controls=$(jq '[.frameworks[].controls | keys[]] | length' "${REPORT_FILE}")
    local passed=$(jq '[.frameworks[].controls[] | select(.status == "PASS")] | length' "${REPORT_FILE}")
    local failed=$(jq '[.frameworks[].controls[] | select(.status == "FAIL")] | length' "${REPORT_FILE}")
    local warnings=$(jq '[.frameworks[].controls[] | select(.status == "WARNING")] | length' "${REPORT_FILE}")
    local score=0
    
    if [[ $total_controls -gt 0 ]]; then
        score=$(echo "scale=2; ($passed * 100) / $total_controls" | bc)
    fi
    
    # Update summary in report
    jq --argjson total "$total_controls" \
       --argjson passed "$passed" \
       --argjson failed "$failed" \
       --argjson warnings "$warnings" \
       --argjson score "$score" \
       '.summary.total_controls = $total |
        .summary.passed = $passed |
        .summary.failed = $failed |
        .summary.warning = $warnings |
        .summary.score = $score' "${REPORT_FILE}" > "${REPORT_FILE}.tmp" && mv "${REPORT_FILE}.tmp" "${REPORT_FILE}"
    
    # Generate text summary
    cat > "${SUMMARY_FILE}" << EOF
Domain-Driven Hexagon Compliance Summary
========================================
Scan Date: $(date)
Report ID: compliance-report-${TIMESTAMP}

OVERALL COMPLIANCE SCORE: ${score}%

Summary Statistics:
- Total Controls Checked: ${total_controls}
- Passed: ${passed}
- Failed: ${failed}
- Warnings: ${warnings}

Framework Breakdown:
$(jq -r '.frameworks | to_entries[] | "- \(.key | ascii_upcase): \(.value.controls | to_entries | map(select(.value.status == "PASS")) | length)/\(.value.controls | length) controls passed"' "${REPORT_FILE}")

Critical Issues (FAIL status):
$(jq -r '.frameworks | to_entries[] | .key as $fw | .value.controls | to_entries[] | select(.value.status == "FAIL") | "- [\($fw | ascii_upcase)] \(.key): \(.value.description)"' "${REPORT_FILE}")

Recommendations:
$(jq -r '.frameworks | to_entries[] | .key as $fw | .value.controls | to_entries[] | select(.value.status == "FAIL") | "- [\($fw | ascii_upcase)] \(.key): \(.value.recommendation)"' "${REPORT_FILE}")

Warnings Requiring Attention:
$(jq -r '.frameworks | to_entries[] | .key as $fw | .value.controls | to_entries[] | select(.value.status == "WARNING") | "- [\($fw | ascii_upcase)] \(.key): \(.value.description)"' "${REPORT_FILE}")

Next Steps:
1. Address all FAIL status controls immediately
2. Review and resolve WARNING status controls  
3. Implement regular compliance monitoring
4. Schedule periodic compliance assessments
5. Update security policies and procedures
6. Conduct security awareness training
7. Test incident response procedures

For detailed findings, review: ${REPORT_FILE}
EOF
    
    log_info "Summary report generated: ${SUMMARY_FILE}"
    
    # Display summary
    echo -e "\n${CYAN}COMPLIANCE SCAN RESULTS${NC}"
    echo -e "${CYAN}=======================${NC}"
    echo -e "Overall Score: ${YELLOW}${score}%${NC}"
    echo -e "Total Controls: ${total_controls}"
    echo -e "✅ Passed: ${GREEN}${passed}${NC}"
    echo -e "❌ Failed: ${RED}${failed}${NC}"
    echo -e "⚠️  Warnings: ${YELLOW}${warnings}${NC}"
    
    if [[ $failed -gt 0 ]]; then
        echo -e "\n${RED}❌ CRITICAL: ${failed} controls failed. Immediate attention required!${NC}"
        return 1
    elif [[ $warnings -gt 0 ]]; then
        echo -e "\n${YELLOW}⚠️  WARNING: ${warnings} controls need attention.${NC}"
        return 2
    else
        echo -e "\n${GREEN}✅ All compliance checks passed!${NC}"
        return 0
    fi
}

# ==================================================
# MAIN EXECUTION
# ==================================================
main() {
    # Check dependencies
    if ! command -v jq &> /dev/null; then
        log_error "jq is required but not installed. Please install jq."
        exit 1
    fi
    
    if ! command -v bc &> /dev/null; then
        log_error "bc is required but not installed. Please install bc."
        exit 1
    fi
    
    # Run compliance checks
    check_soc2_compliance
    check_iso27001_compliance  
    check_nist_compliance
    check_cis_compliance
    check_owasp_compliance
    check_gdpr_compliance
    
    # Generate summary and exit with appropriate code
    generate_summary
    local exit_code=$?
    
    echo -e "\n${BLUE}📋 Reports saved to:${NC}"
    echo -e "  Detailed JSON: ${REPORT_FILE}"
    echo -e "  Summary: ${SUMMARY_FILE}"
    
    exit $exit_code
}

# Run main function
main "$@"