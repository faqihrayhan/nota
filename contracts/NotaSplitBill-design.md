# NotaSplitBill — Smart Contract Design Doc

**Status:** Draft  
**Authors:** Arc Studio  
**Target Chain:** Arc Testnet (EVM-compatible, Chain ID 5042002)  
**Language/Toolchain:** Solidity 0.8.20, Foundry + forge-std v1.9.1  
**Milestone:** v1.0 — Split Bill feature for Nota onchain payment app  

**Review tracker:**
- [ ] Design review
- [ ] Security review
- [ ] Ops review

---

## Action Items (living)

_Empty at first draft. Fill after each review round._

---

## Goals / Non-Goals

### Goals
- Allow a host to create a bill split with a fixed set of participant addresses and per-participant share amounts, or with an equal division (total ÷ count).
- Each participant pays their share directly to the host via USDC `transferFrom`.
- Enforce a host-set deadline; after expiry, unpaid participants' shares can no longer be collected and the split is considered expired.
- Prevent double-payment: each participant can pay at most once.
- Emit rich events for every state change so the Nota app and indexers can reconstruct full split history without any off-chain database.
- Store a `dataHash` (keccak256 of off-chain receipt JSON) for verifiable accounting.

### Non-Goals
- No escrow: funds are NOT held by the contract — they flow directly from participant to host.
- No cross-chain splits.
- No partial payments / installments per participant.
- No participant self-registration (host provides addresses at creation time).
- No on-chain dispute resolution.
- No fee collection by the contract.
- Not upgradeable (this contract is standalone and immutable; upgradeability lives in `NotaInvoiceManager`).

---

## Requirements

### Functional
1. `createSplit(totalAmount, participants[], shares[], deadline, dataHash)` — host creates a split; `sum(shares) == totalAmount` is enforced.
2. `createEqualSplit(totalAmount, participants[], deadline, dataHash)` — convenience: `totalAmount` must be divisible by `participants.length`; each share = `totalAmount / participants.length`.
3. `paySplit(splitId)` — participant pays own share; must be called before `deadline`.
4. `expireSplit(splitId)` — anyone may call after `deadline` to mark split expired (preventing stale splits from being paid into).
5. `getSplit(splitId)` — read-only view returning split metadata and arrays.
6. `getParticipantShare(splitId, participant)` and `hasPaid(splitId, participant)` — read-only helpers for the frontend.

### Security
- No path allows a non-participant to pay into a split.
- No path allows a participant to pay twice.
- No path allows payment after the deadline.
- No path allows a split to be created with `sum(shares) != totalAmount`.
- No path allows a split to be created with a deadline in the past.
- No path allows reentrancy to drain a host or re-enter `paySplit`.
- All external calls (USDC `transferFrom`) follow CEI (Checks-Effects-Interactions).
- Zero-address host and zero-address participants are rejected.
- Zero-amount shares are rejected (prevents phantom participants that never pay).

---

## Terminology & Actors

| Term | Definition |
|------|------------|
| Host | The wallet that creates and receives payment for the split |
| Participant | A wallet address assigned a share; must call `paySplit` |
| Share | The USDC amount (6 decimals, ERC-20 view) a specific participant owes |
| Deadline | Unix timestamp after which no new payments are accepted |
| Split | An on-chain record of a group bill; identified by a uint256 `splitId` |
| dataHash | keccak256 hash of the off-chain receipt JSON, anchored on-chain for verifiability |

### Actors Table

| Actor | On/Off-chain | Trust Level | What they can do |
|-------|-------------|-------------|-----------------|
| Host | On-chain (EOA) | Trusted for their own split | Create splits, receive payments |
| Participant | On-chain (EOA) | Semi-trusted | Pay own share only |
| Anyone | On-chain | Untrusted | Call `expireSplit` after deadline, read state |
| USDC contract | On-chain | Trusted (Arc native USDC) | Transfer tokens |

---

## Language / Runtime

- **Solidity 0.8.20** — built-in overflow checks, custom errors for gas efficiency.
- **EVM version:** Cancun (Arc Testnet supports Cancun).
- **Toolchain:** Foundry + forge-std v1.9.1.
- **OpenZeppelin Contracts v5.0.2** — `ReentrancyGuard` only; no proxy/upgrade pattern (contract is immutable).
- No Cancun-only opcodes (`mcopy`) used, so the contract is forward-compatible with Paris EVM targets too.

---

## Transaction & Execution Model

All state changes are atomic: either the entire call commits or reverts. No partial writes.

**Re-entry surface:** `paySplit` calls `usdc.transferFrom` (external call). CEI pattern applied:
1. **Checks** — deadline, participant existence, not-yet-paid.
2. **Effects** — `hasPaid[participant] = true` written BEFORE the external call.
3. **Interactions** — `transferFrom` called last.

