export const AUTH_DI_TOKENS = {
  // Repositories
  AuthRepository: Symbol('AUTH_REPOSITORY'),
  RoleRepository: Symbol('ROLE_REPOSITORY'),
  PermissionRepository: Symbol('PERMISSION_REPOSITORY'),
  RefreshTokenRepository: Symbol('REFRESH_TOKEN_REPOSITORY'),
  
  // Services
  JwtService: Symbol('JWT_SERVICE'),
  PasswordService: Symbol('PASSWORD_SERVICE'),
  AuthService: Symbol('AUTH_SERVICE'),
  
  // Query Handlers
  GetUserPermissionsQueryHandler: Symbol('GET_USER_PERMISSIONS_QUERY_HANDLER'),
  ValidateTokenQueryHandler: Symbol('VALIDATE_TOKEN_QUERY_HANDLER'),
} as const;