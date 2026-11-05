import { ActionForm, Field, Select } from './ui';
import { Pick } from './pick';
import { kstDateStr } from '@/lib/format';
export const EVENT_TYPES = ['고객미팅', '매물안내', '현장답사', '계약', '잔금', '서류 확인', '촬영', '콘텐츠 발행', '기타'];
export function EventForm({ action, e, opts, defDate }: { action: (s: any, fd: FormData) => Promise<any>; e?: any; opts: any; defDate?: string }) {
  const hm = (d?: Date | null) => d ? new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false }).format(d) : '';
  return (
    <ActionForm action={action} submit="일정 저장">
      <div className="card grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="제목 *" className="sm:col-span-2"><input name="title" defaultValue={e?.title ?? ''} className="input" /></Field>
        <Field label="유형"><Select name="type" options={EVENT_TYPES} def={e?.type} /></Field>
        <Field label="날짜 *"><input name="date" type="date" defaultValue={e ? kstDateStr(e.startAt) : defDate ?? kstDateStr()} className="input" /></Field>
        <Field label="시작"><input name="startTime" type="time" defaultValue={e ? hm(e.startAt) : '10:00'} className="input" /></Field>
        <Field label="종료"><input name="endTime" type="time" defaultValue={hm(e?.endAt)} className="input" /></Field>
        <Field label="반복"><Select name="repeat" options={['매일', '매주', '매월']} def={e?.repeat} empty="반복 없음" /></Field>
        <Field label="사전 알림"><select name="remindMinutes" defaultValue={e?.remindMinutes ?? ''} className="input"><option value="">없음</option><option value="10">10분 전</option><option value="30">30분 전</option><option value="60">1시간 전</option><option value="1440">1일 전</option></select></Field>
        <Pick name="assigneeId" label="담당자" items={opts.users.map((u: any) => ({ id: u.id, label: u.name }))} def={e?.assigneeId} />
        <Pick name="clientId" label="관련 고객" items={opts.clients.map((c: any) => ({ id: c.id, label: `${c.name} (${c.code})` }))} def={e?.clientId} />
        <Pick name="propertyId" label="관련 매물" items={opts.properties.map((p: any) => ({ id: p.id, label: `${p.title} (${p.code})` }))} def={e?.propertyId} />
      </div>
    </ActionForm>
  );
}
