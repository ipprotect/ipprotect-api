export interface UserMeResponse {
  id: string;
  email: string;
  walletPublicKey?: string | null;
  createdAt: string; // ISO string
}
