// NotaInvoiceManager (UUPS proxy) on Arc Testnet.
// Deployed 2026-08-12 via contracts/script/Deploy.s.sol.
// Proxy: 0x7a6645d96c6644c9c4c0601c9b0df05358559c1c
// Implementation: 0xcf8d51413726739076b6b1aa513413721c581694
// Explorer: https://testnet.arcscan.app/address/0x7a6645d96c6644c9c4c0601c9b0df05358559c1c

export const INVOICE_MANAGER_ADDRESS: string = "0x7a6645d96c6644c9c4c0601c9b0df05358559c1c";

// ─────────────────────────────────────────────────────────────────────────────
// NotaSplitBill - standalone split-bill contract on Arc Testnet.
// Deployed 2026-10-07 via Arc Studio.
// Address: 0x6b2fa0c987b9ffd9de996a9bca31a6de90bc7508
// Explorer: https://explorer.testnet.arc.io/address/0x6b2fa0c987b9ffd9de996a9bca31a6de90bc7508
// ─────────────────────────────────────────────────────────────────────────────

export const SPLIT_BILL_ADDRESS: string = "0x6b2fa0c987b9ffd9de996a9bca31a6de90bc7508";

// createSplit(uint256,address[],uint256[],uint256,bytes32)
export const SPLIT_CREATE_SIG = "0xd8e7eb3b";

// createEqualSplit(uint256,address[],uint256,bytes32)
export const SPLIT_CREATE_EQUAL_SIG = "0x7c9a9f4e";

// paySplit(uint256)
export const SPLIT_PAY_SIG = "0x83eb7428";

// expireSplit(uint256)
export const SPLIT_EXPIRE_SIG = "0x6aa3e9b0";

// splitCount() - view
export const SPLIT_COUNT_SIG_V2 = "0x26825056";

// getParticipantShare(uint256,address) - view
export const SPLIT_GET_SHARE_SIG = "0xb8d3bcb4";

// hasPaidShare(uint256,address) - view
export const SPLIT_HAS_PAID_SIG = "0x9e421ade";

// Minimal ABI (function signatures only - we encode calldata by hand).
// createAndPayInvoice(address,uint256,bytes32) - one-shot create + pay.
export const CREATE_AND_PAY_SIG = "0x2ebeb627";

// createSplit(uint256,address[],uint256[],bytes32)
export const CREATE_SPLIT_SIG = "0xa1b55153";

// paySplit(uint256)
export const PAY_SPLIT_SIG = "0x83eb7428";

// completeSplit(uint256)
export const COMPLETE_SPLIT_SIG = "0x475d6714";

// approve(address,uint256)
export const APPROVE_SIG = "0x095ea7b3";

// allowance(address,address)
export const ALLOWANCE_SIG = "0xdd62ed3e";

// splitCount() - view
export const SPLIT_COUNT_SIG = "0x26825056";

// ── ABI encoding helpers (dynamic arrays are length-prefixed, 32-byte head) ──

function pad32(hex: string): string {
  return hex.toLowerCase().replace("0x", "").padStart(64, "0");
}

function encodeAddress(addr: string): string {
  return pad32(addr);
}

function encodeUint256(value: bigint | number | string): string {
  const v = typeof value === "bigint" ? value : BigInt(value);
  return v.toString(16).padStart(64, "0");
}

function encodeBytes32(hex: string): string {
  return pad32(hex);
}

/** createSplit(uint256 totalAmount, address[] participants, uint256[] shares, bytes32 dataHash)
 *  @deprecated Points at the old NotaInvoiceManager. Use encodeSplitBillCreate for the new contract. */
export function encodeCreateSplit(
  totalAmountMicroUsdc: bigint | number,
  participants: string[],
  sharesMicroUsdc: (bigint | number)[],
  dataHash: string
): string {
  if (participants.length !== sharesMicroUsdc.length) {
    throw new Error("encodeCreateSplit: participants/shares length mismatch");
  }
  const n = participants.length;

  // ABI encoding (verified against viem encodeAbiParameters):
  // Head: [totalAmount, ptrParticipants, ptrShares, dataHash]
  //   ptrParticipants = 0x80 (128) = 4 head words
  //   ptrShares       = 0x80 + 32*(n+1)  (participants length word + n addresses)
  const ptrParticipants = 128;
  const ptrShares = 128 + 32 * (n + 1);

  const head =
    encodeUint256(totalAmountMicroUsdc) +
    encodeUint256(ptrParticipants) +
    encodeUint256(ptrShares) +
    encodeBytes32(dataHash);

  const participantsArr = encodeUint256(n) + participants.map(encodeAddress).join("");
  const sharesArr = encodeUint256(n) + sharesMicroUsdc.map(encodeUint256).join("");

  return CREATE_SPLIT_SIG + head + participantsArr + sharesArr;
}

// ─────────────────────────────────────────────────────────────────────────────
// NotaSplitBill ABI encoders
// createSplit(uint256 totalAmount, address[] participants, uint256[] shares, uint256 deadline, bytes32 dataHash)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Encode a call to NotaSplitBill.createSplit with custom per-participant shares and a deadline.
 * All amounts in micro-USDC (6 decimals). deadline is a Unix timestamp (seconds).
 */
