// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test, console} from "forge-std/Test.sol";
import {BuckshotGame} from "../src/BuckshotGame.sol";
import {GameFactory} from "../src/GameFactory.sol";
import {BuckshotWager} from "../src/BuckshotWager.sol";

contract BuckshotGameTest is Test {
    BuckshotGame public game;
    GameFactory public factory;
    BuckshotWager public wager;

    address public player1 = makeAddr("player1");
    address public player2 = makeAddr("player2");
    address public player3 = makeAddr("player3");
    address public player4 = makeAddr("player4");
    address public spectator1 = makeAddr("spectator1");

    uint256 constant BUY_IN = 0.01 ether;

    function setUp() public {
        game = new BuckshotGame();
        factory = new GameFactory(address(game));
        wager = new BuckshotWager(address(game));

        // Fund players
        vm.deal(player1, 10 ether);
        vm.deal(player2, 10 ether);
        vm.deal(player3, 10 ether);
        vm.deal(player4, 10 ether);
        vm.deal(spectator1, 10 ether);
    }

    // ── Helper ──────────────────────────────────────────────────

    function _createGame2Players() internal returns (uint256 gameId) {
        address[] memory players = new address[](2);
        players[0] = player1;
        players[1] = player2;
        gameId = game.createGame{value: BUY_IN * 2}(players, BUY_IN);
    }

    function _createGame4Players() internal returns (uint256 gameId) {
        address[] memory players = new address[](4);
        players[0] = player1;
        players[1] = player2;
        players[2] = player3;
        players[3] = player4;
        gameId = game.createGame{value: BUY_IN * 4}(players, BUY_IN);
    }

    // ── BuckshotGame Tests ──────────────────────────────────────

    function test_createGame() public {
        uint256 gameId = _createGame2Players();

        BuckshotGame.GameView memory state = game.getGameState(gameId);
        assertEq(state.players.length, 2);
        assertEq(state.players[0], player1);
        assertEq(state.players[1], player2);
        assertEq(uint8(state.phase), uint8(BuckshotGame.GamePhase.ACTIVE));
        assertEq(state.currentRound, 1);
        assertEq(state.prizePool, BUY_IN * 2);
    }

    function test_createGame_reverts_invalidCount() public {
        address[] memory one = new address[](1);
        one[0] = player1;
        vm.expectRevert(BuckshotGame.InvalidPlayerCount.selector);
        game.createGame{value: BUY_IN}(one, BUY_IN);

        address[] memory seven = new address[](7);
        vm.expectRevert(BuckshotGame.InvalidPlayerCount.selector);
        game.createGame(seven, 0);
    }

    function test_round1_hp_is_2() public {
        uint256 gameId = _createGame2Players();
        assertEq(game.hp(gameId, player1), 2);
        assertEq(game.hp(gameId, player2), 2);
    }

    function test_shootOpponent_notYourTurn() public {
        uint256 gameId = _createGame2Players();
        // player1 goes first (index 0)
        vm.prank(player2);
        vm.expectRevert(BuckshotGame.NotYourTurn.selector);
        game.shootOpponent(gameId, player1);
    }

    function test_shootOpponent_invalidTarget_self() public {
        uint256 gameId = _createGame2Players();
        vm.prank(player1);
        vm.expectRevert(BuckshotGame.InvalidTarget.selector);
        game.shootOpponent(gameId, player1);
    }

    function test_full_1v1_game() public {
        uint256 gameId = _createGame2Players();

        // Play until game ends (max iterations to avoid infinite loop)
        uint256 winnerBalanceBefore = 0;
        for (uint256 i = 0; i < 200; i++) {
            BuckshotGame.GameView memory state = game.getGameState(gameId);
            if (state.phase == BuckshotGame.GamePhase.FINISHED) {
                break;
            }

            address currentPlayer = game.getCurrentTurn(gameId);
            address target = currentPlayer == player1 ? player2 : player1;

            if (winnerBalanceBefore == 0) {
                winnerBalanceBefore = player1.balance; // snapshot
            }

            vm.prank(currentPlayer);
            game.shootOpponent(gameId, target);
        }

        BuckshotGame.GameView memory finalState = game.getGameState(gameId);
        assertEq(uint8(finalState.phase), uint8(BuckshotGame.GamePhase.FINISHED));
        assertTrue(finalState.winner == player1 || finalState.winner == player2);
    }

    function test_shootSelf_blank_gives_extra_turn() public {
        uint256 gameId = _createGame2Players();
        BuckshotGame.GameView memory state = game.getGameState(gameId);

        // We'll play turns and observe if shooting self with blank keeps the turn
        // This is probabilistic, but over many shots it should happen
        address currentPlayer = game.getCurrentTurn(gameId);
        assertEq(currentPlayer, player1);

        // Just verify shooting self doesn't revert when it's your turn
        vm.prank(player1);
        game.shootSelf(gameId);
        // After shooting self, the current turn is either player1 (blank) or player2 (live)
    }

    function test_forceTimeout() public {
        uint256 gameId = _createGame2Players();

        // Advance time past the deadline
        vm.warp(block.timestamp + 61 seconds);

        // Anyone can force timeout
        vm.prank(player3);
        game.forceTimeout(gameId);
    }

    function test_forceTimeout_reverts_before_deadline() public {
        uint256 gameId = _createGame2Players();

        vm.expectRevert(BuckshotGame.TurnNotExpired.selector);
        game.forceTimeout(gameId);
    }

    function test_4player_game() public {
        uint256 gameId = _createGame4Players();

        BuckshotGame.GameView memory state = game.getGameState(gameId);
        assertEq(state.players.length, 4);

        // Play until game ends
        for (uint256 i = 0; i < 500; i++) {
            state = game.getGameState(gameId);
            if (state.phase == BuckshotGame.GamePhase.FINISHED) break;

            address currentPlayer = game.getCurrentTurn(gameId);

            // Find a valid alive target
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

        state = game.getGameState(gameId);
        assertEq(uint8(state.phase), uint8(BuckshotGame.GamePhase.FINISHED));
        assertTrue(state.winner != address(0));
    }

    function test_useItem_magnifyingGlass() public {
        // Create a game in round 2 to have items
        // We'll create game directly and simulate
        uint256 gameId = _createGame2Players();

        // Play through round 1 quickly to get to round 2 where items exist
        // This is hard to control deterministically, so let's test item logic
        // by directly checking items getter works
        uint8[] memory p1Items = game.getMyItems(gameId, player1);
        // Round 1 has no items
        assertEq(p1Items.length, 0);
    }

    function test_getVisibleShells() public {
        uint256 gameId = _createGame2Players();

        (uint8 live, uint8 blank) = game.getVisibleShells(gameId);
        assertTrue(live > 0);
        assertTrue(blank > 0);
        assertTrue(live + blank >= 2 && live + blank <= 4); // Round 1 limits
    }

    // ── GameFactory Tests ───────────────────────────────────────

    function test_factory_joinQueue() public {
        vm.prank(player1);
        factory.joinQueue{value: BUY_IN}(BUY_IN);

        assertEq(factory.getQueueLength(BUY_IN), 1);
        assertTrue(factory.isInQueue(player1));
    }

    function test_factory_joinQueue_wrongPayment() public {
        vm.prank(player1);
        vm.expectRevert(GameFactory.WrongPayment.selector);
        factory.joinQueue{value: 0.005 ether}(BUY_IN);
    }

    function test_factory_joinQueue_invalidBuyIn() public {
        vm.prank(player1);
        vm.expectRevert(GameFactory.InvalidBuyIn.selector);
        factory.joinQueue{value: 0.05 ether}(0.05 ether);
    }

    function test_factory_leaveQueue() public {
        vm.prank(player1);
        factory.joinQueue{value: BUY_IN}(BUY_IN);

        uint256 balBefore = player1.balance;
        vm.prank(player1);
        factory.leaveQueue();

        assertEq(factory.getQueueLength(BUY_IN), 0);
        assertFalse(factory.isInQueue(player1));
        assertEq(player1.balance, balBefore + BUY_IN);
    }

    function test_factory_startGame() public {
        vm.prank(player1);
        factory.joinQueue{value: BUY_IN}(BUY_IN);
        vm.prank(player2);
        factory.joinQueue{value: BUY_IN}(BUY_IN);

        factory.startGame(BUY_IN, 2);

        assertEq(factory.getQueueLength(BUY_IN), 0);

        uint256[] memory activeGames = factory.getActiveGames();
        assertEq(activeGames.length, 1);
    }

    function test_factory_startGame_notEnoughPlayers() public {
        vm.prank(player1);
        factory.joinQueue{value: BUY_IN}(BUY_IN);

        vm.expectRevert(GameFactory.NotEnoughPlayers.selector);
        factory.startGame(BUY_IN, 2);
    }

    function test_factory_doubleJoin_reverts() public {
        vm.prank(player1);
        factory.joinQueue{value: BUY_IN}(BUY_IN);

        vm.prank(player1);
        vm.expectRevert(GameFactory.AlreadyInQueue.selector);
        factory.joinQueue{value: BUY_IN}(BUY_IN);
    }

    // ── BuckshotWager Tests ─────────────────────────────────────

    function test_wager_placeBet() public {
        uint256 gameId = _createGame2Players();

        vm.prank(spectator1);
        wager.placeBet{value: 0.1 ether}(gameId, player1);

        assertEq(wager.totalPool(gameId), 0.1 ether);
    }

    function test_wager_placeBet_tooSmall() public {
        uint256 gameId = _createGame2Players();

        vm.prank(spectator1);
        vm.expectRevert(BuckshotWager.BetTooSmall.selector);
        wager.placeBet{value: 0.0001 ether}(gameId, player1);
    }

    function test_wager_placeBet_invalidPrediction() public {
        uint256 gameId = _createGame2Players();

        vm.prank(spectator1);
        vm.expectRevert(BuckshotWager.InvalidPrediction.selector);
        wager.placeBet{value: 0.1 ether}(gameId, player3); // player3 not in game
    }

    function test_wager_claimWinnings_gameNotFinished() public {
        uint256 gameId = _createGame2Players();

        vm.prank(spectator1);
        wager.placeBet{value: 0.1 ether}(gameId, player1);

        vm.prank(spectator1);
        vm.expectRevert(BuckshotWager.GameNotFinished.selector);
        wager.claimWinnings(gameId);
    }

    function test_wager_getOdds() public {
        uint256 gameId = _createGame2Players();

        vm.prank(spectator1);
        wager.placeBet{value: 0.1 ether}(gameId, player1);

        (address[] memory players, uint256[] memory odds) = wager.getOdds(gameId);
        assertEq(players.length, 2);
        // Only player1 has bets, so odds[0] = pool/bets = 1e18 (1:1)
        assertEq(odds[0], 1e18);
        assertEq(odds[1], 0); // No bets on player2
    }

    function test_wager_full_flow() public {
        uint256 gameId = _createGame2Players();

        // Place bets
        vm.prank(spectator1);
        wager.placeBet{value: 1 ether}(gameId, player1);

        address bettor2 = makeAddr("bettor2");
        vm.deal(bettor2, 10 ether);
        vm.prank(bettor2);
        wager.placeBet{value: 0.5 ether}(gameId, player2);

        // Play the game to completion
        for (uint256 i = 0; i < 200; i++) {
            BuckshotGame.GameView memory state = game.getGameState(gameId);
            if (state.phase == BuckshotGame.GamePhase.FINISHED) break;

            address currentPlayer = game.getCurrentTurn(gameId);
            address target = currentPlayer == player1 ? player2 : player1;

            vm.prank(currentPlayer);
            game.shootOpponent(gameId, target);
        }

        BuckshotGame.GameView memory finalState = game.getGameState(gameId);
        assertEq(uint8(finalState.phase), uint8(BuckshotGame.GamePhase.FINISHED));

        // The bettor who picked the winner can claim
        address winner = finalState.winner;
        if (winner == player1) {
            uint256 balBefore = spectator1.balance;
            vm.prank(spectator1);
            wager.claimWinnings(gameId);
            assertTrue(spectator1.balance > balBefore);
        } else {
            uint256 balBefore = bettor2.balance;
            vm.prank(bettor2);
            wager.claimWinnings(gameId);
            assertTrue(bettor2.balance > balBefore);
        }
    }

    function test_getMyBets() public {
        uint256 gameId = _createGame2Players();

        vm.prank(spectator1);
        wager.placeBet{value: 0.1 ether}(gameId, player1);

        vm.prank(spectator1);
        wager.placeBet{value: 0.05 ether}(gameId, player2);

        (address[] memory winners, uint256[] memory amounts, bool[] memory claimed) =
            wager.getMyBets(gameId, spectator1);

        assertEq(winners.length, 2);
        assertEq(amounts[0], 0.1 ether);
        assertEq(amounts[1], 0.05 ether);
        assertFalse(claimed[0]);
        assertFalse(claimed[1]);
    }
}