`ReentrancyGuard.nonReentrant` added to `paySplit` as belt-and-suspenders.

---

## Chain Standards & Interfaces

- **ERC-20 (IERC20):** USDC is the only token interacted with. Arc native USDC address passed at construction.
- No ERC-721 / ERC-1155 / EIP-712 / Permit2 in scope.

---

## Architecture Overview

```mermaid
sequenceDiagram
    participant Host
    participant NotaSplitBill
    participant USDC
    participant Participant

    Host->>NotaSplitBill: createSplit(total, participants, shares, deadline, dataHash)
    NotaSplitBill-->>Host: splitId (event SplitCreated)

    Participant->>USDC: approve(NotaSplitBill, share)
    Participant->>NotaSplitBill: paySplit(splitId)
    NotaSplitBill->>USDC: transferFrom(Participant, Host, share)
    NotaSplitBill-->>Participant: event SplitMemberPaid

    Note over NotaSplitBill: After deadline (if not all paid)
    Anyone->>NotaSplitBill: expireSplit(splitId)
    NotaSplitBill-->>Anyone: event SplitExpired
```

### Flow of Funds

| Step | Who moves what | Invariant |
|------|---------------|-----------|
| `createSplit` | No funds move | `sum(shares) == totalAmount` |
| `paySplit` | Participant → Host via USDC `transferFrom` | `hasPaid[participant]` set before transfer |
| `expireSplit` | No funds move | Split marked expired; no future payments |
| **Resting state** | Contract holds **zero** USDC at all times | Direct transfer model — no custody |

---

## Contract Design

### Roles

| Role | Holder | Permissions | Why |
|------|--------|------------|-----|
| Host | Split creator | Receives payments | Created the bill |
| Participant | Assigned at creation | Pay own share | Owes a share |
| Anyone | — | Call `expireSplit` after deadline | Permissionless cleanup |
| Contract owner | None (immutable) | — | No owner needed; no upgrade path |

### Storage Layout

```solidity
// Top-level
address public immutable usdc;          // USDC ERC-20 address (set in constructor)
uint256 public splitCount;              // monotonically incrementing split ID

// Per split
mapping(uint256 => SplitBill) private _splits;

struct SplitBill {
    address host;               // slot 0
    uint256 totalAmount;        // slot 1
    uint256 deadline;           // slot 2 — unix timestamp
    bytes32 dataHash;           // slot 3
    bool    expired;            // slot 4 (packed)
    address[] participants;     // slot 5 (dynamic)
    mapping(address => uint256) shares;   // separate slot mapping
    mapping(address => bool)    hasPaid;  // separate slot mapping
}
```

No `__gap` or EIP-7201 namespace needed — contract is NOT upgradeable.

### Modifiers

| Modifier | Guard enforced |
|----------|---------------|
| `nonReentrant` (OZ) | Prevents re-entrant calls to `paySplit` |

### Functions — WRITE

#### `constructor(address _usdc)`
- **Caller:** Deployer
- **State:** Sets `usdc` immutable; reverts on zero address.
- **Events:** None.
- **Reverts:** `ZeroAddress()`

#### `createSplit(uint256 totalAmount, address[] calldata participants, uint256[] calldata shares, uint256 deadline, bytes32 dataHash) → uint256 splitId`
- **Caller:** Anyone (becomes host).
- **State:** Writes new `SplitBill`; increments `splitCount`.
- **Checks:** `participants.length > 0`, `participants.length == shares.length`, `sum(shares) == totalAmount`, `deadline > block.timestamp`, no zero-address participant, no zero share.
- **Events:** `SplitCreated(splitId, host, totalAmount, deadline, dataHash)`
- **Reverts:** `EmptyParticipants()`, `ArrayLengthMismatch()`, `ShareSumMismatch()`, `DeadlineInPast()`, `ZeroAddress()`, `ZeroShare()`

#### `createEqualSplit(uint256 totalAmount, address[] calldata participants, uint256 deadline, bytes32 dataHash) → uint256 splitId`
- **Caller:** Anyone (becomes host).
- **State:** Derives `share = totalAmount / participants.length`; delegates to the same storage path as `createSplit`.
- **Checks:** All of `createSplit`'s checks PLUS `totalAmount % participants.length == 0`.
- **Events:** `SplitCreated(splitId, host, totalAmount, deadline, dataHash)`
- **Reverts:** `UnevenDivision()`, plus all `createSplit` reverts.

