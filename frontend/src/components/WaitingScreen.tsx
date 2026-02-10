interface WaitingScreenProps {
  connected: boolean
  error: string | null
}

export function WaitingScreen({ connected, error }: WaitingScreenProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#060609] scanlines">
      <div className="text-center space-y-8">
        {/* Title */}
        <div className="space-y-3">
          <h1 className="font-display text-4xl font-bold tracking-[0.12em] text-white/75">
            BUCKSHOT<span className="text-blood">_</span>ROULETTE
          </h1>
          <div className="h-px w-48 mx-auto bg-gradient-to-r from-transparent via-blood/30 to-transparent" />
        </div>

        {/* Shotgun */}
        <pre className="text-white/[0.08] text-[9px] leading-tight select-none">
{`     ____________________________________
    /                                    \\
===|  =====================================>
    \\____________________________________/
         ||    ||    ||`}
        </pre>

        {/* Status */}
        <div className="space-y-3">
          <div className="flex items-center justify-center gap-2">
            <div
              className={`w-1.5 h-1.5 rounded-full ${
                connected ? 'bg-alive' : 'bg-blood animate-pulse'
              }`}
            />
            <span className="text-[10px] font-mono text-white/25">
              {connected ? 'Connected to Anvil' : 'Connecting...'}
            </span>
          </div>

          {error && (
            <div className="text-[10px] font-mono text-blood/40 max-w-sm mx-auto">
              {error}
            </div>
          )}

          <div className="text-xs font-mono text-white/15 animate-pulse">
            Waiting for game...
          </div>

          <div className="text-[9px] text-white/[0.06]">
            Run <code className="text-neon/15">make play-spectate</code> to start
          </div>
        </div>
      </div>
    </div>
  )
}
