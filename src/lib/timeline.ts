/** 겹치는 항목(블록 · 일정)을 나란히 배치하기 위한 lane 계산 */
export function layoutBlocks<T extends { start_min: number; end_min: number }>(blocks: T[]) {
  const sorted = [...blocks].sort((a, b) => a.start_min - b.start_min || b.end_min - a.end_min)
  const out: { block: T; lane: number; lanes: number }[] = []
  let cluster: typeof out = []
  let clusterEnd = -1
  let laneEnds: number[] = []
  const flush = () => {
    const n = laneEnds.length
    for (const c of cluster) c.lanes = n
    out.push(...cluster)
    cluster = []
    laneEnds = []
  }
  for (const b of sorted) {
    if (b.start_min >= clusterEnd && cluster.length) flush()
    let lane = laneEnds.findIndex((end) => end <= b.start_min)
    if (lane === -1) lane = laneEnds.push(0) - 1
    laneEnds[lane] = b.end_min
    cluster.push({ block: b, lane, lanes: 1 })
    clusterEnd = Math.max(clusterEnd, b.end_min)
  }
  flush()
  return out
}