export function encodeSplitBillCreate(
  totalAmountMicroUsdc: bigint | number,
  participants: string[],
  sharesMicroUsdc: (bigint | number)[],
  deadlineUnix: bigint | number,
  dataHash: string
): string {
  if (participants.length !== sharesMicroUsdc.length) {
    throw new Error("encodeSplitBillCreate: participants/shares length mismatch");
  }
  const n = participants.length;

  // ABI layout for (uint256, address[], uint256[], uint256, bytes32):
  // Slot 0: totalAmount       (static)
  // Slot 1: offset to participants array
  // Slot 2: offset to shares array
  // Slot 3: deadline          (static)
  // Slot 4: dataHash          (static)
  // Then: participants array (length + n words), shares array (length + n words)
  const WORD = 32;
  const HEAD_WORDS = 5; // 5 static head slots
  const headBytes = HEAD_WORDS * WORD; // 160

  const ptrParticipants = headBytes;                        // 160
  const ptrShares = headBytes + WORD * (1 + n);             // 160 + 32*(1+n)

  const head =
    encodeUint256(totalAmountMicroUsdc) +
    encodeUint256(ptrParticipants) +
    encodeUint256(ptrShares) +
    encodeUint256(deadlineUnix) +
    encodeBytes32(dataHash);

  const participantsArr = encodeUint256(n) + participants.map(encodeAddress).join("");
  const sharesArr = encodeUint256(n) + sharesMicroUsdc.map(encodeUint256).join("");

  return SPLIT_CREATE_SIG + head + participantsArr + sharesArr;
}

/**
 * Encode a call to NotaSplitBill.createEqualSplit.
 * totalAmount must be divisible by participants.length onchain.
 */
export function encodeSplitBillCreateEqual(
  totalAmountMicroUsdc: bigint | number,
  participants: string[],
  deadlineUnix: bigint | number,
  dataHash: string
): string {
  const n = participants.length;

  // ABI layout for (uint256, address[], uint256, bytes32):
  // Slot 0: totalAmount  (static)
  // Slot 1: offset to participants array
  // Slot 2: deadline     (static)
  // Slot 3: dataHash     (static)
  const HEAD_WORDS = 4;
  const WORD = 32;
  const ptrParticipants = HEAD_WORDS * WORD; // 128

  const head =
    encodeUint256(totalAmountMicroUsdc) +
    encodeUint256(ptrParticipants) +
    encodeUint256(deadlineUnix) +
    encodeBytes32(dataHash);

  const participantsArr = encodeUint256(n) + participants.map(encodeAddress).join("");

  return SPLIT_CREATE_EQUAL_SIG + head + participantsArr;
}

/** paySplit(uint256 splitId) - for NotaSplitBill */
export function encodeSplitBillPay(splitId: bigint | number): string {
  return SPLIT_PAY_SIG + encodeUint256(splitId);
}

/** expireSplit(uint256 splitId) - permissionless post-deadline cleanup */
export function encodeSplitBillExpire(splitId: bigint | number): string {
  return SPLIT_EXPIRE_SIG + encodeUint256(splitId);
}

/** getParticipantShare(uint256 splitId, address participant) - view query on-chain */
export function encodeGetParticipantShare(splitId: bigint | number, participant: string): string {
  return SPLIT_GET_SHARE_SIG + encodeUint256(splitId) + encodeAddress(participant);
}

/** hasPaidShare(uint256 splitId, address participant) - view query status on-chain */
export function encodeHasPaidShare(splitId: bigint | number, participant: string): string {
  return SPLIT_HAS_PAID_SIG + encodeUint256(splitId) + encodeAddress(participant);
}

/** paySplit(uint256 id) */
export function encodePaySplit(splitId: bigint | number): string {
  return PAY_SPLIT_SIG + encodeUint256(splitId);
}

/** completeSplit(uint256 id) */
export function encodeCompleteSplit(splitId: bigint | number): string {
  return COMPLETE_SPLIT_SIG + encodeUint256(splitId);
}

/** splitCount() - eth_call */
export const encodeSplitCount = SPLIT_COUNT_SIG;

export function encodeCreateAndPayInvoice(payee: string, amountMicroUsdc: bigint, dataHash: string): string {
  const paddedPayee = payee.toLowerCase().replace("0x", "").padStart(64, "0");
  const paddedAmount = amountMicroUsdc.toString(16).padStart(64, "0");
  const paddedHash = dataHash.toLowerCase().replace("0x", "").padStart(64, "0");
  return CREATE_AND_PAY_SIG + paddedPayee + paddedAmount + paddedHash;
}

export function encodeApprove(spender: string, amountMicroUsdc: bigint): string {
  const paddedSpender = spender.toLowerCase().replace("0x", "").padStart(64, "0");
  const paddedAmount = amountMicroUsdc.toString(16).padStart(64, "0");
  return APPROVE_SIG + paddedSpender + paddedAmount;
}

export function encodeAllowance(owner: string, spender: string): string {
  const paddedOwner = owner.toLowerCase().replace("0x", "").padStart(64, "0");
  const paddedSpender = spender.toLowerCase().replace("0x", "").padStart(64, "0");
  return ALLOWANCE_SIG + paddedOwner + paddedSpender;
}

// keccak256 via viem (browser-safe)
export async function keccak256Hex(input: string): Promise<`0x${string}`> {
  // dynamic import keeps this file dependency-light; viem is a direct dep
  const { keccak256, toBytes } = await import("viem");
  return keccak256(toBytes(input));
}
