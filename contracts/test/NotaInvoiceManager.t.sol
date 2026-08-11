// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/NotaInvoiceManager.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

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
    address public participant2 = address(4);

    function setUp() public {
        usdc = new MockUSDC();
        
        // Deploy implementation and proxy
        NotaInvoiceManager implementation = new NotaInvoiceManager();
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(implementation),
            abi.encodeCall(NotaInvoiceManager.initialize, (address(usdc)))
        );
        
        manager = NotaInvoiceManager(address(proxy));

        // Fund test accounts
        usdc.transfer(payer, 1000 * 10**18);
        usdc.transfer(participant2, 1000 * 10**18);
    }

    function testCreateAndPayInvoice() public {
        bytes32 dataHash = keccak256("invoice_metadata_123");
        uint256 amount = 50 * 10**18;

        // 1. Payee creates invoice targeting payer
        vm.prank(payee);
        uint256 invoiceId = manager.createInvoice(payer, amount, dataHash);

        assertEq(invoiceId, 1);
        
        (address p1, address p2, uint256 amt, bytes32 dh, bool paid) = manager.invoices(1);
        assertEq(p1, payer);
        assertEq(p2, payee);
        assertEq(amt, amount);
        assertEq(dh, dataHash);
        assertFalse(paid);

        // 2. Payer approves USDC to manager
        vm.startPrank(payer);
        usdc.approve(address(manager), amount);

        // 3. Payer pays the invoice
        manager.payInvoice(1);
        vm.stopPrank();

        // 4. Verify payment status & balances
        (, , , , bool paidAfter) = manager.invoices(1);
        assertTrue(paidAfter);
        assertEq(usdc.balanceOf(payee), amount);
    }

    function testCreateAndPaySplitBill() public {
        bytes32 dataHash = keccak256("split_metadata_456");
        uint256 totalAmount = 100 * 10**18;

        address[] memory participants = new address[](2);
        participants[0] = payer;
        participants[1] = participant2;

        uint256[] memory shares = new uint256[](2);
        shares[0] = 40 * 10**18;
        shares[1] = 60 * 10**18;

        // 1. Host (payee) creates split bill
        vm.prank(payee);
        uint256 splitId = manager.createSplit(totalAmount, participants, shares, dataHash);

        assertEq(splitId, 1);

        // 2. Participant 1 (payer) pays share
        vm.startPrank(payer);
        usdc.approve(address(manager), shares[0]);
        manager.paySplit(1);
        vm.stopPrank();

        // 3. Participant 2 pays share
        vm.startPrank(participant2);
        usdc.approve(address(manager), shares[1]);
        manager.paySplit(1);
        vm.stopPrank();

        // 4. Verify host received total shares
        assertEq(usdc.balanceOf(payee), shares[0] + shares[1]);
    }
}
