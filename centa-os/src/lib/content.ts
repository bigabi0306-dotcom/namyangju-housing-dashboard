import { formatKRW, formatArea } from './format';

export const CHANNELS = ['네이버 블로그', '유튜브 롱폼', '유튜브 쇼츠', '인스타그램 피드', '인스타그램 릴스', '티스토리', '네이버 카페', '부동산신문 칼럼', '네이버 플레이스'] as const;
export type Channel = (typeof CHANNELS)[number];
export const TOPICS = ['등록된 매물', '지역 부동산시장 분석', '개발사업', '부동산 정책', '투자 정보', '현장답사', '부동산 교육', '자유 주제'] as const;
export const STATUSES = ['아이디어', '작성중', '검수중', '승인', '발행예약', '발행완료', '수정필요', '보관'] as const;
export const PLACEHOLDER = '【입력 필요';
export const hasPlaceholder = (t: string) => t.includes(PLACEHOLDER);

/** 채널별 독자·형식·목적 (AI 프롬프트와 템플릿 구성의 기준) */
export const CHANNEL_SPEC: Record<Channel, { audience: string; format: string; purpose: string; api: string }> = {
  '네이버 블로그': { audience: '검색으로 유입되는 매수·임차 희망자', format: 'SEO 제목 5개+추천 제목, 도입부, 소제목별 본문, 핵심 매물정보, 장점, 활용 가능성, 유의사항, FAQ, 태그, 썸네일 문구, 사진 배치 안내', purpose: '검색 유입과 상담 문의', api: '네이버 블로그 공식 글쓰기 API 미연결 → 복사 후 수동 게시' },
  '유튜브 롱폼': { audience: '영상으로 현장을 확인하려는 투자자·사업자', format: '5~6분 대본: 제목 후보, 썸네일 문구, 후킹, 인사, 매물 개요, 외부공간, 건물 내부, 입지, 활용 가능성, 주의사항, 마무리, 촬영 컷, 드론 컷, 영상 설명, 태그', purpose: '신뢰 형성과 현장 이해', api: 'YouTube Data API 연동 전 → 수동 업로드' },
  '유튜브 쇼츠': { audience: '짧은 영상으로 탐색하는 잠재 고객', format: '세로 9:16, 초 단위 대본·장면·자막, 표지 문구, 설명글, 해시태그', purpose: '관심 유도 후 롱폼·문의로 연결', api: '수동 업로드' },
  '인스타그램 피드': { audience: '시각적으로 매물을 훑어보는 팔로워', format: '카드 구성 안내, 캡션(짧은 문단), 해시태그', purpose: '브랜드 노출과 DM 문의', api: 'Instagram 공식 API 미연결 → 수동 게시' },
  '인스타그램 릴스': { audience: '짧은 영상 소비자', format: '세로 9:16, 초 단위 대본·장면·자막, 표지 문구, 캡션, 해시태그', purpose: '도달 확대', api: '수동 업로드' },
  '티스토리': { audience: '정보를 비교·검토하는 독자', format: '정보 중심 구조화 문단, 표, 데이터, 출처, SEO 제목', purpose: '정보형 검색 유입', api: 'Tistory API 종료/제한 → 수동 게시' },
  '네이버 카페': { audience: '카페 회원', format: '친근한 문체, 간결한 핵심정보, 문의 안내 (카페 운영규칙 확인 필요)', purpose: '회원 대상 정보 공유·문의', api: '카페 규칙 준수 필요 → 수동 게시' },
  '부동산신문 칼럼': { audience: '업계 종사자·전문 독자', format: '지역 시장 분석, 정책 배경, 통계, 현장 사례, 전문가 의견, 향후 전망, 근거 및 출처', purpose: '전문성 공신력', api: '신문사 투고 → 원고 내보내기' },
  '네이버 플레이스': { audience: '업체를 검색한 지역 고객', format: '업체 소식 초안, 회사 소개, 서비스 안내, 현장 활동, FAQ', purpose: '지역 검색 신뢰도', api: '플레이스 정책상 수동 게시' },
};

export type Opts = { priceVisible: boolean; emphasize: string; exclude: string; audience: string; shortsSec: 15 | 30 | 45 | 60; includeCons: boolean };
export type Facts = { lines: Record<string, string>; sources: string[]; warnings: string[] };

