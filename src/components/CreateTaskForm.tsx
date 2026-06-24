import { useState } from 'react';
import { PlusCircle, Coins } from 'lucide-react';
import { createTaskWithDeposit } from '../soroban';
import { ErrorMessage } from './ErrorMessage';
import { LoadingSpinner } from './LoadingSpinner';

interface Props {
  publicKey: string;
  onCreated: () => void;
}

export function CreateTaskForm({ publicKey, onCreated }: Props) {
  const [description, setDescription] = useState('');
  const [reward, setReward] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !reward.trim()) return;

    setError(null);
    setLoading(true);
    try {
      await createTaskWithDeposit(publicKey, description.trim(), reward.trim());
      setDescription('');
      setReward('');
      onCreated();
    } catch (err: any) {
      setError(err.message ?? 'Failed to create task');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="create-task-form" onSubmit={handleSubmit}>
      <h2>
        <PlusCircle size={18} />
        Create Task
      </h2>

      <label>
        Description
        <input
          type="text"
          placeholder="e.g. Design the landing page"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
        />
      </label>

      <label>
        <span>Reward (tokens)</span>
        <input
          type="text"
          placeholder="e.g. 1.5"
          value={reward}
          onChange={(e) => setReward(e.target.value)}
          required
        />
      </label>

      <button className="btn btn-primary" type="submit" disabled={loading || !description.trim() || !reward.trim()}>
        <Coins size={16} />
        {loading ? 'Creating...' : 'Create Task & Deposit Reward'}
      </button>

      {loading && <LoadingSpinner label="Submitting transactions..." />}
      {error && <ErrorMessage message={error} onDismiss={() => setError(null)} />}
    </form>
  );
}
