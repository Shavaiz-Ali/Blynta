export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AdminUser {
  id: string;
  email: string;
  name?: string;
  role: string;
  accessToken?: string;
}