/** 공개 가능한 정보만 수집한다. 주소 상세·지번·소유자·내부메모는 절대 포함하지 않는다. */
export function publicFacts(p: any, o: Opts, analysis?: any): Facts {
  const lines: Record<string, string> = {};
  const set = (k: string, v: string | null | undefined) => { if (v && v.trim()) lines[k] = v.trim(); };
  set('매물명', p.title); set('종류', [p.category, p.subCategory].filter(Boolean).join(' / ')); set('거래유형', p.dealType); set('소재지', p.publicAddress || p.region);
  if (o.priceVisible) { set('가격', p.dealType === '매매' ? formatKRW(p.price) : p.dealType === '전세' ? `보증금 ${formatKRW(p.deposit)}` : `보증금 ${formatKRW(p.deposit)} / 월 ${formatKRW(p.monthlyRent)}`); if (p.priceNegotiable) set('가격 협의', '협의 가능'); }
  else set('가격', '가격은 문의 시 안내');
  if (p.landAreaM2) set('대지면적', formatArea(p.landAreaM2)); if (p.buildingAreaM2) set('건축면적', formatArea(p.buildingAreaM2)); if (p.totalFloorAreaM2) set('연면적', formatArea(p.totalFloorAreaM2));
  set('지목', p.landCategory); set('용도지역', p.zoning); set('도로조건', p.roadCondition); set('층수', p.floors); set('건물용도', p.buildingUse); set('주차', p.parking);
  if (p.largeTruck != null) set('대형차 진입', p.largeTruck ? '가능' : '제한');
  set('매물 특징', p.features); set('장점', p.pros); if (o.includeCons) set('유의할 점', p.cons); set('설명', p.publicDescription);
  const sources = ['센타부동산 매물장(공개 가능 항목만 사용)'];
  const warnings: string[] = [];
  if (!p.isPublic) warnings.push('이 매물은 "공개 허용"이 체크되어 있지 않습니다. 게시 전 공개 가능 여부를 확인하세요.');
  if (analysis) {
    const r = analysis.result; const pick = (k: string) => r.sections.find((s: any) => s.key === k);
    for (const [key, label] of [['location', '입지(분석 입력)'], ['transport', '교통(분석 입력)'], ['usability', '활용 가능성(분석 입력)'], ['compare', '시세 비교(분석)']] as const) { const s = pick(key); if (s && s.status !== '자료 없음') { set(label, s.text); sources.push(`${s.source} (${s.status}, 기준일 ${s.asOf})`); } }
    if (analysis.type) sources.push(`물건분석 보고서 #${analysis.id} (${analysis.type}, 기준일 ${r.asOf})`);
  }
  const ex = o.exclude.split(/[\n,]/).map((x) => x.trim()).filter(Boolean);
  if (ex.length) for (const k of Object.keys(lines)) if (ex.some((e) => lines[k].includes(e) || k.includes(e))) delete lines[k];
  return { lines, sources: [...new Set(sources)], warnings };
}
export const factsText = (f: Facts) => Object.entries(f.lines).map(([k, v]) => `- ${k}: ${v}`).join('\n');

const ph = (what: string) => `${PLACEHOLDER}: ${what}】`;
const L = (f: Facts, k: string, fb = ph(k)) => f.lines[k] ?? fb;

/** 쇼츠/릴스 초 단위 구간 (합계가 총 길이와 정확히 일치) */
export function shortsTimeline(total: number): { from: number; to: number; role: string }[] {
  const roles = [['후킹', 0.12], ['핵심 매물 소개', 0.28], ['현장 장면', 0.3], ['활용 포인트', 0.2], ['마무리·문의 유도', 0.1]] as const;
  let t = 0; const out: { from: number; to: number; role: string }[] = [];
  roles.forEach(([role, w], i) => { const len = i === roles.length - 1 ? total - t : Math.max(1, Math.round(total * w)); out.push({ from: t, to: t + len, role }); t += len; });
  return out;
}

