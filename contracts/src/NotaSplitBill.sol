// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract NotaSplitBill is ReentrancyGuard {
    error ZeroAddress();
    error EmptyParticipants();
    error ArrayLengthMismatch();
    error ShareSumMismatch();
    error DeadlineInPast();
    error ZeroShare();
    error UnevenDivision();
    error SplitNotFound();
    error SplitExpired();
    error DeadlinePassed();
    error DuplicateParticipant();
    error NotParticipant();
    error AlreadyPaid();
    error SplitAlreadyExpired();
    error DeadlineNotPassed();

    struct SplitBill {
        address host;
        uint256 totalAmount;
        uint256 deadline;
        bytes32 dataHash;
        bool expired;
        address[] participants;
        mapping(address => uint256) shares;
        mapping(address => bool) hasPaid;
    }

    IERC20 public immutable usdc;
    uint256 public splitCount;

    mapping(uint256 => SplitBill) private _splits;

    event SplitCreated(
        uint256 indexed splitId,
        address indexed host,
        uint256 totalAmount,
        uint256 deadline,
        bytes32 dataHash
    );
    event SplitMemberPaid(uint256 indexed splitId, address indexed participant, uint256 amount);
    event SplitBillExpired(uint256 indexed splitId);

    constructor(address _usdc) {
        if (_usdc == address(0)) revert ZeroAddress();
        usdc = IERC20(_usdc);
    }

    function createSplit(
        uint256 totalAmount,
        address[] calldata participants,
        uint256[] calldata shares,
        uint256 deadline,
        bytes32 dataHash
    ) external returns (uint256 splitId) {
        if (participants.length == 0) revert EmptyParticipants();
        if (participants.length != shares.length) revert ArrayLengthMismatch();
        if (deadline <= block.timestamp) revert DeadlineInPast();

        uint256[] memory shareList = new uint256[](participants.length);
        uint256 shareSum = 0;

        for (uint256 i = 0; i < participants.length; i++) {
            if (participants[i] == address(0)) revert ZeroAddress();
            if (shares[i] == 0) revert ZeroShare();

            for (uint256 j = 0; j < i; j++) {
                if (participants[j] == participants[i]) revert DuplicateParticipant();
            }

            shareList[i] = shares[i];
            shareSum += shares[i];
        }

        if (shareSum != totalAmount) revert ShareSumMismatch();

        splitId = _storeSplit(totalAmount, participants, shareList, deadline, dataHash);
    }

    function createEqualSplit(
        uint256 totalAmount,
        address[] calldata participants,
        uint256 deadline,
        bytes32 dataHash
    ) external returns (uint256 splitId) {
        if (participants.length == 0) revert EmptyParticipants();
        if (deadline <= block.timestamp) revert DeadlineInPast();
        if (totalAmount % participants.length != 0) revert UnevenDivision();

        uint256 equalShare = totalAmount / participants.length;
        if (equalShare == 0) revert ZeroShare();

        uint256[] memory shareList = new uint256[](participants.length);

        for (uint256 i = 0; i < participants.length; i++) {
            if (participants[i] == address(0)) revert ZeroAddress();

            for (uint256 j = 0; j < i; j++) {
                if (participants[j] == participants[i]) revert DuplicateParticipant();
            }

            shareList[i] = equalShare;
        }

        splitId = _storeSplit(totalAmount, participants, shareList, deadline, dataHash);
    }

    function paySplit(uint256 splitId) external nonReentrant {
        SplitBill storage split = _splits[splitId];

        if (split.host == address(0)) revert SplitNotFound();
        if (split.expired) revert SplitExpired();
        if (block.timestamp >= split.deadline) revert DeadlinePassed();

        uint256 share = split.shares[msg.sender];
        if (share == 0) revert NotParticipant();
        if (split.hasPaid[msg.sender]) revert AlreadyPaid();

        split.hasPaid[msg.sender] = true;

        require(usdc.transferFrom(msg.sender, split.host, share), "Transfer failed");

        emit SplitMemberPaid(splitId, msg.sender, share);
    }

    function expireSplit(uint256 splitId) external {
        SplitBill storage split = _splits[splitId];

        if (split.host == address(0)) revert SplitNotFound();
        if (split.expired) revert SplitAlreadyExpired();
        if (block.timestamp <= split.deadline) revert DeadlineNotPassed();

        split.expired = true;

        emit SplitBillExpired(splitId);
    }

    function getSplit(
        uint256 splitId
    ) external view returns (address host, uint256 totalAmount, uint256 deadline, bytes32 dataHash, bool expired) {
        SplitBill storage split = _splits[splitId];
        if (split.host == address(0)) revert SplitNotFound();

        return (split.host, split.totalAmount, split.deadline, split.dataHash, split.expired);
    }

    function getSplitParticipants(uint256 splitId) external view returns (address[] memory) {
        SplitBill storage split = _splits[splitId];
        if (split.host == address(0)) revert SplitNotFound();

        return split.participants;
    }

    function getParticipantShare(uint256 splitId, address participant) external view returns (uint256) {
        SplitBill storage split = _splits[splitId];
        if (split.host == address(0)) revert SplitNotFound();

        return split.shares[participant];
    }

    function hasPaidShare(uint256 splitId, address participant) external view returns (bool) {
        SplitBill storage split = _splits[splitId];
        if (split.host == address(0)) revert SplitNotFound();

        return split.hasPaid[participant];
    }

    function _storeSplit(
        uint256 totalAmount,
        address[] calldata participants,
        uint256[] memory shares,
        uint256 deadline,
        bytes32 dataHash
    ) private returns (uint256 splitId) {
        splitId = ++splitCount;
        SplitBill storage split = _splits[splitId];

        split.host = msg.sender;
        split.totalAmount = totalAmount;
        split.deadline = deadline;
        split.dataHash = dataHash;
        split.expired = false;
        split.participants = participants;

        for (uint256 i = 0; i < participants.length; i++) {
            split.shares[participants[i]] = shares[i];
            split.hasPaid[participants[i]] = false;
        }

        emit SplitCreated(splitId, msg.sender, totalAmount, deadline, dataHash);
    }
}
