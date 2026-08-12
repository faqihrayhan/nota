// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/NotaInvoiceManager.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "@openzeppelin/contracts/mocks/token/ERC20ReturnFalseMock.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("USDC", "USDC") {
        _mint(msg.sender, 1000000 * 10**18);
    }
}

contract ReturnFalseUSDC is ERC20ReturnFalseMock {
    constructor() ERC20("USDC", "USDC") {}
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

    function testCreateAndPayInvoice_OneShot() public {
        bytes32 dataHash = keccak256("invoice_metadata_oneshot");
        uint256 amount = 25 * 10**18;

        // Payer approves, then pays in one transaction (creates invoice + pays)
        vm.startPrank(payer);
        usdc.approve(address(manager), amount);
        uint256 invoiceId = manager.createAndPayInvoice(payee, amount, dataHash);
        vm.stopPrank();

        assertEq(invoiceId, 1);
        (, , , bytes32 dh, bool paid) = manager.invoices(1);
        assertEq(dh, dataHash);
        assertTrue(paid);
        assertEq(usdc.balanceOf(payee), amount);
    }

    function testCreateAndPayInvoice_Reverts_NoPayee() public {
        vm.startPrank(payer);
        usdc.approve(address(manager), 10 * 10**18);
        vm.expectRevert("Invalid payee");
        manager.createAndPayInvoice(address(0), 10 * 10**18, bytes32(0));
        vm.stopPrank();
    }

    function testCreateAndPayInvoice_Reverts_ZeroAmount() public {
        vm.startPrank(payer);
        vm.expectRevert("Amount must be > 0");
        manager.createAndPayInvoice(payee, 0, bytes32(0));
        vm.stopPrank();
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

    // ── Revert paths / edge cases (branch coverage) ──────────────────

    function testPayInvoice_Reverts_AlreadyPaid() public {
        bytes32 dataHash = keccak256("already_paid");
        uint256 amount = 10 * 10**18;

        vm.prank(payee);
        manager.createInvoice(payer, amount, dataHash);

        vm.startPrank(payer);
        usdc.approve(address(manager), amount);
        manager.payInvoice(1);

        vm.expectRevert("Already paid");
        manager.payInvoice(1);
        vm.stopPrank();
    }

    function testPayInvoice_Reverts_NotPayer() public {
        vm.prank(payee);
        manager.createInvoice(payer, 10 * 10**18, keccak256("not_payer"));

        // participant2 is NOT the invoice payer
        vm.prank(participant2);
        vm.expectRevert("Not the payer");
        manager.payInvoice(1);
    }

    function testPayInvoice_TransferFails_NoAllowance() public {
        vm.prank(payee);
        manager.createInvoice(payer, 10 * 10**18, keccak256("no_allowance"));

        // Payer never approves → OZ v5 custom error: ERC20InsufficientAllowance(spender, allowance, needed)
        vm.prank(payer);
        vm.expectRevert(
            abi.encodeWithSelector(
                IERC20Errors.ERC20InsufficientAllowance.selector,
                address(manager),
                0,
                10 * 10**18
            )
        );
        manager.payInvoice(1);
    }

    function testCreateAndPayInvoice_TransferFails_NoAllowance() public {
        vm.startPrank(payer);
        vm.expectRevert(
            abi.encodeWithSelector(
                IERC20Errors.ERC20InsufficientAllowance.selector,
                address(manager),
                0,
                10 * 10**18
            )
        );
        manager.createAndPayInvoice(payee, 10 * 10**18, keccak256("oneshot_no_allowance"));
        vm.stopPrank();
    }

    function testCreateSplit_Reverts_MismatchedArrays() public {
        address[] memory participants = new address[](1);
        participants[0] = payer;

        uint256[] memory shares = new uint256[](2);
        shares[0] = 10 * 10**18;
        shares[1] = 20 * 10**18;

        vm.prank(payee);
        vm.expectRevert("Mismatched arrays");
        manager.createSplit(30 * 10**18, participants, shares, bytes32(0));
    }

    function testPaySplit_Reverts_NotParticipant() public {
        // Host creates a split but is not in the participant list → cannot pay own share
        address[] memory participants = new address[](2);
        participants[0] = payer;
        participants[1] = participant2;

        uint256[] memory shares = new uint256[](2);
        shares[0] = 40 * 10**18;
        shares[1] = 60 * 10**18;

        vm.prank(payee);
        manager.createSplit(100 * 10**18, participants, shares, keccak256("split_not_participant"));

        vm.prank(payee);
        vm.expectRevert("Not a participant");
        manager.paySplit(1);
    }

    function testPaySplit_Reverts_AlreadyPaidShare() public {
        address[] memory participants = new address[](2);
        participants[0] = payer;
        participants[1] = participant2;

        uint256[] memory shares = new uint256[](2);
        shares[0] = 40 * 10**18;
        shares[1] = 60 * 10**18;

        vm.prank(payee);
        manager.createSplit(100 * 10**18, participants, shares, keccak256("split_double_pay"));

        vm.startPrank(payer);
        usdc.approve(address(manager), shares[0]);
        manager.paySplit(1);

        vm.expectRevert("Already paid share");
        manager.paySplit(1);
        vm.stopPrank();
    }

    function testPaySplit_TransferFails_NoAllowance() public {
        address[] memory participants = new address[](1);
        participants[0] = payer;

        uint256[] memory shares = new uint256[](1);
        shares[0] = 10 * 10**18;

        vm.prank(payee);
        manager.createSplit(10 * 10**18, participants, shares, keccak256("split_no_allowance"));

        vm.prank(payer);
        vm.expectRevert(
            abi.encodeWithSelector(
                IERC20Errors.ERC20InsufficientAllowance.selector,
                address(manager),
                0,
                10 * 10**18
            )
        );
        manager.paySplit(1);
    }

    function testInitialize_Reverts_Reinitialization() public {
        // Proxy already initialized in setUp → second initialize must revert
        vm.expectRevert();
        manager.initialize(address(usdc));
    }

    // ── Transfer-failure paths (returnFalseUSDC covers require "Transfer failed") ──

    function deployWithReturnFalseUSDC() internal returns (NotaInvoiceManager mgr, ReturnFalseUSDC badUsdc) {
        ReturnFalseUSDC bad = new ReturnFalseUSDC();
        NotaInvoiceManager implementation = new NotaInvoiceManager();
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(implementation),
            abi.encodeCall(NotaInvoiceManager.initialize, (address(bad)))
        );
        return (NotaInvoiceManager(address(proxy)), bad);
    }

    function testPayInvoice_Reverts_TransferFailed() public {
        (NotaInvoiceManager mgr, ) = deployWithReturnFalseUSDC();

        vm.prank(payee);
        mgr.createInvoice(payer, 10 * 10**18, keccak256("tf_pay"));

        vm.prank(payer);
        vm.expectRevert("Transfer failed");
        mgr.payInvoice(1);
    }

    function testCreateAndPayInvoice_Reverts_TransferFailed() public {
        (NotaInvoiceManager mgr, ) = deployWithReturnFalseUSDC();

        vm.startPrank(payer);
        vm.expectRevert("Transfer failed");
        mgr.createAndPayInvoice(payee, 10 * 10**18, keccak256("tf_oneshot"));
        vm.stopPrank();
    }

    function testPaySplit_Reverts_TransferFailed() public {
        (NotaInvoiceManager mgr, ) = deployWithReturnFalseUSDC();

        address[] memory participants = new address[](1);
        participants[0] = payer;

        uint256[] memory shares = new uint256[](1);
        shares[0] = 10 * 10**18;

        vm.prank(payee);
        mgr.createSplit(10 * 10**18, participants, shares, keccak256("tf_split"));

        vm.prank(payer);
        vm.expectRevert("Transfer failed");
        mgr.paySplit(1);
    }

    // ── completeSplit (host-only) ────────────────────────────────────

    function testCompleteSplit_HappyPath() public {
        address[] memory participants = new address[](1);
        participants[0] = payer;

        uint256[] memory shares = new uint256[](1);
        shares[0] = 10 * 10**18;

        vm.prank(payee);
        manager.createSplit(10 * 10**18, participants, shares, keccak256("complete_happy"));

        vm.prank(payee); // host
        manager.completeSplit(1);
    }

    function testCompleteSplit_Reverts_NotHost() public {
        address[] memory participants = new address[](1);
        participants[0] = payer;

        uint256[] memory shares = new uint256[](1);
        shares[0] = 10 * 10**18;

        vm.prank(payee);
        manager.createSplit(10 * 10**18, participants, shares, keccak256("complete_not_host"));

        vm.prank(payer); // not host
        vm.expectRevert("Not the host");
        manager.completeSplit(1);
    }

    function testCompleteSplit_Reverts_AlreadyCompleted() public {
        address[] memory participants = new address[](1);
        participants[0] = payer;

        uint256[] memory shares = new uint256[](1);
        shares[0] = 10 * 10**18;

        vm.prank(payee);
        manager.createSplit(10 * 10**18, participants, shares, keccak256("complete_twice"));

        vm.startPrank(payee);
        manager.completeSplit(1);

        vm.expectRevert("Already completed");
        manager.completeSplit(1);
        vm.stopPrank();
    }

    function testPaySplit_Reverts_Completed() public {
        address[] memory participants = new address[](1);
        participants[0] = payer;

        uint256[] memory shares = new uint256[](1);
        shares[0] = 10 * 10**18;

        vm.prank(payee);
        manager.createSplit(10 * 10**18, participants, shares, keccak256("pay_after_complete"));

        vm.prank(payee);
        manager.completeSplit(1);

        vm.prank(payer);
        vm.expectRevert("Split completed");
        manager.paySplit(1);
    }
}