/** 템플릿 초안: 사실 항목은 채우고, 현장 경험·수치·전망은 '입력 필요'로 남겨 사람이 작성하도록 한다. (AI 아님) */
export function templateDraft(ch: Channel, p: any, f: Facts, o: Opts): string {
  const loc = f.lines['소재지'] ?? p.region, cat = p.category, deal = p.dealType;
  const core = Object.entries(f.lines).filter(([k]) => !['설명', '장점', '유의할 점', '매물 특징'].includes(k)).map(([k, v]) => `- ${k}: ${v}`).join('\n');
  const pros = f.lines['장점'] ?? ph('장점(현장에서 확인한 내용)'), cons = f.lines['유의할 점'] ?? ph('유의할 점');
  const emph = o.emphasize.trim() ? `강조: ${o.emphasize.trim()}` : '';
  const caveat = '※ 인허가·건축 가능 여부, 개발 호재는 공식 자료로 확인된 경우에만 서술하고, 확인 전에는 "가능성"으로 표현합니다.';
  switch (ch) {
    case '네이버 블로그': return `## SEO 제목 후보
1. [${loc}] ${cat} ${deal} | ${f.lines['용도지역'] ?? ph('용도지역')} ${f.lines['대지면적']?.split(' ')[0] ?? ''} 현장 정리
2. ${loc} ${cat} ${deal}, 현장에서 확인한 핵심 3가지
3. ${loc} ${cat} 찾으신다면 ${f.lines['도로조건'] ?? '도로조건'}부터 확인하세요
4. ${cat} ${deal} 전 체크리스트 — ${loc} 사례
5. 공인중개사가 직접 본 ${loc} ${cat}
추천 제목: 1번

## 도입부
${ph('현장을 방문한 계기와 첫인상 2~3문장 (구어체)')}

## 핵심 매물정보
${core}

## 현장에서 본 장점
${pros}
${emph}

## 활용 가능성
${L(f, '활용 가능성(분석 입력)', ph('활용 가능성 — 확인된 사실과 전망을 구분해서 작성'))}

## 유의사항
${cons}
${caveat}

## FAQ
Q. 가격 협의가 가능한가요?
A. ${f.lines['가격 협의'] ?? ph('협의 여부')}
Q. 현장 방문은 어떻게 하나요?
A. 센타부동산 010-8848-7727로 문의해 주세요.
Q. ${f.lines['용도지역'] ? `${f.lines['용도지역']}에서 어떤 용도가 가능한가요?` : '건축 가능한 용도는 무엇인가요?'}
A. ${ph('관할 지자체 확인 결과 또는 "지자체 확인 필요"로 기재')}

## 태그
#${loc.replace(/\s/g, '')} #${cat.replace(/[·\s]/g, '')} #${deal} #센타부동산 #땅폴레옹

## 썸네일 문구
${loc} ${cat} ${deal}

## 사진 배치 안내
1) 전경(드론) 2) 진입로·도로 3) 외부공간 4) 내부 5) 주변 환경 6) 문의 안내`;
    case '유튜브 롱폼': return `## 제목 후보
1. ${loc} ${cat} ${deal}, 직접 가 봤습니다
2. ${cat} 찾는다면 이것부터 보세요 (${loc})
3. ${loc} ${cat} 현장 리뷰

## 썸네일 문구
${loc} ${cat}

## 대본 (총 5~6분 목표)
[0:00~0:20 후킹] ${ph('가장 강한 한 문장')}
[0:20~0:40 인사] 안녕하세요, 센타부동산 땅폴레옹입니다. 오늘은 ${loc}의 ${cat}을 소개해 드리겠습니다.
[0:40~1:30 매물 개요]
${core}
[1:30~2:30 외부공간] ${ph('진입로, 도로 폭, 대형차 진입, 주차·야적 현장 멘트')}
[2:30~3:30 건물 내부] ${ph('층고, 구조, 설비 현장 멘트')}
[3:30~4:30 입지] ${L(f, '입지(분석 입력)', ph('교통·주변 환경(확인된 사실만)'))}
[4:30~5:20 활용 가능성] ${L(f, '활용 가능성(분석 입력)', ph('활용 가능성'))}
[5:20~5:40 주의사항] ${cons}
${caveat}
[5:40~6:00 마무리] 궁금하신 점은 센타부동산 010-8848-7727로 문의 주세요.

## 촬영 컷
전경 / 진입로 / 외부 전체 / 내부 / 디테일(층고·바닥·설비) / 주변 환경
## 드론 컷
상공 전경 / 진입로 따라가기 / 인근 도로망 확인
## 영상 설명
${loc} ${cat} ${deal} 현장 영상입니다. 매물 문의: 010-8848-7727
## 태그
${loc}, ${cat}, ${deal}, 센타부동산, 땅폴레옹`;
    case '유튜브 쇼츠': case '인스타그램 릴스': { const tl = shortsTimeline(o.shortsSec); return `## ${ch} ${o.shortsSec}초 (세로 9:16)
## 표지 문구
${loc} ${cat} ${deal}

## 초 단위 대본·장면·자막
${tl.map((s) => `[${s.from}~${s.to}초 ${s.role}] 대본: ${ph(s.role + ' 멘트')} / 장면: ${ph('촬영 장면')} / 자막: ${ph('자막')}`).join('\n')}

## 핵심 사실 (자막에 쓸 수 있는 확인된 정보)
${core}

## 설명글
${loc} ${cat} ${deal}. 문의 010-8848-7727
## 해시태그
#${loc.replace(/\s/g, '')} #${cat.replace(/[·\s]/g, '')} #센타부동산 #땅폴레옹`; }
    case '인스타그램 피드': return `## 카드 구성
1) 표지: ${loc} ${cat} ${deal} 2) 전경 3) 핵심 정보 4) 내부/외부 5) 활용 포인트 6) 문의 안내

## 캡션
${loc}의 ${cat}입니다.
${core}
${ph('현장에서 느낀 한 줄 코멘트')}
문의: 센타부동산 010-8848-7727

## 해시태그
#${loc.replace(/\s/g, '')} #${cat.replace(/[·\s]/g, '')} #${deal} #센타부동산 #땅폴레옹`;
    case '티스토리': return `## SEO 제목
${loc} ${cat} ${deal} 정보 정리 — ${f.lines['용도지역'] ?? ''} 기준

## 요약
${ph('3줄 요약')}

## 매물 개요 (표)
| 항목 | 내용 |
|---|---|
${Object.entries(f.lines).filter(([k]) => !['설명'].includes(k)).map(([k, v]) => `| ${k} | ${v.replace(/\n/g, ' ')} |`).join('\n')}

## 입지·시장 데이터
${ph('거래사례·통계 수치와 출처(기관, 조회일)')}

## 활용 시 검토사항
${cons}
${caveat}

## 출처
${f.sources.map((s) => `- ${s}`).join('\n')}`;
    case '네이버 카페': return `## 제목
[${loc}] ${cat} ${deal} 소개

## 본문
안녕하세요, 센타부동산입니다.
${core}
${emph}
${ph('회원에게 전하는 한두 줄 코멘트')}
문의는 쪽지 또는 010-8848-7727로 부탁드립니다.
※ 카페 운영규칙(홍보글 허용 게시판·표기 방식)을 게시 전 확인하세요.`;
    case '부동산신문 칼럼': return `## 칼럼 제목
${ph('제목 — 지역/이슈 중심')}

## 지역 시장 분석
${ph('지역 시장 현황 (통계 수치·기관·기준일)')}
## 정책 배경
${ph('관련 정책명·시행일·출처')}
## 현장 사례
${loc} ${cat} ${deal} 사례:
${core}
## 전문가 의견
${ph('공인중개사로서의 현장 판단 (사실과 의견 구분)')}
## 향후 전망
${ph('전망은 근거와 함께 "예상"으로 표기')}
## 근거 및 출처
${f.sources.map((s) => `- ${s}`).join('\n')}
${ph('통계·정책 자료 출처 추가')}`;
    case '네이버 플레이스': return `## 업체 소식 초안
[${loc} ${cat} ${deal} 소식] ${f.lines['매물명'] ?? ''}
${core}
## 회사 소개
센타부동산 — ${ph('소개 문구')}
## 서비스 안내
${ph('취급 매물·상담 범위')}
## FAQ
Q. 상담은 어떻게 받나요? A. 010-8848-7727 문의`; }
}

