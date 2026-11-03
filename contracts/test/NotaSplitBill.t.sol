// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/NotaSplitBill.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import "@openzeppelin/contracts/mocks/token/ERC20ReturnFalseMock.sol";

// ---------------------------------------------------------------------------
// MockUSDC — standard ERC-20 that mints a large supply to the deployer
// ---------------------------------------------------------------------------
contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "mUSDC") {
        _mint(msg.sender, 1_000_000 * 1e6);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

// ---------------------------------------------------------------------------
// ReturnFalseUSDC — every transfer / transferFrom returns false
// ---------------------------------------------------------------------------
contract ReturnFalseUSDC is ERC20ReturnFalseMock {
    constructor() ERC20("Return-False USDC", "rfUSDC") {}

    // Give the test contract a way to seed balances (bypass the overridden transfer)
    function mintTo(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

// ---------------------------------------------------------------------------
// NotaSplitBillTest
// ---------------------------------------------------------------------------
contract NotaSplitBillTest is Test {
    // ── actors ──────────────────────────────────────────────────────────────
    address internal host    = makeAddr("host");
    address internal alice   = makeAddr("alice");
    address internal bob     = makeAddr("bob");
    address internal carol   = makeAddr("carol");
    address internal stranger = makeAddr("stranger");

    // ── contracts ───────────────────────────────────────────────────────────
    MockUSDC         internal usdc;
    ReturnFalseUSDC  internal rfUsdc;
    NotaSplitBill    internal bill;
    NotaSplitBill    internal rfBill; // wired to rfUsdc

    // ── constants ───────────────────────────────────────────────────────────
    uint256 internal constant INITIAL_BALANCE = 10_000 * 1e6; // 10 000 USDC (6 dec)
    bytes32 internal constant DATA_HASH       = keccak256("test-data");

    // ── setUp ────────────────────────────────────────────────────────────────
    function setUp() public {
        // Start time at a known value so deadlines are predictable
        vm.warp(1_000_000);

        usdc  = new MockUSDC();
        bill  = new NotaSplitBill(address(usdc));

        rfUsdc = new ReturnFalseUSDC();
        rfBill = new NotaSplitBill(address(rfUsdc));

        // Seed USDC balances
        usdc.mint(host,    INITIAL_BALANCE);
        usdc.mint(alice,   INITIAL_BALANCE);
        usdc.mint(bob,     INITIAL_BALANCE);
        usdc.mint(carol,   INITIAL_BALANCE);
        usdc.mint(stranger, INITIAL_BALANCE);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 1. CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════════

    function test_Constructor_SetsUSDC() public view {
        assertEq(address(bill.usdc()), address(usdc));
    }

    function test_Constructor_RevertsZeroAddress() public {
        vm.expectRevert(NotaSplitBill.ZeroAddress.selector);
        new NotaSplitBill(address(0));
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 2. createSplit — HAPPY PATH
    // ═══════════════════════════════════════════════════════════════════════

    function test_CreateSplit_HappyPath_TwoParticipants() public {
        address[] memory participants = new address[](2);
        participants[0] = alice;
        participants[1] = bob;

        uint256[] memory shares = new uint256[](2);
        shares[0] = 300 * 1e6;
        shares[1] = 700 * 1e6;

        uint256 deadline = block.timestamp + 1 days;
        uint256 total    = 1_000 * 1e6;

        vm.expectEmit(true, true, false, true, address(bill));
        emit NotaSplitBill.SplitCreated(1, host, total, deadline, DATA_HASH);

        vm.prank(host);
        uint256 splitId = bill.createSplit(total, participants, shares, deadline, DATA_HASH);

        assertEq(splitId, 1);
        assertEq(bill.splitCount(), 1);

        (address h, uint256 tot, uint256 dl, bytes32 dh, bool exp) = bill.getSplit(splitId);
        assertEq(h,   host);
        assertEq(tot, total);
        assertEq(dl,  deadline);
        assertEq(dh,  DATA_HASH);
        assertFalse(exp);
    }

    function test_CreateSplit_IncrementsSplitCount() public {
        _createDefaultSplit(host);
        _createDefaultSplit(host);
        assertEq(bill.splitCount(), 2);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 3. createSplit — REVERT PATHS
    // ═══════════════════════════════════════════════════════════════════════

    function test_CreateSplit_Reverts_EmptyParticipants() public {
        address[] memory empty = new address[](0);
        uint256[] memory emptyShares = new uint256[](0);

        vm.prank(host);
        vm.expectRevert(NotaSplitBill.EmptyParticipants.selector);
        bill.createSplit(0, empty, emptyShares, block.timestamp + 1 days, DATA_HASH);
    }

    function test_CreateSplit_Reverts_ArrayLengthMismatch() public {
        address[] memory participants = new address[](2);
        participants[0] = alice;
        participants[1] = bob;

        uint256[] memory shares = new uint256[](1);
        shares[0] = 500 * 1e6;

        vm.prank(host);
        vm.expectRevert(NotaSplitBill.ArrayLengthMismatch.selector);
        bill.createSplit(500 * 1e6, participants, shares, block.timestamp + 1 days, DATA_HASH);
    }

    function test_CreateSplit_Reverts_DeadlineInPast_Equal() public {
        address[] memory p = _twoParticipants();
        uint256[] memory s = _twoShares(500 * 1e6, 500 * 1e6);

        // deadline == block.timestamp should revert (not strictly in future)
        vm.prank(host);
        vm.expectRevert(NotaSplitBill.DeadlineInPast.selector);
        bill.createSplit(1_000 * 1e6, p, s, block.timestamp, DATA_HASH);
    }

    function test_CreateSplit_Reverts_DeadlineInPast_Strictly() public {
        address[] memory p = _twoParticipants();
        uint256[] memory s = _twoShares(500 * 1e6, 500 * 1e6);

        vm.prank(host);
        vm.expectRevert(NotaSplitBill.DeadlineInPast.selector);
        bill.createSplit(1_000 * 1e6, p, s, block.timestamp - 1, DATA_HASH);
    }

    function test_CreateSplit_Reverts_ZeroShare() public {
        address[] memory p = _twoParticipants();
        uint256[] memory s = new uint256[](2);
        s[0] = 0;
        s[1] = 1_000 * 1e6;

        vm.prank(host);
        vm.expectRevert(NotaSplitBill.ZeroShare.selector);
        bill.createSplit(1_000 * 1e6, p, s, block.timestamp + 1 days, DATA_HASH);
    }

    function test_CreateSplit_Reverts_ZeroAddressParticipant() public {
        address[] memory p = new address[](2);
        p[0] = address(0);
        p[1] = bob;

        uint256[] memory s = _twoShares(500 * 1e6, 500 * 1e6);

        vm.prank(host);
        vm.expectRevert(NotaSplitBill.ZeroAddress.selector);
        bill.createSplit(1_000 * 1e6, p, s, block.timestamp + 1 days, DATA_HASH);
    }

    function test_CreateSplit_Reverts_DuplicateParticipant() public {
        address[] memory p = new address[](2);
        p[0] = alice;
        p[1] = alice; // duplicate

        uint256[] memory s = _twoShares(500 * 1e6, 500 * 1e6);

        vm.prank(host);
        vm.expectRevert(NotaSplitBill.DuplicateParticipant.selector);
        bill.createSplit(1_000 * 1e6, p, s, block.timestamp + 1 days, DATA_HASH);
    }

    function test_CreateSplit_Reverts_ShareSumMismatch() public {
        address[] memory p = _twoParticipants();
        // shares sum to 900, totalAmount is 1000
        uint256[] memory s = _twoShares(400 * 1e6, 500 * 1e6);

        vm.prank(host);
        vm.expectRevert(NotaSplitBill.ShareSumMismatch.selector);
        bill.createSplit(1_000 * 1e6, p, s, block.timestamp + 1 days, DATA_HASH);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 4. createEqualSplit — HAPPY PATH
    // ═══════════════════════════════════════════════════════════════════════

    function test_CreateEqualSplit_HappyPath() public {
        address[] memory p = _twoParticipants();
        uint256 total    = 1_000 * 1e6;
        uint256 deadline = block.timestamp + 1 days;

        vm.expectEmit(true, true, false, true, address(bill));
        emit NotaSplitBill.SplitCreated(1, host, total, deadline, DATA_HASH);

        vm.prank(host);
        uint256 splitId = bill.createEqualSplit(total, p, deadline, DATA_HASH);

        assertEq(splitId, 1);

        // Each participant should have equal share
        assertEq(bill.getParticipantShare(splitId, alice), 500 * 1e6);
        assertEq(bill.getParticipantShare(splitId, bob),   500 * 1e6);
    }

    function test_CreateEqualSplit_ThreeParticipants() public {
        address[] memory p = new address[](3);
        p[0] = alice;
        p[1] = bob;
        p[2] = carol;

        uint256 total    = 300 * 1e6;
        uint256 deadline = block.timestamp + 1 days;

        vm.prank(host);
        uint256 splitId = bill.createEqualSplit(total, p, deadline, DATA_HASH);

        assertEq(bill.getParticipantShare(splitId, alice), 100 * 1e6);
        assertEq(bill.getParticipantShare(splitId, bob),   100 * 1e6);
        assertEq(bill.getParticipantShare(splitId, carol), 100 * 1e6);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 5. createEqualSplit — REVERT PATHS
    // ═══════════════════════════════════════════════════════════════════════

    function test_CreateEqualSplit_Reverts_EmptyParticipants() public {
        address[] memory empty = new address[](0);

        vm.prank(host);
        vm.expectRevert(NotaSplitBill.EmptyParticipants.selector);
        bill.createEqualSplit(1_000 * 1e6, empty, block.timestamp + 1 days, DATA_HASH);
    }

    function test_CreateEqualSplit_Reverts_DeadlineInPast() public {
        address[] memory p = _twoParticipants();

        vm.prank(host);
        vm.expectRevert(NotaSplitBill.DeadlineInPast.selector);
        bill.createEqualSplit(1_000 * 1e6, p, block.timestamp, DATA_HASH);
    }

    function test_CreateEqualSplit_Reverts_UnevenDivision() public {
        address[] memory p = _twoParticipants();
        // 1_000_000_001 is odd → remainder 1 when divided by 2
        vm.prank(host);
        vm.expectRevert(NotaSplitBill.UnevenDivision.selector);
        bill.createEqualSplit(1_000_000_001, p, block.timestamp + 1 days, DATA_HASH);
    }

    function test_CreateEqualSplit_Reverts_ZeroShare() public {
        address[] memory p = _twoParticipants();
        // totalAmount 0 / 2 == 0 share
        vm.prank(host);
        vm.expectRevert(NotaSplitBill.ZeroShare.selector);
        bill.createEqualSplit(0, p, block.timestamp + 1 days, DATA_HASH);
    }

    function test_CreateEqualSplit_Reverts_ZeroAddressParticipant() public {
        address[] memory p = new address[](2);
        p[0] = address(0);
        p[1] = bob;

        vm.prank(host);
        vm.expectRevert(NotaSplitBill.ZeroAddress.selector);
        bill.createEqualSplit(1_000 * 1e6, p, block.timestamp + 1 days, DATA_HASH);
    }

    function test_CreateEqualSplit_Reverts_DuplicateParticipant() public {
        address[] memory p = new address[](2);
        p[0] = alice;
        p[1] = alice;

        vm.prank(host);
        vm.expectRevert(NotaSplitBill.DuplicateParticipant.selector);
        bill.createEqualSplit(1_000 * 1e6, p, block.timestamp + 1 days, DATA_HASH);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 6. paySplit — HAPPY PATH (createSplit variant)
    // ═══════════════════════════════════════════════════════════════════════

    function test_PaySplit_HappyPath_AllParticipantsPay() public {
        // Shares: alice=300, bob=700, total=1000 USDC
        address[] memory p = _twoParticipants();
        uint256[] memory s = _twoShares(300 * 1e6, 700 * 1e6);
        uint256 deadline   = block.timestamp + 1 days;

        vm.prank(host);
        uint256 splitId = bill.createSplit(1_000 * 1e6, p, s, deadline, DATA_HASH);

        // Approve
        vm.prank(alice);
        usdc.approve(address(bill), 300 * 1e6);
        vm.prank(bob);
        usdc.approve(address(bill), 700 * 1e6);

        uint256 hostBefore = usdc.balanceOf(host);

        // Alice pays
        vm.expectEmit(true, true, false, true, address(bill));
        emit NotaSplitBill.SplitMemberPaid(splitId, alice, 300 * 1e6);
        vm.prank(alice);
        bill.paySplit(splitId);

        // Bob pays
        vm.expectEmit(true, true, false, true, address(bill));
        emit NotaSplitBill.SplitMemberPaid(splitId, bob, 700 * 1e6);
        vm.prank(bob);
        bill.paySplit(splitId);

        // Host received total
        assertEq(usdc.balanceOf(host), hostBefore + 1_000 * 1e6);

        // hasPaid flags
        assertTrue(bill.hasPaidShare(splitId, alice));
        assertTrue(bill.hasPaidShare(splitId, bob));

        // Participant balances decreased
        assertEq(usdc.balanceOf(alice), INITIAL_BALANCE - 300 * 1e6);
        assertEq(usdc.balanceOf(bob),   INITIAL_BALANCE - 700 * 1e6);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 7. paySplit — HAPPY PATH (createEqualSplit variant)
    // ═══════════════════════════════════════════════════════════════════════

    function test_PaySplit_EqualSplit_HappyPath() public {
        address[] memory p = _twoParticipants();
        uint256 total    = 1_000 * 1e6;
        uint256 deadline = block.timestamp + 1 days;

        vm.prank(host);
        uint256 splitId = bill.createEqualSplit(total, p, deadline, DATA_HASH);

        vm.prank(alice);
        usdc.approve(address(bill), 500 * 1e6);
        vm.prank(bob);
        usdc.approve(address(bill), 500 * 1e6);

        uint256 hostBefore = usdc.balanceOf(host);

        vm.prank(alice);
        bill.paySplit(splitId);
        vm.prank(bob);
        bill.paySplit(splitId);

        assertEq(usdc.balanceOf(host), hostBefore + total);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 8. paySplit — REVERT PATHS
    // ═══════════════════════════════════════════════════════════════════════

    function test_PaySplit_Reverts_SplitNotFound() public {
        vm.prank(alice);
        vm.expectRevert(NotaSplitBill.SplitNotFound.selector);
        bill.paySplit(999);
    }

    function test_PaySplit_Reverts_SplitExpired() public {
        uint256 splitId = _createDefaultSplit(host);
        // Expire it
        vm.warp(block.timestamp + 2 days + 1);
        bill.expireSplit(splitId);

        vm.prank(alice);
        vm.expectRevert(NotaSplitBill.SplitExpired.selector);
        bill.paySplit(splitId);
    }

    function test_PaySplit_Reverts_DeadlinePassed() public {
        uint256 splitId  = _createDefaultSplit(host);
        uint256 deadline = block.timestamp + 1 days;

        // Warp to exactly the deadline (>= deadline → revert)
        vm.warp(deadline);

        vm.prank(alice);
        vm.expectRevert(NotaSplitBill.DeadlinePassed.selector);
        bill.paySplit(splitId);
    }

    function test_PaySplit_Reverts_DeadlinePassed_AfterDeadline() public {
        uint256 splitId = _createDefaultSplit(host);
        uint256 deadline = block.timestamp + 1 days;

        vm.warp(deadline + 1);

        vm.prank(alice);
        vm.expectRevert(NotaSplitBill.DeadlinePassed.selector);
        bill.paySplit(splitId);
    }

    function test_PaySplit_Reverts_NotParticipant() public {
        uint256 splitId = _createDefaultSplit(host);

        vm.prank(stranger);
        vm.expectRevert(NotaSplitBill.NotParticipant.selector);
        bill.paySplit(splitId);
    }

    function test_PaySplit_Reverts_AlreadyPaid() public {
        uint256 splitId = _createDefaultSplit(host);

        vm.prank(alice);
        usdc.approve(address(bill), 500 * 1e6);
        vm.prank(alice);
        bill.paySplit(splitId);

        // Second call must revert
        vm.prank(alice);
        usdc.approve(address(bill), 500 * 1e6);
        vm.prank(alice);
        vm.expectRevert(NotaSplitBill.AlreadyPaid.selector);
        bill.paySplit(splitId);
    }

    function test_PaySplit_Reverts_TransferFailed_ReturnFalse() public {
        // Use rfBill which is wired to ReturnFalseUSDC
        address[] memory p = _twoParticipants();
        uint256[] memory s = _twoShares(500 * 1e6, 500 * 1e6);
        uint256 deadline   = block.timestamp + 1 days;

        vm.prank(host);
        uint256 splitId = rfBill.createSplit(1_000 * 1e6, p, s, deadline, DATA_HASH);

        // Seed alice in rfUsdc
        rfUsdc.mintTo(alice, 1_000 * 1e6);

        // approve returns false too, but we need hasPaid to not block us;
        // approve() also returns false from ERC20ReturnFalseMock — we call
        // approve on the underlying ERC20 directly via _approve hack isn't possible.
        // Instead, use vm.prank on alice and call ERC20.approve directly:
        // Because approve is also overridden to return false, we cannot grant a
        // real allowance through the public API.  We use vm.store to write the
        // allowance slot directly.
        //
        // OZ ERC20 _allowances is slot 1:
        //   mapping(address owner => mapping(address spender => uint256))
        //   slot = keccak256(abi.encode(spender, keccak256(abi.encode(owner, 1))))
        bytes32 outerKey = keccak256(abi.encode(alice, uint256(1)));
        bytes32 slot     = keccak256(abi.encode(address(rfBill), outerKey));
        vm.store(address(rfUsdc), slot, bytes32(uint256(500 * 1e6)));

        vm.prank(alice);
        vm.expectRevert("Transfer failed");
        rfBill.paySplit(splitId);
    }

    function test_PaySplit_Reverts_InsufficientAllowance() public {
        uint256 splitId = _createDefaultSplit(host);

        // Alice has balance but gives zero allowance
        // OZ ERC20 reverts with ERC20InsufficientAllowance
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                IERC20Errors.ERC20InsufficientAllowance.selector,
                address(bill), // spender
                0,             // current allowance
                500 * 1e6      // needed
            )
        );
        bill.paySplit(splitId);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 9. expireSplit — HAPPY PATH
    // ═══════════════════════════════════════════════════════════════════════

    function test_ExpireSplit_HappyPath_EmitsEvent() public {
        uint256 splitId  = _createDefaultSplit(host);
        uint256 deadline = block.timestamp + 1 days;

        // Must be strictly AFTER deadline (contract checks block.timestamp <= deadline)
        vm.warp(deadline + 1);

        vm.expectEmit(true, false, false, false, address(bill));
        emit NotaSplitBill.SplitBillExpired(splitId);

        bill.expireSplit(splitId);

        (, , , , bool exp) = bill.getSplit(splitId);
        assertTrue(exp);
    }

    function test_ExpireSplit_IsPermissionless() public {
        uint256 splitId  = _createDefaultSplit(host);
        uint256 deadline = block.timestamp + 1 days;
        vm.warp(deadline + 1);

        // stranger (not host, not participant) can expire
        vm.prank(stranger);
        bill.expireSplit(splitId);

        (, , , , bool exp) = bill.getSplit(splitId);
        assertTrue(exp);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 10. expireSplit — REVERT PATHS
    // ═══════════════════════════════════════════════════════════════════════

    function test_ExpireSplit_Reverts_SplitNotFound() public {
        vm.expectRevert(NotaSplitBill.SplitNotFound.selector);
        bill.expireSplit(999);
    }

    function test_ExpireSplit_Reverts_SplitAlreadyExpired() public {
        uint256 splitId  = _createDefaultSplit(host);
        uint256 deadline = block.timestamp + 1 days;
        vm.warp(deadline + 1);
        bill.expireSplit(splitId);

        vm.expectRevert(NotaSplitBill.SplitAlreadyExpired.selector);
        bill.expireSplit(splitId);
    }

    function test_ExpireSplit_Reverts_DeadlineNotPassed_AtDeadline() public {
        uint256 splitId  = _createDefaultSplit(host);
        uint256 deadline = block.timestamp + 1 days;

        // At exactly the deadline: block.timestamp == deadline → <= check reverts
        vm.warp(deadline);

        vm.expectRevert(NotaSplitBill.DeadlineNotPassed.selector);
        bill.expireSplit(splitId);
    }

    function test_ExpireSplit_Reverts_DeadlineNotPassed_BeforeDeadline() public {
        uint256 splitId = _createDefaultSplit(host);
        // Don't advance time — well before deadline
        vm.expectRevert(NotaSplitBill.DeadlineNotPassed.selector);
        bill.expireSplit(splitId);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 11. VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════

    function test_GetSplit_ReturnsCorrectData() public {
        address[] memory p = _twoParticipants();
        uint256[] memory s = _twoShares(400 * 1e6, 600 * 1e6);
        uint256 total    = 1_000 * 1e6;
        uint256 deadline = block.timestamp + 3 days;
        bytes32 dh       = keccak256("my-data");

        vm.prank(host);
        uint256 splitId = bill.createSplit(total, p, s, deadline, dh);

        (address h, uint256 tot, uint256 dl, bytes32 d, bool exp) = bill.getSplit(splitId);
        assertEq(h,   host);
        assertEq(tot, total);
        assertEq(dl,  deadline);
        assertEq(d,   dh);
        assertFalse(exp);
    }

    function test_GetSplit_Reverts_SplitNotFound() public {
        vm.expectRevert(NotaSplitBill.SplitNotFound.selector);
        bill.getSplit(42);
    }

    function test_GetSplitParticipants_ReturnsCorrectList() public {
        address[] memory p = _twoParticipants();
        uint256[] memory s = _twoShares(500 * 1e6, 500 * 1e6);

        vm.prank(host);
        uint256 splitId = bill.createSplit(1_000 * 1e6, p, s, block.timestamp + 1 days, DATA_HASH);

        address[] memory result = bill.getSplitParticipants(splitId);
        assertEq(result.length, 2);
        assertEq(result[0], alice);
        assertEq(result[1], bob);
    }

    function test_GetSplitParticipants_Reverts_SplitNotFound() public {
        vm.expectRevert(NotaSplitBill.SplitNotFound.selector);
        bill.getSplitParticipants(42);
    }

    function test_GetParticipantShare_ReturnsCorrectShare() public {
        address[] memory p = _twoParticipants();
        uint256[] memory s = _twoShares(300 * 1e6, 700 * 1e6);

        vm.prank(host);
        uint256 splitId = bill.createSplit(1_000 * 1e6, p, s, block.timestamp + 1 days, DATA_HASH);

        assertEq(bill.getParticipantShare(splitId, alice), 300 * 1e6);
        assertEq(bill.getParticipantShare(splitId, bob),   700 * 1e6);
        assertEq(bill.getParticipantShare(splitId, carol), 0); // non-participant → 0
    }

    function test_GetParticipantShare_Reverts_SplitNotFound() public {
        vm.expectRevert(NotaSplitBill.SplitNotFound.selector);
        bill.getParticipantShare(42, alice);
    }

    function test_HasPaidShare_InitiallyFalse() public {
        uint256 splitId = _createDefaultSplit(host);
        assertFalse(bill.hasPaidShare(splitId, alice));
        assertFalse(bill.hasPaidShare(splitId, bob));
    }

    function test_HasPaidShare_TrueAfterPayment() public {
        uint256 splitId = _createDefaultSplit(host);

        vm.prank(alice);
        usdc.approve(address(bill), 500 * 1e6);
        vm.prank(alice);
        bill.paySplit(splitId);

        assertTrue(bill.hasPaidShare(splitId, alice));
        assertFalse(bill.hasPaidShare(splitId, bob));
    }

    function test_HasPaidShare_Reverts_SplitNotFound() public {
        vm.expectRevert(NotaSplitBill.SplitNotFound.selector);
        bill.hasPaidShare(42, alice);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 12. FUZZ — createSplit with equal shares across 2 participants
    // ═══════════════════════════════════════════════════════════════════════

    function testFuzz_CreateSplit_TwoParticipantsEqualShares(uint128 halfShare) public {
        // halfShare > 0 so that each share is non-zero; total must not overflow
        halfShare = uint128(bound(uint256(halfShare), 1, type(uint64).max));

        uint256 share0 = uint256(halfShare);
        uint256 share1 = uint256(halfShare);
        uint256 total  = share0 + share1;

        address[] memory p = _twoParticipants();
        uint256[] memory s = _twoShares(share0, share1);
        uint256 deadline   = block.timestamp + 1 days;

        vm.prank(host);
        uint256 splitId = bill.createSplit(total, p, s, deadline, DATA_HASH);

        assertEq(bill.getParticipantShare(splitId, alice), share0);
        assertEq(bill.getParticipantShare(splitId, bob),   share1);
        (address h, uint256 tot, , , ) = bill.getSplit(splitId);
        assertEq(h,   host);
        assertEq(tot, total);
    }

    function testFuzz_CreateEqualSplit_RandomEvenTotal(uint64 perPerson) public {
        perPerson = uint64(bound(uint256(perPerson), 1, type(uint32).max));

        uint256 total    = uint256(perPerson) * 2;
        address[] memory p = _twoParticipants();
        uint256 deadline = block.timestamp + 1 days;

        vm.prank(host);
        uint256 splitId = bill.createEqualSplit(total, p, deadline, DATA_HASH);

        assertEq(bill.getParticipantShare(splitId, alice), perPerson);
        assertEq(bill.getParticipantShare(splitId, bob),   perPerson);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 13. FULL LIFECYCLE — create → partial pay → expire
    // ═══════════════════════════════════════════════════════════════════════

    function test_FullLifecycle_PartialPayThenExpire() public {
        address[] memory p = _twoParticipants();
        uint256[] memory s = _twoShares(400 * 1e6, 600 * 1e6);
        uint256 deadline   = block.timestamp + 1 days;

        vm.prank(host);
        uint256 splitId = bill.createSplit(1_000 * 1e6, p, s, deadline, DATA_HASH);

        // Only alice pays
        vm.prank(alice);
        usdc.approve(address(bill), 400 * 1e6);
        vm.prank(alice);
        bill.paySplit(splitId);

        // Warp past deadline
        vm.warp(deadline + 1);

        // bob is now blocked by DeadlinePassed (before expiry)
        vm.prank(bob);
        vm.expectRevert(NotaSplitBill.DeadlinePassed.selector);
        bill.paySplit(splitId);

        // Expire the split
        bill.expireSplit(splitId);

        // bob now gets SplitExpired
        vm.prank(bob);
        vm.expectRevert(NotaSplitBill.SplitExpired.selector);
        bill.paySplit(splitId);

        (, , , , bool exp) = bill.getSplit(splitId);
        assertTrue(exp);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // HELPERS
    // ═══════════════════════════════════════════════════════════════════════

    /// @dev Creates a default equal split: alice + bob, 500 each, 1 day deadline.
    function _createDefaultSplit(address caller) internal returns (uint256 splitId) {
        address[] memory p = _twoParticipants();
        uint256[] memory s = _twoShares(500 * 1e6, 500 * 1e6);
        uint256 deadline   = block.timestamp + 1 days;

        vm.prank(caller);
        splitId = bill.createSplit(1_000 * 1e6, p, s, deadline, DATA_HASH);
    }

    function _twoParticipants() internal view returns (address[] memory p) {
        p = new address[](2);
        p[0] = alice;
        p[1] = bob;
    }

    function _twoShares(uint256 a, uint256 b) internal pure returns (uint256[] memory s) {
        s = new uint256[](2);
        s[0] = a;
        s[1] = b;
    }
}
