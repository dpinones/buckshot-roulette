// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {PlayerProfile} from "./PlayerProfile.sol";

contract BuckshotGame {
    // ── Enums ───────────────────────────────────────────────────
    enum GamePhase {
        WAITING,
        ACTIVE,
        FINISHED
    }
    enum ItemType {
        NONE,
        MAGNIFYING_GLASS,
        BEER,
        HANDSAW,
        CIGARETTES
    }

    // ── Structs ─────────────────────────────────────────────────
    struct GameView {
        uint256 id;
        address[] players;
        uint8[] hpList;
        bool[] alive;
        uint8 currentRound;
        uint8 currentTurnIndex;
        uint8 shellsRemaining;
        uint8 liveRemaining;
        uint8 blankRemaining;
        uint256 turnDeadline;
        GamePhase phase;
        address winner;
        uint256 prizePool;
    }

    // ── Storage ─────────────────────────────────────────────────
    struct Game {
        uint256 id;
        address[] players;
        bool[] alive;
        uint8 aliveCount;
        uint8 currentRound;
        uint8 currentTurnIndex;
        uint8[] shells;
        uint8 shellIndex;
        uint256 turnDeadline;
        GamePhase phase;
        address winner;
        uint256 prizePool;
        uint256 buyIn;
    }

    PlayerProfile public profileContract;

    uint256 public nextGameId;
    uint256 public constant TURN_TIMEOUT = 60 seconds;
    uint256 private _nonce;

    mapping(uint256 => Game) internal games;
    mapping(uint256 => mapping(address => uint8)) public hp;
    mapping(uint256 => mapping(address => uint8[])) internal items;
    mapping(uint256 => mapping(address => bool)) public sawActive;
    mapping(uint256 => mapping(address => bool)) public currentShellKnown;
    mapping(uint256 => mapping(address => uint8)) public knownShellValue;

    uint256 public constant BETTING_WINDOW = 20 seconds;
    mapping(uint256 => uint256) public bettingDeadline;
    mapping(uint256 => mapping(address => uint8)) public deathOrder;
    mapping(uint256 => uint8) public deathCount;
    mapping(uint256 => mapping(address => uint8)) public gameKills;

    // ── Events ──────────────────────────────────────────────────
    event GameCreated(uint256 indexed gameId, address[] players, uint256 buyIn);
    event RoundStarted(uint256 indexed gameId, uint8 round);
    event ShellsLoaded(uint256 indexed gameId, uint8 liveCount, uint8 blankCount);
    event TurnStarted(uint256 indexed gameId, address indexed player, uint256 deadline);
    event ShotFired(
        uint256 indexed gameId, address indexed shooter, address indexed target, bool wasLive, uint8 damage
    );
    event ItemUsed(uint256 indexed gameId, address indexed player, uint8 itemType, bytes data);
    event ShellRevealed(uint256 indexed gameId, address indexed player, bool isLive);
    event ShellEjected(uint256 indexed gameId, bool wasLive);
    event PlayerEliminated(uint256 indexed gameId, address indexed player, uint8 placement);
    event RoundEnded(uint256 indexed gameId, uint8 round);
    event GameEnded(uint256 indexed gameId, address indexed winner, uint256 prize);
    event ItemsDistributed(uint256 indexed gameId, uint8 round);
    event GameActivated(uint256 indexed gameId);

    // ── Errors ──────────────────────────────────────────────────
    error NotYourTurn();
    error GameNotActive();
    error InvalidTarget();
    error TargetDead();
    error NoSuchItem();
    error TurnNotExpired();
    error GameAlreadyFinished();
    error InvalidPlayerCount();
    error BettingWindowActive();
    error GameNotWaiting();

    // ── Modifiers ───────────────────────────────────────────────
    modifier onlyCurrentTurn(uint256 gameId) {
        Game storage g = games[gameId];
        if (g.phase != GamePhase.ACTIVE) revert GameNotActive();
        if (g.players[g.currentTurnIndex] != msg.sender) revert NotYourTurn();
        _;
    }

    // ── Constructor ─────────────────────────────────────────────
    constructor(address _profileContract) {
        profileContract = PlayerProfile(_profileContract);
    }

    // ── Create Game (called by GameFactory) ─────────────────────
    function createGame(address[] calldata players, uint256 buyIn) external payable returns (uint256 gameId) {
        uint256 len = players.length;
        if (len < 2 || len > 6) revert InvalidPlayerCount();

        gameId = nextGameId++;
        Game storage g = games[gameId];
        g.id = gameId;
        g.prizePool = msg.value;
        g.buyIn = buyIn;
        g.aliveCount = uint8(len);

        for (uint256 i = 0; i < len; i++) {
            g.players.push(players[i]);
            g.alive.push(true);
            hp[gameId][players[i]] = 3;
        }

        g.phase = GamePhase.WAITING;
        g.currentRound = 1;

        bettingDeadline[gameId] = block.timestamp + BETTING_WINDOW;

        emit GameCreated(gameId, players, buyIn);

        return gameId;
    }

    // ── Activate Game (after betting window) ─────────────────────
    function activateGame(uint256 gameId) external {
        Game storage g = games[gameId];
        if (g.phase != GamePhase.WAITING) revert GameNotWaiting();
        if (block.timestamp < bettingDeadline[gameId]) revert BettingWindowActive();
        g.phase = GamePhase.ACTIVE;
        emit GameActivated(gameId);
        _distributeItems(gameId);
        _startRound(gameId);
    }

    // ── Player Actions ──────────────────────────────────────────

    function shootOpponent(uint256 gameId, address target) external onlyCurrentTurn(gameId) {
        _requireAlivePlayer(gameId, target);
        if (target == msg.sender) revert InvalidTarget();

        profileContract.recordShotFired(msg.sender);
        (bool wasLive, uint8 damage) = _fireShell(gameId, msg.sender);

        if (wasLive) {
            if (sawActive[gameId][msg.sender]) {
                damage = 2;
                sawActive[gameId][msg.sender] = false;
            }
            _applyDamage(gameId, msg.sender, target, damage);
        } else {
            sawActive[gameId][msg.sender] = false;
        }

        emit ShotFired(gameId, msg.sender, target, wasLive, wasLive ? damage : 0);
        _clearShellKnowledge(gameId, msg.sender);
        _afterShot(gameId, false);
    }

    function shootSelf(uint256 gameId) external onlyCurrentTurn(gameId) {
        profileContract.recordShotFired(msg.sender);
        (bool wasLive, uint8 damage) = _fireShell(gameId, msg.sender);

        if (wasLive) {
            if (sawActive[gameId][msg.sender]) {
                damage = 2;
                sawActive[gameId][msg.sender] = false;
            }
            _applyDamage(gameId, msg.sender, msg.sender, damage);
            emit ShotFired(gameId, msg.sender, msg.sender, true, damage);
            _clearShellKnowledge(gameId, msg.sender);
            _afterShot(gameId, false);
        } else {
            sawActive[gameId][msg.sender] = false;
            emit ShotFired(gameId, msg.sender, msg.sender, false, 0);
            _clearShellKnowledge(gameId, msg.sender);
            // Blank on self = extra turn
            _afterShot(gameId, true);
        }
    }

    function useItem(uint256 gameId, uint8 itemIndex) external onlyCurrentTurn(gameId) {
        uint8[] storage playerItems = items[gameId][msg.sender];
        if (itemIndex >= playerItems.length) revert NoSuchItem();

        uint8 itemType = playerItems[itemIndex];
        if (itemType == 0) revert NoSuchItem();

        profileContract.recordItemUsed(msg.sender);

        // Remove item (swap with last, pop)
        playerItems[itemIndex] = playerItems[playerItems.length - 1];
        playerItems.pop();

        Game storage g = games[gameId];

        if (itemType == uint8(ItemType.MAGNIFYING_GLASS)) {
            bool isLive = g.shells[g.shellIndex] == 1;
            currentShellKnown[gameId][msg.sender] = true;
            knownShellValue[gameId][msg.sender] = isLive ? 1 : 0;
            emit ShellRevealed(gameId, msg.sender, isLive);
            emit ItemUsed(gameId, msg.sender, itemType, abi.encode(isLive));
        } else if (itemType == uint8(ItemType.BEER)) {
            bool wasLive = g.shells[g.shellIndex] == 1;
            g.shellIndex++;
            emit ShellEjected(gameId, wasLive);
            emit ItemUsed(gameId, msg.sender, itemType, abi.encode(wasLive));
            // If shells depleted after ejecting, reload
            if (g.shellIndex >= g.shells.length) {
                _loadShells(gameId);
            }
        } else if (itemType == uint8(ItemType.HANDSAW)) {
            sawActive[gameId][msg.sender] = true;
            emit ItemUsed(gameId, msg.sender, itemType, "");
        } else if (itemType == uint8(ItemType.CIGARETTES)) {
            uint8 curHp = hp[gameId][msg.sender];
            if (curHp < 3) {
                hp[gameId][msg.sender] = curHp + 1;
            }
            emit ItemUsed(gameId, msg.sender, itemType, abi.encode(hp[gameId][msg.sender]));
        }

        // Using an item does NOT end the turn — player still must shoot
        // Reset turn deadline
        g.turnDeadline = block.timestamp + TURN_TIMEOUT;
    }

    function forceTimeout(uint256 gameId) external {
        Game storage g = games[gameId];
        if (g.phase != GamePhase.ACTIVE) revert GameNotActive();
        if (block.timestamp < g.turnDeadline) revert TurnNotExpired();

        address timedOut = g.players[g.currentTurnIndex];

        profileContract.recordShotFired(timedOut);
        // Default action: shoot self (penalty)
        (bool wasLive, uint8 damage) = _fireShell(gameId, timedOut);
        if (wasLive) {
            _applyDamage(gameId, timedOut, timedOut, damage);
        }

        emit ShotFired(gameId, timedOut, timedOut, wasLive, wasLive ? damage : 0);
        _clearShellKnowledge(gameId, timedOut);
        _afterShot(gameId, false);
    }

    // ── View Functions ──────────────────────────────────────────

    function getGameState(uint256 gameId) external view returns (GameView memory) {
        Game storage g = games[gameId];
        uint256 len = g.players.length;
        uint8[] memory hpList = new uint8[](len);
        for (uint256 i = 0; i < len; i++) {
            hpList[i] = hp[gameId][g.players[i]];
        }

        uint8 liveRem;
        uint8 blankRem;
        for (uint256 i = g.shellIndex; i < g.shells.length; i++) {
            if (g.shells[i] == 1) liveRem++;
            else blankRem++;
        }

        return GameView({
            id: g.id,
            players: g.players,
            hpList: hpList,
            alive: g.alive,
            currentRound: g.currentRound,
            currentTurnIndex: g.currentTurnIndex,
            shellsRemaining: uint8(g.shells.length) - g.shellIndex,
            liveRemaining: liveRem,
            blankRemaining: blankRem,
            turnDeadline: g.turnDeadline,
            phase: g.phase,
            winner: g.winner,
            prizePool: g.prizePool
        });
    }

    function getCurrentTurn(uint256 gameId) external view returns (address) {
        Game storage g = games[gameId];
        if (g.phase != GamePhase.ACTIVE) return address(0);
        return g.players[g.currentTurnIndex];
    }

    function getMyItems(uint256 gameId, address player) external view returns (uint8[] memory) {
        return items[gameId][player];
    }

    function getVisibleShells(uint256 gameId) external view returns (uint8 liveRem, uint8 blankRem) {
        Game storage g = games[gameId];
        for (uint256 i = g.shellIndex; i < g.shells.length; i++) {
            if (g.shells[i] == 1) liveRem++;
            else blankRem++;
        }
    }

    function getPlayers(uint256 gameId) external view returns (address[] memory) {
        return games[gameId].players;
    }

    function getPhase(uint256 gameId) external view returns (GamePhase) {
        return games[gameId].phase;
    }

    // ── Internal Logic ──────────────────────────────────────────

    function _startRound(uint256 gameId) internal {
        Game storage g = games[gameId];
        emit RoundStarted(gameId, g.currentRound);
        _loadShells(gameId);
        _startNextTurn(gameId);
    }

    function _loadShells(uint256 gameId) internal {
        Game storage g = games[gameId];
        uint8 totalShells = 6;
        uint8 liveCount = _random(1, totalShells - 1); // At least 1 live, 1 blank
        uint8 blankCount = totalShells - liveCount;

        // Build and shuffle
        delete g.shells;
        for (uint8 i = 0; i < liveCount; i++) {
            g.shells.push(1);
        }
        for (uint8 i = 0; i < blankCount; i++) {
            g.shells.push(0);
        }

        // Fisher-Yates shuffle
        for (uint256 i = g.shells.length - 1; i > 0; i--) {
            uint256 j = uint256(_random(0, uint8(i)));
            (g.shells[i], g.shells[j]) = (g.shells[j], g.shells[i]);
        }

        g.shellIndex = 0;
        emit ShellsLoaded(gameId, liveCount, blankCount);
    }

    function _distributeItems(uint256 gameId) internal {
        Game storage g = games[gameId];
        for (uint256 i = 0; i < g.players.length; i++) {
            if (!g.alive[i]) continue;
            address player = g.players[i];
            for (uint8 j = 0; j < 2; j++) {
                uint8 randomItem = _random(1, 4); // ItemType 1-4
                items[gameId][player].push(randomItem);
            }
        }
        emit ItemsDistributed(gameId, g.currentRound);
    }

    function _fireShell(uint256 gameId, address) internal returns (bool wasLive, uint8 damage) {
        Game storage g = games[gameId];
        wasLive = g.shells[g.shellIndex] == 1;
        damage = wasLive ? 1 : 0;
        g.shellIndex++;
        return (wasLive, damage);
    }

    function _applyDamage(uint256 gameId, address shooter, address target, uint8 damage) internal {
        uint8 curHp = hp[gameId][target];
        if (damage >= curHp) {
            hp[gameId][target] = 0;
            _eliminatePlayer(gameId, shooter, target);
        } else {
            hp[gameId][target] = curHp - damage;
        }
    }

    function _eliminatePlayer(uint256 gameId, address killer, address victim) internal {
        Game storage g = games[gameId];
        for (uint256 i = 0; i < g.players.length; i++) {
            if (g.players[i] == victim && g.alive[i]) {
                g.alive[i] = false;
                g.aliveCount--;
                emit PlayerEliminated(gameId, victim, g.aliveCount + 1);

                deathCount[gameId]++;
                deathOrder[gameId][victim] = deathCount[gameId];
                gameKills[gameId][killer]++;

                profileContract.recordKill(killer);
                profileContract.recordDeath(victim);

                // Clear items
                delete items[gameId][victim];
                sawActive[gameId][victim] = false;

                break;
            }
        }
    }

    function _afterShot(uint256 gameId, bool extraTurn) internal {
        Game storage g = games[gameId];

        // Check win condition
        if (g.aliveCount <= 1) {
            _endGame(gameId);
            return;
        }

        // Check if shells are depleted → check round transition
        if (g.shellIndex >= g.shells.length) {
            // Check if all alive players have 0 HP in current round context
            // Actually just reload shells; round ends when one player eliminated or
            // we can move to next round after shells deplete
            _checkRoundTransition(gameId);
            return;
        }

        if (extraTurn) {
            // Same player goes again, just reset deadline
            g.turnDeadline = block.timestamp + TURN_TIMEOUT;
            emit TurnStarted(gameId, g.players[g.currentTurnIndex], g.turnDeadline);
        } else {
            _advanceTurn(gameId);
        }
    }

    function _checkRoundTransition(uint256 gameId) internal {
        Game storage g = games[gameId];
        emit RoundEnded(gameId, g.currentRound);
        g.currentRound++;
        _startRound(gameId);
    }

    function _advanceTurn(uint256 gameId) internal {
        Game storage g = games[gameId];
        uint8 nextIdx = _findNextAliveIndex(gameId, g.currentTurnIndex);
        g.currentTurnIndex = nextIdx;
        _startNextTurn(gameId);
    }

    function _startNextTurn(uint256 gameId) internal {
        Game storage g = games[gameId];
        g.turnDeadline = block.timestamp + TURN_TIMEOUT;
        emit TurnStarted(gameId, g.players[g.currentTurnIndex], g.turnDeadline);
    }

    function _endGame(uint256 gameId) internal {
        Game storage g = games[gameId];
        g.phase = GamePhase.FINISHED;

        // Find winner
        for (uint256 i = 0; i < g.players.length; i++) {
            if (g.alive[i]) {
                g.winner = g.players[i];
                break;
            }
        }

        uint256 prize = g.prizePool;
        g.prizePool = 0;

        profileContract.recordGameEnd(g.players, g.winner, prize);

        emit GameEnded(gameId, g.winner, prize);

        // Transfer prize to winner
        if (prize > 0 && g.winner != address(0)) {
            (bool ok,) = g.winner.call{value: prize}("");
            require(ok, "Transfer failed");
        }
    }

    function _findNextAliveIndex(uint256 gameId, uint8 currentIdx) internal view returns (uint8) {
        Game storage g = games[gameId];
        uint8 len = uint8(g.players.length);
        uint8 idx = (currentIdx + 1) % len;
        while (!g.alive[idx]) {
            idx = (idx + 1) % len;
        }
        return idx;
    }

    function _requireAlivePlayer(uint256 gameId, address player) internal view {
        Game storage g = games[gameId];
        for (uint256 i = 0; i < g.players.length; i++) {
            if (g.players[i] == player) {
                if (!g.alive[i]) revert TargetDead();
                return;
            }
        }
        revert InvalidTarget();
    }

    function _clearShellKnowledge(uint256 gameId, address player) internal {
        currentShellKnown[gameId][player] = false;
        knownShellValue[gameId][player] = 0;
    }

    function _random(uint8 min, uint8 max) internal returns (uint8) {
        if (min == max) return min;
        _nonce++;
        return min
            + uint8(
            uint256(keccak256(abi.encodePacked(block.timestamp, block.prevrandao, _nonce, msg.sender)))
                % (max - min + 1)
        );
    }

    receive() external payable {}
}
