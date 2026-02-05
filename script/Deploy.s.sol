// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {BuckshotGame} from "../src/BuckshotGame.sol";
import {GameFactory} from "../src/GameFactory.sol";
import {BuckshotWager} from "../src/BuckshotWager.sol";

contract DeployScript is Script {
    function run() external {
        vm.startBroadcast();

        // 1. Deploy BuckshotGame
        BuckshotGame game = new BuckshotGame();
        console.log("BuckshotGame deployed at:", address(game));

        // 2. Deploy GameFactory (points to BuckshotGame)
        GameFactory factory = new GameFactory(address(game));
        console.log("GameFactory deployed at:", address(factory));

        // 3. Deploy BuckshotWager (points to BuckshotGame)
        BuckshotWager wager = new BuckshotWager(address(game));
        console.log("BuckshotWager deployed at:", address(wager));

        vm.stopBroadcast();
    }
}
