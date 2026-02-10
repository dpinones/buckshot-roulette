// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {BuckshotGame} from "./BuckshotGame.sol";

contract BuckshotBetting {
    // ── Enums ──────────────────────────────────────────────────
    enum BetType {
        WINNER,
        FIRST_DEATH,
        OVER_KILLS
    }

    // ── Structs ────────────────────────────────────────────────
    struct Bet {
        bytes32 poolKey;
        bytes32 outcomeKey;
        uint256 amount;
        bool claimed;
    }

    // ── State ──────────────────────────────────────────────────
    BuckshotGame public immutable gameContract;

    uint256 public constant MIN_BET = 0.001 ether;
    uint256 public constant HOUSE_FEE_BPS = 200; // 2%

    mapping(bytes32 => uint256) public poolTotal;
    mapping(bytes32 => mapping(bytes32 => uint256)) public outcomeTotal;
    mapping(bytes32 => bytes) public poolParams;
    mapping(bytes32 => bool) public poolResolved;
    mapping(bytes32 => bytes32) public poolWinningOutcome;
    mapping(bytes32 => bool) public feeDeducted;
    mapping(uint256 => mapping(address => Bet[])) internal userBets;

    address public owner;
    uint256 public accumulatedFees;
    uint8[] public KILL_THRESHOLDS;

    // ── Events ─────────────────────────────────────────────────
    event BetPlaced(
        uint256 indexed gameId, address indexed bettor, bytes32 poolKey, bytes32 outcomeKey, uint256 amount
    );
    event PoolResolved(bytes32 indexed poolKey, bytes32 winningOutcome);
    event WinningsClaimed(uint256 indexed gameId, address indexed bettor, uint256 amount);

    // ── Errors ─────────────────────────────────────────────────
    error BetTooSmall();
    error GameNotInBettingPhase();
    error BettingWindowExpired();
    error InvalidPlayer();
    error InvalidThreshold();
    error NothingToClaim();
    error NotOwner();
    error TransferFailed();

    // ── Constructor ────────────────────────────────────────────
    constructor(address _gameContract) {
        gameContract = BuckshotGame(payable(_gameContract));
        owner = msg.sender;
        KILL_THRESHOLDS.push(1);
        KILL_THRESHOLDS.push(2);
        KILL_THRESHOLDS.push(3);
    }

    // ── Place Bet ──────────────────────────────────────────────
    function placeBet(uint256 gameId, BetType betType, bytes calldata betParams) external payable {
        if (msg.value < MIN_BET) revert BetTooSmall();

        BuckshotGame.GamePhase phase = gameContract.getPhase(gameId);
        if (phase != BuckshotGame.GamePhase.WAITING) revert GameNotInBettingPhase();
        if (block.timestamp >= gameContract.bettingDeadline(gameId)) revert BettingWindowExpired();

        bytes32 poolKey;
        bytes32 outcomeKey;

        if (betType == BetType.WINNER) {
            address player = abi.decode(betParams, (address));
            _requireValidPlayer(gameId, player);
            poolKey = winnerPoolKey(gameId);
            outcomeKey = playerOutcomeKey(player);
            if (poolParams[poolKey].length == 0) {
                poolParams[poolKey] = abi.encode(gameId, BetType.WINNER);
            }
        } else if (betType == BetType.FIRST_DEATH) {
            (uint8 position, address player) = abi.decode(betParams, (uint8, address));
            _requireValidPlayer(gameId, player);
            poolKey = firstDeathPoolKey(gameId, position);
            outcomeKey = playerOutcomeKey(player);
            if (poolParams[poolKey].length == 0) {
                poolParams[poolKey] = abi.encode(gameId, BetType.FIRST_DEATH, position);
            }
        } else {
            (address player, uint8 threshold) = abi.decode(betParams, (address, uint8));
            _requireValidPlayer(gameId, player);
            _requireValidThreshold(threshold);
            poolKey = overKillsPoolKey(gameId, player, threshold);
            outcomeKey = boolOutcomeKey(true); // betting YES by default; can also bet NO
            // Allow betParams to include a bool for YES/NO
            if (betParams.length > 64) {
                (,, bool betYes) = abi.decode(betParams, (address, uint8, bool));
                outcomeKey = boolOutcomeKey(betYes);
            }
            if (poolParams[poolKey].length == 0) {
                poolParams[poolKey] = abi.encode(gameId, BetType.OVER_KILLS, player, threshold);
            }
        }

        poolTotal[poolKey] += msg.value;
        outcomeTotal[poolKey][outcomeKey] += msg.value;
        userBets[gameId][msg.sender].push(
            Bet({poolKey: poolKey, outcomeKey: outcomeKey, amount: msg.value, claimed: false})
        );

        emit BetPlaced(gameId, msg.sender, poolKey, outcomeKey, msg.value);
    }

    // ── Claim Winnings ─────────────────────────────────────────
    function claimWinnings(uint256 gameId) external {
        BuckshotGame.GamePhase phase = gameContract.getPhase(gameId);
        if (phase != BuckshotGame.GamePhase.FINISHED) revert NothingToClaim();

        Bet[] storage bets = userBets[gameId][msg.sender];
        if (bets.length == 0) revert NothingToClaim();

        uint256 totalPayout = 0;

        for (uint256 i = 0; i < bets.length; i++) {
            if (bets[i].claimed) continue;
            bets[i].claimed = true;

            bytes32 pKey = bets[i].poolKey;

            // Lazy resolve pool
            if (!poolResolved[pKey]) {
                _resolvePool(pKey);
            }

            bytes32 winOutcome = poolWinningOutcome[pKey];
            uint256 pool = poolTotal[pKey];

            if (pool == 0) continue;

            // Deduct fee once per pool
            if (!feeDeducted[pKey]) {
                feeDeducted[pKey] = true;
                uint256 fee = (pool * HOUSE_FEE_BPS) / 10000;
                accumulatedFees += fee;
            }

            uint256 distributable = pool - (pool * HOUSE_FEE_BPS) / 10000;

            if (bets[i].outcomeKey == winOutcome) {
                uint256 winnerTotal = outcomeTotal[pKey][winOutcome];
                if (winnerTotal > 0) {
                    totalPayout += (bets[i].amount * distributable) / winnerTotal;
                }
            } else if (outcomeTotal[pKey][winOutcome] == 0) {
                // No one bet on the winning outcome → refund minus fee
                totalPayout += (bets[i].amount * distributable) / pool;
            }
        }

        if (totalPayout == 0) revert NothingToClaim();

        emit WinningsClaimed(gameId, msg.sender, totalPayout);

        (bool ok,) = msg.sender.call{value: totalPayout}("");
        if (!ok) revert TransferFailed();
    }

    // ── Owner Functions ────────────────────────────────────────
    function withdrawFees() external {
        if (msg.sender != owner) revert NotOwner();
        uint256 amount = accumulatedFees;
        accumulatedFees = 0;
        (bool ok,) = owner.call{value: amount}("");
        if (!ok) revert TransferFailed();
    }

    // ── Internal Resolution ────────────────────────────────────
    function _resolvePool(bytes32 pKey) internal {
        bytes memory params = poolParams[pKey];

        // Decode betType from params (second element)
        // All params start with (uint256 gameId, BetType betType, ...)
        (uint256 gameId, BetType betType) = abi.decode(params, (uint256, BetType));

        bytes32 winOutcome;

        if (betType == BetType.WINNER) {
            BuckshotGame.GameView memory state = gameContract.getGameState(gameId);
            winOutcome = playerOutcomeKey(state.winner);
        } else if (betType == BetType.FIRST_DEATH) {
            (,, uint8 position) = abi.decode(params, (uint256, BetType, uint8));
            // Find which player has deathOrder == position
            address[] memory players = gameContract.getPlayers(gameId);
            address found;
            for (uint256 i = 0; i < players.length; i++) {
                if (gameContract.deathOrder(gameId, players[i]) == position) {
                    found = players[i];
                    break;
                }
            }
            winOutcome = playerOutcomeKey(found);
        } else {
            // OVER_KILLS
            (,, address player, uint8 threshold) = abi.decode(params, (uint256, BetType, address, uint8));
            bool result = gameContract.gameKills(gameId, player) >= threshold;
            winOutcome = boolOutcomeKey(result);
        }

        poolResolved[pKey] = true;
        poolWinningOutcome[pKey] = winOutcome;
        emit PoolResolved(pKey, winOutcome);
    }

    function _requireValidPlayer(uint256 gameId, address player) internal view {
        address[] memory players = gameContract.getPlayers(gameId);
        for (uint256 i = 0; i < players.length; i++) {
            if (players[i] == player) return;
        }
        revert InvalidPlayer();
    }

    function _requireValidThreshold(uint8 threshold) internal view {
        for (uint256 i = 0; i < KILL_THRESHOLDS.length; i++) {
            if (KILL_THRESHOLDS[i] == threshold) return;
        }
        revert InvalidThreshold();
    }

    // ── View Helpers (for offchain key computation) ────────────
    function winnerPoolKey(uint256 gameId) public pure returns (bytes32) {
        return keccak256(abi.encode(gameId, BetType.WINNER));
    }

    function firstDeathPoolKey(uint256 gameId, uint8 position) public pure returns (bytes32) {
        return keccak256(abi.encode(gameId, BetType.FIRST_DEATH, position));
    }

    function overKillsPoolKey(uint256 gameId, address player, uint8 threshold) public pure returns (bytes32) {
        return keccak256(abi.encode(gameId, BetType.OVER_KILLS, player, threshold));
    }

    function playerOutcomeKey(address player) public pure returns (bytes32) {
        return keccak256(abi.encode(player));
    }

    function boolOutcomeKey(bool value) public pure returns (bytes32) {
        return keccak256(abi.encode(value));
    }

    function getPoolOdds(bytes32 poolKey, bytes32[] calldata outcomeKeys) external view returns (uint256[] memory) {
        uint256[] memory odds = new uint256[](outcomeKeys.length);
        uint256 pool = poolTotal[poolKey];
        for (uint256 i = 0; i < outcomeKeys.length; i++) {
            uint256 total = outcomeTotal[poolKey][outcomeKeys[i]];
            if (total > 0 && pool > 0) {
                odds[i] = (pool * 1e18) / total;
            }
        }
        return odds;
    }

    function getMyBets(uint256 gameId, address bettor)
        external
        view
        returns (
            bytes32[] memory poolKeys,
            bytes32[] memory outcomeKeys,
            uint256[] memory amounts,
            bool[] memory claimed
        )
    {
        Bet[] storage bets = userBets[gameId][bettor];
        uint256 len = bets.length;
        poolKeys = new bytes32[](len);
        outcomeKeys = new bytes32[](len);
        amounts = new uint256[](len);
        claimed = new bool[](len);

        for (uint256 i = 0; i < len; i++) {
            poolKeys[i] = bets[i].poolKey;
            outcomeKeys[i] = bets[i].outcomeKey;
            amounts[i] = bets[i].amount;
            claimed[i] = bets[i].claimed;
        }
    }

    function getKillThresholds() external view returns (uint8[] memory) {
        return KILL_THRESHOLDS;
    }

    receive() external payable {}
}
