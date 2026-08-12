// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract NotaInvoiceManager is Initializable, OwnableUpgradeable {
    IERC20 public usdc;

    struct Invoice {
        address payer;
        address payee;
        uint256 amount;
        bytes32 dataHash;
        bool paid;
    }

    struct SplitBill {
        address host;
        uint256 totalAmount;
        address[] participants;
        mapping(address => uint256) shares;
        mapping(address => bool) hasPaid;
        bytes32 dataHash;
        bool completed;
    }

    uint256 public invoiceCount;
    mapping(uint256 => Invoice) public invoices;

    uint256 public splitCount;
    mapping(uint256 => SplitBill) private splits;

    event InvoiceCreated(uint256 indexed id, address indexed payer, address indexed payee, uint256 amount, bytes32 dataHash);
    event InvoicePaid(uint256 indexed id, address indexed payer, uint256 amount);
    event SplitCreated(uint256 indexed id, address indexed host, uint256 totalAmount, bytes32 dataHash);
    event SplitMemberPaid(uint256 indexed id, address indexed participant, uint256 amount);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _usdc) external initializer {
        __Ownable_init(msg.sender);
        usdc = IERC20(_usdc);
    }

    function createInvoice(address _payer, uint256 _amount, bytes32 _dataHash) external returns (uint256) {
        uint256 id = ++invoiceCount;
        invoices[id] = Invoice({
            payer: _payer,
            payee: msg.sender,
            amount: _amount,
            dataHash: _dataHash,
            paid: false
        });

        emit InvoiceCreated(id, _payer, msg.sender, _amount, _dataHash);
        return id;
    }

    function payInvoice(uint256 _id) external {
        Invoice storage inv = invoices[_id];
        require(!inv.paid, "Already paid");
        require(inv.payer == msg.sender, "Not the payer");

        inv.paid = true;
        require(usdc.transferFrom(msg.sender, inv.payee, inv.amount), "Transfer failed");

        emit InvoicePaid(_id, msg.sender, inv.amount);
    }

    /// @notice One-shot: creates an invoice for _payee and pays it immediately.
    /// @dev Caller is the payer. Mirrors the Nota QR flow: scan -> pay.
    function createAndPayInvoice(address _payee, uint256 _amount, bytes32 _dataHash) external returns (uint256) {
        require(_payee != address(0), "Invalid payee");
        require(_amount > 0, "Amount must be > 0");

        uint256 id = ++invoiceCount;
        invoices[id] = Invoice({
            payer: msg.sender,
            payee: _payee,
            amount: _amount,
            dataHash: _dataHash,
            paid: true
        });

        emit InvoiceCreated(id, msg.sender, _payee, _amount, _dataHash);
        require(usdc.transferFrom(msg.sender, _payee, _amount), "Transfer failed");
        emit InvoicePaid(id, msg.sender, _amount);

        return id;
    }

    function createSplit(uint256 _totalAmount, address[] calldata _participants, uint256[] calldata _shares, bytes32 _dataHash) external returns (uint256) {
        require(_participants.length == _shares.length, "Mismatched arrays");

        uint256 id = ++splitCount;
        SplitBill storage s = splits[id];
        s.host = msg.sender;
        s.totalAmount = _totalAmount;
        s.participants = _participants;
        s.dataHash = _dataHash;

        for (uint256 i = 0; i < _participants.length; i++) {
            s.shares[_participants[i]] = _shares[i];
        }

        emit SplitCreated(id, msg.sender, _totalAmount, _dataHash);
        return id;
    }

    function paySplit(uint256 _id) external {
        SplitBill storage s = splits[_id];
        require(!s.completed, "Split completed");
        require(s.shares[msg.sender] > 0, "Not a participant");
        require(!s.hasPaid[msg.sender], "Already paid share");

        uint256 share = s.shares[msg.sender];
        s.hasPaid[msg.sender] = true;

        require(usdc.transferFrom(msg.sender, s.host, share), "Transfer failed");

        emit SplitMemberPaid(_id, msg.sender, share);
    }

    /// @notice Marks a split as completed. Only the host can call this.
    /// @dev Guards against paying into a completed split; the split is settled
    ///      after all participants have paid their shares.
    function completeSplit(uint256 _id) external {
        SplitBill storage s = splits[_id];
        require(msg.sender == s.host, "Not the host");
        require(!s.completed, "Already completed");

        s.completed = true;
    }
}