#### `paySplit(uint256 splitId) nonReentrant`
- **Caller:** Participant only.
- **State:** `hasPaid[msg.sender] = true` (before transfer — CEI).
- **Checks:** Split exists, not expired, `block.timestamp <= deadline`, `shares[msg.sender] > 0`, `!hasPaid[msg.sender]`.
- **Interactions:** `usdc.transferFrom(msg.sender, split.host, share)`.
- **Events:** `SplitMemberPaid(splitId, participant, amount)`
- **Reverts:** `SplitNotFound()`, `SplitExpired()`, `DeadlinePassed()`, `NotParticipant()`, `AlreadyPaid()`, `"Transfer failed"` (if USDC returns false)

#### `expireSplit(uint256 splitId)`
- **Caller:** Anyone.
- **State:** Sets `split.expired = true`.
- **Checks:** Split exists, not already expired, `block.timestamp > split.deadline`.
- **Events:** `SplitExpired(splitId)`
- **Reverts:** `SplitNotFound()`, `SplitAlreadyExpired()`, `DeadlineNotPassed()`

### Functions — READ

| Function | Returns | Notes |
|----------|---------|-------|
| `getParticipantShare(uint256 splitId, address participant)` | `uint256` | Returns 0 if not a participant |
| `hasPaidShare(uint256 splitId, address participant)` | `bool` | |
| `getSplitParticipants(uint256 splitId)` | `address[]` | |
| `getSplit(uint256 splitId)` | `host, totalAmount, deadline, dataHash, expired` | Top-level fields only; use getters for mappings |

### Events

| Event | Params (indexed first) | When |
|-------|----------------------|------|
| `SplitCreated` | `id indexed, host indexed, totalAmount, deadline, dataHash` | New split created |
| `SplitMemberPaid` | `id indexed, participant indexed, amount` | Participant paid |
| `SplitExpired` | `id indexed` | Split manually expired |

---

## Deployment & Initialization

- **Pattern:** Plain constructor (no proxy, no `initialize`). `usdc` address is `immutable`.
- **Constructor arg:** Arc Testnet USDC ERC-20 address.
- **Init runbook:** Deploy → verify `usdc` is set correctly → call `createSplit` or `createEqualSplit` from a test wallet.
- **No owner at genesis.** Contract is permissionless for hosts/participants; no admin key.

---

## Upgradeability

**Not upgradeable.** Immutable by design. If a bug is found:
- Deploy a new `NotaSplitBill` at a new address.
- Update the Nota frontend to point at the new address.
- Existing splits on the old contract continue to function (they can still be paid or expired).

---

## Key Management & Signing

No off-chain signing required. All interactions are standard EVM transactions signed by the caller's EOA. No EIP-712 / Permit2 in scope.

---

## Security Considerations

| Vulnerability | Applicable? | Mitigation |
|---------------|-------------|-----------|
| Reentrancy | Yes — `paySplit` calls external `transferFrom` | CEI ordering: `hasPaid` written before `transferFrom`; `nonReentrant` on `paySplit` |
| Access control | Yes | Participant check (`shares[msg.sender] > 0`) and paid check before transfer; `expireSplit` is permissionless by design |
| Integer overflow/underflow | Solidity 0.8 checked | `sum(shares)` loop uses checked arithmetic; no `unchecked` blocks |
| Unchecked external call | Yes | `require(usdc.transferFrom(...), "Transfer failed")` — return value checked |
| Fee-on-transfer / rebasing tokens | Low risk (Arc USDC is standard) | Not guarded against; doc states only Arc USDC is supported |
| Signature replay | N/A — no off-chain signatures | — |
| Front-running / MEV | Low — no price-sensitive logic | Deadline is block-timestamp; 1-block tolerance acceptable |
| Flash-loan / price manipulation | N/A — no price oracle | — |
| Oracle manipulation | N/A | — |
| Denial of service | Low — participants array is bounded by host input | No unbounded loops in `paySplit`; `expireSplit` is O(1) |
| Delegatecall / proxy safety | N/A — not upgradeable | — |
| Timestamp dependence | Yes — deadline uses `block.timestamp` | 1-block (~1s on Arc) tolerance acceptable for a deadline; not used for randomness |
| Approval persistence | N/A — contract never holds approvals | Participants approve USDC to the contract per call |
| Centralization risk | Low — no admin key | Host can only receive; no privileged role that can drain funds |
| Zero-address host/participant | Yes | Explicit `ZeroAddress()` checks in `createSplit` |
| Zero-share participant | Yes | `ZeroShare()` check prevents ghost participants |
| Share sum mismatch | Yes | `require(sum == totalAmount)` enforced in `createSplit` |
| Uneven equal split | Yes | `require(totalAmount % count == 0)` in `createEqualSplit` |

