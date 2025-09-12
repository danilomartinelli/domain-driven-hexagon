-- Seed initial roles and permissions for RBAC system
-- Insert default roles
INSERT INTO "roles" ("id", "name", "description") VALUES
('role-admin-001', 'admin', 'System administrator with full access'),
('role-moderator-001', 'moderator', 'Moderator with limited administrative access'),
('role-user-001', 'user', 'Standard user with basic access'),
('role-guest-001', 'guest', 'Guest user with minimal access');

-- Insert default permissions
INSERT INTO "permissions" ("id", "name", "resource", "action", "description") VALUES
-- User management permissions
('perm-user-001', 'user:create', 'user', 'create', 'Create new users'),
('perm-user-002', 'user:read', 'user', 'read', 'View user information'),
('perm-user-003', 'user:update', 'user', 'update', 'Update user information'),
('perm-user-004', 'user:delete', 'user', 'delete', 'Delete users'),
('perm-user-005', 'user:list', 'user', 'list', 'List all users'),
('perm-user-006', 'user:read-own', 'user', 'read-own', 'Read own user profile'),
('perm-user-007', 'user:update-own', 'user', 'update-own', 'Update own user profile'),

-- Role management permissions  
('perm-role-001', 'role:create', 'role', 'create', 'Create new roles'),
('perm-role-002', 'role:read', 'role', 'read', 'View role information'),
('perm-role-003', 'role:update', 'role', 'update', 'Update role information'),
('perm-role-004', 'role:delete', 'role', 'delete', 'Delete roles'),
('perm-role-005', 'role:assign', 'role', 'assign', 'Assign roles to users'),

-- Permission management permissions
('perm-permission-001', 'permission:create', 'permission', 'create', 'Create new permissions'),
('perm-permission-002', 'permission:read', 'permission', 'read', 'View permission information'),
('perm-permission-003', 'permission:update', 'permission', 'update', 'Update permission information'),
('perm-permission-004', 'permission:delete', 'permission', 'delete', 'Delete permissions'),

-- Wallet management permissions
('perm-wallet-001', 'wallet:create', 'wallet', 'create', 'Create wallets'),
('perm-wallet-002', 'wallet:read', 'wallet', 'read', 'View wallet information'),
('perm-wallet-003', 'wallet:update', 'wallet', 'update', 'Update wallet information'),
('perm-wallet-004', 'wallet:delete', 'wallet', 'delete', 'Delete wallets'),
('perm-wallet-005', 'wallet:read-own', 'wallet', 'read-own', 'Read own wallet'),

-- System permissions
('perm-system-001', 'system:health', 'system', 'health', 'Check system health'),
('perm-system-002', 'system:metrics', 'system', 'metrics', 'View system metrics');

-- Assign permissions to roles
-- Admin role gets all permissions
INSERT INTO "role_permissions" ("roleId", "permissionId") 
SELECT 'role-admin-001', "id" FROM "permissions";

-- Moderator role gets user and wallet management permissions
INSERT INTO "role_permissions" ("roleId", "permissionId") VALUES
('role-moderator-001', 'perm-user-002'),
('role-moderator-001', 'perm-user-003'),
('role-moderator-001', 'perm-user-005'),
('role-moderator-001', 'perm-user-006'),
('role-moderator-001', 'perm-user-007'),
('role-moderator-001', 'perm-wallet-002'),
('role-moderator-001', 'perm-wallet-003'),
('role-moderator-001', 'perm-wallet-005'),
('role-moderator-001', 'perm-role-002'),
('role-moderator-001', 'perm-permission-002'),
('role-moderator-001', 'perm-system-001');

-- User role gets basic permissions
INSERT INTO "role_permissions" ("roleId", "permissionId") VALUES
('role-user-001', 'perm-user-006'),
('role-user-001', 'perm-user-007'),
('role-user-001', 'perm-wallet-005'),
('role-user-001', 'perm-system-001');

-- Guest role gets minimal permissions
INSERT INTO "role_permissions" ("roleId", "permissionId") VALUES
('role-guest-001', 'perm-system-001');

-- Update existing user roles to use the new role system
-- Convert old role enum values to new role assignments
INSERT INTO "user_roles" ("userId", "roleId")
SELECT 
  u."id" as "userId",
  CASE u."role"
    WHEN 'admin' THEN 'role-admin-001'
    WHEN 'moderator' THEN 'role-moderator-001'  
    WHEN 'guest' THEN 'role-guest-001'
    ELSE 'role-user-001'
  END as "roleId"
FROM "users" u
WHERE u."role" IS NOT NULL;

-- Optional: Remove the old role column after data migration
-- ALTER TABLE "users" DROP COLUMN "role";