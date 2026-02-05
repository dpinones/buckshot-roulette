# 🎯 BUCKSHOT ROULETTE ON-CHAIN — Plan de Hackathon Moltiverse v2

**Track:** Gaming Arena Agent — Bounty $10,000  
**Deadline:** 15 Feb 2026, 23:59 ET (judging rolling, submit ASAP)  
**Chain:** Monad (EVM-compatible, 10K TPS, 0.8s finality, 0.4s blocks)  
**Días disponibles:** ~11 días (5 Feb → 15 Feb)

---

## 🏗️ ARQUITECTURA — 100% ON-CHAIN

Sin backend. Sin API. Todo vive en Monad.

```
┌─────────────────────────────────────────────────────────────────┐
│                         MONAD BLOCKCHAIN                        │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐       │
│  │ GameFactory   │  │ BuckshotGame  │  │ BuckshotWager │       │
│  │ - createGame  │  │ - game logic  │  │ - sidebets    │       │
│  │ - joinQueue   │  │ - items       │  │ - payouts     │       │
│  │ - matchmaking │  │ - turns       │  │ - odds        │       │
│  └───────────────┘  └───────────────┘  └───────────────┘       │
│           │                  │                  │               │
│           └──────────────────┼──────────────────┘               │
│                              │                                  │
│                        EVENTS (logs)                            │
└──────────────────────────────┼──────────────────────────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
        ▼                      ▼                      ▼
  ┌──────────┐          ┌──────────┐          ┌──────────┐
  │ Agente 1 │          │ Agente 2 │          │ Agente N │
  │ Calculador│          │ Agresivo │          │ Spectator│
  │          │          │          │          │ (apuesta)│
  └──────────┘          └──────────┘          └──────────┘
        │                      │                      │
        └──────────────────────┼──────────────────────┘
                               │
                               ▼
                        ┌──────────┐
                        │ Frontend │  (opcional)
                        │ React    │
                        └──────────┘
```

---

## 📐 CAPA 1: SMART CONTRACTS

### 1.1 `GameFactory.sol` — Matchmaking y creación de partidas

```solidity
// Funciones principales
joinQueue(uint256 buyIn) external payable    // Agente entra a cola con buy-in
leaveQueue() external                         // Salir de la cola
startGame(uint256 queueIndex) external        // Cualquiera puede iniciar cuando hay suficientes jugadores
getQueueLength() view returns (uint256)       // Ver cuántos esperando
getActiveGames() view returns (uint256[])     // Lista de partidas activas

// Configuración
minPlayers: 2
maxPlayers: 6
supportedBuyIns: [0.01 ETH, 0.1 ETH, 1 ETH]  // Pools separados por buy-in
```

**Eventos:**
- `PlayerJoinedQueue(address player, uint256 buyIn)`
- `PlayerLeftQueue(address player)`
- `GameCreated(uint256 gameId, address[] players, uint256 buyIn)`

---

### 1.2 `BuckshotGame.sol` — Lógica del juego

#### Estado del juego
```solidity
struct Game {
    uint256 id;
    address[] players;
    mapping(address => uint8) hp;           // HP por jugador
    mapping(address => uint8[]) items;      // Items por jugador (max 8)
    uint8 currentRound;                     // 1, 2, o 3
    uint8 currentTurnIndex;                 // Índice del jugador actual
    uint8[] shells;                         // Array de balas [0=blank, 1=live]
    uint8 shellIndex;                       // Próxima bala a disparar
    uint256 turnDeadline;                   // Timestamp límite del turno
    GamePhase phase;                        // WAITING, ACTIVE, FINISHED
    address winner;
}

enum GamePhase { WAITING, ACTIVE, FINISHED }
```

#### Mecánicas de turno
```solidity
// Acciones del jugador
shootOpponent(uint256 gameId, address target) external
shootSelf(uint256 gameId) external
useItem(uint256 gameId, uint8 itemIndex) external

// Timeout - cualquiera puede llamar si el turno expiró
forceTimeout(uint256 gameId) external  // Acción default: dispara al jugador anterior

// Getters para agentes
getGameState(uint256 gameId) view returns (GameState)
getCurrentTurn(uint256 gameId) view returns (address)
getMyItems(uint256 gameId) view returns (uint8[])
getVisibleShells(uint256 gameId) view returns (uint8, uint8)  // (lives, blanks) restantes
```

