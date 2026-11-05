// 코드 수준 접근통제 점검: 모든 서버 액션·화면·내보내기 라우트에 권한 검사가 있는지, 비밀값이 커밋되지 않았는지.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const root = path.resolve(__dirname, '..');
const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const rel = (f: string) => path.relative(root, f);

test('서버 액션: 모든 export 함수가 첫 부분에서 requireUser 호출 (login/logout 제외)', () => {
  const OPEN = new Set(['login', 'logout']);
  const files = fs.readdirSync(path.join(root, 'src/app')).filter((f) => /^actions.*\.ts$/.test(f));
  assert.ok(files.length >= 5);
  const bad: string[] = [];
  for (const f of files) {
    const src = fs.readFileSync(path.join(root, 'src/app', f), 'utf8');
    assert.match(src, /^'use server'/, `${f}: 'use server' 누락`);
    const re = /export async function (\w+)\s*\([^)]*\)[^{]*\{([\s\S]*?)(?=\nexport |\n\/\/ ──|$)/g; let m;
    while ((m = re.exec(src))) { if (OPEN.has(m[1])) continue; if (!/requireUser\(/.test(m[2].split('\n').slice(0, 8).join('\n'))) bad.push(`${f}:${m[1]}`); }
  }
  assert.deepEqual(bad, [], `권한 검사 없는 서버 액션: ${bad.join(', ')}`);
});
test('화면: (app) 하위 모든 page.tsx가 requireUser를 호출하거나 requireUser 래퍼를 사용', () => {
  const pages = walk(path.join(root, 'src/app/(app)')).filter((f) => /page\.tsx$/.test(f));
  assert.ok(pages.length >= 15);
  const bad = pages.filter((f) => !/requireUser\(/.test(fs.readFileSync(f, 'utf8'))).map(rel);
  assert.deepEqual(bad, [], `권한 검사 없는 화면: ${bad.join(', ')}`);
});
test('라우트 핸들러: health 외에는 requireUser 필수', () => {
  const routes = walk(path.join(root, 'src/app')).filter((f) => /route\.ts$/.test(f));
  for (const f of routes) { if (f.includes(`${path.sep}health${path.sep}`)) continue; assert.match(fs.readFileSync(f, 'utf8'), /requireUser\(/, rel(f)); }
});
test('쓰기·민감 화면은 구체 권한을 요구', () => {
  const need: [string, string][] = [['src/app/(app)/settings/page.tsx', 'settings.write'], ['src/app/(app)/contracts/settlements/page.tsx', 'settlement.read'], ['src/app/(app)/properties/new/page.tsx', 'property.write'], ['src/app/(app)/clients/new/page.tsx', 'client.write'], ['src/app/(app)/contracts/new/page.tsx', 'contract.write'], ['src/app/(app)/content/new/page.tsx', 'content.write'], ['src/app/(app)/analysis/new/page.tsx', 'analysis.write'], ['src/app/(app)/calendar/new/page.tsx', 'calendar.write']];
  for (const [f, perm] of need) assert.ok(fs.readFileSync(path.join(root, f), 'utf8').includes(`requireUser('${perm}')`), `${f} → ${perm}`);
});
test('위험 API 사용 금지: eval, 임의 HTML 삽입(레이아웃의 서비스워커 등록 제외), 평문 쿼리 실행', () => {
  const files = walk(path.join(root, 'src')).filter((f) => /\.(ts|tsx)$/.test(f));
  for (const f of files) {
    const s = fs.readFileSync(f, 'utf8');
    assert.ok(!/\beval\(|new Function\(/.test(s), `${rel(f)}: eval`);
    assert.ok(!/\$queryRawUnsafe|\$executeRawUnsafe/.test(s), `${rel(f)}: raw unsafe`);
    if (/dangerouslySetInnerHTML/.test(s)) assert.equal(rel(f), 'src/app/layout.tsx', `${rel(f)}: dangerouslySetInnerHTML`);
  }
});
test('비밀값: .env·백업 파일이 git에 추적되지 않음, 코드에 키 패턴 없음', () => {
  const tracked = execSync('git ls-files', { cwd: root, encoding: 'utf8' }).split('\n');
  assert.ok(!tracked.some((f) => /(^|\/)\.env$/.test(f) || /\.sql(\.gz)?$/.test(f)), '.env/백업이 추적됨');
  const files = tracked.filter((f) => /\.(ts|tsx|mjs|json|md|yml)$/.test(f) && !f.endsWith('package-lock.json'));
  for (const f of files) { const s = fs.readFileSync(path.join(root, f), 'utf8'); assert.ok(!/sk-ant-[A-Za-z0-9_-]{20,}/.test(s), `${f}: Anthropic 키 패턴`); assert.ok(!/[0-9a-f]{64}/i.test(s.replace(/package-lock/g, '')) || f.includes('test'), `${f}: 64자 hex(키 의심)`); }
});
