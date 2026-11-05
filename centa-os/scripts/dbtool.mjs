// 윈도우/리눅스/맥 공용 DB 백업·복구 도구.  사용:  node scripts/dbtool.mjs backup
//                                                node scripts/dbtool.mjs restore <백업.sql.gz> [--uploads <사진백업.tar.gz>] [--yes]
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import zlib from 'node:zlib';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
function loadEnv() { // .env 간이 읽기 (환경변수가 이미 있으면 우선)
  const f = path.join(root, '.env'); if (!fs.existsSync(f)) return;
  for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m || line.trim().startsWith('#')) continue; if (process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2'); }
}
loadEnv();
const die = (m) => { console.error('\n[오류] ' + m); process.exit(1); };
if (!process.env.DATABASE_URL) die('DATABASE_URL이 없습니다. .env 파일을 확인하세요.');
let u; try { u = new URL(process.env.DATABASE_URL); } catch { die('DATABASE_URL 형식이 올바르지 않습니다.'); }
const conn = { host: u.hostname, port: u.port || '5432', user: decodeURIComponent(u.username), pass: decodeURIComponent(u.password), db: u.pathname.replace(/^\//, '') };
const env = { ...process.env, PGPASSWORD: conn.pass, PGCLIENTENCODING: 'UTF8' };

function findBin(name) {
  if (spawnSync(name, ['--version'], { stdio: 'ignore' }).status === 0) return name;
  if (process.platform === 'win32') for (const v of [17, 16, 15, 14, 13]) { const p = `C:\\Program Files\\PostgreSQL\\${v}\\bin\\${name}.exe`; if (fs.existsSync(p)) return p; }
  die(`${name} 프로그램을 찾을 수 없습니다. PostgreSQL을 설치했는지, 또는 설치 폴더의 bin 경로가 PATH에 있는지 확인하세요.`);
}
const uploadsDir = () => path.resolve(process.env.UPLOAD_DIR || path.join(root, 'uploads'));
const stamp = () => { const d = new Date(); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`; };
const prune = (dir, re, keep = 30) => { const fs_ = fs.readdirSync(dir).filter((f) => re.test(f)).sort().reverse(); for (const f of fs_.slice(keep)) fs.unlinkSync(path.join(dir, f)); };

async function backup() {
  const dir = path.join(root, 'backups'); fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, `centa_${stamp()}.sql.gz`);
  const dump = spawn(findBin('pg_dump'), ['-h', conn.host, '-p', conn.port, '-U', conn.user, '-d', conn.db, '--no-owner', '--no-privileges'], { env });
  let err = ''; dump.stderr.on('data', (d) => (err += d));
  const ws = fs.createWriteStream(out); dump.stdout.pipe(zlib.createGzip()).pipe(ws);
  const code = await new Promise((r) => dump.on('close', r)); await new Promise((r) => ws.on('close', r));
  if (code !== 0 || fs.statSync(out).size < 200) { fs.rmSync(out, { force: true }); die(`DB 백업에 실패했습니다.\n${err.trim()}`); }
  console.log(`DB 백업 완료: ${out} (${Math.round(fs.statSync(out).size / 1024)} KB)`);
  const up = uploadsDir();
  if (fs.existsSync(up) && fs.readdirSync(up).length) {
    const tarOut = path.join(dir, `centa_uploads_${stamp()}.tar.gz`);
    const r = spawnSync('tar', ['-czf', tarOut, '-C', up, '.'], { stdio: 'pipe' });
    if (r.status !== 0) console.error('[경고] 사진 백업 실패: tar 명령을 사용할 수 없습니다. uploads 폴더를 직접 복사해 두세요.');
    else console.log(`사진 백업 완료: ${tarOut}`);
  } else console.log('사진 백업: 업로드된 사진이 없어 건너뜀');
  prune(dir, /^centa_\d{8}_\d{6}\.sql\.gz$/); prune(dir, /^centa_uploads_\d{8}_\d{6}\.tar\.gz$/);
  console.log('\n※ backups 폴더를 다른 곳(외장하드·클라우드)에도 복사해 두세요. 이 PC가 고장나면 함께 사라집니다.');
}
async function restore(args) {
  const ui = args.indexOf('--uploads'); const upFile = ui >= 0 ? args[ui + 1] : null;
  const file = args.find((a, i) => !a.startsWith('--') && !(ui >= 0 && i === ui + 1)); // '--uploads' 다음 값은 파일 인자가 아님
  if (!file || !fs.existsSync(file)) die('복구할 백업 파일(.sql.gz)을 지정하세요.  예) node scripts/dbtool.mjs restore backups\\centa_20260101_090000.sql.gz');
  if (upFile && !fs.existsSync(upFile)) die('사진 백업 파일을 찾을 수 없습니다: ' + upFile);
  if (!args.includes('--yes')) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const a = await rl.question(`현재 DB(${conn.db})의 모든 데이터가 백업 시점으로 덮어써집니다. 계속하려면 YES 를 입력하세요: `); rl.close();
    if (a.trim() !== 'YES') die('취소했습니다.');
  }
  const psql = findBin('psql'); const base = ['-h', conn.host, '-p', conn.port, '-U', conn.user, '-d', conn.db, '-v', 'ON_ERROR_STOP=1', '-q'];
  const reset = spawnSync(psql, [...base, '-c', 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'], { env, encoding: 'utf8' });
  if (reset.status !== 0) die('DB 초기화에 실패했습니다.\n' + reset.stderr);
  const p = spawn(psql, base, { env }); let err = ''; p.stderr.on('data', (d) => (err += d));
  fs.createReadStream(file).pipe(zlib.createGunzip()).pipe(p.stdin);
  const code = await new Promise((r) => p.on('close', r));
  if (code !== 0) die('복구 중 오류가 발생했습니다.\n' + err.trim());
  console.log('DB 복구 완료');
  if (upFile) { fs.mkdirSync(uploadsDir(), { recursive: true }); const r = spawnSync('tar', ['-xzf', upFile, '-C', uploadsDir()]); console.log(r.status === 0 ? `사진 복구 완료: ${uploadsDir()}` : '[경고] 사진 복구 실패(tar). 압축을 직접 풀어 uploads 폴더에 넣으세요.'); }
}
const [cmd, ...rest] = process.argv.slice(2);
if (cmd === 'backup') await backup(); else if (cmd === 'restore') await restore(rest); else die('사용법: node scripts/dbtool.mjs backup | restore <파일.sql.gz> [--uploads <사진.tar.gz>] [--yes]');