#### Sistema de rondas
```
Ronda 1: 2 HP, 0 items, 2-4 shells
Ronda 2: 4 HP, 2 items cada uno, 4-6 shells  
Ronda 3: 5 HP, 4 items cada uno, 5-8 shells
```

#### Sistema de balas (Pseudorandom simple)
```solidity
// Al cargar la escopeta (inicio de ronda o cuando se vacía)
function _loadShells(uint256 gameId) internal {
    uint8 liveCount = _random(2, 4);  // 2-4 balas vivas
    uint8 blankCount = _random(1, 4); // 1-4 blanks
    
    // Crear array y mezclar
    shells = _createAndShuffle(liveCount, blankCount);
    shellIndex = 0;
    
    emit ShellsLoaded(gameId, liveCount, blankCount); // Solo revela cantidades, no orden
}

// Pseudorandom simple con timestamp (suficiente para hackathon)
uint256 private _nonce;

function _random(uint8 min, uint8 max) internal returns (uint8) {
    _nonce++;
    return min + uint8(uint256(keccak256(abi.encodePacked(
        block.timestamp,
        _nonce,
        msg.sender
    ))) % (max - min + 1));
}

function _createAndShuffle(uint8 liveCount, uint8 blankCount) internal returns (uint8[] memory) {
    uint8 total = liveCount + blankCount;
    uint8[] memory result = new uint8[](total);
    
    // Llenar: 1 = live, 0 = blank
    for (uint8 i = 0; i < liveCount; i++) result[i] = 1;
    for (uint8 i = liveCount; i < total; i++) result[i] = 0;
    
    // Fisher-Yates shuffle
    for (uint8 i = total - 1; i > 0; i--) {
        uint8 j = _random(0, i);
        (result[i], result[j]) = (result[j], result[i]);
    }
    
    return result;
}

// NOTA: Este random es predecible. Para producción usar Chainlink VRF o similar.
// Para el hackathon es suficiente ya que los agentes son nuestros.
```

**Eventos:**
- `TurnStarted(uint256 gameId, address player, uint256 deadline)`
- `ShotFired(uint256 gameId, address shooter, address target, bool wasLive, uint8 damage)`
- `ItemUsed(uint256 gameId, address player, uint8 itemType, bytes data)`
- `PlayerEliminated(uint256 gameId, address player, uint8 placement)`
- `RoundEnded(uint256 gameId, uint8 round)`
- `ShellsLoaded(uint256 gameId, uint8 liveCount, uint8 blankCount)`
- `GameEnded(uint256 gameId, address winner, uint256 prize)`

---

### 1.3 `Items.sol` — Sistema de ítems (library o dentro de BuckshotGame)

| ID | Ítem | Efecto | Implementación |
|----|------|--------|----------------|
| 1 | **Magnifying Glass** | Revela si bala actual es live/blank | `emit ShellRevealed(gameId, player, shells[shellIndex])` solo al caller |
| 2 | **Beer** | Eyecta bala actual sin disparar | `shellIndex++; emit ShellEjected(gameId)` |
| 3 | **Handsaw** | Siguiente disparo hace 2x daño | `sawActive[player] = true` |
| 4 | **Handcuffs** | Oponente pierde próximo turno | `skipNextTurn[target] = true` |
| 5 | **Cigarettes** | +1 HP (max = roundMaxHp) | `hp[player] = min(hp[player] + 1, maxHp)` |
| 6 | **Inverter** | Cambia bala actual (live↔blank) | `shells[shellIndex] = 1 - shells[shellIndex]` |

**Distribución:**
```solidity
function _distributeItems(uint256 gameId) internal {
    uint8 itemCount = currentRound == 2 ? 2 : 4;
    for (address player : activePlayers) {
        for (uint8 i = 0; i < itemCount; i++) {
            if (items[player].length < 8) {
                items[player].push(_randomItem());
            }
        }
    }
}
```

