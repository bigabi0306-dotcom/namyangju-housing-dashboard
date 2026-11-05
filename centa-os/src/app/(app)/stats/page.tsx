import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { computeStats } from '@/lib/stats';
import { BarList, MonthBars } from '@/components/charts';
import { formatKRW } from '@/lib/format';
import { REGIONS } from '@/lib/constants';

export default async function Stats({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await requireUser('stats.read'); const sp = await searchParams;
  const months = [3, 6, 12].includes(Number(sp.m)) ? Number(sp.m) : 6;
  const withFee = can(me.role, 'settlement.read');
  const agentId = sp.agent && me.role === 'OWNER' ? Number(sp.agent) || undefined : me.role === 'AGENT' || me.role === 'ASSISTANT' ? me.id : undefined;
  const s = await computeStats({ months, region: sp.region || undefined, agentId, withFee });
  const users = me.role === 'OWNER' ? await db.user.findMany({ select: { id: true, name: true } }) : [];
  const won = (v: number) => formatKRW(v);
  const cp = s.content.chPub;
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">경영 통계</h1>
      <form className="card flex flex-wrap items-end gap-2"><label className="text-xs">기간<select name="m" defaultValue={months} className="input !w-28">{[3, 6, 12].map((m) => <option key={m} value={m}>최근 {m}개월</option>)}</select></label>
        <label className="text-xs">지역<select name="region" defaultValue={sp.region ?? ''} className="input !w-32"><option value="">전체</option>{REGIONS.map((r) => <option key={r}>{r}</option>)}</select></label>
        {me.role === 'OWNER' && <label className="text-xs">담당자<select name="agent" defaultValue={sp.agent ?? ''} className="input !w-32"><option value="">전체</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label>}
        <button className="btn">적용</button>{agentId && me.role !== 'OWNER' && <span className="text-xs text-gray-500">본인 담당 데이터 기준</span>}</form>
      <div className="grid gap-3 sm:grid-cols-4">{[['기간 내 계약 체결', `${s.signedTotal}건`], ['잔금 완료(누적)', `${s.closedTotal}건`], ['등록 → 계약 평균 기간', s.avgDaysToContract != null ? `${s.avgDaysToContract}일 (표본 ${s.daysSample}건)` : '표본 없음'], ['기간 내 실수령 보수', s.feeTotal != null ? won(s.feeTotal) : '권한 없음']].map(([k, v]) => <div key={k} className="card"><div className="text-xs text-gray-500">{k}</div><div className="text-lg font-bold">{v}</div></div>)}</div>
      <div className="grid gap-3 lg:grid-cols-2">
        <MonthBars title="월별 신규 매물" months={s.months} values={s.newProps} /><MonthBars title="월별 신규 고객" months={s.months} values={s.newClients} />
        <MonthBars title="월별 상담 건수" months={s.months} values={s.consults} /><MonthBars title="월별 현장안내 건수 (현장답사 업무일지 기준)" months={s.months} values={s.visits} />
        <MonthBars title="월별 계약 체결 (계약일 기준)" months={s.months} values={s.signedByMonth} />{s.feeByMonth && <MonthBars title="월별 실제 중개보수 수령액 (수령일 기준)" months={s.months} values={s.feeByMonth} fmt={(v) => `${Math.round(v / 1e4).toLocaleString('ko-KR')}만`} />}
        <BarList title="지역별 매물 현황" data={s.propsByRegion} /><BarList title="종류별 매물 현황" data={s.propsByCategory} />
        <BarList title="가격대별 매물 현황 (매매)" data={s.propsByBand} empty="가격이 입력된 매매 매물이 없습니다" /><BarList title="고객 유입경로" data={s.clientsByChannel} />
        <BarList title="고객별 상담 진행단계" data={s.clientsByStage} />
        <div className="card"><h3 className="mb-2 text-sm font-bold">담당자별 실적 (기간 내)</h3><table className="w-full text-sm"><thead><tr><th className="th">담당자</th><th className="th">계약 체결</th>{withFee && <th className="th">수령 보수</th>}</tr></thead><tbody>{s.byAgent.map((a) => <tr key={a.name} className="border-t"><td className="td">{a.name}</td><td className="td">{a.contracts}</td>{withFee && <td className="td">{won(a.fee ?? 0)}</td>}</tr>)}{s.byAgent.length === 0 && <tr><td colSpan={3} className="td text-gray-500">실적 데이터가 없습니다.</td></tr>}</tbody></table></div>
      </div>
      <div className="card space-y-2"><h3 className="font-bold">콘텐츠 성과</h3>
        <table className="w-full text-sm"><thead><tr>{['채널', '발행 건수', '입력된 조회수', '문의 수(입력)'].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead><tbody>{Object.entries(cp).map(([k, r]) => <tr key={k} className="border-t"><td className="td">{k}</td><td className="td">{r.n}</td><td className="td">{r.viewsKnown ? r.views.toLocaleString('ko-KR') : '수집 불가/미입력'}</td><td className="td">{r.inq}</td></tr>)}{Object.keys(cp).length === 0 && <tr><td colSpan={4} className="td text-gray-500">발행된 콘텐츠가 없습니다.</td></tr>}</tbody></table>
        <p className="text-sm">콘텐츠 계열 유입경로(유튜브·블로그·인스타그램·네이버 플레이스) 고객 <b>{s.content.contentClients}명</b> · 이들과 연결된 계약 <b>{s.content.contentContracts}건</b></p>
        <p className="text-xs text-gray-400">외부 플랫폼 조회수는 공식 API 연동 전이라 직접 입력값만 집계합니다. 유입경로는 상담 시 고객이 말한 내용을 기록한 값이며, 조회수·유입과 계약 사이의 인과관계는 이 통계만으로 단정할 수 없습니다.</p></div>
    </div>
  );
}
