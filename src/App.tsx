import { useState, useCallback } from 'react';
import { Target } from 'lucide-react';
import { ConnectWallet } from './components/ConnectWallet';
import { CreateTaskForm } from './components/CreateTaskForm';
import { TaskList } from './components/TaskList';
import { requireConfig } from './config';
import { formatReward } from './soroban';
import type { WalletState, Task } from './types';

export default function App() {
  const [wallet, setWallet] = useState<WalletState>({ connected: false, publicKey: null });
  const [refreshKey, setRefreshKey] = useState(0);
  const [configError, setConfigError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);

  const handleConnect = useCallback((pk: string) => {
    try {
      requireConfig();
      setConfigError(null);
    } catch (e: any) {
      setConfigError(e.message);
    }
    setWallet({ connected: true, publicKey: pk });
  }, []);

  const handleDisconnect = useCallback(() => {
    setWallet({ connected: false, publicKey: null });
    setTasks([]);
  }, []);

  const handleTaskCreated = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const handleTasksUpdate = useCallback((updated: Task[]) => {
    setTasks(updated);
  }, []);

  const openCount = tasks.filter((t) => !t.completed && !t.assignee).length;
  const completedCount = tasks.filter((t) => t.completed).length;
  const rewardsLocked = tasks
    .filter((t) => !t.completed)
    .reduce((sum, t) => sum + t.reward, 0n);

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-brand">
          <h1><Target size={32} className="header-logo" /> Task Bounty</h1>
          <p className="header-tagline">Decentralized task marketplace on Stellar</p>
        </div>
        <ConnectWallet wallet={wallet} onConnect={handleConnect} onDisconnect={handleDisconnect} />
      </header>

      <main className="app-main">
        {configError && (
          <div className="error-message">
            <span>{configError}</span>
          </div>
        )}

        {wallet.connected && wallet.publicKey ? (
          <>
            <div className="stats-bar">
              <div className="stat-card">
                <span className="stat-label">Total Tasks</span>
                <span className="stat-value accent">{tasks.length}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Open</span>
                <span className="stat-value">{openCount}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Completed</span>
                <span className="stat-value success">{completedCount}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Rewards Locked</span>
                <span className="stat-value">{rewardsLocked > 0n ? formatReward(rewardsLocked) : '—'}</span>
              </div>
            </div>

            <div className="content-grid">
              <CreateTaskForm publicKey={wallet.publicKey} onCreated={handleTaskCreated} />
              <TaskList publicKey={wallet.publicKey} refreshKey={refreshKey} onTasksUpdate={handleTasksUpdate} />
            </div>
          </>
        ) : (
          <div className="app-welcome">
            <div className="welcome-card">
              <h2>Welcome to Task Bounty</h2>
              <p>
                Connect your Freighter wallet to start creating tasks with crypto rewards
                or complete existing tasks to earn tokens.
              </p>
            </div>
          </div>
        )}
      </main>

      <footer className="app-footer">
        <div className="footer-content">
          <span>Built on <a href="https://stellar.org" target="_blank" rel="noopener noreferrer">Stellar Soroban</a></span>
          <span className="footer-divider">·</span>
          <a href="https://github.com/your-org/task-bounty-dapp" target="_blank" rel="noopener noreferrer">GitHub</a>
          <span className="footer-divider">·</span>
          <span className="network-badge">Testnet</span>
        </div>
      </footer>
    </div>
  );
}
