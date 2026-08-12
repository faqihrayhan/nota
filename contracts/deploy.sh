#!/usr/bin/env bash
# Nota contracts — deploy + verify helper (Arc Testnet)
# Usage:
#   export PRIVATE_KEY=0x...
#   ./deploy.sh            # deploy + verify + print addresses
#   ./deploy.sh --dry-run  # simulation only
set -euo pipefail

RPC_URL="https://rpc.testnet.arc.io"
VERIFIER_URL="https://testnet.arcscan.app/api/"
CHAIN_ID=5042002
CONTRACT="src/NotaInvoiceManager.sol:NotaInvoiceManager"

if [[ -z "${PRIVATE_KEY:-}" ]]; then
  echo "❌ PRIVATE_KEY not set. Run: export PRIVATE_KEY=0x..."
  exit 1
fi

FORGE_ARGS=(script script/Deploy.s.sol:DeployNota --rpc-url "$RPC_URL")

if [[ "${1:-}" == "--dry-run" ]]; then
  echo "🧪 DRY RUN (simulation only)"
  PRIVATE_KEY="$PRIVATE_KEY" forge "${FORGE_ARGS[@]}"
  exit 0
fi

echo "🚀 Deploying NotaInvoiceManager to Arc Testnet..."
OUTPUT=$(PRIVATE_KEY="$PRIVATE_KEY" forge "${FORGE_ARGS[@]}" --broadcast)
echo "$OUTPUT" | tail -6

# Extract deployed addresses from broadcast JSON
BROADCAST_JSON=$(ls -t broadcast/Deploy.s.sol/$CHAIN_ID/run-latest.json)
PROXY=$(python3 -c "
import json
with open('$BROADCAST_JSON') as f: d = json.load(f)
txs = d.get('transactions', [])
for tx in txs:
    if tx.get('contractName') == 'ERC1967Proxy':
        print(tx['contractAddress'])
" 2>/dev/null || echo "")
IMPL=$(python3 -c "
import json
with open('$BROADCAST_JSON') as f: d = json.load(f)
txs = d.get('transactions', [])
for tx in txs:
    if tx.get('contractName') == 'NotaInvoiceManager' and tx.get('transactionType') == 'CREATE':
        print(tx['contractAddress'])
" 2>/dev/null || echo "")

if [[ -n "$PROXY" ]]; then
  echo ""
  echo "✅ PROXY (use this):      $PROXY"
  echo "✅ IMPLEMENTATION:        $IMPL"
  echo "   Explorer: https://testnet.arcscan.app/address/$PROXY"

  echo ""
  echo "🔍 Verifying implementation on ArcScan..."
  forge verify-contract "$IMPL" "$CONTRACT" \
    --chain-id "$CHAIN_ID" \
    --verifier blockscout \
    --verifier-url "$VERIFIER_URL" \
    --num-of-optimizations 200 || echo "⚠️ Verify failed (may already be verified)"
else
  echo "❌ Could not extract proxy address from broadcast. Check log above."
fi
