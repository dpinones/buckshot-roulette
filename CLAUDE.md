# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Buckshot Roulette — a fully on-chain multiplayer game built with Foundry on Monad testnet (Chain ID: 10143, EVM version: Prague). No backend; all game state lives in smart contracts.

## Common Commands (via Makefile)

```bash
make build                        # Compile contracts
make test                         # Run all tests (verbose)
make test-one T=test_createGame   # Run a single test by name
make fmt                          # Format Solidity code
make fmt-check                    # Check formatting (CI)
make sizes                        # Build with contract size report
make clean                        # Clean build artifacts
make install                      # Install git submodule dependencies
```

### Local Devnet

```bash
make play                         # Full 1v1 game: Anvil + deploy + play (self-contained)
make anvil                        # Start Anvil only (block-time 1s)
make deploy-local                 # Deploy contracts to local Anvil
```

### Monad Testnet

```bash
make deploy                                                        # Deploy all contracts
make verify ADDR=0x... CONTRACT=src/BuckshotGame.sol:BuckshotGame  # Verify on Sourcify
```

Note: local tests/deploy need `NO_PROXY="*"` or `FOUNDRY_CHAIN_ID=31337` to avoid a Foundry macOS crash with the Monad RPC configured in `foundry.toml`. The Makefile and `play_local.sh` handle this automatically.

## Architecture

Three core contracts with a linear dependency chain:

- **BuckshotGame** (`src/BuckshotGame.sol`) — Game engine. Manages game state, turns, shooting mechanics, items, round progression, and player elimination. Games support 2-6 players across 3 rounds with escalating HP and shell counts. Uses keccak256-based pseudo-RNG (block.timestamp, prevrandao, nonce, sender). 60-second turn timeout with `forceTimeout()`.

- **GameFactory** (`src/GameFactory.sol`) — Matchmaking. Queue-based system with tiered buy-ins (0.01, 0.1, 1 ether). Players join a queue at their chosen stake; admin calls `startGame()` to create a game from queued players. Depends on BuckshotGame address at construction.

- **BuckshotWager** (`src/BuckshotWager.sol`) — Parimutuel betting for spectators. 2% house fee (200 bps). Min bet: 0.001 ether. Betting closes automatically on first claim. Depends on BuckshotGame address at construction.

Deploy order matters: BuckshotGame first, then GameFactory and BuckshotWager (both receive BuckshotGame's address as constructor arg).

## Game Mechanics (for context when modifying contracts)

- **Rounds:** 3 rounds. HP: R1=2, R2=4, R3=5. Shells: R1=2-4, R2=4-6, R3=5-8.
- **Items:** Distributed in R2 (2 items) and R3 (4 items). Types: MAGNIFYING_GLASS (peek shell), BEER (eject shell), HANDSAW (double damage), HANDCUFFS (skip opponent turn), CIGARETTES (+1 HP), INVERTER (flip shell type).
- **Shooting:** Live shell on opponent = 1 dmg (2 with handsaw). Self-shot with blank = extra turn.

## CI

GitHub Actions runs on every push/PR: `forge fmt --check` → `forge build --sizes` → `forge test -vvv`. Profile: `ci`.

## Dependencies

Git submodules (run `git submodule update --init --recursive` after cloning):
- `lib/forge-std` — Foundry standard library
- `lib/openzeppelin-contracts` — OpenZeppelin (available but not yet imported)
