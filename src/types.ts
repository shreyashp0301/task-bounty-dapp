export interface Task {
  id: number;
  creator: string;
  description: string;
  reward: bigint;
  assignee: string | null;
  completed: boolean;
}

export interface WalletState {
  connected: boolean;
  publicKey: string | null;
}

export type LoadingState = {
  [key: string]: boolean;
};

export type ErrorState = {
  [key: string]: string | null;
};
