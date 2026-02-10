#!/bin/bash
#
# Buckshot Roulette — Local 1v1 game simulation
#
# Levanta Anvil, deploya contratos y ejecuta una partida completa entre 2 jugadores.
# Los jugadores usan una IA simple: usan items estrategicamente y disparan al oponente.
#
# Uso:   ./script/play_local.sh
# Requisitos: foundry (forge, cast, anvil)
#

# ── Config ──────────────────────────────────────────────────
export FOUNDRY_CHAIN_ID=31337
export FOUNDRY_ETH_RPC_URL="http://127.0.0.1:8545"
RPC="$FOUNDRY_ETH_RPC_URL"

PK1="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
PK2="0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
P1="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
P2="0x70997970C51812dc3A010C7d01b50e0d17dc79C8"

BUYIN="10000000000000"  # 0.00001 ETH
GAME_ID=0
MAX_TURNS=150

ITEM_NAMES=("NONE" "MAGNIFYING_GLASS" "BEER" "HANDSAW" "HANDCUFFS" "CIGARETTES" "INVERTER")

# Delay entre acciones: modo espectador = 5s, normal = 0.2s
if [ "${SPECTATE:-0}" = "1" ]; then
  PLAY_DELAY=5
else
  PLAY_DELAY=0.2
fi

# ── Helpers ─────────────────────────────────────────────────

ANVIL_PID=""

cleanup() {
  if [ -n "$ANVIL_PID" ]; then
    echo ""
    echo "[*] Cerrando Anvil (PID $ANVIL_PID)..."
    kill "$ANVIL_PID" 2>/dev/null
    wait "$ANVIL_PID" 2>/dev/null
  fi
}
trap cleanup EXIT

cast_call() {
  cast call --rpc-url "$RPC" "$GAME_ADDR" "$@" 2>/dev/null
}

cast_send() {
  local pk="$1"; shift
  # Gas limit explicito para evitar fallos por diferencia de block entre estimacion y ejecucion
  cast send --rpc-url "$RPC" --private-key "$pk" --gas-limit 1000000 "$GAME_ADDR" "$@" 2>&1
}

pk_for() {
  case "$(echo "$1" | tr '[:upper:]' '[:lower:]')" in
    "$(echo "$P1" | tr '[:upper:]' '[:lower:]')") echo "$PK1" ;;
    *) echo "$PK2" ;;
  esac
}

name_for() {
  case "$(echo "$1" | tr '[:upper:]' '[:lower:]')" in
    "$(echo "$P1" | tr '[:upper:]' '[:lower:]')") echo "P1" ;;
    *) echo "P2" ;;
  esac
}

opponent_of() {
  case "$(echo "$1" | tr '[:upper:]' '[:lower:]')" in
    "$(echo "$P1" | tr '[:upper:]' '[:lower:]')") echo "$P2" ;;
    *) echo "$P1" ;;
  esac
}

format_items() {
  local raw="$1"
  raw="${raw//[\[\] ]/}"
  if [ -z "$raw" ]; then
    echo "-"
    return
  fi
  local result=""
  IFS=',' read -ra nums <<< "$raw"
  for n in "${nums[@]}"; do
    n=$(echo "$n" | tr -d ' ')
    if [ -n "$n" ] && [ "$n" -ge 1 ] 2>/dev/null && [ "$n" -le 6 ]; then
      result+="${ITEM_NAMES[$n]}, "
    fi
  done
  echo "${result%, }"
}

tx_succeeded() {
  echo "$1" | grep -q "status               1"
}

