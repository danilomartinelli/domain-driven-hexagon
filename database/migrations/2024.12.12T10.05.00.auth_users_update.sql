-- Update existing users table to support authentication
-- Add password and authentication related fields
ALTER TABLE "users" 
ADD COLUMN "password" character varying,
ADD COLUMN "isActive" boolean NOT NULL DEFAULT true,
ADD COLUMN "isEmailVerified" boolean NOT NULL DEFAULT false,
ADD COLUMN "emailVerificationToken" character varying,
ADD COLUMN "passwordResetToken" character varying,
ADD COLUMN "passwordResetTokenExpiresAt" TIMESTAMP WITH TIME ZONE,
ADD COLUMN "lastLoginAt" TIMESTAMP WITH TIME ZONE,
ADD COLUMN "loginAttempts" integer NOT NULL DEFAULT 0,
ADD COLUMN "lockedUntil" TIMESTAMP WITH TIME ZONE;

-- Create user_roles junction table (many-to-many relationship)
CREATE TABLE "user_roles" (
  "userId" character varying NOT NULL,
  "roleId" character varying NOT NULL,
  "assignedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "assignedBy" character varying,
  CONSTRAINT "PK_user_roles" PRIMARY KEY ("userId", "roleId"),
  CONSTRAINT "FK_user_roles_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "FK_user_roles_role" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE,
  CONSTRAINT "FK_user_roles_assigned_by" FOREIGN KEY ("assignedBy") REFERENCES "users"("id") ON DELETE SET NULL
);

-- Create refresh tokens table for JWT token management
CREATE TABLE "refresh_tokens" (
  "id" character varying NOT NULL,
  "token" character varying NOT NULL,
  "userId" character varying NOT NULL,
  "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
  "isRevoked" boolean NOT NULL DEFAULT false,
  "revokedAt" TIMESTAMP WITH TIME ZONE,
  "revokedByIp" character varying,
  "replacedByToken" character varying,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "createdByIp" character varying,
  "userAgent" text,
  CONSTRAINT "PK_refresh_tokens_id" PRIMARY KEY ("id"),
  CONSTRAINT "FK_refresh_tokens_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "UQ_refresh_tokens_token" UNIQUE ("token")
);

-- Create audit log table for security monitoring
CREATE TABLE "auth_audit_log" (
  "id" character varying NOT NULL,
  "userId" character varying,
  "action" character varying NOT NULL,
  "details" jsonb,
  "ipAddress" character varying,
  "userAgent" text,
  "success" boolean NOT NULL,
  "timestamp" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT "PK_auth_audit_log_id" PRIMARY KEY ("id"),
  CONSTRAINT "FK_auth_audit_log_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL
);

-- Create indexes for better query performance
CREATE INDEX "IDX_users_email_active" ON "users" ("email", "isActive");
CREATE INDEX "IDX_users_email_verification_token" ON "users" ("emailVerificationToken");
CREATE INDEX "IDX_users_password_reset_token" ON "users" ("passwordResetToken");
CREATE INDEX "IDX_users_locked_until" ON "users" ("lockedUntil");
CREATE INDEX "IDX_users_active" ON "users" ("isActive");

CREATE INDEX "IDX_user_roles_user" ON "user_roles" ("userId");
CREATE INDEX "IDX_user_roles_role" ON "user_roles" ("roleId");
CREATE INDEX "IDX_user_roles_assigned_by" ON "user_roles" ("assignedBy");

CREATE INDEX "IDX_refresh_tokens_user" ON "refresh_tokens" ("userId");
CREATE INDEX "IDX_refresh_tokens_token" ON "refresh_tokens" ("token");
CREATE INDEX "IDX_refresh_tokens_expires_at" ON "refresh_tokens" ("expiresAt");
CREATE INDEX "IDX_refresh_tokens_revoked" ON "refresh_tokens" ("isRevoked");

CREATE INDEX "IDX_auth_audit_log_user" ON "auth_audit_log" ("userId");
CREATE INDEX "IDX_auth_audit_log_action" ON "auth_audit_log" ("action");
CREATE INDEX "IDX_auth_audit_log_timestamp" ON "auth_audit_log" ("timestamp");
CREATE INDEX "IDX_auth_audit_log_success" ON "auth_audit_log" ("success");