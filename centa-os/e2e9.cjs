const { chromium, devices } = require('playwright');
(async()=>{const B='http://localhost:3100';const b=await chromium.launch();
const ok=(n,c)=>console.log((c?'PASS ':'FAIL ')+n);
const ctx=await b.newContext({viewport:{width:1280,height:900}});const p=await ctx.newPage();const csp=[];const jsErr=[];
p.on('console',m=>{const t=m.text(); if(/Content Security Policy/i.test(t)) csp.push(t.slice(0,150));}); p.on('pageerror',e=>jsErr.push(e.message.slice(0,120)));
await p.goto(B+'/login');await p.fill('input[name=email]','admin@centa.local');await p.fill('input[name=password]','Centa!Dev2026pw');await p.click('button');await p.waitForURL(B+'/');
// 기존 매물에 좌표 입력: 잘못된 값들
await p.goto(B+'/properties'); const href=await p.locator('a:has-text("화도읍 공장")').first().getAttribute('href'); const pid=href.split('/').pop();
await p.goto(B+href); await p.click('summary:has-text("정보 수정")');
const save=async()=>{await p.click('details button:has-text("저장")');};
await p.fill('input[name=lat]','127.2'); await p.fill('input[name=lng]','37.6'); await p.waitForSelector('p[role=alert]:has-text("바뀐")'); ok('위도·경도 순서 바뀜을 즉시 안내(입력 중)', true);
await save(); await p.waitForSelector('p[role=alert]:has-text("바뀐")'); ok('서버도 바뀐 순서 저장 거부', p.url().includes('/properties/'+pid));
await p.fill('input[name=lat]','35'); await p.fill('input[name=lng]','140'); await save(); await p.waitForSelector('p[role=alert]:has-text("범위")'); ok('한국 범위 밖 좌표 거부', true);
await p.fill('input[name=lat]','37.6'); await p.fill('input[name=lng]',''); await save(); await p.waitForSelector('p[role=alert]:has-text("함께")'); ok('한쪽만 입력 거부', true);
await p.fill('input[name=lat]','37.690123'); await p.fill('input[name=lng]','127.250456'); await save(); await p.waitForURL(new RegExp('/properties/'+pid+'$')); await p.waitForSelector('[aria-label="매물 위치 지도"] .leaflet-marker-icon'); ok('정상 좌표 저장 → 상세 화면에 위치 지도·마커', true);
// 지도 클릭으로 좌표 입력
await p.goto(B+'/properties/2'.replace('/2','/'+(await (async()=>{await p.goto(B+'/properties');return (await p.locator('a:has-text("진접 토지")').first().getAttribute('href')).split('/').pop();})()))); await p.click('summary:has-text("정보 수정")');
await p.locator('[aria-label="위치 선택 지도"]').click({position:{x:400,y:120}}); await p.waitForTimeout(400);
const la=await p.inputValue('input[name=lat]'), ln=await p.inputValue('input[name=lng]'); ok('지도 클릭 → 위도·경도 자동 입력(한국 범위)', /^\d{2}\.\d{6}$/.test(la) && /^\d{3}\.\d{6}$/.test(ln) && +la>33 && +la<39);
ok('입력값 유효 시 선택 마커 표시', (await p.locator('[aria-label="위치 선택 지도"] .leaflet-marker-icon').count())===1);
await p.click('details button:has-text("저장")'); await p.waitForURL(/\/properties\/\d+$/); 
// 악성 제목 매물 등록(XSS 시험) + 좌표
await p.goto(B+'/properties/new'); await p.fill('input[name=title]','<img src=x onerror="window.__xss=1">악성제목'); await p.selectOption('select[name=category]','토지'); await p.selectOption('select[name=dealType]','매매'); await p.selectOption('select[name=region]','남양주시'); await p.fill('input[name=address]','경기 남양주시 xss리 1'); await p.fill('input[name=lat]','37.65'); await p.fill('input[name=lng]','127.2'); await p.click('form button.btn'); await p.waitForURL(/\/properties\/\d+$/); const xssId=p.url().split('/').pop();
// 지도 보기
await p.goto(B+'/properties?view=map'); await p.waitForSelector('.leaflet-marker-icon'); const n=await p.locator('.leaflet-marker-icon').count(); const expected=+(await p.innerText('body')).match(/지도에 표시된 매물 (\d+)건/)[1];
ok('지도 보기: 좌표 있는 매물만 마커로 표시', n===expected && n>=3); ok('좌표 없는 매물 건수 안내', (await p.innerText('body')).includes('좌표가 없어 표시되지 않은 매물'));
await p.locator('.leaflet-marker-icon[title*="악성제목"]').click(); await p.waitForSelector('.leaflet-popup-content a'); const pop=await p.innerText('.leaflet-popup-content'); const xss=await p.evaluate(()=>window.__xss);
ok('팝업에 제목이 글자 그대로 표시(HTML 미해석)', pop.includes('<img src=x') && pop.includes('악성제목')); ok('악성 제목 스크립트 실행 안 됨', xss===undefined && (await p.locator('.leaflet-popup-content img').count())===0);
await p.locator('.leaflet-popup-content a').click(); await p.waitForURL(new RegExp('/properties/'+xssId+'$')); ok('팝업 링크 → 매물 상세', true);
// 필터가 지도에도 적용
await p.goto(B+'/properties?view=map&category='+encodeURIComponent('토지')); await p.waitForSelector('.leaflet-marker-icon'); const nt=await p.locator('.leaflet-marker-icon').count(); ok('필터(토지)가 지도 마커에 반영', nt>=1 && nt<n);
// 비로그인 영향 없음 / CSP
ok('CSP 위반 없음(지도 스크립트·스타일·타일 허용 범위)', csp.length===0); if(csp.length) console.log('  ',csp[0]); ok('페이지 JS 오류 없음', jsErr.length===0); if(jsErr.length) console.log('  ',jsErr[0]);
// 모바일 지도 화면
const m=await b.newContext({...devices['iPhone 13']}); const mp=await m.newPage(); await mp.goto(B+'/login'); await mp.fill('input[name=email]','admin@centa.local'); await mp.fill('input[name=password]','Centa!Dev2026pw'); await mp.click('button'); await mp.waitForURL(B+'/');
await mp.goto(B+'/properties?view=map',{waitUntil:'networkidle'}); await mp.waitForSelector('.leaflet-marker-icon'); ok('모바일: 지도 화면 가로 스크롤 없음', await mp.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
await mp.screenshot({path:'/tmp/m-map.png'});
await mp.goto(B+'/properties/'+pid,{waitUntil:'networkidle'}); await mp.click('summary:has-text("정보 수정")'); ok('모바일: 위치 선택 지도 가로 스크롤 없음', await mp.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
// 정리: 악성 제목 매물 삭제
await p.goto(B+'/properties/'+xssId); p.once('dialog',d=>d.accept()); await p.click('button:has-text("삭제")'); await p.waitForURL(B+'/properties'); ok('시험 매물 삭제', !(await p.innerText('body')).includes('악성제목'));
await p.screenshot({path:'/tmp/d-list.png'});
await b.close();})().catch(e=>{console.error('ERR',e.message.slice(0,500));process.exit(1)});
