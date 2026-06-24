import {
  rpc,
  xdr,
  Contract,
  nativeToScVal,
  scValToNative,
  TransactionBuilder,
  BASE_FEE,
  Address,
} from '@stellar/stellar-sdk';
import * as Freighter from '@stellar/freighter-api';
import { config, requireConfig } from './config';
import type { Task } from './types';

console.log('[soroban] Config loaded:', config.rpcUrl);

let server: rpc.Server;
function getServer(): rpc.Server {
  requireConfig();
  if (!server) {
    server = new rpc.Server(config.rpcUrl);
  }
  return server;
}

function taskboardContract(): Contract {
  return new Contract(config.taskboardContractId);
}

async function getAccount(pubKey: string) {
  return await getServer().getAccount(pubKey);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
//  Helpers
// ---------------------------------------------------------------------------

function parseTask(val: Record<string, any>): Task {
  const assignee = val.assignee;
  return {
    id: Number(val.id),
    creator: val.creator.toString(),
    description: val.description.toString(),
    reward: BigInt(val.reward),
    assignee: assignee ? assignee.toString() : null,
    completed: val.completed,
  };
}

function rewardToScVal(amountStr: string): bigint {
  const [whole = '0', frac = ''] = amountStr.split('.');
  const padded = frac.padEnd(7, '0').slice(0, 7);
  return BigInt(whole + padded);
}

export function formatReward(r: bigint): string {
  const s = r.toString().padStart(8, '0');
  const len = s.length;
  const intPart = s.slice(0, len - 7) || '0';
  const fracPart = s.slice(len - 7).replace(/0+$/, '');
  return fracPart ? `${intPart}.${fracPart}` : intPart;
}

export function toUserFriendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  console.error('[soroban] Raw error:', msg);

  if (msg.includes('UnreachableCodeReached') || msg.includes('VM call trapped')) {
    return 'This task has no funded reward and cannot be completed.';
  }
  if (msg.includes('txTooLate')) {
    return 'Transaction expired, please try again.';
  }
  if (msg.includes('HostError') || msg.includes('simulation failed') || msg.includes('Transaction rejected') || msg.includes('Transaction failed') || msg.includes('Transaction timeout')) {
    return 'Something went wrong. Please try again.';
  }
  return msg;
}

function dumpError(label: string, err: any): void {
  const props = Object.getOwnPropertyNames(err);
  const obj: Record<string, any> = {};
  for (const p of props) {
    try {
      obj[p] = err[p];
    } catch {
      obj[p] = '<unreadable>';
    }
  }
  console.error(`[soroban] ${label} – full error properties:`, JSON.stringify(obj, null, 2));
  console.error(`[soroban] ${label} – error.toString():`, err?.toString?.());
  console.error(`[soroban] ${label} – error.stack:`, err?.stack);
}

function decodeTxResultXdr(label: string, errorResultXdrB64: string): void {
  try {
    const txResult = xdr.TransactionResult.fromXDR(errorResultXdrB64, 'base64');
    const result = txResult.result();
    const switchName = result.switch().name;
    console.error(`[soroban] ${label} – TransactionResult switch:`, switchName);

    // Extract operation-level errors
    try {
      const opResults = result.results();
      if (opResults) {
        for (let i = 0; i < opResults.length; i++) {
          const opRes = opResults[i];
          const opResType = (opRes as any).result().switch().name;
          console.error(`[soroban] ${label} – op[${i}] type:`, opResType);
        }
      }
    } catch (e) {
      // results() may not exist for all switch variants
    }
  } catch (e) {
    console.error(`[soroban] ${label} – failed to decode errorResultXdr:`, e);
  }
}

// ---------------------------------------------------------------------------
//  Simulate a read-only call & return the native value
// ---------------------------------------------------------------------------

async function simulateCall<T>(
  pubKey: string,
  method: string,
  args: any[],
  contractId?: string,
): Promise<T> {
  const account = await getAccount(pubKey);
  const c = contractId ? new Contract(contractId) : taskboardContract();

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(c.call(method, ...args))
    .setTimeout(180)
    .build();

  const sim = await getServer().simulateTransaction(tx);

  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(sim.error);
  }

  if (!sim.result) {
    throw new Error('No simulation result');
  }

  return scValToNative(sim.result.retval) as T;
}

// ---------------------------------------------------------------------------
//  Build, sign & submit a write transaction
// ---------------------------------------------------------------------------

