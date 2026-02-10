// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {BuckshotGame} from "./BuckshotGame.sol";
import {PlayerProfile} from "./PlayerProfile.sol";

contract GameFactory {
    // ── Storage ─────────────────────────────────────────────────
    BuckshotGame public gameContract;
    PlayerProfile public profileContract;

    uint8 public constant MIN_PLAYERS = 2;
    uint8 public constant MAX_PLAYERS = 6;

    // Supported buy-in tiers (in wei)
    uint256[] public supportedBuyIns;
    mapping(uint256 => bool) public isValidBuyIn;

    // Queues: buyIn => array of queued players
    mapping(uint256 => address[]) internal queues;
    mapping(address => uint256) public playerQueueBuyIn;
    mapping(address => bool) public isInQueue;

    // Track active games
    uint256[] public activeGameIds;
    mapping(uint256 => bool) public isActiveGame;

    // ── Events ──────────────────────────────────────────────────
    event PlayerJoinedQueue(address indexed player, uint256 buyIn);
    event PlayerLeftQueue(address indexed player);
    event GameCreated(uint256 indexed gameId, address[] players, uint256 buyIn);
    event GameFinished(uint256 indexed gameId);

    // ── Errors ──────────────────────────────────────────────────
    error InvalidBuyIn();
    error AlreadyInQueue();
    error NotInQueue();
    error WrongPayment();
    error NotEnoughPlayers();
    error TooManyPlayers();
    error NoProfile();

    // ── Constructor ─────────────────────────────────────────────
    constructor(address _gameContract, address _profileContract) {
        gameContract = BuckshotGame(payable(_gameContract));
        profileContract = PlayerProfile(_profileContract);

        // Default buy-in tiers
        uint256[4] memory tiers = [uint256(0.00001 ether), 0.01 ether, 0.1 ether, 1 ether];
        for (uint256 i = 0; i < 4; i++) {
            supportedBuyIns.push(tiers[i]);
            isValidBuyIn[tiers[i]] = true;
        }
    }

    // ── Queue Management ────────────────────────────────────────

    function joinQueue(uint256 buyIn) external payable {
        if (!profileContract.hasProfile(msg.sender)) revert NoProfile();
        if (!isValidBuyIn[buyIn]) revert InvalidBuyIn();
        if (isInQueue[msg.sender]) revert AlreadyInQueue();
        if (msg.value != buyIn) revert WrongPayment();

        queues[buyIn].push(msg.sender);
        playerQueueBuyIn[msg.sender] = buyIn;
        isInQueue[msg.sender] = true;

        emit PlayerJoinedQueue(msg.sender, buyIn);
    }

    function leaveQueue() external {
        if (!isInQueue[msg.sender]) revert NotInQueue();

        uint256 buyIn = playerQueueBuyIn[msg.sender];
        _removeFromQueue(buyIn, msg.sender);

        isInQueue[msg.sender] = false;
        playerQueueBuyIn[msg.sender] = 0;

        // Refund buy-in
        (bool ok,) = msg.sender.call{value: buyIn}("");
        require(ok, "Refund failed");

        emit PlayerLeftQueue(msg.sender);
    }

    function startGame(uint256 buyIn, uint8 playerCount) external {
        if (!isValidBuyIn[buyIn]) revert InvalidBuyIn();
        if (playerCount < MIN_PLAYERS) revert NotEnoughPlayers();
        if (playerCount > MAX_PLAYERS) revert TooManyPlayers();

        address[] storage queue = queues[buyIn];
        if (queue.length < playerCount) revert NotEnoughPlayers();

        // Take the first N players from the queue
        address[] memory players = new address[](playerCount);
        uint256 totalBuyIn = 0;

        for (uint8 i = 0; i < playerCount; i++) {
            players[i] = queue[i];
            isInQueue[players[i]] = false;
            playerQueueBuyIn[players[i]] = 0;
            totalBuyIn += buyIn;
        }

        // Remove players from queue (shift remaining)
        uint256 remaining = queue.length - playerCount;
        for (uint256 i = 0; i < remaining; i++) {
            queue[i] = queue[i + playerCount];
        }
        for (uint8 i = 0; i < playerCount; i++) {
            queue.pop();
        }

        // Create game on BuckshotGame contract
        uint256 gameId = gameContract.createGame{value: totalBuyIn}(players, buyIn);

        activeGameIds.push(gameId);
        isActiveGame[gameId] = true;

        emit GameCreated(gameId, players, buyIn);
    }

    // ── View Functions ──────────────────────────────────────────

    function getQueueLength(uint256 buyIn) external view returns (uint256) {
        return queues[buyIn].length;
    }

    function getQueue(uint256 buyIn) external view returns (address[] memory) {
        return queues[buyIn];
    }

    function getActiveGames() external view returns (uint256[] memory) {
        return activeGameIds;
    }

    function getSupportedBuyIns() external view returns (uint256[] memory) {
        return supportedBuyIns;
    }

    // ── Internal ────────────────────────────────────────────────

    function _removeFromQueue(uint256 buyIn, address player) internal {
        address[] storage queue = queues[buyIn];
        for (uint256 i = 0; i < queue.length; i++) {
            if (queue[i] == player) {
                queue[i] = queue[queue.length - 1];
                queue.pop();
                return;
            }
        }
    }

    receive() external payable {}
}
