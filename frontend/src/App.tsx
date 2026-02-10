import { useState } from 'react'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useGameState } from './hooks/useGameState'
import { useEventLog } from './hooks/useEventLog'
import { usePlayerNames } from './hooks/usePlayerNames'
import { Phase } from './config/contracts'
import { GameBoard } from './components/GameBoard'
import { WaitingScreen } from './components/WaitingScreen'
import { BettingPanel } from './components/BettingPanel'
import { BurnerWallets } from './components/BurnerWallets'
import { Lobby } from './components/Lobby'
import { Rankings } from './components/Rankings'
import { GameReplay } from './components/GameReplay'
import { isLocal } from './config/wagmi'

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

  if (!state) {
    return <WaitingScreen connected={connected} error={error} />
  }

  if (state.phase === Phase.WAITING) {
    return <BettingPanel gameId={gameId} state={state} onBack={onBack} />
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

  let content
  if (view === 'game') {
    content = <GameView gameId={selectedGameId} onBack={handleBackToLobby} />
  } else if (view === 'rankings') {
    content = <Rankings onBack={handleBackToLobby} onReplay={handleReplay} />
  } else if (view === 'replay') {
    content = <GameReplay gameId={selectedGameId} onBack={() => setView('rankings')} />
  } else {
    content = <Lobby onSelectGame={handleSelectGame} onOpenRankings={() => setView('rankings')} />
  }

  return (
    <div className="relative min-h-screen">
      <div className="fixed top-3 right-4 z-[150]">
        {isLocal ? <BurnerWallets /> : <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false} />}
      </div>
      {content}
    </div>
  )
}

export default App