---

### 1.4 `BuckshotWager.sol` — Apuestas externas

```solidity
// Apuestas de espectadores
placeBet(uint256 gameId, address predictedWinner) external payable
// Solo mientras game.phase == ACTIVE && shells no reveladas

// Reclamar ganancias
claimWinnings(uint256 gameId) external
// Pool dividido proporcionalmente entre los que acertaron (parimutuel)

// Getters
getOdds(uint256 gameId) view returns (mapping address => uint256)
// Odds = totalPool / apuestasAlJugador

getTotalPool(uint256 gameId) view returns (uint256)
getMyBets(uint256 gameId) view returns (Bet[])
```

**Eventos:**
- `BetPlaced(uint256 gameId, address bettor, address predictedWinner, uint256 amount)`
- `WinningsClaimed(uint256 gameId, address bettor, uint256 amount)`

---

## 📐 CAPA 2: AI AGENTS

Cada agente es un proceso independiente que:
1. Escucha eventos on-chain
2. Analiza el estado del juego
3. Toma decisiones según su estrategia
4. Envía transacciones directamente a Monad

### 2.1 Estructura base del agente

```python
class BuckshotAgent:
    def __init__(self, private_key, strategy, rpc_url):
        self.wallet = Account.from_key(private_key)
        self.w3 = Web3(Web3.HTTPProvider(rpc_url))
        self.strategy = strategy
        self.game_contract = self.w3.eth.contract(address=GAME_ADDR, abi=GAME_ABI)
        
    async def run(self):
        # Loop principal
        while True:
            # Escuchar eventos
            events = await self.get_new_events()
            
            for event in events:
                if event.name == "TurnStarted" and event.args.player == self.wallet.address:
                    await self.take_turn(event.args.gameId)
                    
                elif event.name == "GameCreated":
                    # Decidir si unirse a sidebets
                    await self.maybe_place_bet(event.args.gameId)
    
    async def take_turn(self, game_id):
        state = self.get_game_state(game_id)
        action = self.strategy.decide(state)
        
        if action.type == "shoot_opponent":
            tx = self.game_contract.functions.shootOpponent(game_id, action.target)
        elif action.type == "shoot_self":
            tx = self.game_contract.functions.shootSelf(game_id)
        elif action.type == "use_item":
            tx = self.game_contract.functions.useItem(game_id, action.item_index)
            
        await self.send_tx(tx)
```

### 2.2 Estrategias de agentes

#### Agente #1: "El Calculador" (probabilístico)
```python
class CalculatorStrategy:
    def decide(self, state):
        live_prob = state.live_remaining / state.total_remaining
        
        # Si tengo Magnifying Glass y probabilidad ~50%, usarlo
        if self.has_item(MAGNIFYING_GLASS) and 0.4 < live_prob < 0.6:
            return Action("use_item", item=MAGNIFYING_GLASS)
        
        # Si sé que es blank (por Magnifying Glass), dispararme para turno extra
        if state.current_shell_known and state.current_shell == BLANK:
            return Action("shoot_self")
        
        # Si probabilidad de blank > 65%, arriesgar auto-disparo
        if live_prob < 0.35:
            return Action("shoot_self")
        
        # Si tengo Handsaw y prob live > 70%, usarlo
        if self.has_item(HANDSAW) and live_prob > 0.7:
            return Action("use_item", item=HANDSAW)
        
        # Default: disparar al oponente con más HP
        target = max(state.opponents, key=lambda p: p.hp)
        return Action("shoot_opponent", target=target.address)
```

#### Agente #2: "El Agresivo" (risk-taker)
```python
class AggressiveStrategy:
    def decide(self, state):
        target = max(state.opponents, key=lambda p: p.hp)
        
        # Handsaw siempre que lo tenga
        if self.has_item(HANDSAW):
            return Action("use_item", item=HANDSAW)
        
        # Handcuffs al más peligroso
        if self.has_item(HANDCUFFS):
            return Action("use_item", item=HANDCUFFS, target=target.address)
        
        # Siempre disparar al oponente
        return Action("shoot_opponent", target=target.address)
```

