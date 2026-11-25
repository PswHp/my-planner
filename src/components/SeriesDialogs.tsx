import type { ReactNode } from 'react'
import { ChoiceDialog } from './ChoiceDialog'
import { ConfirmDialog } from './ConfirmDialog'
import { RepeatIcon, TrashIcon } from './Icons'

/** 반복 묶음이 있는 항목 이름 (조사 '을'이 붙는 말) */
type Noun = '일정' | '블록' | '할 일'

/**
 * 반복 항목 수정 범위 선택 — '이 ○○만 수정' / '반복 ○○ 전체 수정'
 * keeps: 전체 수정해도 그대로인 것, changes: 전체 수정으로 바뀌는 것
 */
export function SeriesEditDialog({
  noun,
  keeps,
  changes,
  onOne,
  onAll,
  onCancel,
}: {
  noun: Noun
  keeps: string
  changes: string
  onOne: () => Promise<void>
  onAll: () => Promise<void>
  onCancel: () => void
}) {
  return (
    <ChoiceDialog
      title={`반복 ${noun}을 수정할까요?`}
      icon={<RepeatIcon size={22} />}
      message={
        <>
          <b className="font-semibold text-ink">{`반복 ${noun} 전체`}</b>
          {`를 고르면 각 ${noun}의 ${keeps} 그대로 두고`}
          <br />
          {`${changes}만 모두 바꿔요.`}
        </>
      }
      choices={[
        { label: `이 ${noun}만 수정`, variant: 'secondary', onSelect: onOne },
        { label: `반복 ${noun} 전체 수정`, variant: 'primary', onSelect: onAll },
      ]}
      onCancel={onCancel}
    />
  )
}

/**
 * 삭제 확인 — 반복 항목이면 '이 ○○만 삭제' / '반복 ○○ 전체 삭제' 중 선택, 아니면 일반 확인 창
 * (모든 삭제는 화면 중앙의 확인 창을 씀)
 */
export function DeleteDialog({
  noun,
  series,
  message,
  icon = <TrashIcon />,
  onOne,
  onAll,
  onCancel,
}: {
  noun: Noun
  /** 반복 묶음에 속한 항목인지 */
  series: boolean
  message: string
  /** 반복 항목 선택 창의 아이콘 */
  icon?: ReactNode
  onOne: () => Promise<void>
  onAll: () => Promise<void>
  onCancel: () => void
}) {
  if (!series) return <ConfirmDialog title={`이 ${noun}을 삭제할까요?`} message={message} onConfirm={onOne} onCancel={onCancel} />
  return (
    <ChoiceDialog
      tone="danger"
      title={`반복 ${noun}을 삭제할까요?`}
      icon={icon}
      message={message}
      choices={[
        { label: `이 ${noun}만 삭제`, variant: 'secondary', onSelect: onOne },
        { label: `반복 ${noun} 전체 삭제`, variant: 'danger', onSelect: onAll },
      ]}
      onCancel={onCancel}
    />
  )
}
