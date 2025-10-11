export interface PasswordResetToken {
  id: string;
  userId: string;
  email: string;
  token: string;
  expiresAt: Date;
  used: boolean; 
  usedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirm {
  token: string;
  newPassword: string;
}
