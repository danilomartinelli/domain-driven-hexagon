-- Create roles table for RBAC system
CREATE TABLE "roles" (
  "id" character varying NOT NULL,
  "name" character varying NOT NULL UNIQUE,
  "description" character varying,
  "isActive" boolean NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT "PK_roles_id" PRIMARY KEY ("id")
);

-- Create permissions table
CREATE TABLE "permissions" (
  "id" character varying NOT NULL,
  "name" character varying NOT NULL UNIQUE,
  "resource" character varying NOT NULL,
  "action" character varying NOT NULL,
  "description" character varying,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT "PK_permissions_id" PRIMARY KEY ("id"),
  CONSTRAINT "UQ_permissions_resource_action" UNIQUE ("resource", "action")
);

-- Create role_permissions junction table for many-to-many relationship
CREATE TABLE "role_permissions" (
  "roleId" character varying NOT NULL,
  "permissionId" character varying NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT "PK_role_permissions" PRIMARY KEY ("roleId", "permissionId"),
  CONSTRAINT "FK_role_permissions_role" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE,
  CONSTRAINT "FK_role_permissions_permission" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX "IDX_roles_name" ON "roles" ("name");
CREATE INDEX "IDX_roles_active" ON "roles" ("isActive");
CREATE INDEX "IDX_permissions_resource" ON "permissions" ("resource");
CREATE INDEX "IDX_permissions_action" ON "permissions" ("action");
CREATE INDEX "IDX_permissions_resource_action" ON "permissions" ("resource", "action");
CREATE INDEX "IDX_role_permissions_role" ON "role_permissions" ("roleId");
CREATE INDEX "IDX_role_permissions_permission" ON "role_permissions" ("permissionId");