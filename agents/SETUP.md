# Buckshot Roulette AI Agents — Setup Guide

## Qué se construyó

Un orquestador Node.js/TypeScript con 5 agentes AI que juegan Buckshot Roulette on-chain de forma autónoma:

| Agente | Personalidad | LLM |
|--------|-------------|-----|
| El Calculador | Probabilístico, frío | Claude Sonnet |
| El Agresivo | Violento, handsaw first | GPT-4o |
| La Tramposa | Combos de items, inverter | GPT-4o |
| El Filósofo | Equilibrado, reflexivo | Claude Sonnet |
| El Aprendiz | Adaptativo, sin doctrina | Claude Sonnet |

Si no hay API keys de LLM configuradas, los agentes usan una **estrategia determinística de fallback** (basada en `play_local.sh`).

---

## Paso 1: Configurar environment variables

```bash
cd agents
cp .env.example .env
```

Editar `.env` con tus valores:

### Variables requeridas

| Variable | Descripción | Default (Anvil local) |
|----------|-------------|----------------------|
| `RPC_URL` | URL del RPC | `http://127.0.0.1:8545` |
| `BUCKSHOT_GAME_ADDRESS` | Address del contrato BuckshotGame | `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512` |
| `GAME_FACTORY_ADDRESS` | Address del contrato GameFactory | `0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9` |
| `AGENT_1_PRIVATE_KEY` | PK del agente 1 (El Calculador) | Anvil account #2 |
| `AGENT_2_PRIVATE_KEY` | PK del agente 2 (El Agresivo) | Anvil account #3 |
| `AGENT_3_PRIVATE_KEY` | PK del agente 3 (La Tramposa) | Anvil account #4 |
| `AGENT_4_PRIVATE_KEY` | PK del agente 4 (El Filósofo) | Anvil account #5 |
| `AGENT_5_PRIVATE_KEY` | PK del agente 5 (El Aprendiz) | Anvil account #6 |

### Variables opcionales (LLM)

| Variable | Descripción | Sin configurar = fallback determinístico |
|----------|-------------|------------------------------------------|
| `ANTHROPIC_API_KEY` | API key de Anthropic (para Sonnet) | Agentes 1, 4 y 5 usan fallback |
| `OPENAI_API_KEY` | API key de OpenAI (para GPT-4o) | Agentes 2 y 3 usan fallback |

### Variables de tuning

| Variable | Descripción | Default |
|----------|-------------|---------|
| `BUY_IN` | Buy-in por partida en ETH | `0.00001` |
| `POLL_INTERVAL_MS` | Intervalo de polling en ms | `2000` |
| `ACTION_DELAY_MS` | Delay entre acciones (efecto visual) | `2500` |

---

## Paso 2: Test local con Anvil (sin LLM keys)

Esto prueba que todo funciona con la estrategia de fallback. No necesitas API keys.

### Terminal 1: Anvil + Deploy
```bash
# Desde la raíz del proyecto
make anvil
```

### Terminal 2: Deploy contratos
```bash
make deploy-local
```

### Terminal 3: Correr agentes
```bash
cd agents
npm install     # Solo la primera vez
cp .env.example .env   # Solo la primera vez (los defaults de Anvil ya están)
npx tsx src/index.ts
```

### Terminal 4 (opcional): Frontend para ver visualmente
```bash
cd frontend
npm install     # Solo la primera vez
npm run dev
```

Deberías ver en la terminal 3:
```
[SYSTEM] === Buckshot Roulette AI Agents ===
[El Calculador] Initialized at 0x3C44... with none
[El Agresivo] Initialized at 0x90F7... with none
[La Tramposa] Initialized at 0x15d3... with none
[El Filósofo] Initialized at 0x9965... with none
[El Aprendiz] Initialized at 0x976E... with none
[SYSTEM] Creating new match...
[El Calculador] Joined queue
[El Agresivo] Joined queue
...
[GAME] Game #0 created!
[GAME] --- El Calculador's turn ---
[El Calculador] Using fallback strategy
[El Calculador] Actions: useItem[0] → shootOpponent(0x90F7...)
...
```

---

## Paso 3: Activar LLMs (decisiones inteligentes)

### Obtener API keys

1. **Anthropic**: https://console.anthropic.com/ → API Keys → Create Key
2. **OpenAI**: https://platform.openai.com/api-keys → Create new secret key

### Configurar en `.env`
```bash
ANTHROPIC_API_KEY=sk-ant-api03-...
OPENAI_API_KEY=sk-proj-...
```

Puedes configurar solo una de las dos. Los agentes que no tengan su LLM asignado usarán el que esté disponible, o fallback si ninguno está configurado.

### Costo estimado por LLM
- ~1024 tokens por turno (prompt + respuesta)
- ~$0.003 por turno con Sonnet, ~$0.005 con GPT-4o
- Una partida completa: ~$0.10-0.20
- **~$10/semana** corriendo 24/7

---

## Paso 4: Deploy en Monad Testnet

### 4a. Generar 5 wallets nuevas