/** 사실 검토용 점검: 단정·과장·미확인 호재 표현을 찾아 알린다 (차단이 아닌 경고) */
const RULES: [RegExp, string][] = [
  [/무조건|반드시\s*(오른|상승|돈)|100\s*%|확실(히|한)\s*(수익|상승)|손해\s*(없|볼\s*일)/, '단정·과장 표현(수익·상승 보장처럼 읽힐 수 있음)'],
  [/대박|폭등|급등\s*예정|놓치면\s*후회/, '과장된 투자 권유 표현'],
  [/호재/, "'호재' 표현: 공식 자료(고시·계획)로 확인된 사실인지 출처를 확인하세요"],
  [/개발\s*(예정|확정)|(착공|준공)\s*예정/, '개발 확정·예정 표현: 근거 자료(고시 번호, 시행기관)가 있어야 합니다'],
  [/인허가\s*(가능|문제\s*없)|건축\s*(가능|문제\s*없)/, '인허가·건축 가능 단정: 지자체 확인 전에는 "가능성"으로 표현하세요'],
  [/수익률\s*\d+/, '수익률 수치: 산식·가정·기준일 명시가 필요합니다'],
];
export function factCheckWarnings(text: string, facts?: Facts): string[] {
  const w: string[] = [];
  for (const [re, msg] of RULES) if (re.test(text)) w.push(msg);
  if (hasPlaceholder(text)) w.push(`아직 채우지 않은 '${PLACEHOLDER}' 항목이 있습니다 (승인 불가)`);
  if (facts && /\d{2,3}-\d{3,4}-\d{4}/.test(text.replace(/010-8848-7727/g, ''))) w.push('센타부동산 대표번호 외 전화번호가 포함되어 있습니다 (개인정보 확인)');
  return w;
}

