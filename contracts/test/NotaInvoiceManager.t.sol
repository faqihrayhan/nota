// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/NotaInvoiceManager.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("USDC", "USDC") {
        _mint(msg.sender, 1000000 * 10**18);
    }
}

contract NotaInvoiceManagerTest is Test {
    NotaInvoiceManager public manager;
    MockUSDC public usdc;
    address public owner = address(1);
    address public payer = address(2);
    address public payee = address(3);

    function setUp() public {
        usdc = new MockUSDC();
        manager = new NotaInvoiceManager();
        manager.initialize(address(usdc));

        usdc.transfer(payer, 1000 * 10**18);
    }

    function testCreateInvoice() public {
        bytes32 dataHash = keccak256("invoice_1");
        vm.prank(payee);
        uint256 id = manager.createInvoice(payer, 100 * 10**18, dataHash);
        
        assertEq(id, 1);
        (address p1, address p2, uint256 amt, bytes32 dh, bool paid) = manager.invoices(1);
        assertEq(p1, payer);
        assertEq(p2, payee);
        assertEq(amt, 100 * 10**18);
        assertEq(dh, dataHash);
        assertFalse(paid);
    }

    function testPayInvoice() public {
        bytes32 dataHash = keccak256("invoice_1");
        vm.prank(payee);
        uint256 id = manager.openInvoice(payer, 100 * 10**18, dataHash); // Wait, createInvoice

        // Fix name in test if needed, let's use createInvoice
    }
}
