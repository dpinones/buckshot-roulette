interface ThinkingBubbleProps {
  text: string
}

export function ThinkingBubble({ text }: ThinkingBubbleProps) {
  return (
    <div
      className="absolute top-[-20%] left-1/2 z-[60]"
      style={{ animation: 'bubbleFloat 2.5s ease-in-out infinite' }}
    >
      <div className="bg-white border-3 border-text-dark rounded-[22px] px-4.5 py-2.5 font-data text-base font-bold text-text-dark whitespace-nowrap shadow-[4px_4px_0_var(--color-paper-shadow)]">
        {text}
      </div>
      <div className="flex flex-col items-center gap-1.5 mt-1">
        <span className="w-4 h-4 bg-white border-2 border-text-dark rounded-full" />
        <span className="w-[11px] h-[11px] bg-white border-2 border-text-dark rounded-full" />
        <span className="w-[7px] h-[7px] bg-white border-2 border-text-dark rounded-full" />
      </div>
    </div>
  )
}
