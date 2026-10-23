/** Binary min-heap of (node, key) pairs in typed arrays. Decrease-key is done by pushing duplicates. */
export class MinHeap {
  private nodes: Uint32Array
  private keys: Float64Array
  size = 0

  constructor(initialCapacity = 1024) {
    this.nodes = new Uint32Array(initialCapacity)
    this.keys = new Float64Array(initialCapacity)
  }

  clear(): void {
    this.size = 0
  }

  push(node: number, key: number): void {
    if (this.size === this.nodes.length) this.grow()
    let i = this.size++
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (this.keys[parent] <= key) break
      this.nodes[i] = this.nodes[parent]
      this.keys[i] = this.keys[parent]
      i = parent
    }
    this.nodes[i] = node
    this.keys[i] = key
  }

  /** Smallest key; only valid when size > 0. */
  peekKey(): number {
    return this.keys[0]
  }

  /** Node with the smallest key; only valid when size > 0. */
  peekNode(): number {
    return this.nodes[0]
  }

  /** Removes the smallest entry and returns its node; only valid when size > 0. */
  pop(): number {
    const top = this.nodes[0]
    const lastNode = this.nodes[--this.size]
    const lastKey = this.keys[this.size]
    let i = 0
    for (;;) {
      let child = 2 * i + 1
      if (child >= this.size) break
      if (child + 1 < this.size && this.keys[child + 1] < this.keys[child]) child++
      if (this.keys[child] >= lastKey) break
      this.nodes[i] = this.nodes[child]
      this.keys[i] = this.keys[child]
      i = child
    }
    this.nodes[i] = lastNode
    this.keys[i] = lastKey
    return top
  }

  private grow(): void {
    const nodes = new Uint32Array(this.nodes.length * 2)
    const keys = new Float64Array(this.keys.length * 2)
    nodes.set(this.nodes)
    keys.set(this.keys)
    this.nodes = nodes
    this.keys = keys
  }
}
