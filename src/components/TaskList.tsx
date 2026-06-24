import { useState, useEffect, useCallback } from 'react';
import { ClipboardList, UserCheck, CheckCircle, CircleDot, User, CheckCheck } from 'lucide-react';
import { getAllTasks, assignTask, completeTask, formatReward } from '../soroban';
import type { Task } from '../types';
import { ErrorMessage } from './ErrorMessage';
import { LoadingSpinner } from './LoadingSpinner';

type Filter = 'all' | 'mine';

interface Props {
  publicKey: string;
  refreshKey: number;
  onTasksUpdate?: (tasks: Task[]) => void;
}

export function TaskList({ publicKey, refreshKey, onTasksUpdate }: Props) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState<Filter>('all');

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getAllTasks(publicKey);
      setTasks(result);
      onTasksUpdate?.(result);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [publicKey]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks, refreshKey]);

  const handleAssign = async (taskId: number) => {
    const key = `assign-${taskId}`;
    setError(null);
    setActionLoading((prev) => ({ ...prev, [key]: true }));
    try {
      await assignTask(publicKey, taskId);
      await fetchTasks();
    } catch (err: any) {
      setError(err.message ?? 'Failed to assign task');
    } finally {
      setActionLoading((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleComplete = async (taskId: number) => {
    const key = `complete-${taskId}`;
    setError(null);
    setActionLoading((prev) => ({ ...prev, [key]: true }));
    try {
      await completeTask(publicKey, taskId);
      await fetchTasks();
    } catch (err: any) {
      setError(err.message ?? 'Failed to complete task');
    } finally {
      setActionLoading((prev) => ({ ...prev, [key]: false }));
    }
  };

  const canAssign = (task: Task) => !task.completed && !task.assignee;
  const canComplete = (task: Task) =>
    !task.completed && task.assignee === publicKey;

  const filtered = filter === 'mine'
    ? tasks.filter((t) => t.creator === publicKey || t.assignee === publicKey)
    : tasks;

  const statusIcon = (task: Task) => {
    if (task.completed && task.assignee === publicKey) return <CheckCheck size={12} />;
    if (task.completed) return <CheckCircle size={12} />;
    if (task.assignee) return <CircleDot size={12} />;
    return <CircleDot size={12} />;
  };

  const statusLabel = (task: Task) => {
    if (task.completed && task.assignee === publicKey) return 'Reward Claimed';
    if (task.completed) return 'Done';
    if (task.assignee) return 'Assigned';
    return 'Open';
  };

  const statusClass = (task: Task) => {
    if (task.completed && task.assignee === publicKey) return 'status-claimed';
    if (task.completed) return 'status-done';
    if (task.assignee) return 'status-assigned';
    return 'status-open';
  };

  return (
    <div className="task-list">
      <div className="task-list-header">
        <h2>
          <ClipboardList size={18} />
          Tasks
        </h2>
        {!loading && <span className="task-count">{filtered.length} / {tasks.length} total</span>}
      </div>

      <div className="task-filters">
        <button
          className={`task-filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All
        </button>
        <button
          className={`task-filter-btn ${filter === 'mine' ? 'active' : ''}`}
          onClick={() => setFilter('mine')}
        >
          My Tasks
        </button>
      </div>

      {loading && <LoadingSpinner label="Loading tasks..." />}
      {error && <ErrorMessage message={error} onDismiss={() => setError(null)} />}

      {!loading && filtered.length === 0 && (
        <div className="empty-state">
          <ClipboardList size={48} className="empty-icon" />
          <h3>{filter === 'mine' ? 'No tasks for you yet' : 'No tasks yet'}</h3>
          <p>{filter === 'mine' ? 'Create a task or get assigned to see them here.' : 'Create your first task above to get started.'}</p>
        </div>
      )}

      <div className="task-grid">
        {filtered.map((task) => (
          <div key={task.id} className={`task-card ${task.completed ? 'completed' : ''}`}>
            <div className="task-header">
              <span className="task-id">#{task.id}</span>
              <span className={`task-status ${statusClass(task)}`}>
                {statusIcon(task)}
                {statusLabel(task)}
              </span>
            </div>

            <p className="task-desc">{task.description}</p>

            <div className="task-meta">
              <span className="meta-label">
                <CoinsIcon />
                Reward:
              </span>
              <span className="meta-value">{formatReward(task.reward)}</span>
              {task.completed && task.assignee === publicKey && (
                <span className="task-claimed-amount">+{formatReward(task.reward)} earned</span>
              )}
              {task.assignee && !task.completed && (
                <span className="task-assignee">
                  <User size={12} />
                  {task.assignee.slice(0, 4)}...{task.assignee.slice(-4)}
                </span>
              )}
            </div>

            <div className="task-actions">
              {canAssign(task) && (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => handleAssign(task.id)}
                  disabled={actionLoading[`assign-${task.id}`]}
                >
                  <UserCheck size={14} />
                  {actionLoading[`assign-${task.id}`] ? 'Assigning...' : 'Assign to me'}
                </button>
              )}
              {canComplete(task) && (
                <button
                  className="btn btn-success btn-sm"
                  onClick={() => handleComplete(task.id)}
                  disabled={actionLoading[`complete-${task.id}`]}
                >
                  <CheckCircle size={14} />
                  {actionLoading[`complete-${task.id}`] ? 'Completing...' : 'Mark Complete'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CoinsIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="8" cy="8" r="6" />
      <path d="M18.09 10.37A6 6 0 1 1 10.34 18" />
      <path d="M7 6h1v4" />
      <path d="M16.71 13.88c.7.54 1.12 1.35 1.12 2.26 0 1.58-1.36 2.86-3.04 2.86" />
    </svg>
  );
}
