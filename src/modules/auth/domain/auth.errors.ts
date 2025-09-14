import { ExceptionBase } from '@libs/exceptions/exception.base';

export class AuthenticationError extends ExceptionBase {
  static readonly message = 'Authentication failed';

  public readonly code = 'AUTH.AUTHENTICATION_FAILED';

  constructor(metadata?: unknown) {
    super(AuthenticationError.message, undefined, metadata);
  }
}

export class InvalidCredentialsError extends ExceptionBase {
  static readonly message = 'Invalid email or password';

  public readonly code = 'AUTH.INVALID_CREDENTIALS';

  constructor(metadata?: unknown) {
    super(InvalidCredentialsError.message, undefined, metadata);
  }
}

export class AccountLockedError extends ExceptionBase {
  static readonly message =
    'Account is temporarily locked due to too many failed login attempts';

  public readonly code = 'AUTH.ACCOUNT_LOCKED';

  constructor(metadata?: unknown) {
    super(AccountLockedError.message, undefined, metadata);
  }
}

export class AccountInactiveError extends ExceptionBase {
  static readonly message = 'Account is inactive';

  public readonly code = 'AUTH.ACCOUNT_INACTIVE';

  constructor(metadata?: unknown) {
    super(AccountInactiveError.message, undefined, metadata);
  }
}

export class EmailNotVerifiedError extends ExceptionBase {
  static readonly message = 'Email address is not verified';

  public readonly code = 'AUTH.EMAIL_NOT_VERIFIED';

  constructor(metadata?: unknown) {
    super(EmailNotVerifiedError.message, undefined, metadata);
  }
}

export class InvalidTokenError extends ExceptionBase {
  static readonly message = 'Invalid or expired token';

  public readonly code = 'AUTH.INVALID_TOKEN';

  constructor(metadata?: unknown) {
    super(InvalidTokenError.message, undefined, metadata);
  }
}

export class TokenExpiredError extends ExceptionBase {
  static readonly message = 'Token has expired';

  public readonly code = 'AUTH.TOKEN_EXPIRED';

  constructor(metadata?: unknown) {
    super(TokenExpiredError.message, undefined, metadata);
  }
}

export class RefreshTokenNotFoundError extends ExceptionBase {
  static readonly message = 'Refresh token not found or has been revoked';

  public readonly code = 'AUTH.REFRESH_TOKEN_NOT_FOUND';

  constructor(metadata?: unknown) {
    super(RefreshTokenNotFoundError.message, undefined, metadata);
  }
}

export class UnauthorizedError extends ExceptionBase {
  static readonly message = 'Unauthorized access';

  public readonly code = 'AUTH.UNAUTHORIZED';

  constructor(metadata?: unknown) {
    super(UnauthorizedError.message, undefined, metadata);
  }
}

export class ForbiddenError extends ExceptionBase {
  static readonly message = 'Access forbidden - insufficient permissions';

  public readonly code = 'AUTH.FORBIDDEN';

  constructor(metadata?: unknown) {
    super(ForbiddenError.message, undefined, metadata);
  }
}

export class WeakPasswordError extends ExceptionBase {
  static readonly message = 'Password does not meet security requirements';

  public readonly code = 'AUTH.WEAK_PASSWORD';

  constructor(metadata?: unknown) {
    super(WeakPasswordError.message, undefined, metadata);
  }
}

export class PasswordMismatchError extends ExceptionBase {
  static readonly message = 'Passwords do not match';

  public readonly code = 'AUTH.PASSWORD_MISMATCH';

  constructor(metadata?: unknown) {
    super(PasswordMismatchError.message, undefined, metadata);
  }
}

export class CurrentPasswordIncorrectError extends ExceptionBase {
  static readonly message = 'Current password is incorrect';

  public readonly code = 'AUTH.CURRENT_PASSWORD_INCORRECT';

  constructor(metadata?: unknown) {
    super(CurrentPasswordIncorrectError.message, undefined, metadata);
  }
}

export class RoleNotFoundError extends ExceptionBase {
  static readonly message = 'Role not found';

  public readonly code = 'AUTH.ROLE_NOT_FOUND';

  constructor(metadata?: unknown) {
    super(RoleNotFoundError.message, undefined, metadata);
  }
}

export class PermissionNotFoundError extends ExceptionBase {
  static readonly message = 'Permission not found';

  public readonly code = 'AUTH.PERMISSION_NOT_FOUND';

  constructor(metadata?: unknown) {
    super(PermissionNotFoundError.message, undefined, metadata);
  }
}

export class RoleAlreadyExistsError extends ExceptionBase {
  static readonly message = 'Role with this name already exists';

  public readonly code = 'AUTH.ROLE_ALREADY_EXISTS';

  constructor(metadata?: unknown) {
    super(RoleAlreadyExistsError.message, undefined, metadata);
  }
}

export class PermissionAlreadyExistsError extends ExceptionBase {
  static readonly message =
    'Permission already exists for this resource and action';

  public readonly code = 'AUTH.PERMISSION_ALREADY_EXISTS';

  constructor(metadata?: unknown) {
    super(PermissionAlreadyExistsError.message, undefined, metadata);
  }
}
