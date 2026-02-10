import { type Address } from 'viem'
import { ITEM_ICONS, ITEM_NAMES } from '../config/contracts'
import { getCharacter } from '../config/characters'

interface AgentCardProps {
  address: Address
  hp: number
  maxHp: number
  items: readonly number[]
  isCurrentTurn: boolean
  isNext: boolean
  isAlive: boolean
  label: string
  onClick?: () => void
}

export function AgentCard({
  address,
  hp,
  maxHp,
  items,
  isCurrentTurn,
  isNext,
  isAlive,
  label,
  onClick,
}: AgentCardProps) {
  const char = getCharacter(label)
  const isDead = !isAlive

  let cardClass = 'agent-card-root'
  if (isDead) cardClass += ' dead'
  else if (isCurrentTurn) cardClass += ' active'
  else if (isNext) cardClass += ' next'

  return (
    <div
      onClick={onClick}
      className={`
        relative flex-1 max-w-[180px] min-w-0 rounded-[14px] p-2.5 flex flex-col gap-1
        transition-all duration-400 select-none
        ${isDead
          ? 'bg-[rgba(200,200,200,0.85)] border-3 border-[#999] grayscale-[0.7] shadow-[0_2px_6px_rgba(0,0,0,0.12)]'
          : isCurrentTurn
            ? 'bg-[rgba(200,230,200,0.92)] border-4 border-gold shadow-[0_0_20px_rgba(255,215,0,0.5),0_4px_12px_rgba(0,0,0,0.2)] -translate-y-1'
            : isNext
              ? 'bg-[rgba(200,230,200,0.92)] border-3 border-[#FFE082] shadow-[0_4px_12px_rgba(0,0,0,0.18),0_2px_4px_rgba(0,0,0,0.1)]'
              : 'bg-[rgba(200,230,200,0.92)] border-3 border-alive shadow-[0_4px_12px_rgba(0,0,0,0.18),0_2px_4px_rgba(0,0,0,0.1)]'
        }
        ${onClick ? 'cursor-pointer' : ''}
      `}
    >
      {/* TURN badge */}
      {isCurrentTurn && isAlive && (
        <span className="absolute -top-2.5 -right-2.5 bg-gold text-text-dark font-display text-[11px] px-2.5 py-0.5 rounded-xl border-2 border-[#DAA520] shadow-[0_3px_6px_rgba(0,0,0,0.25)] z-10">
          TURN
        </span>
      )}

      {/* NEXT badge */}
      {isNext && isAlive && !isCurrentTurn && (
        <span className="absolute -top-2.5 -right-2.5 bg-[#FFE082] text-text-dark font-display text-[10px] px-2 py-0.5 rounded-xl border-2 border-[#F9A825] shadow-[0_2px_5px_rgba(0,0,0,0.2)] z-10">
          NEXT
        </span>
      )}

      {/* Header: avatar + name */}
      <div className="flex items-center gap-2.5">
        <img
          src={char.img}
          alt={char.name}
          className={`w-14 h-14 rounded-[10px] object-contain bg-white/50 p-0.5 ${isDead ? 'grayscale opacity-50' : ''}`}
        />
        <div className="flex-1 min-w-0">
          <div className={`font-display text-sm leading-tight truncate ${isDead ? 'text-[#888]' : 'text-text-dark'}`}>
            {char.name}
          </div>
          <div className="font-data text-[11px] text-text-light">
            {char.role}
          </div>
        </div>
      </div>

      {/* Hearts */}
      {isAlive && (
        <div className="flex gap-1 mt-1">
          {Array.from({ length: maxHp }, (_, i) => (
            <span
              key={i}
              className={`text-base leading-none ${i < hp ? 'text-heart-full' : 'text-heart-empty'}`}
            >
              {'\u2665'}
            </span>
          ))}
        </div>
      )}

      {/* Items */}
      {isAlive && items.length > 0 && (
        <div className="flex gap-1 flex-wrap mt-0.5">
          {items.map((item, i) => (
            <span
              key={i}
              className="w-[26px] h-[26px] bg-white/70 border border-black/20 rounded-md flex items-center justify-center text-sm"
              title={ITEM_NAMES[item] ?? 'Unknown'}
            >
              {ITEM_ICONS[item] ?? '?'}
            </span>
          ))}
        </div>
      )}

      {/* ELIMINATED label */}
      {isDead && (
        <div className="font-display text-[13px] text-[#999] text-center mt-1">
          ELIMINATED
        </div>
      )}
    </div>
  )
}
