import { type Address } from 'viem'
import { ITEM_NAMES } from '../config/contracts'

const ITEM_IMGS: Record<number, string> = {
  1: '/characters/MAGNIFYING_GLASS.png',
  2: '/characters/beer.png',
  3: '/characters/handsaw.png',
  4: '/characters/cigarette.png',
}
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
  isDamaged?: boolean
  onClick?: () => void
}

export function AgentCard({
  address: _address,
  hp,
  maxHp,
  items,
  isCurrentTurn,
  isNext,
  isAlive,
  label,
  isDamaged,
  onClick,
}: AgentCardProps) {
  const char = getCharacter(label)
  const isDead = !isAlive

  return (
    <div
      onClick={onClick}
      className={`
        relative flex-1 max-w-[240px] min-w-0 rounded-[16px] p-3.5 flex flex-col gap-1.5
        transition-all duration-400 select-none
        ${isDead
          ? 'bg-[rgba(200,200,200,0.85)] border-3 border-[#999] grayscale-[0.7] shadow-[0_2px_6px_rgba(0,0,0,0.12)]'
          : isCurrentTurn
            ? 'bg-[rgba(200,230,200,0.92)] border-4 border-gold shadow-[0_0_20px_rgba(255,215,0,0.5),0_4px_12px_rgba(0,0,0,0.2)] -translate-y-1'
            : isNext
              ? 'bg-[rgba(200,230,200,0.92)] border-3 border-[#FFE082] shadow-[0_4px_12px_rgba(0,0,0,0.18),0_2px_4px_rgba(0,0,0,0.1)]'
              : 'bg-[rgba(200,230,200,0.92)] border-3 border-alive shadow-[0_4px_12px_rgba(0,0,0,0.18),0_2px_4px_rgba(0,0,0,0.1)]'
        }
        ${isDamaged ? 'card-damage' : ''}
        ${onClick ? 'cursor-pointer' : ''}
      `}
    >
      {/* TURN badge */}
      {isCurrentTurn && isAlive && (
        <span className="absolute -top-3 -right-3 bg-gold text-text-dark font-display text-sm px-3 py-1 rounded-xl border-2 border-[#DAA520] shadow-[0_3px_6px_rgba(0,0,0,0.25)] z-10">
          TURN
        </span>
      )}

      {/* NEXT badge */}
      {isNext && isAlive && !isCurrentTurn && (
        <span className="absolute -top-3 -right-3 bg-[#FFE082] text-text-dark font-display text-[13px] px-2.5 py-0.5 rounded-xl border-2 border-[#F9A825] shadow-[0_2px_5px_rgba(0,0,0,0.2)] z-10">
          NEXT
        </span>
      )}

      {/* Header: avatar + name */}
      <div className="flex items-center gap-3">
        <img
          src={char.img}
          alt={char.name}
          className={`w-18 h-18 rounded-[12px] object-contain bg-white/50 p-0.5 ${isDead ? 'grayscale opacity-50' : ''}`}
        />
        <div className="flex-1 min-w-0">
          <div className={`font-display text-base leading-tight truncate ${isDead ? 'text-[#888]' : 'text-text-dark'}`}>
            {char.name}
          </div>
          <div className="font-data text-sm text-text-light">
            {char.role}
          </div>
        </div>
      </div>

      {/* Hearts */}
      {isAlive && (
        <div className="flex gap-1.5 mt-1">
          {Array.from({ length: maxHp }, (_, i) => (
            <span
              key={i}
              className={`text-lg leading-none ${i < hp ? 'text-heart-full' : 'text-heart-empty'}`}
            >
              {'\u2665'}
            </span>
          ))}
        </div>
      )}

      {/* Items */}
      {isAlive && items.length > 0 && (
        <div className="flex gap-1.5 flex-wrap mt-0.5">
          {items.map((item, i) => (
            <span
              key={i}
              className="w-[32px] h-[32px] bg-white/70 border border-black/20 rounded-lg flex items-center justify-center overflow-hidden"
              title={ITEM_NAMES[item] ?? 'Unknown'}
            >
              {ITEM_IMGS[item]
                ? <img src={ITEM_IMGS[item]} alt={ITEM_NAMES[item] ?? ''} className="w-[26px] h-[26px] object-contain" />
                : '?'}
            </span>
          ))}
        </div>
      )}

      {/* ELIMINATED label */}
      {isDead && (
        <div className="font-display text-base text-[#999] text-center mt-1">
          ELIMINATED
        </div>
      )}
    </div>
  )
}