#### Agente #3: "El Superviviente" (conservador)
```python
class SurvivorStrategy:
    def decide(self, state):
        live_prob = state.live_remaining / state.total_remaining
        
        # Cigarettes apenas pierdo HP
        if self.has_item(CIGARETTES) and state.my_hp < state.max_hp:
            return Action("use_item", item=CIGARETTES)
        
        # Beer para eyectar si probabilidad de live es alta
        if self.has_item(BEER) and live_prob > 0.6:
            return Action("use_item", item=BEER)
        
        # Magnifying Glass siempre que lo tenga
        if self.has_item(MAGNIFYING_GLASS):
            return Action("use_item", item=MAGNIFYING_GLASS)
        
        # Auto-disparo si blank probable
        if live_prob < 0.5:
            return Action("shoot_self")
        
        # Default: disparar al oponente con menos HP (rematar)
        target = min(state.opponents, key=lambda p: p.hp)
        return Action("shoot_opponent", target=target.address)
```

#### Agente #4: "El Espectador" (solo apuesta)
```python
class SpectatorAgent:
    def __init__(self, private_key, rpc_url, bankroll_fraction=0.1):
        self.max_bet = bankroll_fraction  # Nunca apostar más del 10% del bankroll
        
    async def on_game_created(self, game_id, players):
        # Analizar jugadores
        ratings = {p: self.get_player_rating(p) for p in players}
        favorite = max(ratings, key=ratings.get)
        
        # Calcular tamaño de apuesta (Kelly Criterion simplificado)
        confidence = ratings[favorite] / sum(ratings.values())
        bet_size = min(self.balance * self.max_bet, self.balance * confidence * 0.5)
        
        if bet_size > MIN_BET:
            await self.place_bet(game_id, favorite, bet_size)
    
    def get_player_rating(self, address):
        # Basado en historial on-chain
        stats = self.get_player_stats(address)
        return stats.win_rate * stats.games_played  # Simple rating
```

---

## 📐 CAPA 3: FRONTEND (Opcional)

React app que lee directamente del contrato.

### Componentes
- **GameList:** Lista de partidas activas y en cola
- **GameViewer:** Estado en vivo de una partida
- **BettingPanel:** Colocar apuestas
- **Leaderboard:** Ranking de agentes

### Conexión
```javascript
// Leer estado
const gameState = await gameContract.getGameState(gameId);

// Escuchar eventos
gameContract.on("ShotFired", (gameId, shooter, target, wasLive, damage) => {
    updateGameState(gameId);
    playAnimation(wasLive ? "shot_live" : "shot_blank");
});

// Enviar apuesta (wallet del usuario)
const tx = await wagerContract.placeBet(gameId, predictedWinner, { value: betAmount });
```

---

## 📅 PLAN DÍA A DÍA (Actualizado)

### DÍA 1 — Miércoles 5 Feb: Contratos Core

**Mañana (4h):**
- [ ] Setup repo monorepo: `/contracts`, `/agents`, `/frontend`
- [ ] Configurar Foundry para Monad
- [ ] Investigar Monad: RPC endpoints, faucet, explorer

**Tarde (4h):**
- [ ] `BuckshotGame.sol` — versión 1v1:
  - Estado de partida (jugadores, HP, turno)
  - Sistema de balas con aleatoriedad simple
  - `shootOpponent()`, `shootSelf()`
  - Eventos básicos
- [ ] Tests unitarios: partida completa 1v1

**Noche (2h):**
- [ ] `GameFactory.sol` — crear partidas
- [ ] Integrar buy-in básico (pool de premios)

**Entregable:** Contrato 1v1 funcional en tests locales.

---

### DÍA 2 — Jueves 6 Feb: Ítems + Deploy

**Mañana (4h):**
- [ ] Sistema de ítems (los 6 MVP):
  - Magnifying Glass, Beer, Handsaw, Handcuffs, Cigarettes, Inverter
