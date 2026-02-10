import { useState } from 'react'
import { useGameState } from './hooks/useGameState'
import { useEventLog } from './hooks/useEventLog'
import { usePlayerNames } from './hooks/usePlayerNames'
import { Phase } from './config/contracts'
import { GameBoard } from './components/GameBoard'
import { WaitingScreen } from './components/WaitingScreen'
import { Lobby } from './components/Lobby'
import { Rankings } from './components/Rankings'
import { GameReplay } from './components/GameReplay'

function GameView({
  gameId,
  onBack,
}: {
  gameId: bigint
  onBack: () => void
}) {
  const { state, prevState, error, connected } = useGameState(gameId, 2000)
  const names = usePlayerNames(state?.players ?? [])
  const events = useEventLog(state, prevState, names)

  if (!state || state.phase === Phase.WAITING) {
    return <WaitingScreen connected={connected} error={error} />
  }

  return (
    <GameBoard
      state={state}
      prevState={prevState}
      events={events}
      onBack={onBack}
    />
  )
}

type View = 'lobby' | 'game' | 'rankings' | 'replay'

function App() {
  const [view, setView] = useState<View>('lobby')
  const [selectedGameId, setSelectedGameId] = useState<bigint>(0n)

  function handleSelectGame(gameId: bigint) {
    setSelectedGameId(gameId)
    setView('game')
  }

  function handleReplay(gameId: bigint) {
    setSelectedGameId(gameId)
    setView('replay')
  }

  function handleBackToLobby() {
    setView('lobby')
  }

  if (view === 'game') {
    return <GameView gameId={selectedGameId} onBack={handleBackToLobby} />
  }

  if (view === 'rankings') {
    return (
      <Rankings
        onBack={handleBackToLobby}
        onReplay={handleReplay}
      />
    )
  }

  if (view === 'replay') {
    return <GameReplay gameId={selectedGameId} onBack={() => setView('rankings')} />
  }

  return (
    <Lobby
      onSelectGame={handleSelectGame}
      onOpenRankings={() => setView('rankings')}
    />
  )
}

export default App
