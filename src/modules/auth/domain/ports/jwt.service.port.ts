import { JwtPayload, TokenPair } from '../auth.types';

export interface JwtServicePort {
  generateTokenPair(payload: JwtPayload): Promise<TokenPair>;
  generateAccessToken(payload: JwtPayload): Promise<string>;
  generateRefreshToken(payload: JwtPayload): Promise<string>;
  verifyAccessToken(token: string): Promise<JwtPayload>;
  verifyRefreshToken(token: string): Promise<JwtPayload>;
  decodeToken(token: string): JwtPayload | null;
  isTokenExpired(token: string): boolean;
}