```bash
# Generar 5 private keys (o usa las que prefieras)
cast wallet new
cast wallet new
cast wallet new
cast wallet new
cast wallet new
```

### 4b. Fondear wallets via faucet

```bash
# Repetir para cada address
curl -X POST https://agents.devnads.com/v1/faucet \
  -H "Content-Type: application/json" \
  -d '{"chainId": 10143, "address": "0xTU_ADDRESS_AQUI"}'
```

### 4c. Deploy contratos a Monad (si no están deployados)

```bash
# Desde la raíz del proyecto
make deploy
```

Anotar las addresses del output.

### 4d. Actualizar `.env`

```env
RPC_URL=https://testnet-rpc.monad.xyz
BUCKSHOT_GAME_ADDRESS=0x...  # Del deploy
GAME_FACTORY_ADDRESS=0x...   # Del deploy
AGENT_1_PRIVATE_KEY=0x...    # De paso 4a
AGENT_2_PRIVATE_KEY=0x...
AGENT_3_PRIVATE_KEY=0x...
AGENT_4_PRIVATE_KEY=0x...
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-proj-...
```

### 4e. Correr
```bash
cd agents
npx tsx src/index.ts
```

---

## Paso 5: Deploy en Railway (producción)

Railway es la forma más simple de correr los agentes 24/7. No necesitas servidor, SSH, ni PM2 — conectas GitHub y listo.

### 5a. Crear cuenta en Railway

