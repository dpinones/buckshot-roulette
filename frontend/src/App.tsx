import { useGameState } from './hooks/useGameState'
import { useEventLog } from './hooks/useEventLog'
import { Phase } from './config/contracts'
import { GameBoard } from './components/GameBoard'
import { WaitingScreen } from './components/WaitingScreen'

function App() {
  const { state, prevState, error, connected } = useGameState(2000)
  const events = useEventLog(state, prevState)

  // No state yet or game not active/finished — show waiting screen
  if (!state || state.phase === Phase.WAITING) {
    return <WaitingScreen connected={connected} error={error} />
  }

  return <GameBoard state={state} prevState={prevState} events={events} />
}

export default App
