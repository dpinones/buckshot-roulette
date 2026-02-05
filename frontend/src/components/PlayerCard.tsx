import { type Address } from 'viem'
import { ITEM_ICONS } from '../config/contracts'

interface PlayerCardProps {
  address: Address
  hp: number
  maxHp: number
  items: readonly number[]
  isCurrentTurn: boolean
  isAlive: boolean
  label: string
  side: 'left' | 'right'
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
  side,
}: PlayerCardProps) {
  const hearts = Array.from({ length: maxHp }, (_, i) => i < hp)

  return (
    <div
      className={`
        relative border p-5 transition-all duration-500
        ${isCurrentTurn && isAlive
          ? 'border-blood shadow-[0_0_30px_rgba(220,38,38,0.4),inset_0_0_30px_rgba(220,38,38,0.05)]'
          : 'border-white/10'
        }
        ${!isAlive ? 'opacity-30 grayscale' : ''}
        bg-surface
      `}
      style={{ clipPath: side === 'left'
        ? 'polygon(0 0, 100% 4%, 100% 96%, 0 100%)'
        : 'polygon(0 4%, 100% 0, 100% 100%, 0 96%)'
      }}
    >
      {/* Turn indicator bar */}
      {isCurrentTurn && isAlive && (
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-blood animate-pulse" />
      )}

      {/* Label */}
      <div className={`
        text-xs tracking-[0.3em] uppercase mb-3
        ${isCurrentTurn && isAlive ? 'text-blood' : 'text-white/30'}
      `}>
        {label}
        {isCurrentTurn && isAlive && (
          <span className="ml-2 text-blood animate-pulse">&#9654;</span>
        )}
        {!isAlive && <span className="ml-2 text-white/20">DEAD</span>}
      </div>

      {/* Address */}
      <div className="font-mono text-sm text-white/50 mb-4">
        {truncateAddr(address)}
      </div>

      {/* HP Hearts */}
      <div className="flex gap-1.5 mb-4">
        {hearts.map((filled, i) => (
          <div
            key={i}
            className={`
              w-6 h-6 flex items-center justify-center text-sm transition-all duration-300
              ${filled
                ? 'text-blood drop-shadow-[0_0_6px_rgba(220,38,38,0.6)]'
                : 'text-white/10'
              }
            `}
          >
            {filled ? '\u2665' : '\u2661'}
          </div>
        ))}
      </div>

      {/* HP text */}
      <div className="text-xs text-white/30 mb-4 tracking-wider">
        HP {hp}/{maxHp}
      </div>

      {/* Items */}
      {items.length > 0 && (
        <div className="border-t border-white/5 pt-3">
          <div className="text-[10px] text-white/20 uppercase tracking-[0.2em] mb-2">
            Items
          </div>
          <div className="flex gap-2 flex-wrap">
            {items.map((item, i) => (
              <div
                key={i}
                className="w-8 h-8 bg-white/5 border border-white/10 flex items-center justify-center text-base hover:bg-white/10 transition-colors"
                title={`Item ${item}`}
              >
                {ITEM_ICONS[item] ?? '?'}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
