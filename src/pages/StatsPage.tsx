import { addDays, eachDayOfInterval } from 'date-fns'
import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '../components/Layout'
import { api, CATEGORY_INFO, COLOR_HEX, type Stats } from '../lib/api'
import { fmt, formatDuration, parseDate, toDateStr, todayStr } from '../lib/date'

const RANGES = [
  { days: 7, label: '최근 7일' },
  { days: 30, label: '최근 30일' },
  { days: 90, label: '최근 90일' },
]

export default function StatsPage() {
  const [days, setDays] = useState(7)
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState<string | null>(null)

  const today = todayStr()
  const from = toDateStr(addDays(parseDate(today), -(days - 1)))

  useEffect(() => {
    api
      .get<Stats>(`/stats?from=${from}&to=${today}&today=${today}`)
      .then((s) => {
        setStats(s)
        setError(null)
      })
      .catch((e) => setError(e.message))
  }, [from, today])

  const dates = useMemo(
    () => eachDayOfInterval({ start: parseDate(from), end: parseDate(today) }).map(toDateStr),
    [from, today],
  )

  const completedSeries = useMemo(() => {
    const m = new Map(stats?.completedByDay.map((d) => [d.date, d.count]))
    return dates.map((d) => ({ date: d, value: m.get(d) ?? 0 }))
  }, [stats, dates])

  const hoursSeries = useMemo(() => {
    const m = new Map(stats?.blocksByDay.map((d) => [d.date, d.minutes]))
    return dates.map((d) => ({ date: d, value: (m.get(d) ?? 0) / 60 }))
  }, [stats, dates])

  const completedTotal = completedSeries.reduce((s, d) => s + d.value, 0)
  const plannedMinutes = stats?.blocksByCategory.reduce((s, c) => s + c.minutes, 0) ?? 0
  const rate = stats && stats.dueTotal > 0 ? Math.round((stats.dueDone / stats.dueTotal) * 100) : null

  return (
    <div>
      <PageHeader title="통계">
        <div className="segmented" role="tablist" aria-label="기간">
          {RANGES.map((r) => (
            <button key={r.days} role="tab" aria-selected={days === r.days} onClick={() => setDays(r.days)}>
              {r.label}
            </button>
          ))}
        </div>
      </PageHeader>

      {error && <p className="alert-error mb-4">{error}</p>}

      {stats && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="완료한 할 일" value={`${completedTotal}개`} sub={`하루 평균 ${(completedTotal / days).toFixed(1)}개`} />
            <StatTile
              label="마감 달성률"
              value={rate === null ? '–' : `${rate}%`}
              sub={stats.dueTotal ? `마감 ${stats.dueTotal}개 중 ${stats.dueDone}개 완료` : '기간 내 마감 할 일 없음'}
            />
            <StatTile label="계획한 시간" value={formatDuration(plannedMinutes)} sub={`하루 평균 ${formatDuration(Math.round(plannedMinutes / days))}`} />
            <StatTile
              label="남은 할 일"
              value={`${stats.openTasks}개`}
              sub={stats.overdueTasks ? `기한 지남 ${stats.overdueTasks}개` : '기한 지난 할 일 없음'}
              alert={stats.overdueTasks > 0}
            />
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <ChartCard title="날짜별 완료한 할 일">
              <BarChart data={completedSeries} format={(v) => `${v}개`} />
            </ChartCard>
            <ChartCard title="날짜별 계획한 시간">
              <BarChart data={hoursSeries} format={(v) => formatDuration(Math.round(v * 60))} />
            </ChartCard>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <ChartCard title="카테고리별 시간">
              {stats.blocksByCategory.length === 0 ? (
                <p className="rounded-control bg-surface-muted py-10 text-center text-sm text-ink-subtle">이 기간에 타임 블록이 없습니다</p>
              ) : (
                <ul className="space-y-3">
                  {stats.blocksByCategory.map((c) => {
                    const info = CATEGORY_INFO[c.category]
                    const pct = (c.minutes / plannedMinutes) * 100
                    const max = stats.blocksByCategory[0].minutes
                    return (
                      <li key={c.category} title={`${info.label}: ${formatDuration(c.minutes)} (${pct.toFixed(0)}%)`}>
                        <div className="mb-1 flex justify-between text-sm">
                          <span className="text-ink">{info.label}</span>
                          <span className="text-ink-muted tabular-nums">
                            {formatDuration(c.minutes)} · {pct.toFixed(0)}%
                          </span>
                        </div>
                        <div className="h-2.5 rounded-full bg-surface-sunken">
                          <div className="h-full rounded-full" style={{ width: `${(c.minutes / max) * 100}%`, background: COLOR_HEX[info.color] }} />
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </ChartCard>
            <ChartCard title="요약">
              <dl className="grid grid-cols-2 gap-y-3 text-sm">
                <dt className="text-ink-muted">기간</dt>
                <dd className="text-right">
                  {fmt(parseDate(from), 'M월 d일')} – {fmt(parseDate(today), 'M월 d일')}
                </dd>
                <dt className="text-ink-muted">캘린더 일정</dt>
                <dd className="text-right tabular-nums">{stats.eventCount}개</dd>
                <dt className="text-ink-muted">가장 많이 완료한 날</dt>
                <dd className="text-right">{bestDay(completedSeries, (v) => `${v}개`)}</dd>
                <dt className="text-ink-muted">가장 많이 계획한 날</dt>
                <dd className="text-right">{bestDay(hoursSeries, (v) => formatDuration(Math.round(v * 60)))}</dd>
              </dl>
            </ChartCard>
          </div>
        </>
      )}
    </div>
  )
}

function bestDay(series: { date: string; value: number }[], format: (v: number) => string) {
  const best = series.reduce((a, b) => (b.value > a.value ? b : a), series[0])
  if (!best || best.value === 0) return '–'
  return `${fmt(parseDate(best.date), 'M/d (EEE)')} · ${format(best.value)}`
}

function StatTile({ label, value, sub, alert }: { label: string; value: string; sub: string; alert?: boolean }) {
  return (
    <div className="card p-4 md:p-5">
      <div className="text-xs font-semibold text-ink-muted">{label}</div>
      <div className="mt-2 text-2xl font-bold tracking-tight tabular-nums md:text-[28px]">{value}</div>
      <div className={`mt-1 text-xs ${alert ? 'font-medium text-danger' : 'text-ink-muted'}`}>
        {alert && '⚠ '}
        {sub}
      </div>
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card p-5 md:p-6">
      <h2 className="section-title mb-5">{title}</h2>
      {children}
    </section>
  )
}

/** 단일 계열 세로 막대 차트 (마우스 오버 툴팁, 표 보기 포함) */
function BarChart({ data, format }: { data: { date: string; value: number }[]; format: (v: number) => string }) {
  const [hover, setHover] = useState<number | null>(null)
  const [showTable, setShowTable] = useState(false)
  const max = Math.max(...data.map((d) => d.value))
  const niceMax = max <= 0 ? 1 : niceCeil(max)
  const ticks = [0, niceMax / 2, niceMax]
  const labelEvery = data.length <= 7 ? 1 : data.length <= 31 ? 5 : 15
  const H = 160

  if (max === 0) return <p className="rounded-control bg-surface-muted py-14 text-center text-sm text-ink-subtle">이 기간에 데이터가 없습니다</p>

  return (
    <div>
      <div className="flex gap-2">
        {/* y축 */}
        <div className="relative w-10 shrink-0 text-right text-[11px] text-ink-subtle tabular-nums" style={{ height: H }}>
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: H - (t / niceMax) * H }}>
              {Number.isInteger(t) ? t : t.toFixed(1)}
            </span>
          ))}
        </div>
        <div className="relative flex-1">
          {/* 격자선 */}
          {ticks.map((t) => (
            <div key={t} className="absolute inset-x-0 border-t border-line" style={{ top: H - (t / niceMax) * H }} />
          ))}
          <div className="relative flex items-end" style={{ height: H, gap: 2 }} onMouseLeave={() => setHover(null)}>
            {data.map((d, i) => (
              <div
                key={d.date}
                className="flex h-full flex-1 cursor-default items-end justify-center"
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                tabIndex={0}
                aria-label={`${fmt(parseDate(d.date), 'M월 d일')}: ${format(d.value)}`}
              >
                <div
                  className="w-full max-w-7 rounded-t-[4px] transition-opacity duration-150"
                  style={{
                    height: d.value > 0 ? Math.max(2, (d.value / niceMax) * H) : 0,
                    background: 'var(--color-brand)',
                    opacity: hover === null || hover === i ? 1 : 0.45,
                  }}
                />
              </div>
            ))}
            {hover !== null && (
              <div
                className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full rounded-lg bg-inverse px-2.5 py-1.5 text-xs whitespace-nowrap text-on-inverse shadow-pop"
                style={{ left: `${((hover + 0.5) / data.length) * 100}%` }}
              >
                <div className="text-on-inverse/70">{fmt(parseDate(data[hover].date), 'M월 d일 (EEE)')}</div>
                <div className="font-semibold">{format(data[hover].value)}</div>
              </div>
            )}
          </div>
          {/* x축 */}
          <div className="mt-1.5 flex text-[11px] text-ink-subtle" style={{ gap: 2 }}>
            {data.map((d, i) => (
              <div key={d.date} className="flex-1 text-center whitespace-nowrap">
                {(data.length - 1 - i) % labelEvery === 0 ? (data.length <= 7 ? fmt(parseDate(d.date), 'EEE') : fmt(parseDate(d.date), 'M/d')) : ''}
              </div>
            ))}
          </div>
        </div>
      </div>
      <button className="btn-ghost btn-sm mt-3 -ml-2" onClick={() => setShowTable(!showTable)}>
        {showTable ? '표 숨기기' : '표로 보기'}
      </button>
      {showTable && (
        <table className="mt-2 w-full text-xs">
          <tbody>
            {data.map((d) => (
              <tr key={d.date} className="border-t border-line">
                <td className="py-1 text-ink-muted">{fmt(parseDate(d.date), 'M월 d일 (EEE)')}</td>
                <td className="py-1 text-right tabular-nums">{format(d.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function niceCeil(v: number) {
  const pow = 10 ** Math.floor(Math.log10(v))
  for (const m of [1, 2, 2.5, 5, 10]) if (m * pow >= v) return m * pow
  return 10 * pow
}
