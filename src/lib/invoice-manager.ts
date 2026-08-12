// NotaInvoiceManager (UUPS proxy) on Arc Testnet.
// Deployed 2026-08-12 via contracts/script/Deploy.s.sol.
// Proxy: 0x7a6645d96c6644c9c4c0601c9b0df05358559c1c
// Implementation: 0xcf8d51413726739076b6b1aa513413721c581694
// Explorer: https://testnet.arcscan.app/address/0x7a6645d96c6644c9c4c0601c9b0df05358559c1c

export const INVOICE_MANAGER_ADDRESS: string = "0x7a6645d96c6644c9c4c0601c9b0df05358559c1c";

// Minimal ABI (function signatures only — we encode calldata by hand).
// createAndPayInvoice(address,uint256,bytes32) — one-shot create + pay.
export const CREATE_AND_PAY_SIG = "0x2ebeb627";

// approve(address,uint256)
export const APPROVE_SIG = "0x095ea7b3";

// allowance(address,address)
export const ALLOWANCE_SIG = "0xdd62ed3e";

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
