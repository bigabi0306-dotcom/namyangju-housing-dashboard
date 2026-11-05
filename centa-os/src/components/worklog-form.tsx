import { ActionForm, Field, Select } from './ui';
import { Pick } from './pick';
import { kstDateStr } from '@/lib/format';
import { saveWorkLog } from '@/app/actions-work';
export const WORK_TYPES = ['고객상담', '매물 접수', '현장답사', '매물 촬영', '소유자 상담', '계약 협의', '계약 체결', '잔금', '분석보고서 작성', '콘텐츠 제작', '기타'];
export function WorkLogForm({ opts }: { opts: any }) {
  return (
    <ActionForm action={saveWorkLog} submit="업무일지 저장">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="날짜"><input name="date" type="date" defaultValue={kstDateStr()} className="input" /></Field>
        <Field label="업무유형"><Select name="type" options={WORK_TYPES} /></Field>
        <Pick name="clientId" label="관련 고객" items={opts.clients.map((c: any) => ({ id: c.id, label: `${c.name} (${c.code})` }))} />
        <Pick name="propertyId" label="관련 매물" items={opts.properties.map((p: any) => ({ id: p.id, label: `${p.title} (${p.code})` }))} />
      </div>
      <Field label="업무내용 *"><textarea name="content" rows={3} className="input" /></Field>
      <div className="grid gap-3 sm:grid-cols-2"><Field label="업무결과"><input name="result" className="input" /></Field><Field label="후속조치 (입력 시 후속업무가 자동 생성)"><input name="followUp" className="input" /></Field></div>
      <div className="flex flex-wrap items-end gap-4"><Field label="후속 기한"><input name="followDate" type="date" className="input" /></Field>
        <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="makeEvent" />후속 일정도 캘린더에 등록</label>
        <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="done" defaultChecked />완료</label>
        <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="needsCheck" />확인 필요</label></div>
    </ActionForm>
  );
}