1. Ir a [railway.com](https://railway.com) → **Login with GitHub**
2. No necesita tarjeta de crédito para el trial ($5 de crédito gratis)

### 5b. Crear proyecto

1. **New Project** → **Deploy from GitHub repo**
2. Seleccionar tu repositorio de `buckshot-roulette`
3. En **Settings** → configurar **Root Directory**: `agents`
   - Esto es clave: Railway solo buildea desde la carpeta `agents/`
4. Railway detecta el `Dockerfile` automáticamente (forzado por `railway.toml`)

### 5c. Configurar environment variables

En el dashboard de Railway → tu servicio → **Variables** tab, agregar:

```
RPC_URL=https://testnet-rpc.monad.xyz
BUCKSHOT_GAME_ADDRESS=0x...
GAME_FACTORY_ADDRESS=0x...
AGENT_1_PRIVATE_KEY=0x...
AGENT_2_PRIVATE_KEY=0x...
AGENT_3_PRIVATE_KEY=0x...
AGENT_4_PRIVATE_KEY=0x...
AGENT_5_PRIVATE_KEY=0x...
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-proj-...
```

Usa los valores de Monad testnet del Paso 4.

### 5d. Deploy

- El deploy arranca automáticamente al configurar el proyecto
- Deploys futuros se disparan automáticamente al pushear a `main`
- Railway usa el `Dockerfile` existente (multi-stage build, Node 20 Alpine)
- Si crashea, Railway lo reinicia solo (`restartPolicyType = "always"` en `railway.toml`)

### 5e. Monitoreo

- **Logs**: Dashboard → Deployments → **View Logs** (tiempo real)
- **Métricas**: Dashboard → **Metrics** tab (CPU, RAM, network)
- **Redeploy manual**: Dashboard → **Deployments** → **Redeploy**

### Costo estimado

- Railway cobra por uso: ~$5/mes para un servicio Node.js liviano corriendo 24/7
- Trial incluye $5 de crédito gratis (suficiente para ~1 mes)

---

## Paso 6: Deploy con OpenClaw (modo orquestador)

OpenClaw reemplaza la lógica de decisión: en vez de llamar a Anthropic/OpenAI directamente, OpenClaw usa su propio LLM como cerebro. Los agentes exponen su funcionalidad como CLI commands que OpenClaw invoca.

**Ventaja:** No necesitas API keys de LLM. OpenClaw maneja el LLM internamente. Solo necesitas las private keys de los agentes y las addresses de los contratos.

### 6a. Deploy OpenClaw en Railway

1. Ir a [railway.com](https://railway.com) → **Deploy** → buscar **OpenClaw** (o usar el template link)
2. Seguir el setup wizard de OpenClaw
3. Conectar un canal (Telegram o Discord)

### 6b. Configurar environment variables

En el workspace de OpenClaw, configurar las mismas env vars que en el modo standalone (sin las LLM keys):

```
RPC_URL=https://testnet-rpc.monad.xyz
BUCKSHOT_GAME_ADDRESS=0x...
GAME_FACTORY_ADDRESS=0x...
AGENT_1_PRIVATE_KEY=0x...
AGENT_2_PRIVATE_KEY=0x...
AGENT_3_PRIVATE_KEY=0x...
AGENT_4_PRIVATE_KEY=0x...
AGENT_5_PRIVATE_KEY=0x...
BUY_IN=0.00001
```

**No necesitas `ANTHROPIC_API_KEY` ni `OPENAI_API_KEY`** — OpenClaw usa su propio LLM.

### 6c. Instalar el skill

1. Copiar la carpeta `agents/` al workspace de OpenClaw como skill:
   - El código va en `/data/workspace/skills/buckshot-roulette/game/`
   - El skill file va en `/data/workspace/skills/buckshot-roulette/SKILL.md` (copiar de `agents/openclaw/SKILL.md`)
2. Copiar el `.env` configurado al directorio del skill
3. Ejecutar el setup script:
   ```bash
   bash /data/workspace/skills/buckshot-roulette/scripts/setup.sh
   ```

### 6d. Configurar cron job

En OpenClaw, configurar un cron que ejecute el skill cada ~5 segundos. Esto hace que el LLM:
1. Verifique el estado del juego
2. Cree partidas si no hay una activa
3. Juegue el turno del agente que corresponda

### 6e. Test manual

Desde el chat de OpenClaw, puedes mandar:
- "check the buckshot roulette game status"
- "start a new buckshot roulette game"
- "play the next turn"

OpenClaw interpretará tu mensaje, invocará el skill, y ejecutará los CLI commands correspondientes.

### Arquitectura OpenClaw vs Standalone

```
STANDALONE (index.ts):              OPENCLAW:
index.ts (while true)               OpenClaw cron (cada ~5s)
  → matchmaker.ts                     → SKILL.md define reglas + personalidades
  → game-watcher.ts                   → CLI commands = tools de OpenClaw
  → prompt-builder.ts                 → OpenClaw LLM decide (no API directas)
  → sonnet.ts / gpt.ts               → Personalidades en SKILL.md
  → action-parser.ts                  → OpenClaw parsea la decisión
  → validator.ts                      → fallback-strategy como CLI command
  → tx-executor.ts                    → use-item, shoot-opponent, shoot-self como CLI
```

---

## Estructura de archivos creados

```
agents/
├── package.json                    # Deps: viem, anthropic, openai, dotenv, tsx
├── tsconfig.json                   # ES2022, strict
├── .env.example                    # Template de variables
├── .gitignore                      # node_modules, dist, .env
├── Dockerfile                      # Node 20 Alpine (usado por Railway)
├── railway.toml                    # Config de Railway (builder + restart policy)
├── openclaw/
│   ├── SKILL.md                    # Skill de OpenClaw (reglas, personalidades, tools, loop)
│   └── scripts/
│       └── setup.sh                # Setup script para workspace de OpenClaw
├── src/
│   ├── index.ts                    # Entry point + main loop (modo standalone)
│   ├── cli.ts                      # CLI entry point (modo OpenClaw)
│   ├── config.ts                   # Lee env vars
│   ├── logger.ts                   # Logging con colores
│   ├── contracts/
│   │   ├── abis.ts                 # ABIs completos de BuckshotGame + GameFactory
│   │   ├── addresses.ts            # Addresses desde env
│   │   └── client.ts              # PublicClient + 5 WalletClients (viem)
│   ├── agents/
│   │   ├── types.ts               # Agent type definition
│   │   ├── agent-manager.ts       # Carga y gestiona los 5 agentes
│   │   └── personalities/
│   │       ├── el-calculador.md   # Probabilístico (Sonnet)
│   │       ├── el-agresivo.md     # Violento (GPT-4o)
│   │       ├── la-tramposa.md     # Combos (GPT-4o)
│   │       ├── el-filosofo.md     # Equilibrado (Sonnet)
│   │       └── el-aprendiz.md    # Adaptativo (Sonnet)
│   ├── llm/
│   │   ├── provider.ts           # Interface LLMProvider
│   │   ├── sonnet.ts             # Anthropic SDK
│   │   ├── gpt.ts                # OpenAI SDK
│   │   └── prompt-builder.ts     # System prompt + game state → JSON
│   ├── strategy/
│   │   ├── game-state.ts         # Lee estado on-chain → ReadableGameState
│   │   ├── action-types.ts       # GameAction types + ITEM_NAMES
│   │   ├── action-parser.ts      # Parsea JSON del LLM
│   │   └── validator.ts          # Valida acciones + fallback determinístico
│   ├── executor/
│   │   └── tx-executor.ts        # Envía txs con retry + backoff
│   ├── coordinator/
│   │   ├── matchmaker.ts         # joinQueue + startGame
│   │   └── timeout-enforcer.ts   # forceTimeout si turno expira
│   └── watcher/
│       ├── game-watcher.ts       # Poll loop: detecta turnos → LLM → execute
│       └── turn-detector.ts      # Dedup de turnos
```

---

## Troubleshooting

| Problema | Solución |
|----------|----------|
| `Missing env var` | Verificar que `.env` existe y tiene todas las vars |
| `Insufficient balance` | Fondear wallets con el faucet |
| TX reverts con `AlreadyInQueue` | Un agente quedó en queue de una corrida anterior. Reiniciar Anvil o cambiar wallets |
| `LLM error` / timeout | Los agentes usan fallback automáticamente, no crashea |
| Agentes no toman turno | Verificar que `BUCKSHOT_GAME_ADDRESS` y `GAME_FACTORY_ADDRESS` son correctos |
| `ECONNREFUSED` en RPC | Verificar que Anvil/nodo está corriendo en la URL configurada |
