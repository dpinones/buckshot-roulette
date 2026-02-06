/**
 * Deduplicates turn processing to prevent handling the same turn twice.
 * Tracks turns by a compound key of gameId + turnAddress + turnDeadline.
 */
export class TurnDetector {
  private processedTurns = new Set<string>()

  private makeKey(gameId: bigint, turnAddress: string, turnDeadline: bigint): string {
    return `${gameId}-${turnAddress.toLowerCase()}-${turnDeadline}`
  }

  /** Returns true if this turn has NOT been processed yet, and marks it as seen. */
  claim(gameId: bigint, turnAddress: string, turnDeadline: bigint): boolean {
    const key = this.makeKey(gameId, turnAddress, turnDeadline)
    if (this.processedTurns.has(key)) return false
    this.processedTurns.add(key)
    return true
  }

  /** Clear all tracked turns (e.g., when a new game starts). */
  reset(): void {
    this.processedTurns.clear()
  }
}
