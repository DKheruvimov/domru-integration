export interface SavedCredentials {
  login: string;
  password?: string;
  token?: string;
  refreshToken?: string;
  operatorId?: number;
  isDemo: boolean;
}
