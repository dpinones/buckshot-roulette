// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {PlayerProfile} from "../src/PlayerProfile.sol";
import {BuckshotGame} from "../src/BuckshotGame.sol";
import {GameFactory} from "../src/GameFactory.sol";
import {BuckshotWager} from "../src/BuckshotWager.sol";

contract DeployScript is Script {
    function run() external {
        vm.startBroadcast();

        // 1. Deploy PlayerProfile
        PlayerProfile profile = new PlayerProfile();
        console.log("PlayerProfile deployed at:", address(profile));

        // 2. Deploy BuckshotGame (points to PlayerProfile)
        BuckshotGame game = new BuckshotGame(address(profile));
        console.log("BuckshotGame deployed at:", address(game));

        // 3. Authorize BuckshotGame to update profiles
        profile.setGameContract(address(game));

        // 4. Deploy GameFactory (points to BuckshotGame + PlayerProfile)
        GameFactory factory = new GameFactory(address(game), address(profile));
        console.log("GameFactory deployed at:", address(factory));

        // 5. Deploy BuckshotWager (points to BuckshotGame)
        BuckshotWager wager = new BuckshotWager(address(game));
        console.log("BuckshotWager deployed at:", address(wager));

        vm.stopBroadcast();
    }
}
