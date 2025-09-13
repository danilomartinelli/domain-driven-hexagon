// Tokens used for Dependency Injection

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

export const USER_DI_TOKENS = {
  UserRepository: USER_REPOSITORY,
} as const;
