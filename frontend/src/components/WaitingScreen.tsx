interface WaitingScreenProps {
  connected: boolean
  error: string | null
}

export function WaitingScreen({ connected, error }: WaitingScreenProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-meadow">
      <div className="text-center space-y-8">
        {/* Title */}
        <div className="space-y-3">
          <h1 className="font-display text-4xl text-text-dark">
            Fluffy Fate
          </h1>
          <div className="h-0.5 w-48 mx-auto bg-paper-shadow" />
        </div>

        {/* Shotgun image */}
        <img
          src="/characters/shotgun.png"
          alt="shotgun"
          className="mx-auto w-56 opacity-40 -rotate-[5deg]"
        />

        {/* Status */}
        <div className="space-y-3">
          <div className="flex items-center justify-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                connected ? 'bg-alive' : 'bg-blood animate-pulse'
              }`}
            />
            <span className="font-data text-sm text-text-light">
              {connected ? 'Connected to Anvil' : 'Connecting...'}
            </span>
          </div>

          {error && (
            <div className="font-data text-sm text-blood max-w-sm mx-auto">
              {error}
            </div>
          )}

          <div className="font-display text-lg text-text-light animate-pulse">
            Waiting for game...
          </div>

          <div className="font-data text-xs text-text-light/60">
            Run <code className="text-text-dark bg-paper px-1.5 py-0.5 rounded border border-paper-shadow">make play-spectate</code> to start
          </div>
        </div>
      </div>
    </div>
  )
}