# Leer el currentRound del contrato via raw storage/getGameState
get_round() {
  # getGameState returns a struct; currentRound is field index 4 (0-indexed)
  # The ABI-encoded tuple has dynamic arrays so we need to parse the raw hex
  # Easier: just use the raw hex and find the round from known position
  # Alternative: read the GameView struct fields
  local raw
  raw=$(cast_call "getGameState(uint256)" $GAME_ID)
  if [ -z "$raw" ]; then echo "0"; return; fi
  # The struct layout after ABI decoding:
  # offset 0: pointer to tuple (0x20)
  # Then the tuple fields:
  # +0x00: id (uint256)
  # +0x20: pointer to players array
  # +0x40: pointer to hpList array
  # +0x60: pointer to alive array
  # +0x80: currentRound (uint8, padded to 32 bytes)
  # We skip the first 0x20 (pointer) + 0x80 = 0xa0 = 160 bytes = 320 hex chars + 2 for "0x" prefix
  # So currentRound is at chars 322-385 (1-indexed) of the raw hex
  local round_hex="${raw:322:64}"
  local round_dec=$((16#${round_hex##+(0)}))
  echo "${round_dec:-0}"
}

# ── 1. Iniciar Anvil ───────────────────────────────────────

echo "============================================"
echo "   BUCKSHOT ROULETTE — Local Devnet"
echo "============================================"
echo ""

# Matar instancias previas de anvil en el mismo puerto
lsof -ti:8545 2>/dev/null | xargs kill 2>/dev/null || true
sleep 1

echo "[1/3] Iniciando Anvil..."
anvil --silent &
ANVIL_PID=$!
sleep 2

if ! kill -0 "$ANVIL_PID" 2>/dev/null; then
  echo "ERROR: Anvil no pudo arrancar"
  exit 1
fi
echo "  Anvil corriendo (PID $ANVIL_PID) en $RPC"

# ── 2. Deploy de contratos ─────────────────────────────────

echo ""
echo "[2/3] Deployando contratos..."

DEPLOY_OUTPUT=$(forge script script/Deploy.s.sol \
  --rpc-url "$RPC" \
  --private-key "$PK1" \
  --broadcast 2>&1)

PROFILE_ADDR=$(echo "$DEPLOY_OUTPUT" | grep "PlayerProfile deployed" | awk '{print $NF}')
GAME_ADDR=$(echo "$DEPLOY_OUTPUT" | grep "BuckshotGame deployed" | awk '{print $NF}')
FACTORY_ADDR=$(echo "$DEPLOY_OUTPUT" | grep "GameFactory deployed" | awk '{print $NF}')
WAGER_ADDR=$(echo "$DEPLOY_OUTPUT" | grep "BuckshotWager deployed" | awk '{print $NF}')

if [ -z "$GAME_ADDR" ]; then
  echo "ERROR: Deploy fallo"
  echo "$DEPLOY_OUTPUT"
  exit 1
fi

# Esperar a que los contratos esten confirmados on-chain
sleep 2

echo "  PlayerProfile: $PROFILE_ADDR"
echo "  BuckshotGame:  $GAME_ADDR"
echo "  GameFactory:   $FACTORY_ADDR"
echo "  BuckshotWager: $WAGER_ADDR"

# ── 3. Crear partida via Factory ───────────────────────────

echo ""
echo "[3/3] Creando partida 1v1 via Factory (buy-in: 0.00001 ETH cada uno)..."

# Helper para enviar txs al factory
cast_send_factory() {
  local pk="$1"; shift
  cast send --rpc-url "$RPC" --private-key "$pk" --gas-limit 1000000 "$FACTORY_ADDR" "$@" 2>&1
}

# Helper para enviar txs al profile
cast_send_profile() {
  local pk="$1"; shift
  cast send --rpc-url "$RPC" --private-key "$pk" --gas-limit 1000000 "$PROFILE_ADDR" "$@" 2>&1
}

# Helper para leer del profile
cast_call_profile() {
  cast call --rpc-url "$RPC" "$PROFILE_ADDR" "$@" 2>/dev/null
}

# Create profiles
echo "  P1 creating profile..."
PROF1=$(cast_send_profile "$PK1" "createProfile(string)" "Player1")
if ! tx_succeeded "$PROF1"; then
  echo "ERROR: P1 no pudo crear perfil"
  echo "$PROF1"
  exit 1
fi

echo "  P2 creating profile..."
PROF2=$(cast_send_profile "$PK2" "createProfile(string)" "Player2")
if ! tx_succeeded "$PROF2"; then
  echo "ERROR: P2 no pudo crear perfil"
  echo "$PROF2"
  exit 1
fi

# P1 joins queue
echo "  P1 joining queue..."
JOIN1=$(cast_send_factory "$PK1" "joinQueue(uint256)" "$BUYIN" --value 0.00001ether)
if ! tx_succeeded "$JOIN1"; then
  echo "ERROR: P1 no pudo unirse a la queue"
  echo "$JOIN1"
  exit 1
fi

# P2 joins queue
echo "  P2 joining queue..."
JOIN2=$(cast_send_factory "$PK2" "joinQueue(uint256)" "$BUYIN" --value 0.00001ether)
if ! tx_succeeded "$JOIN2"; then
  echo "ERROR: P2 no pudo unirse a la queue"
  echo "$JOIN2"
  exit 1
fi

# Start game from queue
GAME_CREATED=false
for ATTEMPT in 1 2 3 4 5; do
  START_RESULT=$(cast_send_factory "$PK1" "startGame(uint256,uint8)" "$BUYIN" 2)

  if tx_succeeded "$START_RESULT"; then
    PHASE=$(cast_call "getPhase(uint256)(uint8)" $GAME_ID)
    if [ "$PHASE" = "1" ]; then
      GAME_CREATED=true
      break
    fi
  fi
  echo "  Intento $ATTEMPT fallo, reintentando..."
  sleep 1
done

if [ "$GAME_CREATED" != "true" ]; then
  echo "ERROR: No se pudo crear el juego despues de 5 intentos"
  exit 1
fi

echo "  Game ID: $GAME_ID | Prize Pool: 0.00002 ETH"
echo "  P1: $P1"
echo "  P2: $P2"

# ── 4. Jugar la partida ────────────────────────────────────

echo ""
echo "============================================"
echo "   COMIENZA LA PARTIDA"
echo "============================================"

PREV_ROUND=0
TURN=0
RETRIES=0

while [ $TURN -lt $MAX_TURNS ]; do
  TURN=$((TURN + 1))

  # Verificar si el juego termino
  PHASE=$(cast_call "getPhase(uint256)(uint8)" $GAME_ID)
  if [ "$PHASE" = "2" ]; then
    break
  fi

  # Obtener turno actual
  CURRENT=$(cast_call "getCurrentTurn(uint256)(address)" $GAME_ID)
  if [ -z "$CURRENT" ] || [ "$CURRENT" = "0x0000000000000000000000000000000000000000" ]; then
    sleep 1
    continue
  fi

  CURRENT_NAME=$(name_for "$CURRENT")
  CURRENT_PK=$(pk_for "$CURRENT")
  OPPONENT=$(opponent_of "$CURRENT")
  OPPONENT_NAME=$(name_for "$OPPONENT")

  # Obtener HP
  HP1=$(cast_call "hp(uint256,address)(uint8)" $GAME_ID "$P1")
  HP2=$(cast_call "hp(uint256,address)(uint8)" $GAME_ID "$P2")

  # Obtener shells
  SHELLS_RAW=$(cast_call "getVisibleShells(uint256)(uint8,uint8)" $GAME_ID)
  LIVE=$(echo "$SHELLS_RAW" | head -1 | tr -d ' ')
  BLANK=$(echo "$SHELLS_RAW" | tail -1 | tr -d ' ')

  # Detectar cambio de ronda leyendo del contrato
  ROUND_NUM=$(get_round)
  if [ "$PREV_ROUND" != "$ROUND_NUM" ] && [ "$ROUND_NUM" -ge 1 ] 2>/dev/null; then
    echo ""
    echo "  ========== RONDA $ROUND_NUM (HP: R1=2, R2=4, R3=5) =========="
    PREV_ROUND=$ROUND_NUM
  fi

  # Obtener items del jugador actual
  ITEMS_RAW=$(cast_call "getMyItems(uint256,address)(uint8[])" $GAME_ID "$CURRENT")
  ITEMS_FMT=$(format_items "$ITEMS_RAW")

  echo ""
  echo "--- Turno $TURN [$CURRENT_NAME] ---"
  echo "  HP: P1=$HP1 P2=$HP2 | Shells: ${LIVE}L ${BLANK}B | Items: $ITEMS_FMT"

  # ── Estrategia IA ──
  KNOWN_SHELL=""

  # Usar hasta 3 items por turno
  for ITEM_PASS in 1 2 3; do
    ITEMS_RAW=$(cast_call "getMyItems(uint256,address)(uint8[])" $GAME_ID "$CURRENT")
    ITEMS_CLEAN="${ITEMS_RAW//[\[\] ]/}"
    [ -z "$ITEMS_CLEAN" ] && break

    IFS=',' read -ra ITEM_ARR <<< "$ITEMS_CLEAN"
    USED=false

    for IDX in "${!ITEM_ARR[@]}"; do
      ITEM_VAL=$(echo "${ITEM_ARR[$IDX]}" | tr -d ' ')
      [ -z "$ITEM_VAL" ] && continue

      # MAGNIFYING_GLASS (1) — peek shell
      if [ "$ITEM_VAL" = "1" ] && [ -z "$KNOWN_SHELL" ]; then
        RESULT=$(cast_send "$CURRENT_PK" "useItem(uint256,uint8)" $GAME_ID "$IDX")
        if tx_succeeded "$RESULT"; then
          SHELL_VAL=$(cast_call "knownShellValue(uint256,address)(uint8)" $GAME_ID "$CURRENT")
          if [ "$SHELL_VAL" = "1" ]; then
            KNOWN_SHELL="live"
            echo "  [MAGNIFYING_GLASS] -> LIVE!"
          else
            KNOWN_SHELL="blank"
            echo "  [MAGNIFYING_GLASS] -> BLANK"
          fi
          USED=true; break
        fi
      fi

      # CIGARETTES (5) — heal
      if [ "$ITEM_VAL" = "5" ]; then
        RESULT=$(cast_send "$CURRENT_PK" "useItem(uint256,uint8)" $GAME_ID "$IDX")
        if tx_succeeded "$RESULT"; then
          echo "  [CIGARETTES] +1 HP"
          USED=true; break
        fi
      fi

      # HANDSAW (3) — double damage (skip if shell is blank)
      if [ "$ITEM_VAL" = "3" ] && [ "$KNOWN_SHELL" != "blank" ]; then
        SAW=$(cast_call "sawActive(uint256,address)(bool)" $GAME_ID "$CURRENT")
        if [ "$SAW" = "false" ]; then
          RESULT=$(cast_send "$CURRENT_PK" "useItem(uint256,uint8)" $GAME_ID "$IDX")
          if tx_succeeded "$RESULT"; then
            echo "  [HANDSAW] x2 dano activado"
            USED=true; break
          fi
        fi
      fi

      # BEER (2) — eject shell if blank
      if [ "$ITEM_VAL" = "2" ] && [ "$KNOWN_SHELL" = "blank" ]; then
        RESULT=$(cast_send "$CURRENT_PK" "useItem(uint256,uint8)" $GAME_ID "$IDX")
        if tx_succeeded "$RESULT"; then
          echo "  [BEER] expulsa blank"
          KNOWN_SHELL=""
          USED=true; break
        fi
      fi

      # INVERTER (6) — flip shell if blank
      if [ "$ITEM_VAL" = "6" ] && [ "$KNOWN_SHELL" = "blank" ]; then
        RESULT=$(cast_send "$CURRENT_PK" "useItem(uint256,uint8)" $GAME_ID "$IDX")
        if tx_succeeded "$RESULT"; then
          KNOWN_SHELL="live"
          echo "  [INVERTER] blank -> live"
          USED=true; break
        fi
      fi

      # HANDCUFFS (4) — skip opponent
      if [ "$ITEM_VAL" = "4" ]; then
        SKIP=$(cast_call "skipNextTurn(uint256,address)(bool)" $GAME_ID "$OPPONENT")
        if [ "$SKIP" = "false" ]; then
          RESULT=$(cast_send "$CURRENT_PK" "useItem(uint256,uint8)" $GAME_ID "$IDX")
          if tx_succeeded "$RESULT"; then
            echo "  [HANDCUFFS] $OPPONENT_NAME pierde su turno"
            USED=true; break
          fi
        fi
      fi
    done

    $USED || break
  done

  # ── Disparar ──
  if [ "$KNOWN_SHELL" = "blank" ]; then
    echo "  >> SHOOT SELF (blank = turno extra)"
    RESULT=$(cast_send "$CURRENT_PK" "shootSelf(uint256)" $GAME_ID)
  else
    echo "  >> SHOOT $OPPONENT_NAME"
    RESULT=$(cast_send "$CURRENT_PK" "shootOpponent(uint256,address)" $GAME_ID "$OPPONENT")
  fi

  if tx_succeeded "$RESULT"; then
    RETRIES=0

    # Verificar si el juego termino con este disparo
    NEW_PHASE=$(cast_call "getPhase(uint256)(uint8)" $GAME_ID)
    if [ "$NEW_PHASE" = "2" ]; then
      # Juego termino — no leer HP porque puede haber cambiado de ronda
      echo "     BANG! Eliminado!"
      break
    fi

    # Leer HP post-disparo para determinar resultado
    NEW_HP1=$(cast_call "hp(uint256,address)(uint8)" $GAME_ID "$P1")
    NEW_HP2=$(cast_call "hp(uint256,address)(uint8)" $GAME_ID "$P2")

    # Detectar si cambio de ronda (HP subio) — en ese caso el disparo consumio la ultima shell
    NEW_ROUND=$(get_round)

    if [ "$KNOWN_SHELL" = "blank" ]; then
      echo "     *click* Blank -> turno extra!"
    elif [ "$NEW_ROUND" != "$PREV_ROUND" ]; then
      # Cambio de ronda: el disparo agoto las shells
      echo "     Shells agotadas -> nueva ronda"
    elif [ "$NEW_HP1" != "$HP1" ] || [ "$NEW_HP2" != "$HP2" ]; then
      # Alguien recibio dano
      if [ "$NEW_HP1" -lt "$HP1" ] 2>/dev/null; then
        DMG=$((HP1 - NEW_HP1))
        echo "     BANG! P1 -${DMG}HP (${HP1}->${NEW_HP1})"
      fi
      if [ "$NEW_HP2" -lt "$HP2" ] 2>/dev/null; then
        DMG=$((HP2 - NEW_HP2))
        echo "     BANG! P2 -${DMG}HP (${HP2}->${NEW_HP2})"
      fi
    else
      echo "     *click* Blank..."
    fi
  else
    RETRIES=$((RETRIES + 1))
    if [ $RETRIES -ge 5 ]; then
      echo "  ERROR: Demasiados reintentos, abortando."
      break
    fi
    echo "     [Reintentando... ($RETRIES)]"
    sleep 1
    TURN=$((TURN - 1))
    continue
  fi

  sleep $PLAY_DELAY
done

# ── 5. Resultado final ─────────────────────────────────────

echo ""
echo ""
echo "============================================"
echo "          GAME OVER"
echo "============================================"

HP1=$(cast_call "hp(uint256,address)(uint8)" $GAME_ID "$P1")
HP2=$(cast_call "hp(uint256,address)(uint8)" $GAME_ID "$P2")

# Determinar ganador por HP
if [ "$HP1" -gt 0 ] 2>/dev/null && [ "$HP2" -eq 0 ] 2>/dev/null; then
  WINNER_NAME="P1"
  WINNER_ADDR="$P1"
elif [ "$HP2" -gt 0 ] 2>/dev/null && [ "$HP1" -eq 0 ] 2>/dev/null; then
  WINNER_NAME="P2"
  WINNER_ADDR="$P2"
else
  WINNER_NAME="???"
  WINNER_ADDR="unknown"
fi

BAL1=$(cast balance --rpc-url "$RPC" "$P1" --ether 2>/dev/null)
BAL2=$(cast balance --rpc-url "$RPC" "$P2" --ether 2>/dev/null)

echo ""
echo "  GANADOR:  $WINNER_NAME"
echo "  Premio:   0.00002 ETH"
echo ""
echo "  HP final: P1=$HP1  P2=$HP2"
echo "  Balance:  P1 = $BAL1 ETH"
echo "            P2 = $BAL2 ETH"
echo "  Turnos:   $TURN"
echo ""

# ── Player Profile Stats ──
echo "  ── Player Stats ──"
for PADDR in "$P1" "$P2"; do
  PNAME=$(name_for "$PADDR")
  STATS_RAW=$(cast_call_profile "getStats(address)((uint32,uint32,uint32,uint32,uint32,uint32,uint256))" "$PADDR")
  # Parse tuple output: (gamesPlayed, gamesWon, kills, deaths, shotsFired, itemsUsed, totalEarnings)
  STATS_CLEAN=$(echo "$STATS_RAW" | tr -d '()' | tr ',' '\n' | tr -d ' ')
  GP=$(echo "$STATS_CLEAN" | sed -n '1p')
  GW=$(echo "$STATS_CLEAN" | sed -n '2p')
  KL=$(echo "$STATS_CLEAN" | sed -n '3p')
  DT=$(echo "$STATS_CLEAN" | sed -n '4p')
  SF=$(echo "$STATS_CLEAN" | sed -n '5p')
  IU=$(echo "$STATS_CLEAN" | sed -n '6p')
  TE=$(echo "$STATS_CLEAN" | sed -n '7p')
  echo "  $PNAME: Games=$GP Won=$GW Kills=$KL Deaths=$DT Shots=$SF Items=$IU Earnings=$TE"
done

echo ""
echo "============================================"