---

## Trust Model & Threat Analysis

| Actor | Max damage if compromised | Mitigation | Detection |
|-------|--------------------------|-----------|-----------|
| Host key | Can receive all participant payments (intended) | Participants chose to trust the host | `SplitCreated` event on-chain |
| Participant key | Can pay their own share only | `hasPaid` prevents double-pay | `SplitMemberPaid` event |
| USDC contract | Total loss if malicious | Arc USDC is Circle-controlled; treat as trusted | N/A |
| No admin key | — | No admin = no single point of failure | — |

---

## Emergency Response & Circuit Breakers

- **No pause function** — contract is permissionless and has no admin.
- If a critical bug is found: deploy a new contract; front-end switches address; old splits remain payable until their deadline, after which they can be expired.
- **Token rescue:** Contract never holds USDC (direct transfer model), so no rescue function needed. If USDC is accidentally sent to the contract address directly, it is permanently lost (acceptable; not in scope).

---

## Failure Scenarios

| Scenario | Outcome | Safety |
|----------|---------|--------|
| `transferFrom` returns false | Reverts with "Transfer failed"; `hasPaid` remains false; participant can retry | Safe |
| Participant loses their key | Their share is never paid; split may expire with unpaid shares | Host is not compensated for that share — by design (no escrow) |
| Host loses their key | Payments still land at the host address; host just can't spend them | Safe for participants |
| Deadline passes with partial payment | Any unpaid shares are locked out; `expireSplit` called | Paid shares already delivered; unpaid shares never collected |
| Host tries to call `paySplit` | Reverts `NotParticipant()` unless host is also in the participants list | Correct |

---

## Priorities & Tradeoffs

| Decision | Tradeoff | Rationale |
|----------|---------|-----------|
| Direct transfer (no escrow) | Host gets paid immediately per participant; no atomicity guarantee for all shares | Simpler UX; matches current Nota payment model; escrow adds complexity and a separate claim step |
| Host provides addresses upfront | Host must know wallet addresses; can't use ENS names | Matches current Nota QR flow; self-join adds contract complexity and a two-phase UX |
| Immutable (no proxy) | Bug requires redeploy + frontend update | Simpler, smaller, and auditable; upgradeable pattern adds proxy complexity and a risk of storage collisions |
| `expireSplit` is permissionless | Anyone can expire a split after deadline | Prevents stale splits from being paid; host doesn't need to clean up; no griefing possible since it's post-deadline |
| Custom errors instead of `require(msg)` | Requires ABI to decode on the client | 30–50% gas cheaper per revert; frontend decodes from ABI |

**Rejected alternatives:**
- **Escrow model:** All shares deposited to contract, released to host atomically. Rejected: adds re-entry risk on withdrawal, requires a separate `claimFunds` step, and the UX comment is "who pays first if no one trusts each other?" For a social split-bill app, the host is implicitly trusted.
- **Self-join participants:** Participants call `joinSplit(id)` with their address and desired share. Rejected: the host loses control over share amounts; prone to griefing (anyone joins for 0 share).

---

## Testing Strategy

- **Unit tests (Foundry):** Happy path for `createSplit`, `createEqualSplit`, `paySplit`, `expireSplit`; all revert paths; fuzz on share amounts and participant counts; invariant: `sum(paid_shares) <= totalAmount`.
- **Static analysis:** Slither.
- **Coverage target:** 100% branch coverage on all WRITE functions.
- **Run all tests:** `cd contracts && forge test -v`

---

## Third-Party Libraries

| Library | Version | Already in project? | Why | Security-reviewed? |
|---------|---------|---------------------|-----|--------------------|
| OpenZeppelin Contracts | v5.0.2 | Yes | `ReentrancyGuard`, `IERC20` | Yes (OZ audit) |
| forge-std | v1.9.1 | Yes | Test harness | Yes |

---

## Monitoring & Alerting

| Event | Threshold | Severity | Action |
|-------|-----------|----------|--------|
| `SplitCreated` | Any | Info | Index in Nota DB |
| `SplitMemberPaid` | Any | Info | Update split status in Nota DB |
| `SplitExpired` | Any | Info | Mark split expired in Nota DB |
| Unexpected revert on `paySplit` | Any | Warning | Alert Nota team; check USDC balance / allowance |

---

## Cross-Functional Stakeholders

| Stakeholder | What they own |
|-------------|--------------|
| Nota frontend team | Integrate `createEqualSplit`, `paySplit`, `expireSplit`; decode custom errors from ABI |
| Security reviewer | Review CEI pattern, custom error completeness, timestamp tolerance |
| Ops | Monitor events; manage contract address in frontend config |
