// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {BuckshotGame} from "../src/BuckshotGame.sol";
import {GameFactory} from "../src/GameFactory.sol";

contract CleanupGamesScript is Script {
    function run() external {
        address gameAddr = vm.envAddress("GAME_ADDRESS");
        address factoryAddr = vm.envAddress("FACTORY_ADDRESS");

        BuckshotGame game = BuckshotGame(payable(gameAddr));
        GameFactory factory = GameFactory(payable(factoryAddr));

        vm.startBroadcast();

        console.log("Cancelling all non-finished games...");
        game.cancelAllGames();

        console.log("Clearing all queues...");
        factory.clearAllQueues();

        console.log("Clearing active games list...");
        factory.clearActiveGames();

        console.log("Cleanup complete.");

        vm.stopBroadcast();
    }
}
