# Task Bounty DApp

A decentralized task/bounty board on Stellar Soroban. Creators post tasks with token rewards; workers complete tasks and get paid automatically via an escrow contract.

## Architecture
Frontend (React) 
   -> TaskBoard contract (create/assign/complete tasks)
        -> Escrow contract (deposit_reward / release_reward)

TaskBoard calls Escrow.release_reward() cross-contract when a task is marked complete.

## Tech Stack
- Soroban (Rust smart contracts)
- Stellar SDK (JS)
- React + TypeScript
- Freighter Wallet

## Setup
\`\`\`bash
git clone <repo-url>
cd task-bounty-dapp
cargo test --manifest-path contracts/taskboard/Cargo.toml
cd frontend && npm install && npm run dev
\`\`\`

## Contracts (Testnet)
- TaskBoard: `<paste address>`
- Escrow: `<paste address>`
- Sample tx: `<paste tx hash>`

## Demo
Live: https://your-actual-url.netlify.app
Video:https://youtu.be/vaoKI5aoy4o

## Contracts (Testnet)
- TaskBoard: CABMAJSTYONKPTKCU4ZA5F57O54QBDUBY7NVZRECTJ33VL3RK6TNUWSV
- Escrow: CCZXKHRQC7CCC4IPBB4MYPZTGWIXBLHBPEBENBQ33V4FXPBACOSBFGIJ
- Sample tx: 38d061a6fcca07c56ac6d466557f2d9c48784778ef754085f480d0d9100685e5
