Step-by-step: Buckshot Roulette + OpenClaw en Monad Testnet

  Paso 1: Deploy contratos a Monad (si no los tienes)

  # Desde la raíz del repo
  make deploy

  Anota las addresses de BuckshotGame y GameFactory del output.

  Paso 2: Generar 5 wallets para los agentes

  cast wallet new
  cast wallet new
  cast wallet new
  cast wallet new
  cast wallet new

  Guarda las 5 private keys y addresses.

  Paso 3: Fondear las 5 wallets

  Repetir para cada address:
  curl -X POST https://agents.devnads.com/v1/faucet \
    -H "Content-Type: application/json" \
    -d '{"chainId": 10143, "address": "0xTU_ADDRESS"}'

  Paso 4: Probar el CLI contra Monad

  cd agents
  cp .env.example .env

  Editar .env:
  RPC_URL=https://testnet-rpc.monad.xyz
  BUCKSHOT_GAME_ADDRESS=0x...del_deploy
  GAME_FACTORY_ADDRESS=0x...del_deploy
  AGENT_1_PRIVATE_KEY=0x...del_paso_2
  AGENT_2_PRIVATE_KEY=0x...
  AGENT_3_PRIVATE_KEY=0x...
  AGENT_4_PRIVATE_KEY=0x...
  AGENT_5_PRIVATE_KEY=0x...
  BUY_IN=0.00001

  Probar:
  npx tsx src/cli.ts agents          # Debería mostrar las 5 addresses
  npx tsx src/cli.ts game-status     # No active game
  npx tsx src/cli.ts queue-length    # 0

  Si responde, el CLI habla con Monad correctamente.

  Paso 5: Deploy OpenClaw en Railway

  1. Ir a https://railway.com y loguearte con GitHub
  2. Click New Project → Deploy a Template → buscar OpenClaw (o ir al link directo del template)
  3. Railway te pide configurar variables — por ahora dale deploy con los defaults de OpenClaw
  4. Espera a que buildee y arranque (~2 min)
  5. OpenClaw te da un setup wizard URL — abrirla

  Paso 6: Configurar OpenClaw

  En el setup wizard:
  1. Conectar un canal: Telegram o Discord (ahi es donde vas a chatear con el bot)
  2. Configurar el LLM: OpenClaw trae su propio LLM integrado, solo necesitas configurar el modelo

  Paso 7: Instalar el skill en OpenClaw

  Esto es lo clave — necesitas copiar el código al workspace de OpenClaw:

  1. Subir el código de agents al workspace de OpenClaw en la ruta:
  /data/workspace/skills/buckshot-roulette/game/
  1. Copiar todo el contenido de agents/ ahí (package.json, src/, .env, etc.)
  2. Copiar el SKILL.md a:
  /data/workspace/skills/buckshot-roulette/SKILL.md
  2. (Este archivo ya existe en agents/openclaw/SKILL.md)
  3. Copiar tu .env (con las keys de Monad) al directorio del skill:
  /data/workspace/skills/buckshot-roulette/game/.env
  4. Ejecutar el setup:
  bash /data/workspace/skills/buckshot-roulette/scripts/setup.sh
  4. Esto instala node_modules y verifica que el CLI funciona.

  Paso 8: Configurar el cron

  En la configuración de OpenClaw, crear un cron job que ejecute el skill buckshot-roulette cada ~5 segundos. Esto es lo que
   hace que el bot juegue solo:

  - Cada tick: revisa el estado del juego
  - Si no hay partida: crea una
  - Si es turno de un agente: el LLM decide qué hacer y ejecuta los CLI commands

  Paso 9: Test manual

  Desde el chat (Telegram/Discord), mandarle:
  - "check buckshot roulette status" — debería correr game-status
  - "start a new game" — debería hacer join-queue x5 + start-game
  - "play the next turn" — debería leer el estado y decidir

  Paso 10: Dejar corriendo

  Una vez que el cron está activo, OpenClaw juega solo 24/7. Puedes monitorear desde:
  - El chat de Telegram/Discord (te muestra qué hace)
  - Los logs de Railway (debug)

  ---
  Resumen de lo que va a donde
  ┌─────────────────────────┬────────────────────────────────────────────────────────────────────────┐
  │           Qué           │                                 Donde                                  │
  ├─────────────────────────┼────────────────────────────────────────────────────────────────────────┤
  │ Contratos               │ Monad testnet (ya deployados)                                          │
  ├─────────────────────────┼────────────────────────────────────────────────────────────────────────┤
  │ Private keys de agentes │ .env en OpenClaw workspace                                             │
  ├─────────────────────────┼────────────────────────────────────────────────────────────────────────┤
  │ CLI (cli.ts)            │ OpenClaw workspace, ejecutado por el skill                             │
  ├─────────────────────────┼────────────────────────────────────────────────────────────────────────┤
  │ Cerebro/LLM             │ OpenClaw (su propio modelo, no necesitas API keys de Anthropic/OpenAI) │
  ├─────────────────────────┼────────────────────────────────────────────────────────────────────────┤
  │ SKILL.md                │ Le enseña a OpenClaw las reglas, personalidades y cómo usar el CLI     │
  ├─────────────────────────┼────────────────────────────────────────────────────────────────────────┤
  │ Cron                    │ OpenClaw ejecuta el game loop cada 5s                                  │
  └─────────────────────────┴────────────────────────────────────────────────────────────────────────┘
  Arranca por el Paso 1 y avisame cuando llegues a un punto donde te trabas o necesitas ayuda.