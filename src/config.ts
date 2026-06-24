export const config = {
  rpcUrl: import.meta.env.VITE_RPC_URL as string,
  networkPassphrase: import.meta.env.VITE_NETWORK_PASSPHRASE as string,
  taskboardContractId: import.meta.env.VITE_TASKBOARD_CONTRACT_ID as string,
  escrowContractId: import.meta.env.VITE_ESCROW_CONTRACT_ID as string,
  tokenContractId: import.meta.env.VITE_TOKEN_CONTRACT_ID as string,
};

export function requireConfig(): void {
  const missing = Object.entries(config)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length > 0) {
    throw new Error(`Missing env vars: ${missing.join(', ')}. Copy .env.example to .env and fill in values.`);
  }
}
