import { type Address } from 'viem'
import { ITEM_ICONS, ITEM_NAMES } from '../config/contracts'

interface PlayerCardProps {
  address: Address
  hp: number
  maxHp: number
  items: readonly number[]
  isCurrentTurn: boolean
  isAlive: boolean
  label: string
  onClick?: () => void
}

function truncateAddr(addr: Address): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

export function PlayerCard({
  address,
  hp,
  maxHp,
  items,
  isCurrentTurn,
  isAlive,
  label,
  onClick,
}: PlayerCardProps) {
  const hpPercent = maxHp > 0 ? (hp / maxHp) * 100 : 0
  const hpColor = hp <= 1 ? '#dc2626' : hp <= 2 ? '#f5a623' : '#10b981'

  return (
    <div
      onClick={onClick}
      className={`
        relative overflow-hidden transition-all duration-500 rounded-sm
        ${isCurrentTurn && isAlive
          ? 'border border-blood/50 z-10 scale-[1.02]'
          : 'border border-white/[0.04]'
        }
        ${!isAlive ? 'opacity-30 saturate-0' : ''}
        ${onClick ? 'cursor-pointer hover:border-white/[0.12]' : ''}
        bg-panel
      `}
      style={isCurrentTurn && isAlive ? { animation: 'glowPulse 2s ease-in-out infinite' } : undefined}
    >
      {/* Top accent line */}
      <div className={`h-[2px] w-full ${
        isCurrentTurn && isAlive ? 'bg-gradient-to-r from-blood/80 via-blood to-blood/80' :
        !isAlive ? 'bg-white/[0.02]' : 'bg-white/[0.06]'
      }`} />

      <div className="p-4">
        {/* Header: Label + Status badge */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2.5">
            <span className="font-display text-xl font-semibold tracking-wide text-white/90">
              {label}
            </span>
            {isCurrentTurn && isAlive && (
              <span className="text-[8px] uppercase tracking-[0.25em] px-2 py-[3px] bg-blood/15 text-blood border border-blood/20 font-semibold animate-pulse rounded-sm">
                SHOOTING
              </span>
            )}
            {!isAlive && (
              <span className="text-[8px] uppercase tracking-[0.25em] px-2 py-[3px] bg-white/[0.03] text-white/15 border border-white/[0.04] rounded-sm">
                ELIMINATED
              </span>
            )}
          </div>
        </div>

        {/* Address */}
        <div className="text-[10px] text-white/20 mb-4 tracking-wider font-mono">
          {truncateAddr(address)}
        </div>

        {/* HP Bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[8px] uppercase tracking-[0.3em] text-white/20">HP</span>
            <span className="text-[10px] font-mono tabular-nums" style={{ color: hpColor }}>
              {hp}/{maxHp}
            </span>
          </div>
          <div className="h-1 bg-white/[0.04] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{ width: `${hpPercent}%`, background: hpColor }}
            />
          </div>
        </div>

        {/* Items */}
        {items.length > 0 && (
          <div className="border-t border-white/[0.04] pt-3">
            <div className="text-[7px] uppercase tracking-[0.3em] text-white/15 mb-2">Items</div>
            <div className="flex gap-1 flex-wrap">
              {items.map((item, i) => (
                <div
                  key={i}
                  className="group relative flex items-center gap-1 px-1.5 py-1 bg-white/[0.03] border border-white/[0.05] rounded-sm hover:bg-white/[0.06] transition-colors"
                  title={ITEM_NAMES[item] ?? 'Unknown'}
                >
                  <span className="text-sm leading-none">{ITEM_ICONS[item] ?? '?'}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
