// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract PlayerProfile {
    // ── Structs ─────────────────────────────────────────────────
    struct Stats {
        uint32 gamesPlayed;
        uint32 gamesWon;
        uint32 kills;
        uint32 deaths;
        uint32 shotsFired;
        uint32 itemsUsed;
        uint256 totalEarnings;
    }

    // ── Storage ─────────────────────────────────────────────────
    address public owner;
    address public gameContract;

    mapping(address => bool) public hasProfile;
    mapping(address => string) public playerName;
    mapping(address => Stats) internal stats;

    // ── Events ──────────────────────────────────────────────────
    event ProfileCreated(address indexed player);
    event GameContractSet(address indexed gameContract);

    // ── Errors ──────────────────────────────────────────────────
    error AlreadyRegistered();
    error NotGameContract();
    error GameContractAlreadySet();

    // ── Modifiers ───────────────────────────────────────────────
    modifier onlyGame() {
        if (msg.sender != gameContract) revert NotGameContract();
        _;
    }

    // ── Constructor ─────────────────────────────────────────────
    constructor() {
        owner = msg.sender;
    }

    // ── Public Functions ────────────────────────────────────────

    function createProfile(string calldata _name) external {
        if (hasProfile[msg.sender]) revert AlreadyRegistered();
        hasProfile[msg.sender] = true;
        playerName[msg.sender] = _name;
        emit ProfileCreated(msg.sender);
    }

    function setGameContract(address _gameContract) external {
        if (gameContract != address(0)) revert GameContractAlreadySet();
        gameContract = _gameContract;
        emit GameContractSet(_gameContract);
    }

    // ── View Functions ──────────────────────────────────────────

    function getStats(address player) external view returns (Stats memory) {
        return stats[player];
    }

    function getName(address player) external view returns (string memory) {
        return playerName[player];
    }

    // ── Game-only Update Functions ──────────────────────────────

    function recordShotFired(address player) external onlyGame {
        stats[player].shotsFired++;
    }

    function recordItemUsed(address player) external onlyGame {
        stats[player].itemsUsed++;
    }

    function recordKill(address killer) external onlyGame {
        stats[killer].kills++;
    }

    function recordDeath(address victim) external onlyGame {
        stats[victim].deaths++;
    }

    function recordGameEnd(address[] calldata players, address winner, uint256 prize) external onlyGame {
        for (uint256 i = 0; i < players.length; i++) {
            stats[players[i]].gamesPlayed++;
        }
        stats[winner].gamesWon++;
        stats[winner].totalEarnings += prize;
    }
}