export const BRAND_STYLE = `너는 경기 동북부(남양주·구리·포천) 현장 10년차 공인중개사 '땅폴레옹'(센타부동산)의 콘텐츠 작성 보조다.
문체: 실제 현장 관점의 자연스러운 구어체, 정확한 부동산 용어, 매물 특징과 실질적 활용성 중심, 반복 문장 최소화, AI식 상투 표현 금지.
금지: 과장된 투자 권유, 수익·상승 보장, 확인되지 않은 개발 호재·인허가 단정, 제공되지 않은 숫자·사실 창작.
규칙: 사실과 전망을 구분하고, 전망은 "~로 예상됩니다/~할 가능성" 형태로 쓴다. 제공된 '사실' 밖의 내용(현장 인상, 통계, 정책)은 지어내지 말고 '${PLACEHOLDER}: 항목】' 로 남긴다. 가격은 제공된 경우에만 쓴다.
각 채널의 독자·형식·목적에 맞게 새로 구성하며, 다른 채널 글을 줄이거나 늘리는 방식으로 만들지 않는다.`;

export function aiRequest(ch: Channel, f: Facts, o: Opts, model: string) {
  const s = CHANNEL_SPEC[ch];
  const user = `채널: ${ch}\n독자: ${o.audience || s.audience}\n목적: ${s.purpose}\n출력 형식: ${s.format}${ch.includes('쇼츠') || ch.includes('릴스') ? `\n길이: ${o.shortsSec}초(세로 9:16), 초 단위 구간 합계가 정확히 ${o.shortsSec}초` : ''}\n강조할 장점: ${o.emphasize || '(지정 없음)'}\n\n[사용할 수 있는 사실]\n${factsText(f)}\n\n마크다운 '## 소제목' 형식으로 작성해 줘.`;
  return { model, max_tokens: 4000, system: BRAND_STYLE, messages: [{ role: 'user', content: user }] };
}
export async function generateWithAI(ch: Channel, f: Facts, o: Opts): Promise<{ ok: true; text: string; model: string } | { ok: false; error: string }> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { ok: false, error: 'ANTHROPIC_API_KEY가 설정되지 않았습니다(.env). 템플릿 초안을 사용하세요.' };
  const model = process.env.CONTENT_AI_MODEL || 'claude-sonnet-5-5';
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }, body: JSON.stringify(aiRequest(ch, f, o, model)), signal: AbortSignal.timeout(90_000) });
    const j: any = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: `AI 서비스 오류 HTTP ${res.status}: ${j?.error?.message ?? ''}` };
    const text = (j.content ?? []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n').trim();
    return text ? { ok: true, text, model } : { ok: false, error: 'AI 응답이 비어 있습니다.' };
  } catch (e) { return { ok: false, error: `AI 호출 실패: ${(e as Error).message}` }; }
}

/** 상태 전환 규칙 */
const NEXT: Record<string, string[]> = { 아이디어: ['작성중', '보관'], 작성중: ['검수중', '보관'], 검수중: ['승인', '수정필요', '작성중'], 승인: ['발행예약', '발행완료', '수정필요'], 발행예약: ['발행완료', '수정필요'], 수정필요: ['작성중', '검수중'], 발행완료: ['보관'], 보관: ['아이디어', '작성중'] };
export const nextStatuses = (from: string) => NEXT[from] ?? [];
export function checkTransition(from: string, to: string, ctx: { canApprove: boolean; body: string; hasUrl: boolean; manualPublished: boolean }): string | null {
  if (!(NEXT[from] ?? []).includes(to)) return `'${from}' 상태에서 '${to}'(으)로 바로 변경할 수 없습니다.`;
  if (['검수중', '승인', '발행예약', '발행완료'].includes(to) && !ctx.body.trim()) return '원고가 비어 있습니다.';
  if (['검수중', '승인', '발행예약', '발행완료'].includes(to) && hasPlaceholder(ctx.body)) return `원고에 채우지 않은 '${PLACEHOLDER}' 항목이 남아 있습니다.`;
  if (to === '승인' && !ctx.canApprove) return '승인 권한(대표 관리자·공인중개사)이 필요합니다.';
  if (to === '발행완료' && !ctx.hasUrl && !ctx.manualPublished) return '발행 URL을 입력하거나 "수동 게시 완료"를 체크하세요.';
  return null;
}
