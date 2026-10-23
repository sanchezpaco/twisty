export interface Scored {
  timeS: number
  score: number
}

/** Options that are not beaten by another one that is both faster and twistier, sorted by time. */
export function paretoFrontier<T extends Scored>(items: T[]): T[] {
  const sorted = [...items].sort((a, b) => a.timeS - b.timeS || b.score - a.score)
  const frontier: T[] = []
  for (const item of sorted) {
    if (frontier.length === 0 || item.score > frontier[frontier.length - 1].score) frontier.push(item)
  }
  return frontier
}

/**
 * The frontier of joining one option of `a` to one of `b`, up to `latestS`: with time and score added, the best split
 * of every budget between the two.
 */
export function paretoSum<A extends Scored, B extends Scored, J extends Scored>(a: A[], b: B[], join: (a: A, b: B) => J, latestS = Infinity): J[] {
  return paretoFrontier(a.flatMap((first) => b.map((second) => join(first, second)).filter((joined) => joined.timeS <= latestS)))
}
