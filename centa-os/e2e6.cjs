const { chromium } = require('playwright');
(async()=>{const B='http://localhost:3100';const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1280,height:900}});const p=await ctx.newPage();
const ok=(n,c)=>console.log((c?'PASS ':'FAIL ')+n);
const login=async(pg,e,pw)=>{await pg.goto(B+'/login');await pg.fill('input[name=email]',e);await pg.fill('input[name=password]',pw);await pg.click('button');await pg.waitForURL(B+'/');};
const iso=(n)=>new Date(Date.now()+9*36e5+n*864e5).toISOString().slice(0,10);
await login(p,'admin@centa.local','Centa!Dev2026pw');
// 계약 등록
await p.goto(B+'/contracts/new');
await p.selectOption('select[name=propertyId]',{label:/화도읍 공장/}.source?undefined:undefined).catch(()=>{});
const pv=await p.locator('select[name=propertyId] option',{hasText:'화도읍 공장'}).first().getAttribute('value'); await p.selectOption('select[name=propertyId]',pv);
const cv=await p.locator('select[name=clientId] option',{hasText:'김고객'}).first().getAttribute('value'); await p.selectOption('select[name=clientId]',cv);
await p.fill('input[name=parties]','매도 홍 / 매수 김'); await p.fill('input[name=contractDate]',iso(0)); await p.fill('input[name=dealAmount]','12억'); await p.fill('input[name=downPayment]','1억'); await p.fill('input[name=interimPayment]','4억'); await p.fill('input[name=interimDate]',iso(1)); await p.fill('input[name=balance]','7억'); await p.fill('input[name=balanceDate]',iso(2)); await p.fill('input[name=agreedFee]','1000만');
await p.click('button:has-text("계약 저장")'); await p.waitForURL(/\/contracts\/\d+$/); const curl=p.url();
let t=await p.innerText('body'); ok('계약번호 생성', /CN-\d{4}-\d{4}/.test(t)); ok('납부 일정 3건 자동 생성', ['계약금','중도금','잔금'].every(k=>t.includes(k)) && t.includes('4억원') && t.includes('7억원'));
// 합계 초과 검증
await p.click('summary:has-text("계약 정보 수정")'); await p.fill('details input[name=downPayment]','9억'); await p.click('details button:has-text("계약 저장")'); await p.waitForSelector('p[role=alert]'); ok('분할금 합계가 거래금액 초과 시 차단', (await p.innerText('p[role=alert]')).includes('초과'));
await p.reload();
// 상태 흐름
ok('협상 단계에서 되돌리기 버튼 없음', (await p.locator('button:has-text("협상(으)로")').count())===0);
await p.click('button:has-text("잔금완료(으)로")'); await p.waitForSelector('p[role=alert]'); ok('잔금 미수령 상태에서 잔금완료 차단', (await p.innerText('p[role=alert]')).includes('잔금 수령'));
await p.click('button:has-text("계약(으)로")'); await p.waitForSelector('[role=status]:has-text("변경되었습니다")'); 
await p.goto(B+'/properties'); ok('계약 진행 시 매물 상태 → 계약완료', (await p.locator('tr:has-text("화도읍 공장")').first().innerText()).includes('계약완료'));
await p.goto(B+'/clients/'+cv); ok('고객 단계 → 계약', (await p.innerText('body')).includes('계약'));
await p.goto(curl);
// 계약금 수령 처리
await p.locator('tr:has-text("계약금")').locator('text=수령 처리').click(); await p.waitForTimeout(1000); await p.reload(); ok('계약금 수령 처리', (await p.locator('tr:has-text("계약금")').innerText()).includes('✔'));
// 중개보수 기록 (대표) + 규칙
await p.goto(B+'/contracts/settlements'); 
await p.fill('input[name=name]','기본 60:40'); await p.fill('input[name=agentRatio]','60'); await p.fill('input[name=officeRatio]','50'); await p.click('button:has-text("규칙 추가")'); await p.waitForSelector('p[role=alert]'); ok('비율 합계 100 아니면 규칙 저장 차단', (await p.innerText('p[role=alert]')).includes('100'));
await p.fill('input[name=officeRatio]','40'); await p.fill('input[name=expenseRatio]','5'); await p.check('input[name=isDefault]'); await p.click('button:has-text("규칙 추가")'); await p.waitForSelector('text=저장되었습니다'); 
await p.goto(curl); await p.fill('input[name=receivedFee]','900만'); await p.fill('input[name=receivedAt]',iso(0)); await p.click('button:has-text("보수 저장")'); await p.waitForSelector('text=저장되었습니다');
await p.reload(); await p.fill('input[name=taxRefRate]','3.3'); await p.click('button:has-text("정산 생성")'); await p.waitForSelector('text=담당자 배분액'); await p.reload(); t=await p.innerText('body');
ok('정산: 담당자 배분 540만원', t.includes('540만원')); ok('정산: 지급 예정액 495만원(운영비 45만 차감)', t.includes('495만원') && t.includes('45만원')); ok('세금은 참고액·확정 아님 표시', t.includes('확정 아님') && t.includes('16만 3,350원'));
// 지급·초과·수정 이력
await p.goto(B+'/contracts/settlements'); await p.fill('form:has(button:has-text("지급 기록")) input[name=amount]','300만'); await p.click('button:has-text("지급 기록")'); await p.waitForSelector('text=저장되었습니다'); await p.reload();
ok('지급 300만 반영, 남은 195만', (await p.innerText('body')).includes('195만원'));
await p.fill('form:has(button:has-text("지급 기록")) input[name=amount]','300만'); await p.click('button:has-text("지급 기록")'); await p.waitForSelector('p[role=alert]'); ok('지급 예정액 초과 지급 차단', (await p.innerText('p[role=alert]')).includes('초과'));
await p.reload(); await p.click('summary:has-text("비율 수정")'); await p.fill('details input[name=agentRatio]','70'); await p.click('button:has-text("수정 저장")'); await p.waitForSelector('p[role=alert]'); ok('사유 없는 정산 수정 차단', (await p.innerText('p[role=alert]')).includes('사유'));
await p.fill('details input[name=reason]','대표 합의 특별 조정'); await p.click('button:has-text("수정 저장")'); await p.waitForSelector('text=저장되었습니다'); await p.reload();
await p.click('summary:has-text("정산 이력")'); t=await p.innerText('body'); ok('정산 이력에 생성·지급·수정 보존', ['정산 생성','지급 기록','비율 수정','대표 합의 특별 조정'].every(k=>t.includes(k)));
// 수령액 변경 사유 필수
await p.goto(curl); await p.fill('input[name=receivedFee]','800만'); await p.click('button:has-text("보수 저장")'); await p.waitForSelector('p[role=alert]'); ok('정산 후 수령액 변경은 사유 필수', (await p.innerText('p[role=alert]')).includes('사유'));
// 알림
await p.goto(B+'/notifications'); t=await p.innerText('body'); const n=(t.match(/\[계약알림#\d+\]/g)||[]).length; ok('납부 임박 알림 생성(중복 없음)', n>=2 && new Set(t.match(/\[계약알림#\d+\]/g)).size===n);
// 캘린더 연동
await p.goto(curl); await p.click('button:has-text("캘린더에 일정 등록")'); await p.waitForSelector('[role=status]:has-text("등록")'); await p.goto(B+'/calendar?view=list'); ok('계약·잔금 일정 캘린더 등록', (await p.innerText('body')).includes('잔금 ·'));
// 잔금 수령 → 잔금완료 → 매물 상태
await p.goto(curl); await p.locator('tr:has-text("잔금")').locator('text=수령 처리').click(); await p.waitForTimeout(1000); await p.reload();
await p.click('button:has-text("잔금완료(으)로")'); await p.waitForSelector('[role=status]:has-text("변경되었습니다")'); await p.goto(B+'/properties'); ok('잔금완료 시 매물 상태 반영', (await p.locator('tr:has-text("화도읍 공장")').first().innerText()).includes('잔금완료'));
await p.goto(curl); ok('잔금완료 계약은 상태 변경 불가', (await p.locator('button:has-text("취소(으)로")').count())===0);
// 통계
await p.goto(B+'/stats'); t=await p.innerText('body');
ok('통계: 수령 보수 900만원 집계(사유 없는 800만 변경은 거절됨)', t.includes('900만원')); ok('통계: 계약 체결 1건 이상', /기간 내 계약 체결\s*\n?\s*[1-9]/.test(t)); ok('통계: 등록→계약 기간 표시', t.includes('등록 → 계약 평균 기간')); ok('통계: 인과관계 단정 금지 문구', t.includes('인과관계'));
ok('통계: 지역·종류·가격대·유입경로 차트', ['지역별 매물 현황','종류별 매물 현황','가격대별 매물 현황','고객 유입경로'].every(k=>t.includes(k)));
await p.goto(B+'/stats?m=3&region='+encodeURIComponent('구리시')); t=await p.innerText('body'); ok('지역 필터 적용(구리시: 화도 계약 제외)', /기간 내 계약 체결\s*\n?\s*0/.test(t));
await p.goto(B+'/'); t=await p.innerText('body'); ok('대시보드: 월별 수입 추이 차트', t.includes('월별 수입 추이') && t.includes('유입 채널별 고객')); ok('대시보드: 이달 수령 중개보수 표시', t.includes('이달 수령 중개보수'));
// 공인중개사: 보수·정산 접근 차단
const a=await ctx.newPage(); await login(a,'agent@centa.local','Agent!Test2026');
await a.goto(B+'/contracts'); t=await a.innerText('body'); ok('공인중개사: 계약 목록에 보수 열 없음', !t.includes('실수령 보수') && t.includes('CN-'));
await a.goto(B+'/contracts/settlements'); ok('공인중개사: 정산 화면 차단', a.url().includes('forbidden'));
await a.goto(curl); t=await a.innerText('body'); ok('공인중개사: 계약 상세에 보수 숨김', !t.includes('약정 / 실수령') && t.includes('대표 관리자 전용') && !t.includes('담당자 정산') && !t.includes('중개보수 기록'));
await a.goto(B+'/'); ok('공인중개사: 대시보드 보수 KPI 권한 없음', (await a.innerText('body')).includes('권한 없음'));
await a.goto(B+'/stats'); t=await a.innerText('body'); ok('공인중개사: 통계에 보수 숨김', t.includes('권한 없음') && !t.includes('900만원'));
// 모바일 통계 가로 스크롤
const m=await b.newContext({viewport:{width:390,height:800}}); const mp=await m.newPage(); await login(mp,'admin@centa.local','Centa!Dev2026pw'); await mp.goto(B+'/stats'); ok('모바일: 통계 가로 스크롤 없음', await mp.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
await mp.goto(B+'/contracts/settlements'); ok('모바일: 정산 가로 스크롤 없음', await mp.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
await b.close();})().catch(e=>{console.error('ERR',e.message.slice(0,500));process.exit(1)});
