import { useState } from 'react'
import { useGameState } from './hooks/useGameState'
import { useEventLog } from './hooks/useEventLog'
import { Phase } from './config/contracts'
import { GameBoard } from './components/GameBoard'
import { WaitingScreen } from './components/WaitingScreen'
import { Lobby } from './components/Lobby'

function GameView({
  gameId,
  onBack,
}: {
  gameId: bigint
  onBack: () => void
}) {
  const { state, prevState, error, connected } = useGameState(gameId, 2000)
  const events = useEventLog(state, prevState)

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

function App() {
  const [view, setView] = useState<'lobby' | 'game'>('lobby')
  const [selectedGameId, setSelectedGameId] = useState<bigint>(0n)

  function handleSelectGame(gameId: bigint) {
    setSelectedGameId(gameId)
    setView('game')
  }

  function handleBackToLobby() {
    setView('lobby')
  }

  if (view === 'game') {
    return <GameView gameId={selectedGameId} onBack={handleBackToLobby} />
  }

  return <Lobby onSelectGame={handleSelectGame} />
}

export default App
