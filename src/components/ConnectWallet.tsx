import * as Freighter from '@stellar/freighter-api';
import { useState, useEffect, useCallback } from 'react';
import { Wallet } from 'lucide-react';
import { ErrorMessage } from './ErrorMessage';
import type { WalletState } from '../types';

interface Props {
  wallet: WalletState;
  onConnect: (pk: string) => void;
  onDisconnect: () => void;
}

export function ConnectWallet({ wallet, onConnect, onDisconnect }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const log = useCallback((...args: any[]) => console.log('[Freighter]', ...args), []);
  const logError = useCallback((...args: any[]) => console.error('[Freighter]', ...args), []);

  useEffect(() => {
    (async () => {
      try {
        log('Checking if Freighter is already connected…');
        const { isConnected: yes } = await Freighter.isConnected();
        log('Mount check – isConnected:', yes);
        if (yes) {
          const { address } = await Freighter.getAddress();
          log('Mount check – address:', address);
          if (address) {
            onConnect(address);
          }
        }
      } catch (err) {
        logError('Mount check error (expected if Freighter not installed):', err);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleConnect = async () => {
    setLoading(true);
    setError(null);
    log('Connect clicked — starting flow');

    let connectedResult: { isConnected: boolean; error?: any };
    try {
      log('Calling Freighter.isConnected()…');
      connectedResult = await Freighter.isConnected();
      log('isConnected result:', connectedResult);
    } catch (err: any) {
      logError('isConnected threw:', err);
      setError(`Freighter error: ${err?.message ?? err?.toString() ?? 'Unknown error'}`);
      setLoading(false);
      return;
    }

    if (!connectedResult.isConnected) {
      logError('Freighter not detected by isConnected');
      setError(
        'Freighter wallet not detected. Make sure the Freighter browser extension is installed and enabled.',
      );
      setLoading(false);
      return;
    }

    let accessResult: { address: string; error?: any };
    try {
      log('Calling Freighter.requestAccess() (triggers popup)…');
      accessResult = await Freighter.requestAccess();
      log('requestAccess result:', accessResult);
    } catch (err: any) {
      logError('requestAccess threw:', err);
      setError(`Freighter popup error: ${err?.message ?? err?.toString() ?? 'Unknown error'}`);
      setLoading(false);
      return;
    }

    if (!accessResult.address) {
      const errMsg = accessResult.error?.message ?? 'No address returned — user may have rejected the request.';
      logError('Empty address from requestAccess:', accessResult);
      setError(`Connection failed: ${errMsg}`);
      setLoading(false);
      return;
    }

    log('Connected with address:', accessResult.address);
    onConnect(accessResult.address);
    setLoading(false);
  };

  if (wallet.connected && wallet.publicKey) {
    const short = `${wallet.publicKey.slice(0, 4)}…${wallet.publicKey.slice(-4)}`;
    return (
      <div className="wallet-bar">
        <span className="wallet-address">
          <span className="wallet-dot" />
          <Wallet size={14} />
          {short}
        </span>
        <button className="btn btn-secondary" onClick={onDisconnect}>
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="wallet-bar">
      <button className="btn btn-primary" onClick={handleConnect} disabled={loading}>
        <Wallet size={16} />
        {loading ? 'Connecting…' : 'Connect Freighter'}
      </button>
      {error && <ErrorMessage message={error} onDismiss={() => setError(null)} />}
    </div>
  );
}