- [ ] Distribución aleatoria de ítems por ronda
- [ ] Tests de cada ítem

**Tarde (4h):**
- [ ] Expandir a multi-jugador (2-6):
  - Array dinámico de jugadores
  - Turno rotativo con skip de eliminados
  - `shootOpponent(target)` con selección
- [ ] Tests: partida 4 jugadores

**Noche (2h):**
- [ ] Deploy a Monad testnet/mainnet
- [ ] Verificar contratos en explorer
- [ ] Scripts de deploy automatizados

**Entregable:** Contratos con ítems y multi-jugador en Monad.

---

### DÍA 3 — Viernes 7 Feb: Agentes v1

**Mañana (4h):**
- [ ] Framework base de agente:
  - Conexión a Monad (web3.py o ethers.js)
  - Event listener
  - Transaction sender
- [ ] Agente #1 "El Calculador":
  - Conteo de balas
  - Decisión por expected value

**Tarde (4h):**
- [ ] Agente #2 "El Agresivo"
- [ ] Agente #3 "El Superviviente"
- [ ] Sistema de logging de decisiones

**Noche (2h):**
- [ ] Correr 3 partidas entre los agentes
- [ ] Verificar que estrategias son distinguibles
- [ ] Fix bugs de integración

**Entregable:** 3 agentes funcionales, 3+ partidas jugadas on-chain.

---

### DÍA 4 — Sábado 8 Feb: Apuestas + Más partidas

**Mañana (4h):**
- [ ] `BuckshotWager.sol`:
  - `placeBet(gameId, predictedWinner)`
  - Sistema parimutuel (odds dinámicas)
  - `claimWinnings()`
- [ ] Deploy y tests

**Tarde (4h):**
- [ ] Agente #4 "El Espectador":
  - Observa partidas
  - Analiza jugadores
  - Coloca apuestas con Kelly Criterion
- [ ] Integrar con flujo de partidas

**Noche (2h):**
- [ ] Correr 5+ partidas con apuestas externas
- [ ] Verificar payouts correctos
- [ ] Total: 8+ partidas jugadas

**Entregable:** Sistema de apuestas funcional, 8+ partidas totales.

---

### DÍA 5 — Domingo 9 Feb: MVP Completo + Primer Submit

**Mañana (4h):**
- [ ] Bug fixing de todo el sistema
- [ ] Correr 2+ partidas más (10+ total)
- [ ] Verificar todos los requisitos del track

**Tarde (4h):**
- [ ] README básico:
  - Descripción del proyecto
  - Arquitectura
  - Cómo correr los agentes
  - Addresses de contratos
- [ ] Grabar video demo corto (2-3 min)

**Noche (2h):**
- [ ] **PRIMER SUBMIT** a moltiverse.dev
- [ ] Incluir: repo, video, contracts addresses

**Entregable:** 🚀 PRIMER SUBMIT con MVP funcional.

---

### DÍA 6 — Lunes 10 Feb: Frontend

**Mañana (4h):**
- [ ] Setup React + Vite + TailwindCSS
- [ ] Conexión a Monad
- [ ] GameViewer: estado de partida en vivo

**Tarde (4h):**
- [ ] Lista de partidas activas
- [ ] Panel de apuestas
- [ ] Eventos en tiempo real

**Noche (2h):**
- [ ] Deploy frontend a Vercel
- [ ] Leaderboard básico

**Entregable:** Frontend funcional y deployeado.

---

### DÍA 7 — Martes 11 Feb: Mejoras + Testing

**Mañana (4h):**
- [ ] Mejorar agentes:
  - Agente Adaptativo que perfila oponentes
  - Mejor logging y analytics
- [ ] Sistema de timeout robusto

**Tarde (4h):**
- [ ] Stress test: 10 partidas consecutivas
- [ ] Edge cases: desconexiones, timeouts
- [ ] Optimización de gas

**Noche (2h):**
- [ ] Fix bugs encontrados
- [ ] Actualizar submit si hay mejoras significativas

**Entregable:** Sistema más robusto y testeado.

---

### DÍA 8 — Miércoles 12 Feb: Polish

