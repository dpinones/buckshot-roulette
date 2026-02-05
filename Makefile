.PHONY: build test fmt snapshot clean deploy deploy-local verify play install

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
	anvil

deploy-local:
	FOUNDRY_CHAIN_ID=31337 forge script script/Deploy.s.sol \
		--rpc-url $(ANVIL_RPC) \
		--private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
		--broadcast

play:
	bash script/play_local.sh

# ── Monad Testnet ───────────────────────────────────────────

deploy:
	forge script script/Deploy.s.sol \
		--rpc-url $(MONAD_RPC) \
		--account monad-deployer \
		--broadcast

# Verify: make verify ADDR=0x... CONTRACT=src/BuckshotGame.sol:BuckshotGame
verify:
	forge verify-contract $(ADDR) $(CONTRACT) \
		--chain $(CHAIN_ID) \
		--verifier $(VERIFIER) \
		--verifier-url $(VERIFY_URL)
