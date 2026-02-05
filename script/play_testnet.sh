#!/bin/bash
#
# Buckshot Roulette — Monad Testnet 1v1 game simulation
#
# Deploya contratos y ejecuta una partida completa entre 2 jugadores en Monad testnet.
# Usa Foundry keystores (player1, player2) para firmar transacciones.
#
# Prerequisitos:
#   1. Crear keystores:
#        cast wallet import player1 --interactive
#        cast wallet import player2 --interactive
#   2. Fondear ambas cuentas con MON del faucet: https://testnet.monad.xyz/
#
# Uso:   ./script/play_testnet.sh
# Requisitos: foundry (forge, cast)
#

# ── Config ──────────────────────────────────────────────────
RPC="https://testnet-rpc.monad.xyz"
CHAIN_ID=10143

BUYIN="10000000000000"  # 0.00001 MON
GAME_ID=0
MAX_TURNS=150
TX_SLEEP=3       # segundos entre transacciones
CONFIRM_SLEEP=5  # segundos despues del deploy

ITEM_NAMES=("NONE" "MAGNIFYING_GLASS" "BEER" "HANDSAW" "HANDCUFFS" "CIGARETTES" "INVERTER")

# ── Pedir passwords primero ──────────────────────────────────

echo "============================================"
echo "   BUCKSHOT ROULETTE — Monad Testnet"
echo "============================================"
echo ""

read -s -p "Password para player1 keystore: " PW1
echo ""
read -s -p "Password para player2 keystore: " PW2
echo ""
echo ""

# ── Verificar keystores con las passwords ────────────────────

P1=$(cast wallet address --account player1 --password "$PW1" 2>/dev/null) || {
  echo "ERROR: Keystore 'player1' no encontrado o password incorrecta."
  echo "Crea uno con: cast wallet import player1 --interactive"
  exit 1
}
P2=$(cast wallet address --account player2 --password "$PW2" 2>/dev/null) || {
  echo "ERROR: Keystore 'player2' no encontrado o password incorrecta."
  echo "Crea uno con: cast wallet import player2 --interactive"
  exit 1
}

echo "  Player 1: $P1"
echo "  Player 2: $P2"

# ── Verificar balances ───────────────────────────────────────

BAL1=$(cast balance --rpc-url "$RPC" "$P1" --ether 2>/dev/null)
BAL2=$(cast balance --rpc-url "$RPC" "$P2" --ether 2>/dev/null)

echo "  Balance P1: $BAL1 MON"
echo "  Balance P2: $BAL2 MON"
echo ""

# Verificar que tienen fondos minimos (al menos 0.01 MON para gas + buy-in)
MIN_BAL="0.01"
if [ "$(echo "$BAL1 < $MIN_BAL" | bc -l 2>/dev/null)" = "1" ]; then
  echo "ERROR: P1 necesita al menos $MIN_BAL MON. Fondea desde: https://testnet.monad.xyz/"
  exit 1
fi
if [ "$(echo "$BAL2 < $MIN_BAL" | bc -l 2>/dev/null)" = "1" ]; then
  echo "ERROR: P2 necesita al menos $MIN_BAL MON. Fondea desde: https://testnet.monad.xyz/"
  exit 1
fi

# ── Helpers ─────────────────────────────────────────────────

cast_call() {
  cast call --rpc-url "$RPC" "$GAME_ADDR" "$@" 2>/dev/null
}

cast_send() {
  local account="$1"; shift
  local pw="$1"; shift
  cast send --rpc-url "$RPC" --account "$account" --password "$pw" --gas-limit 1000000 "$GAME_ADDR" "$@" 2>&1
}

cast_send_factory() {
  local account="$1"; shift
  local pw="$1"; shift
  cast send --rpc-url "$RPC" --account "$account" --password "$pw" --gas-limit 1000000 "$FACTORY_ADDR" "$@" 2>&1
}

account_for() {
  case "$(echo "$1" | tr '[:upper:]' '[:lower:]')" in
    "$(echo "$P1" | tr '[:upper:]' '[:lower:]')") echo "player1" ;;
    *) echo "player2" ;;
  esac
}

pw_for() {
  case "$(echo "$1" | tr '[:upper:]' '[:lower:]')" in
    "$(echo "$P1" | tr '[:upper:]' '[:lower:]')") echo "$PW1" ;;
    *) echo "$PW2" ;;
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

