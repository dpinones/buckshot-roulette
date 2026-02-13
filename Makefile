.PHONY: build test fmt snapshot clean deploy deploy-local verify play play-testnet play-spectate install frontend-install frontend-dev spectate cleanup cleanup-local

# ── Config ──────────────────────────────────────────────────
ANVIL_RPC  := http://127.0.0.1:8545
MONAD_RPC  := https://testnet-rpc.monad.xyz
CHAIN_ID   := 10143
VERIFIER   := sourcify
VERIFY_URL := https://sourcify-api-monad.blockvision.org

# ── Build & Test ────────────────────────────────────────────

build:
	forge build

test:
	NO_PROXY="*" forge test -vvv

# Run a single test by name: make test-one T=test_createGame
test-one:
	NO_PROXY="*" forge test -vvv --mt $(T)

fmt:
	forge fmt

fmt-check:
	forge fmt --check

snapshot:
	forge snapshot

sizes:
	forge build --sizes

clean:
	forge clean

install:
	git submodule update --init --recursive

# ── Local Devnet ────────────────────────────────────────────

anvil:
	anvil --block-time 1

deploy-local:
	FOUNDRY_CHAIN_ID=31337 forge script script/Deploy.s.sol \
		--rpc-url $(ANVIL_RPC) \
		--private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
		--broadcast

play:
	bash script/play_local.sh

play-spectate:
	SPECTATE=1 bash script/play_local.sh

play-testnet:
	bash script/play_testnet.sh

# ── Monad Testnet ───────────────────────────────────────────

deploy:
	forge script script/Deploy.s.sol \
		--rpc-url $(MONAD_RPC) \
		--account monad-deployer \
		--broadcast

# ── Frontend ───────────────────────────────────────────────

frontend-install:
	cd frontend && npm install

frontend-dev:
	cd frontend && npm run dev

spectate:
	@echo "Modo espectador:"
	@echo "  1. Terminal 1: make frontend-dev"
	@echo "  2. Terminal 2: make play-spectate"
	@echo "  Frontend en http://localhost:5173"

cleanup:
	GAME_ADDRESS=$(GAME) FACTORY_ADDRESS=$(FACTORY) \
	forge script script/CleanupGames.s.sol \
		--rpc-url $(MONAD_RPC) \
		--account monad-deployer \
		--broadcast

cleanup-local:
	GAME_ADDRESS=$(GAME) FACTORY_ADDRESS=$(FACTORY) \
	FOUNDRY_CHAIN_ID=31337 forge script script/CleanupGames.s.sol \
		--rpc-url $(ANVIL_RPC) \
		--private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
		--broadcast

# ── Monad Testnet ───────────────────────────────────────────

# Verify: make verify ADDR=0x... CONTRACT=src/BuckshotGame.sol:BuckshotGame
verify:
	forge verify-contract $(ADDR) $(CONTRACT) \
		--chain $(CHAIN_ID) \
		--verifier $(VERIFIER) \
		--verifier-url $(VERIFY_URL)
