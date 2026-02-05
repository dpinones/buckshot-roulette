interface WaitingScreenProps {
  connected: boolean
  error: string | null
}

export function WaitingScreen({ connected, error }: WaitingScreenProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a1a]">
      <div className="text-center space-y-8">
        {/* Title */}
        <div className="space-y-2">
          <h1 className="text-4xl font-mono font-bold tracking-[0.15em] text-white/80">
            BUCKSHOT ROULETTE
          </h1>
          <div className="h-px w-64 mx-auto bg-gradient-to-r from-transparent via-blood/40 to-transparent" />
        </div>

        {/* Shotgun ASCII */}
        <pre className="text-white/15 text-[10px] leading-tight select-none">
{`
     ____________________________________
    /                                    \\
===|  =====================================>
    \\____________________________________/
         ||    ||    ||
`}
        </pre>

        {/* Status */}
        <div className="space-y-3">
          <div className="flex items-center justify-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                connected ? 'bg-green-500' : 'bg-blood animate-pulse'
              }`}
            />
            <span className="text-xs font-mono text-white/40">
              {connected ? 'Connected to Anvil' : 'Connecting...'}
            </span>
          </div>

          {error && (
            <div className="text-xs font-mono text-blood/60 max-w-sm mx-auto">
              {error}
            </div>
          )}

          <div className="text-sm font-mono text-white/20 animate-pulse">
            Waiting for game...
          </div>

          <div className="text-[10px] text-white/10">
            Run <code className="text-neon/40">make play-spectate</code> to start
          </div>
        </div>
      </div>
    </div>
  )
}