async function buildAndSubmit(
  pubKey: string,
  method: string,
  args: any[],
  contractId?: string,
): Promise<string> {
  let account;
  try {
    account = await getAccount(pubKey);
  } catch (err) {
    dumpError('getAccount failed', err);
    throw err;
  }

  const c = contractId ? new Contract(contractId) : taskboardContract();

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(c.call(method, ...args))
    .setTimeout(180)
    .build();

  let prepared;
  try {
    prepared = await getServer().prepareTransaction(tx);
  } catch (err) {
    dumpError('prepareTransaction failed', err);
    throw err;
  }

  let signedTxXdr: string;
  try {
    const preparedXdr = prepared.toXDR();
    const sig = await Freighter.signTransaction(preparedXdr, {
      networkPassphrase: config.networkPassphrase,
    });
    signedTxXdr = sig.signedTxXdr;
  } catch (err) {
    dumpError('Freighter signTransaction failed', err);
    throw err;
  }

  const signed = TransactionBuilder.fromXDR(signedTxXdr, config.networkPassphrase);

  let resp;
  try {
    resp = await getServer().sendTransaction(signed);
  } catch (err) {
    dumpError('sendTransaction threw', err);
    throw err;
  }

  if (resp.status === 'ERROR') {
    const r: any = resp;
    if (r.errorResult) {
      try {
        decodeTxResultXdr('sendTransaction.errorResult', r.errorResult.toXDR('base64'));
      } catch (e) {
        console.error('[soroban] errorResult.toXDR failed:', e);
      }
    }
    if (r.errorResultXdr) {
      decodeTxResultXdr('sendTransaction.rawErrorResultXdr', r.errorResultXdr);
    }
    throw new Error(`Transaction rejected by network: ${method}`);
  }

  // Poll for completion — use _getTransaction to bypass SDK's
  // parseTransactionInfo which crashes on Protocol 22 TransactionMeta v4 XDR.
  const txHash = resp.hash;
  for (let i = 0; i < 30; i++) {
    let poll: any;
    try {
      poll = await (getServer() as any)._getTransaction(txHash);
    } catch (err) {
      dumpError(`_getTransaction poll ${i} failed`, err);
      throw err;
    }

    if (poll.status === 'SUCCESS') {
      console.log(`[soroban] ${method} SUCCESS, hash: ${txHash}`);
      return txHash;
    }

    if (poll.status === 'FAILED') {
      if (poll.errorResultXdr) {
        decodeTxResultXdr('_getTransaction.errorResultXdr', poll.errorResultXdr);
      }
      throw new Error(`Transaction failed: ${txHash}`);
    }

    await sleep(2000);
  }

  throw new Error('Transaction timeout');
}

// ===========================================================================
//  Public API
// ===========================================================================

export async function getTask(pubKey: string, id: number): Promise<Task> {
  const val = await simulateCall<Record<string, any>>(pubKey, 'get_task', [
    nativeToScVal(id, { type: 'u32' }),
  ]);
  return parseTask(val);
}

export async function getAllTasks(pubKey: string, limit = 50): Promise<Task[]> {
  const tasks: Task[] = [];

  // Fetch account once, reuse for all simulations to avoid 50x parallel getAccount calls
  let account;
  try {
    account = await getAccount(pubKey);
  } catch (err) {
    console.error('[soroban] getAllTasks: getAccount failed:', err);
    throw err;
  }

  // Sequential fetching to avoid rate-limiting the Soroban RPC
  for (let id = 0; id < limit; id++) {
    try {
      const c = taskboardContract();
      const tx = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: config.networkPassphrase,
      })
        .addOperation(c.call('get_task', nativeToScVal(id, { type: 'u32' })))
        .setTimeout(180)
        .build();

      const sim = await getServer().simulateTransaction(tx);

      if (rpc.Api.isSimulationError(sim)) {
        console.log(`[soroban] get_task(${id}) simulation error:`, sim.error);
        continue; // task doesn't exist
      }
      if (!sim.result) {
        console.log(`[soroban] get_task(${id}) no result`);
        continue;
      }

      const val = scValToNative(sim.result.retval) as Record<string, any>;
      tasks.push(parseTask(val));
      console.log(`[soroban] get_task(${id}) OK:`, val.description?.toString()?.substring(0, 40));
    } catch (err: any) {
      console.log(`[soroban] get_task(${id}) threw:`, err?.message ?? err);
      // task doesn't exist or error – skip
    }
  }

  tasks.sort((a, b) => a.id - b.id);
  console.log(`[soroban] getAllTasks found ${tasks.length} tasks:`, tasks.map(t => t.id));
  return tasks;
}

/**
 * Creates a task on TaskBoard and deposits the reward into Escrow.
 * Returns the newly created task ID.
 */
export async function createTaskWithDeposit(
  pubKey: string,
  description: string,
  rewardAmount: string,
): Promise<number> {
  const reward = rewardToScVal(rewardAmount);

  let taskId: number;
  try {
    taskId = await simulateCall<number>(pubKey, 'create_task', [
      Address.fromString(pubKey).toScVal(),
      nativeToScVal(description),
      nativeToScVal(reward, { type: 'i128' }),
    ]);
  } catch (err) {
    dumpError('simulateCall/create_task failed', err);
    throw err;
  }

  try {
    await buildAndSubmit(pubKey, 'create_task', [
      Address.fromString(pubKey).toScVal(),
      nativeToScVal(description),
      nativeToScVal(reward, { type: 'i128' }),
    ]);
  } catch (err) {
    dumpError('buildAndSubmit/create_task failed', err);
    throw err;
  }

  try {
    await buildAndSubmit(
      pubKey,
      'deposit_reward',
      [
        Address.fromString(config.tokenContractId).toScVal(),
        Address.fromString(pubKey).toScVal(),
        nativeToScVal(taskId, { type: 'u32' }),
        nativeToScVal(reward, { type: 'i128' }),
      ],
      config.escrowContractId,
    );
  } catch (err) {
    dumpError('buildAndSubmit/deposit_reward failed', err);
    throw err;
  }

  return taskId;
}

export async function assignTask(pubKey: string, taskId: number): Promise<void> {
  await buildAndSubmit(pubKey, 'assign_task', [
    nativeToScVal(taskId, { type: 'u32' }),
    Address.fromString(pubKey).toScVal(),
  ]);
}

export async function completeTask(pubKey: string, taskId: number): Promise<void> {
  await buildAndSubmit(pubKey, 'complete_task', [
    nativeToScVal(taskId, { type: 'u32' }),
    Address.fromString(config.escrowContractId).toScVal(),
  ]);
}
