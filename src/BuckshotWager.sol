// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {BuckshotGame} from "./BuckshotGame.sol";

contract BuckshotWager {
    // ── Storage ─────────────────────────────────────────────────
    BuckshotGame public gameContract;

    struct Bet {
        address bettor;
        address predictedWinner;
        uint256 amount;
        bool claimed;
    }

    // gameId => total pool
    mapping(uint256 => uint256) public totalPool;
    // gameId => predictedWinner => total bet on them
    mapping(uint256 => mapping(address => uint256)) public betsByPlayer;
    // gameId => bettor => Bet[]
    mapping(uint256 => mapping(address => Bet[])) internal userBets;
    // gameId => all bettors (for iteration)
    mapping(uint256 => address[]) internal bettors;
    mapping(uint256 => mapping(address => bool)) internal isBettor;
    // gameId => betting closed
    mapping(uint256 => bool) public bettingClosed;

    uint256 public constant MIN_BET = 0.001 ether;
    uint256 public constant HOUSE_FEE_BPS = 200; // 2%

    // ── Events ──────────────────────────────────────────────────
    event BetPlaced(uint256 indexed gameId, address indexed bettor, address indexed predictedWinner, uint256 amount);
    event WinningsClaimed(uint256 indexed gameId, address indexed bettor, uint256 amount);
    event BettingClosed(uint256 indexed gameId);

    // ── Errors ──────────────────────────────────────────────────
    error GameNotActive();
    error BetTooSmall();
    error BettingIsClosed();
    error GameNotFinished();
    error NothingToClaim();
    error InvalidPrediction();
    error AlreadyClaimed();

    // ── Constructor ─────────────────────────────────────────────
    constructor(address _gameContract) {
        gameContract = BuckshotGame(payable(_gameContract));
    }

    // ── Place Bet ───────────────────────────────────────────────
    function placeBet(uint256 gameId, address predictedWinner) external payable {
        if (msg.value < MIN_BET) revert BetTooSmall();
        if (bettingClosed[gameId]) revert BettingIsClosed();

        BuckshotGame.GamePhase phase = gameContract.getPhase(gameId);
        if (phase != BuckshotGame.GamePhase.ACTIVE) revert GameNotActive();

        // Verify predictedWinner is a player in the game
        address[] memory players = gameContract.getPlayers(gameId);
        bool found = false;
        for (uint256 i = 0; i < players.length; i++) {
            if (players[i] == predictedWinner) { found = true; break; }
        }
        if (!found) revert InvalidPrediction();

        Bet memory bet = Bet({
            bettor: msg.sender,
            predictedWinner: predictedWinner,
            amount: msg.value,
            claimed: false
        });

        userBets[gameId][msg.sender].push(bet);
        totalPool[gameId] += msg.value;
        betsByPlayer[gameId][predictedWinner] += msg.value;

        if (!isBettor[gameId][msg.sender]) {
            bettors[gameId].push(msg.sender);
            isBettor[gameId][msg.sender] = true;
        }

        emit BetPlaced(gameId, msg.sender, predictedWinner, msg.value);
    }

    function closeBetting(uint256 gameId) external {
        // Anyone can close betting (e.g., when game reaches a critical state)
        // Or it closes automatically on first claim
        bettingClosed[gameId] = true;
        emit BettingClosed(gameId);
    }

    // ── Claim Winnings ──────────────────────────────────────────
    function claimWinnings(uint256 gameId) external {
        BuckshotGame.GamePhase phase = gameContract.getPhase(gameId);
        if (phase != BuckshotGame.GamePhase.FINISHED) revert GameNotFinished();

        // Auto-close betting
        if (!bettingClosed[gameId]) {
            bettingClosed[gameId] = true;
        }

        BuckshotGame.GameView memory state = gameContract.getGameState(gameId);
        address winner = state.winner;

        Bet[] storage bets = userBets[gameId][msg.sender];
        if (bets.length == 0) revert NothingToClaim();

        uint256 payout = 0;
        uint256 winnerTotalBets = betsByPlayer[gameId][winner];

        for (uint256 i = 0; i < bets.length; i++) {
            if (bets[i].claimed) continue;
            bets[i].claimed = true;

            if (bets[i].predictedWinner == winner && winnerTotalBets > 0) {
                // Parimutuel: proportional share of the pool
                uint256 pool = totalPool[gameId];
                uint256 fee = (pool * HOUSE_FEE_BPS) / 10000;
                uint256 distributable = pool - fee;
                payout += (bets[i].amount * distributable) / winnerTotalBets;
            }
        }

        if (payout == 0) revert NothingToClaim();

        emit WinningsClaimed(gameId, msg.sender, payout);

        (bool ok,) = msg.sender.call{value: payout}("");
        require(ok, "Payout failed");
    }

    // ── View Functions ──────────────────────────────────────────

    function getOdds(uint256 gameId) external view returns (address[] memory players, uint256[] memory odds) {
        players = gameContract.getPlayers(gameId);
        odds = new uint256[](players.length);
        uint256 pool = totalPool[gameId];

        for (uint256 i = 0; i < players.length; i++) {
            uint256 playerBets = betsByPlayer[gameId][players[i]];
            if (playerBets > 0 && pool > 0) {
                odds[i] = (pool * 1e18) / playerBets; // Odds in 1e18 format
            }
        }
    }

    function getTotalPool(uint256 gameId) external view returns (uint256) {
        return totalPool[gameId];
    }

    function getMyBets(uint256 gameId, address bettor) external view returns (
        address[] memory predictedWinners,
        uint256[] memory amounts,
        bool[] memory claimed
    ) {
        Bet[] storage bets = userBets[gameId][bettor];
        uint256 len = bets.length;
        predictedWinners = new address[](len);
        amounts = new uint256[](len);
        claimed = new bool[](len);

        for (uint256 i = 0; i < len; i++) {
            predictedWinners[i] = bets[i].predictedWinner;
            amounts[i] = bets[i].amount;
            claimed[i] = bets[i].claimed;
        }
    }

    receive() external payable {}
}
