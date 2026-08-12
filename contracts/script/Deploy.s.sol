// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {NotaInvoiceManager} from "../src/NotaInvoiceManager.sol";

/// @notice Deploy script for NotaInvoiceManager (UUPS) on Arc Testnet.
/// Usage (deploy + auto-verify):
///   export PRIVATE_KEY=0x...        # deployer key (from `cast wallet new`)
///   forge script script/Deploy.s.sol:DeployNota \
///     --rpc-url https://rpc.testnet.arc.io --broadcast \
///     --verify --verifier blockscout --verifier-url https://testnet.arcscan.app/api/
/// Post-deploy: copy the proxy address into src/lib/invoice-manager.ts (INVOICE_MANAGER_ADDRESS).
contract DeployNota is Script {
    // Arc Testnet USDC (ERC-20 interface over native USDC), 6 decimals.
    address constant USDC = 0x3600000000000000000000000000000000000000;

    function run() external returns (address proxyAddress, address implAddress) {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerKey);

        // 1. Deploy implementation
        NotaInvoiceManager impl = new NotaInvoiceManager();

        // 2. Deploy ERC-1967 proxy, initializing with USDC
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(impl),
            abi.encodeCall(NotaInvoiceManager.initialize, (USDC))
        );

        vm.stopBroadcast();

        proxyAddress = address(proxy);
        implAddress = address(impl);

        console2.log("NotaInvoiceManager implementation: ", implAddress);
        console2.log("NotaInvoiceManager proxy (use this): ", proxyAddress);
        console2.log("USDC: ", USDC);
    }
}