get_round() {
  local raw
  raw=$(cast_call "getGameState(uint256)" $GAME_ID)
  if [ -z "$raw" ]; then echo "0"; return; fi
  local round_hex="${raw:322:64}"
  local round_dec=$((16#${round_hex##+(0)}))
  echo "${round_dec:-0}"
}

# ── 1. Deploy de contratos ─────────────────────────────────

echo "[1/3] Deployando contratos en Monad testnet..."

# Obtener gas price actual para evitar que forge duplique la estimacion
GAS_PRICE=$(cast gas-price --rpc-url "$RPC" 2>/dev/null)
if [ -z "$GAS_PRICE" ]; then
  echo "ERROR: No se pudo obtener el gas price"
  exit 1
fi
echo "  Gas price: $((GAS_PRICE / 1000000000)) gwei"
echo "  (esto puede tardar ~30s)"
echo ""

DEPLOY_OUTPUT=$(forge script script/Deploy.s.sol \
  --rpc-url "$RPC" \
  --account player1 \
  --password "$PW1" \
  --with-gas-price "$GAS_PRICE" \
  --broadcast \
  --slow \
  --timeout 120 2>&1) || true

GAME_ADDR=$(echo "$DEPLOY_OUTPUT" | grep "BuckshotGame deployed" | awk '{print $NF}')
FACTORY_ADDR=$(echo "$DEPLOY_OUTPUT" | grep "GameFactory deployed" | awk '{print $NF}')
WAGER_ADDR=$(echo "$DEPLOY_OUTPUT" | grep "BuckshotWager deployed" | awk '{print $NF}')

if [ -z "$GAME_ADDR" ]; then
  echo "ERROR: Deploy fallo"
  echo "$DEPLOY_OUTPUT"
  exit 1
fi

# Verificar que los contratos existen on-chain
sleep $CONFIRM_SLEEP
GAME_CODE=$(cast code --rpc-url "$RPC" "$GAME_ADDR" 2>/dev/null)
if [ "$GAME_CODE" = "0x" ] || [ -z "$GAME_CODE" ]; then
  echo "ERROR: Deploy no confirmo on-chain. Revisa el output:"
  echo "$DEPLOY_OUTPUT"
  exit 1
fi

echo "  BuckshotGame:  $GAME_ADDR"
echo "  GameFactory:   $FACTORY_ADDR"
echo "  BuckshotWager: $WAGER_ADDR"

# ── 2. Crear partida via Factory ───────────────────────────

echo ""
echo "[2/3] Creando partida 1v1 via Factory (buy-in: 0.00001 MON cada uno)..."

# P1 joins queue
echo "  P1 joining queue..."
JOIN1=$(cast_send_factory "player1" "$PW1" "joinQueue(uint256)" "$BUYIN" --value 0.00001ether)
if ! tx_succeeded "$JOIN1"; then
  echo "ERROR: P1 no pudo unirse a la queue"
  echo "$JOIN1"
  exit 1
fi
sleep $TX_SLEEP

# P2 joins queue
echo "  P2 joining queue..."
JOIN2=$(cast_send_factory "player2" "$PW2" "joinQueue(uint256)" "$BUYIN" --value 0.00001ether)
if ! tx_succeeded "$JOIN2"; then
  echo "ERROR: P2 no pudo unirse a la queue"
  echo "$JOIN2"
  exit 1
fi
sleep $TX_SLEEP

# Start game from queue
GAME_CREATED=false
for ATTEMPT in 1 2 3 4 5; do
  START_RESULT=$(cast_send_factory "player1" "$PW1" "startGame(uint256,uint8)" "$BUYIN" 2)

  if tx_succeeded "$START_RESULT"; then
    sleep $TX_SLEEP
    PHASE=$(cast_call "getPhase(uint256)(uint8)" $GAME_ID)
    if [ "$PHASE" = "1" ]; then
      GAME_CREATED=true
      break
    fi
  fi
  echo "  Intento $ATTEMPT fallo, reintentando..."
  sleep $TX_SLEEP
done

if [ "$GAME_CREATED" != "true" ]; then
  echo "ERROR: No se pudo crear el juego despues de 5 intentos"
  exit 1
fi

echo "  Game ID: $GAME_ID | Prize Pool: 0.00002 MON"
echo "  P1: $P1"
echo "  P2: $P2"

# ── 3. Jugar la partida ────────────────────────────────────

echo ""
echo "[3/3] Jugando..."
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
    sleep $TX_SLEEP
    continue
  fi

  CURRENT_NAME=$(name_for "$CURRENT")
  CURRENT_ACCOUNT=$(account_for "$CURRENT")
  CURRENT_PW=$(pw_for "$CURRENT")
  OPPONENT=$(opponent_of "$CURRENT")
  OPPONENT_NAME=$(name_for "$OPPONENT")

  # Obtener HP
  HP1=$(cast_call "hp(uint256,address)(uint8)" $GAME_ID "$P1")
  HP2=$(cast_call "hp(uint256,address)(uint8)" $GAME_ID "$P2")

  # Obtener shells
  SHELLS_RAW=$(cast_call "getVisibleShells(uint256)(uint8,uint8)" $GAME_ID)
  LIVE=$(echo "$SHELLS_RAW" | head -1 | tr -d ' ')
  BLANK=$(echo "$SHELLS_RAW" | tail -1 | tr -d ' ')

  # Detectar cambio de ronda
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
        RESULT=$(cast_send "$CURRENT_ACCOUNT" "$CURRENT_PW" "useItem(uint256,uint8)" $GAME_ID "$IDX")
        if tx_succeeded "$RESULT"; then
          sleep $TX_SLEEP
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
        RESULT=$(cast_send "$CURRENT_ACCOUNT" "$CURRENT_PW" "useItem(uint256,uint8)" $GAME_ID "$IDX")
        if tx_succeeded "$RESULT"; then
          sleep $TX_SLEEP
          echo "  [CIGARETTES] +1 HP"
          USED=true; break
        fi
      fi

      # HANDSAW (3) — double damage (skip if shell is blank)
      if [ "$ITEM_VAL" = "3" ] && [ "$KNOWN_SHELL" != "blank" ]; then
        SAW=$(cast_call "sawActive(uint256,address)(bool)" $GAME_ID "$CURRENT")
        if [ "$SAW" = "false" ]; then
          RESULT=$(cast_send "$CURRENT_ACCOUNT" "$CURRENT_PW" "useItem(uint256,uint8)" $GAME_ID "$IDX")
          if tx_succeeded "$RESULT"; then
            sleep $TX_SLEEP
            echo "  [HANDSAW] x2 dano activado"
            USED=true; break
          fi
        fi
      fi

      # BEER (2) — eject shell if blank
      if [ "$ITEM_VAL" = "2" ] && [ "$KNOWN_SHELL" = "blank" ]; then
        RESULT=$(cast_send "$CURRENT_ACCOUNT" "$CURRENT_PW" "useItem(uint256,uint8)" $GAME_ID "$IDX")
        if tx_succeeded "$RESULT"; then
          sleep $TX_SLEEP
          echo "  [BEER] expulsa blank"
          KNOWN_SHELL=""
          USED=true; break
        fi
      fi

      # INVERTER (6) — flip shell if blank
      if [ "$ITEM_VAL" = "6" ] && [ "$KNOWN_SHELL" = "blank" ]; then
        RESULT=$(cast_send "$CURRENT_ACCOUNT" "$CURRENT_PW" "useItem(uint256,uint8)" $GAME_ID "$IDX")
        if tx_succeeded "$RESULT"; then
          sleep $TX_SLEEP
          KNOWN_SHELL="live"
          echo "  [INVERTER] blank -> live"
          USED=true; break
        fi
      fi

      # HANDCUFFS (4) — skip opponent
      if [ "$ITEM_VAL" = "4" ]; then
        SKIP=$(cast_call "skipNextTurn(uint256,address)(bool)" $GAME_ID "$OPPONENT")
        if [ "$SKIP" = "false" ]; then
          RESULT=$(cast_send "$CURRENT_ACCOUNT" "$CURRENT_PW" "useItem(uint256,uint8)" $GAME_ID "$IDX")
          if tx_succeeded "$RESULT"; then
            sleep $TX_SLEEP
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
    RESULT=$(cast_send "$CURRENT_ACCOUNT" "$CURRENT_PW" "shootSelf(uint256)" $GAME_ID)
  else
    echo "  >> SHOOT $OPPONENT_NAME"
    RESULT=$(cast_send "$CURRENT_ACCOUNT" "$CURRENT_PW" "shootOpponent(uint256,address)" $GAME_ID "$OPPONENT")
  fi

  if tx_succeeded "$RESULT"; then
    RETRIES=0
    sleep $TX_SLEEP

    # Verificar si el juego termino con este disparo
    NEW_PHASE=$(cast_call "getPhase(uint256)(uint8)" $GAME_ID)
    if [ "$NEW_PHASE" = "2" ]; then
      echo "     BANG! Eliminado!"
      break
    fi

    # Leer HP post-disparo para determinar resultado
    NEW_HP1=$(cast_call "hp(uint256,address)(uint8)" $GAME_ID "$P1")
    NEW_HP2=$(cast_call "hp(uint256,address)(uint8)" $GAME_ID "$P2")

    # Detectar si cambio de ronda
    NEW_ROUND=$(get_round)

    if [ "$KNOWN_SHELL" = "blank" ]; then
      echo "     *click* Blank -> turno extra!"
    elif [ "$NEW_ROUND" != "$PREV_ROUND" ]; then
      echo "     Shells agotadas -> nueva ronda"
    elif [ "$NEW_HP1" != "$HP1" ] || [ "$NEW_HP2" != "$HP2" ]; then
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
    sleep $TX_SLEEP
    TURN=$((TURN - 1))
    continue
  fi

  sleep $TX_SLEEP
done

# ── 4. Resultado final ─────────────────────────────────────

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
elif [ "$HP2" -gt 0 ] 2>/dev/null && [ "$HP1" -eq 0 ] 2>/dev/null; then
  WINNER_NAME="P2"
else
  WINNER_NAME="???"
fi

BAL1=$(cast balance --rpc-url "$RPC" "$P1" --ether 2>/dev/null)
BAL2=$(cast balance --rpc-url "$RPC" "$P2" --ether 2>/dev/null)

echo ""
echo "  GANADOR:  $WINNER_NAME"
echo "  Premio:   0.00002 MON"
echo ""
echo "  HP final: P1=$HP1  P2=$HP2"
echo "  Balance:  P1 = $BAL1 MON"
echo "            P2 = $BAL2 MON"
echo "  Turnos:   $TURN"
echo ""
echo "============================================"