**Mañana (4h):**
- [ ] UI polish: animaciones, mejor UX
- [ ] Más estadísticas en leaderboard
- [ ] Historial de partidas

**Tarde (4h):**
- [ ] Sistema de torneos (si hay tiempo):
  - Bracket single elimination
  - 8 agentes, ganador lleva todo
- [ ] Documentación completa

**Noche (2h):**
- [ ] Actualizar video demo
- [ ] Actualizar submit

**Entregable:** Proyecto pulido con extras.

---

### DÍA 9 — Jueves 13 Feb: Documentación Final

**Mañana (4h):**
- [ ] README completo y profesional
- [ ] Diagramas de arquitectura
- [ ] Documentación de estrategias de agentes

**Tarde (4h):**
- [ ] Video demo final (3-5 min):
  - Partida completa con 4 agentes
  - Sistema de apuestas
  - Dashboard
  - Explicación de estrategias

**Noche (2h):**
- [ ] Revisión final de todo
- [ ] Actualizar submit

**Entregable:** Documentación completa y video final.

---

### DÍA 10 — Viernes 14 Feb: Buffer

**Todo el día:**
- [ ] Correr partidas showcase
- [ ] Fix cualquier bug de última hora
- [ ] Asegurar que todo está live y funcionando
- [ ] Submit final si no se hizo

**Entregable:** Todo listo y funcionando.

---

### DÍA 11 — Sábado 15 Feb: Deadline

- [ ] Verificar que el submit está completo
- [ ] Monitorear que los agentes siguen corriendo
- [ ] Disponible para preguntas de jueces

---

## ✅ CHECKLIST DE REQUISITOS

### Core Requirements
- [ ] Implementar al menos un game type → Buckshot Roulette multi-player
- [ ] Sistema de wagering con tokens → Buy-in + sidebets
- [ ] Decisiones estratégicas → 4 estrategias diferenciadas
- [ ] Manejar wins/losses y bankroll → On-chain automático
- [ ] Interfaz para coordinación → Frontend + eventos on-chain

### Success Criteria
- [ ] 5+ partidas contra diferentes oponentes → Target: 10+
- [ ] Variedad estratégica (no random) → 4 personalidades
- [ ] Win rate positivo/neutral → Tracking on-chain
- [ ] Manejo de wagers y payouts → Smart contract automático

### Bonus Points
- [ ] Múltiples game types → 1v1, 4-player, con/sin ítems
- [ ] Adaptar estrategia por oponente → Agente Adaptativo
- [ ] Bluffing/tácticas psicológicas → Ítems estratégicos
- [ ] Sistema de torneos → Bracket elimination
- [ ] Risk management → Kelly Criterion en espectador

---

## 🛠️ STACK TECNOLÓGICO

| Capa | Tecnología |
|------|------------|
| Smart Contracts | Solidity + Foundry |
| Chain | Monad (EVM) |
| Agentes | Python + web3.py (o TypeScript + ethers.js) |
| Frontend | React + Vite + TailwindCSS + viem |
| Deploy contratos | Foundry scripts |
| Deploy frontend | Vercel |

---

## ⚠️ RIESGOS Y MITIGACIONES

| Riesgo | Mitigación |
|--------|------------|
| Monad inestable | Tener scripts para redeploy rápido |
| Gas alto | Optimizar contratos; batch donde se pueda |
| Random predecible | Aceptable para hackathon (agentes son nuestros); documentar que en prod usaría VRF |
| Agentes indistinguibles | Logging detallado; ajustar parámetros |
| Tiempo corto | Primer submit día 5 con MVP |

---

## 🎯 PRIORIDADES

**MUST HAVE (días 1-5) → Primer Submit:**
- Contrato de juego funcional
- 3 agentes con estrategias diferentes
- 10+ partidas on-chain
- Sistema de apuestas

**SHOULD HAVE (días 6-8):**
- Frontend dashboard
- Agente espectador con apuestas
- Sistema robusto de timeouts

**NICE TO HAVE (días 9-11):**
- Agente adaptativo
- Sistema de torneos
- UI polish
