// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {PlayerProfile} from "../src/PlayerProfile.sol";
import {BuckshotGame} from "../src/BuckshotGame.sol";
import {GameFactory} from "../src/GameFactory.sol";
import {BuckshotBetting} from "../src/BuckshotBetting.sol";

contract BuckshotBettingTest is Test {
    PlayerProfile public profile;
    BuckshotGame public game;
    GameFactory public factory;
    BuckshotBetting public betting;

    address public player1 = makeAddr("player1");
    address public player2 = makeAddr("player2");
    address public player3 = makeAddr("player3");
    address public player4 = makeAddr("player4");
    address public bettor1 = makeAddr("bettor1");
    address public bettor2 = makeAddr("bettor2");
    address public bettor3 = makeAddr("bettor3");

    uint256 constant BUY_IN = 0.01 ether;

    receive() external payable {}

    function setUp() public {
        profile = new PlayerProfile();
        game = new BuckshotGame(address(profile));
        profile.setGameContract(address(game));
        factory = new GameFactory(address(game), address(profile));
        betting = new BuckshotBetting(address(game));

        vm.deal(player1, 10 ether);
        vm.deal(player2, 10 ether);
        vm.deal(player3, 10 ether);
        vm.deal(player4, 10 ether);
        vm.deal(bettor1, 10 ether);
        vm.deal(bettor2, 10 ether);
        vm.deal(bettor3, 10 ether);

        vm.prank(player1);
        profile.createProfile("Player1");
        vm.prank(player2);
        profile.createProfile("Player2");
        vm.prank(player3);
        profile.createProfile("Player3");
        vm.prank(player4);
        profile.createProfile("Player4");
    }

    // ── Helpers ──────────────────────────────────────────────────

    function _createGameInWaiting2P() internal returns (uint256 gameId) {
        address[] memory players = new address[](2);
        players[0] = player1;
        players[1] = player2;
        gameId = game.createGame{value: BUY_IN * 2}(players, BUY_IN);
    }

    function _createGameInWaiting4P() internal returns (uint256 gameId) {
        address[] memory players = new address[](4);
        players[0] = player1;
        players[1] = player2;
        players[2] = player3;
        players[3] = player4;
        gameId = game.createGame{value: BUY_IN * 4}(players, BUY_IN);
    }

    function _activateGame(uint256 gameId) internal {
        vm.warp(block.timestamp + 21);
        game.activateGame(gameId);
    }

    function _playToEnd2P(uint256 gameId) internal {
        for (uint256 i = 0; i < 200; i++) {
            BuckshotGame.GameView memory state = game.getGameState(gameId);
            if (state.phase == BuckshotGame.GamePhase.FINISHED) break;

            address currentPlayer = game.getCurrentTurn(gameId);
            address target = currentPlayer == player1 ? player2 : player1;

            vm.prank(currentPlayer);
            game.shootOpponent(gameId, target);
        }
    }

    function _playToEnd4P(uint256 gameId) internal {
        for (uint256 i = 0; i < 500; i++) {
            BuckshotGame.GameView memory state = game.getGameState(gameId);
            if (state.phase == BuckshotGame.GamePhase.FINISHED) break;

            address currentPlayer = game.getCurrentTurn(gameId);

            address target;
            for (uint256 j = 0; j < state.players.length; j++) {
                if (state.players[j] != currentPlayer && state.alive[j]) {
                    target = state.players[j];
                    break;
                }
            }

            vm.prank(currentPlayer);
            game.shootOpponent(gameId, target);
        }
    }

    // ── Game Phase Tests ─────────────────────────────────────────

    function test_createGame_starts_in_waiting() public {
        uint256 gameId = _createGameInWaiting2P();
        BuckshotGame.GameView memory state = game.getGameState(gameId);
        assertEq(uint8(state.phase), uint8(BuckshotGame.GamePhase.WAITING));
    }

    function test_activateGame_after_deadline() public {
        uint256 gameId = _createGameInWaiting2P();
        vm.warp(block.timestamp + 21);
        game.activateGame(gameId);

        BuckshotGame.GameView memory state = game.getGameState(gameId);
        assertEq(uint8(state.phase), uint8(BuckshotGame.GamePhase.ACTIVE));
    }

    function test_activateGame_before_deadline_reverts() public {
        uint256 gameId = _createGameInWaiting2P();
        vm.expectRevert(BuckshotGame.BettingWindowActive.selector);
        game.activateGame(gameId);
    }

    function test_cannot_shoot_during_waiting() public {
        uint256 gameId = _createGameInWaiting2P();
        vm.prank(player1);
        vm.expectRevert(BuckshotGame.GameNotActive.selector);
        game.shootOpponent(gameId, player2);
    }

    // ── Death / Kill Tracking Tests ──────────────────────────────

    function test_deathOrder_tracked() public {
        uint256 gameId = _createGameInWaiting4P();
        _activateGame(gameId);
        _playToEnd4P(gameId);

        BuckshotGame.GameView memory state = game.getGameState(gameId);
        assertEq(uint8(state.phase), uint8(BuckshotGame.GamePhase.FINISHED));

        // In a 4-player game, 3 players die
        assertEq(game.deathCount(gameId), 3);

        // Each dead player should have a deathOrder 1, 2, or 3
        uint8 maxOrder = 0;
        for (uint256 i = 0; i < state.players.length; i++) {
            uint8 order = game.deathOrder(gameId, state.players[i]);
            if (order > maxOrder) maxOrder = order;
        }
        assertEq(maxOrder, 3);

        // Winner should have deathOrder 0
        assertEq(game.deathOrder(gameId, state.winner), 0);
    }

    function test_gameKills_tracked() public {
        uint256 gameId = _createGameInWaiting4P();
        _activateGame(gameId);
        _playToEnd4P(gameId);

        BuckshotGame.GameView memory state = game.getGameState(gameId);

        // Total kills across all players should be 3 (3 deaths in 4p game)
        uint8 totalKills = 0;
        for (uint256 i = 0; i < state.players.length; i++) {
            totalKills += game.gameKills(gameId, state.players[i]);
        }
        assertEq(totalKills, 3);
    }

    // ── Betting Tests ────────────────────────────────────────────

    function test_placeBet_winner() public {
        uint256 gameId = _createGameInWaiting2P();

        vm.prank(bettor1);
        betting.placeBet{value: 0.1 ether}(gameId, BuckshotBetting.BetType.WINNER, abi.encode(player1));

        bytes32 poolKey = betting.winnerPoolKey(gameId);
        assertEq(betting.poolTotal(poolKey), 0.1 ether);
    }

    function test_placeBet_reverts_after_deadline() public {
        uint256 gameId = _createGameInWaiting2P();
        vm.warp(block.timestamp + 21);

        vm.prank(bettor1);
        vm.expectRevert(BuckshotBetting.BettingWindowExpired.selector);
        betting.placeBet{value: 0.1 ether}(gameId, BuckshotBetting.BetType.WINNER, abi.encode(player1));
    }

    function test_placeBet_reverts_not_waiting() public {
        uint256 gameId = _createGameInWaiting2P();
        _activateGame(gameId);

        vm.prank(bettor1);
        vm.expectRevert(BuckshotBetting.GameNotInBettingPhase.selector);
        betting.placeBet{value: 0.1 ether}(gameId, BuckshotBetting.BetType.WINNER, abi.encode(player1));
    }

    function test_placeBet_reverts_too_small() public {
        uint256 gameId = _createGameInWaiting2P();

        vm.prank(bettor1);
        vm.expectRevert(BuckshotBetting.BetTooSmall.selector);
        betting.placeBet{value: 0.0001 ether}(gameId, BuckshotBetting.BetType.WINNER, abi.encode(player1));
    }

    function test_placeBet_reverts_invalid_player() public {
        uint256 gameId = _createGameInWaiting2P();

        vm.prank(bettor1);
        vm.expectRevert(BuckshotBetting.InvalidPlayer.selector);
        betting.placeBet{value: 0.1 ether}(gameId, BuckshotBetting.BetType.WINNER, abi.encode(player3));
    }

    function test_placeBet_firstDeath() public {
        uint256 gameId = _createGameInWaiting4P();

        vm.prank(bettor1);
        betting.placeBet{value: 0.1 ether}(gameId, BuckshotBetting.BetType.FIRST_DEATH, abi.encode(uint8(1), player2));

        bytes32 poolKey = betting.firstDeathPoolKey(gameId, 1);
        assertEq(betting.poolTotal(poolKey), 0.1 ether);
    }

    function test_placeBet_overKills() public {
        uint256 gameId = _createGameInWaiting4P();

        vm.prank(bettor1);
        betting.placeBet{value: 0.1 ether}(gameId, BuckshotBetting.BetType.OVER_KILLS, abi.encode(player1, uint8(2)));

        bytes32 poolKey = betting.overKillsPoolKey(gameId, player1, 2);
        assertEq(betting.poolTotal(poolKey), 0.1 ether);
    }

    function test_placeBet_overKills_invalid_threshold() public {
        uint256 gameId = _createGameInWaiting4P();

        vm.prank(bettor1);
        vm.expectRevert(BuckshotBetting.InvalidThreshold.selector);
        betting.placeBet{value: 0.1 ether}(gameId, BuckshotBetting.BetType.OVER_KILLS, abi.encode(player1, uint8(5)));
    }

    // ── Claim Winnings Tests ─────────────────────────────────────

    function test_claimWinnings_winner() public {
        uint256 gameId = _createGameInWaiting2P();

        // Both bettors place bets
        vm.prank(bettor1);
        betting.placeBet{value: 1 ether}(gameId, BuckshotBetting.BetType.WINNER, abi.encode(player1));
        vm.prank(bettor2);
        betting.placeBet{value: 0.5 ether}(gameId, BuckshotBetting.BetType.WINNER, abi.encode(player2));

        _activateGame(gameId);
        _playToEnd2P(gameId);

        BuckshotGame.GameView memory state = game.getGameState(gameId);
        assertEq(uint8(state.phase), uint8(BuckshotGame.GamePhase.FINISHED));

        address winner = state.winner;
        address winningBettor = winner == player1 ? bettor1 : bettor2;

        uint256 balBefore = winningBettor.balance;
        vm.prank(winningBettor);
        betting.claimWinnings(gameId);
        assertTrue(winningBettor.balance > balBefore);
    }

    function test_claimWinnings_firstDeath() public {
        uint256 gameId = _createGameInWaiting4P();

        // Bet on each player being first to die
        vm.prank(bettor1);
        betting.placeBet{value: 0.1 ether}(gameId, BuckshotBetting.BetType.FIRST_DEATH, abi.encode(uint8(1), player1));
        vm.prank(bettor2);
        betting.placeBet{value: 0.1 ether}(gameId, BuckshotBetting.BetType.FIRST_DEATH, abi.encode(uint8(1), player2));

        _activateGame(gameId);
        _playToEnd4P(gameId);

        // Find who actually died first
        address firstDead;
        address[] memory players = game.getPlayers(gameId);
        for (uint256 i = 0; i < players.length; i++) {
            if (game.deathOrder(gameId, players[i]) == 1) {
                firstDead = players[i];
                break;
            }
        }

        address winningBettor;
        if (firstDead == player1) winningBettor = bettor1;
        else if (firstDead == player2) winningBettor = bettor2;

        if (winningBettor != address(0)) {
            uint256 balBefore = winningBettor.balance;
            vm.prank(winningBettor);
            betting.claimWinnings(gameId);
            assertTrue(winningBettor.balance > balBefore);
        }
    }

    function test_claimWinnings_overKills() public {
        uint256 gameId = _createGameInWaiting4P();

        // Bet YES on player1 getting >= 1 kill
        vm.prank(bettor1);
        betting.placeBet{value: 0.1 ether}(gameId, BuckshotBetting.BetType.OVER_KILLS, abi.encode(player1, uint8(1)));
        // Bet NO on player1 getting >= 1 kill
        vm.prank(bettor2);
        betting.placeBet{value: 0.1 ether}(
            gameId, BuckshotBetting.BetType.OVER_KILLS, abi.encode(player1, uint8(1), false)
        );

        _activateGame(gameId);
        _playToEnd4P(gameId);

        bool didKill = game.gameKills(gameId, player1) >= 1;
        address winningBettor = didKill ? bettor1 : bettor2;

        uint256 balBefore = winningBettor.balance;
        vm.prank(winningBettor);
        betting.claimWinnings(gameId);
        assertTrue(winningBettor.balance > balBefore);
    }

    function test_refund_no_winning_bets() public {
        uint256 gameId = _createGameInWaiting2P();

        // Both bet on same player, but the other player might win
        vm.prank(bettor1);
        betting.placeBet{value: 1 ether}(gameId, BuckshotBetting.BetType.WINNER, abi.encode(player1));
        vm.prank(bettor2);
        betting.placeBet{value: 1 ether}(gameId, BuckshotBetting.BetType.WINNER, abi.encode(player1));

        _activateGame(gameId);
        _playToEnd2P(gameId);

        BuckshotGame.GameView memory state = game.getGameState(gameId);

        if (state.winner == player2) {
            // No one bet on the winner → refund proportionally
            uint256 bal1Before = bettor1.balance;
            vm.prank(bettor1);
            betting.claimWinnings(gameId);
            // Should get refund minus fee
            uint256 received = bettor1.balance - bal1Before;
            // 2 ether pool, 2% fee = 0.04 ether fee, so 1.96 distributable
            // bettor1 put 1 out of 2 ether total → gets 0.98 ether back
            assertTrue(received > 0);
            assertTrue(received < 1 ether); // Less than original due to fee
        }
        // If player1 won, bettors get their payout normally
    }

    function test_parimutuel_payout() public {
        uint256 gameId = _createGameInWaiting2P();

        // 3 bettors: bettor1 bets 2 ETH on player1, bettor2 bets 1 ETH on player1, bettor3 bets 1 ETH on player2
        vm.prank(bettor1);
        betting.placeBet{value: 2 ether}(gameId, BuckshotBetting.BetType.WINNER, abi.encode(player1));
        vm.prank(bettor2);
        betting.placeBet{value: 1 ether}(gameId, BuckshotBetting.BetType.WINNER, abi.encode(player1));
        vm.prank(bettor3);
        betting.placeBet{value: 1 ether}(gameId, BuckshotBetting.BetType.WINNER, abi.encode(player2));

        _activateGame(gameId);
        _playToEnd2P(gameId);

        BuckshotGame.GameView memory state = game.getGameState(gameId);
        // Total pool = 4 ETH, fee = 0.08 ETH, distributable = 3.92 ETH

        if (state.winner == player1) {
            // bettor1 put 2/3 of winner pool → gets 2/3 * 3.92 = 2.613...
            uint256 bal1Before = bettor1.balance;
            vm.prank(bettor1);
            betting.claimWinnings(gameId);
            uint256 payout1 = bettor1.balance - bal1Before;

            uint256 bal2Before = bettor2.balance;
            vm.prank(bettor2);
            betting.claimWinnings(gameId);
            uint256 payout2 = bettor2.balance - bal2Before;

            // bettor1 should get ~2x what bettor2 gets
            assertApproxEqRel(payout1, payout2 * 2, 0.01e18); // 1% tolerance

            // Total distributed should be ~3.92 ETH
            assertApproxEqRel(payout1 + payout2, 3.92 ether, 0.01e18);

            // bettor3 gets nothing
            vm.prank(bettor3);
            vm.expectRevert(BuckshotBetting.NothingToClaim.selector);
            betting.claimWinnings(gameId);
        }
    }

    function test_getMyBets() public {
        uint256 gameId = _createGameInWaiting2P();

        vm.prank(bettor1);
        betting.placeBet{value: 0.1 ether}(gameId, BuckshotBetting.BetType.WINNER, abi.encode(player1));
        vm.prank(bettor1);
        betting.placeBet{value: 0.05 ether}(gameId, BuckshotBetting.BetType.WINNER, abi.encode(player2));

        (bytes32[] memory poolKeys, bytes32[] memory outcomeKeys, uint256[] memory amounts, bool[] memory claimed) =
            betting.getMyBets(gameId, bettor1);

        assertEq(poolKeys.length, 2);
        assertEq(amounts[0], 0.1 ether);
        assertEq(amounts[1], 0.05 ether);
        assertFalse(claimed[0]);
        assertFalse(claimed[1]);

        // Both should be in the same pool (WINNER pool for this game)
        assertEq(poolKeys[0], poolKeys[1]);
        // But different outcome keys
        assertTrue(outcomeKeys[0] != outcomeKeys[1]);
    }

    function test_withdrawFees() public {
        uint256 gameId = _createGameInWaiting2P();

        vm.prank(bettor1);
        betting.placeBet{value: 1 ether}(gameId, BuckshotBetting.BetType.WINNER, abi.encode(player1));
        vm.prank(bettor2);
        betting.placeBet{value: 1 ether}(gameId, BuckshotBetting.BetType.WINNER, abi.encode(player2));

        _activateGame(gameId);
        _playToEnd2P(gameId);

        // Trigger fee deduction via claim
        BuckshotGame.GameView memory state = game.getGameState(gameId);
        address winningBettor = state.winner == player1 ? bettor1 : bettor2;
        vm.prank(winningBettor);
        betting.claimWinnings(gameId);

        // Owner withdraws fees
        uint256 fees = betting.accumulatedFees();
        assertTrue(fees > 0);
        // 2% of 2 ETH = 0.04 ETH
        assertEq(fees, 0.04 ether);

        address bettingOwner = betting.owner();
        uint256 ownerBalBefore = bettingOwner.balance;
        vm.prank(bettingOwner);
        betting.withdrawFees();
        assertEq(bettingOwner.balance, ownerBalBefore + fees);
    }

    function test_withdrawFees_notOwner_reverts() public {
        vm.prank(bettor1);
        vm.expectRevert(BuckshotBetting.NotOwner.selector);
        betting.withdrawFees();
    }

    function test_getKillThresholds() public view {
        uint8[] memory thresholds = betting.getKillThresholds();
        assertEq(thresholds.length, 3);
        assertEq(thresholds[0], 1);
        assertEq(thresholds[1], 2);
        assertEq(thresholds[2], 3);
    }
}
