# 내 PC(윈도우)에 설치하기

> ⚠ **먼저 알아두세요**
> - 이 안내는 개발 환경(리눅스)에서 같은 단계를 실행해 검증한 내용을 윈도우용으로 옮긴 것입니다. **윈도우 PC에서 직접 설치해 보지는 못했습니다.** 막히는 곳이 있으면 화면에 나온 메시지를 그대로 알려주세요.
> - PC가 꺼지거나 절전 상태면 시스템도 멈춥니다. 직원들이 함께 쓰려면 항상 켜 두는 PC나 서버가 필요합니다(`docs/OPERATIONS.md` 참고).
> - **이 PC가 고장나면 데이터도 사라집니다.** 설치 후 반드시 §7 백업을 하고, 백업 파일을 외장하드나 클라우드에 따로 복사하세요.

## 1. 준비물 설치 (한 번만)
1. **Node.js LTS** — https://nodejs.org 에서 LTS 버전 설치(기본 옵션 그대로). Node 22와 26에서 동작을 확인했습니다(그 외 버전은 미확인).
2. **PostgreSQL 16** — https://www.postgresql.org/download/windows/ → 설치 프로그램 실행.
   - 설치 중 `postgres` 관리자 **비밀번호를 정해서 꼭 적어 두세요.** 포트는 5432 그대로.
   - 설치 끝의 "Stack Builder"는 건너뛰어도 됩니다.
3. 프로그램 파일 받기 — GitHub 저장소의 `claude/admiring-feynman-g4r5oz` 브랜치에서 **Code → Download ZIP** → 압축을 풀고 안의 `centa-os` 폴더를 `C:\centa\centa-os` 처럼 **영문 경로**에 두세요(한글·공백 경로는 문제가 생길 수 있습니다).

## 2. 데이터베이스 만들기 (한 번만)
시작 메뉴에서 **SQL Shell (psql)** 을 열고 Enter를 계속 눌러 기본값을 선택한 뒤, 마지막에 `postgres` 비밀번호를 입력합니다. 그다음 아래를 한 줄씩 입력합니다(비밀번호는 **영문+숫자만 20자 이상**으로, 따옴표·@·: 같은 특수문자는 피하세요).
```sql
CREATE USER centa WITH PASSWORD '여기에-새-DB-비밀번호';
CREATE DATABASE centa_os OWNER centa;
\q
```

## 3. 설정 파일 만들기 (한 번만)
`C:\centa\centa-os` 폴더에서 주소창에 `powershell` 을 입력해 PowerShell을 엽니다. 이후 명령은 모두 이 창에서 입력합니다.
```powershell
copy .env.example .env
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
notepad .env
```
- 두 번째 명령의 출력(긴 문자열)을 복사해 `.env`의 `AUTH_SECRET="..."` 에 붙여넣습니다.
- `DATABASE_URL="postgresql://centa:여기에-새-DB-비밀번호@localhost:5432/centa_os"` 로 고칩니다.
- 나머지(`GEMINI_API_KEY` 등)는 비워 두어도 됩니다. 저장하고 메모장을 닫습니다. **`.env`는 남에게 보내지 마세요.**

## 4. 설치와 초기화 (한 번만, 인터넷 필요 · 수 분 소요)
```powershell
npm install
npx prisma db push
$env:ADMIN_EMAIL='본인이메일@example.com'
$env:ADMIN_NAME='한지윤'
$env:ADMIN_PASSWORD='10자이상-영문과숫자포함'
npm run db:seed
npm run build
```
`seed ok: 본인이메일...` 이 나오면 관리자 계정이 만들어진 것입니다. (처음 설치할 때만 `SEED_DEMO`는 쓰지 마세요 — 시험용 샘플이 들어갑니다.)

## 5. 실행
- 평소에는 `windows\start.bat` 을 **더블클릭**합니다(바탕화면에 바로가기를 만들어 두세요). 검은 창이 열려 있는 동안 동작하며, 닫으면 종료됩니다.
- 브라우저에서 **http://localhost:3000** 접속 → 위에서 만든 이메일·비밀번호로 로그인.
- 로그인 후 오른쪽 위 이름을 눌러 비밀번호를 바꿀 수 있고, `설정`에서 직원 계정을 추가합니다.

## 6. 스마트폰·다른 PC에서 접속하려면 (선택)
기본 설정은 **이 PC에서만** 접속됩니다(안전한 기본값). 같은 와이파이의 다른 기기에서 쓰려면:
1. `.env`에 `COOKIE_SECURE="false"` 를 추가합니다. (HTTPS가 아니면 로그인 쿠키를 저장하지 않는 기본 보안 때문에 필요합니다. **같은 네트워크의 다른 사람이 통신 내용을 볼 수 있어 보안이 약해지므로, 집·사무실처럼 믿을 수 있는 네트워크에서만** 쓰세요.)
2. `windows\start-lan.bat` 으로 실행하고, 윈도우 방화벽 창이 뜨면 **개인 네트워크 허용**을 누릅니다.
3. PC의 IP 주소를 확인합니다(`ipconfig` → IPv4 주소, 예: 192.168.0.12). 폰 브라우저에서 `http://192.168.0.12:3000` 접속.
- ⚠ 이 방식에서는 폰에 **앱 설치(홈 화면에 추가)가 되지 않을 수 있습니다**(설치는 HTTPS가 필요). 외부(집 밖)에서 안전하게 쓰려면 HTTPS가 필요하며, 서버 배포(`docs/OPERATIONS.md`)를 권장합니다.

## 6-1. 사무실 PC들이 함께 쓰기 (프로그램을 켜 두는 PC 1대 + 나머지 PC 브라우저)
프로그램은 **한 PC(본체)** 에서만 돌리고, 다른 사무실 PC는 **크롬으로 본체에 접속**합니다. 데이터는 본체에만 쌓입니다.
1. **본체 PC 설정(한 번만)** — `centa-os` 폴더의 PowerShell에서:
```powershell
Add-Content .env 'COOKIE_SECURE="false"'
ipconfig
```
 `ipconfig` 결과의 **IPv4 주소**(예: 192.168.0.12)를 적어 둡니다. (개발 환경에서 시험: 이 설정이 없으면 http 주소로 로그인해도 화면이 유지되지 않고, 있으면 정상 유지됩니다.)
2. **본체에서 `windows\start-lan.bat`** 으로 시작합니다(`start.bat`은 본체에서만 접속됨). 윈도우 방화벽 창이 뜨면 **개인 네트워크 허용**.
3. **다른 PC**의 크롬 주소창에 `http://본체IPv4주소:3000` (예: `http://192.168.0.12:3000`) → 각자 계정으로 로그인. 즐겨찾기에 추가해 두세요.
4. **본체 PC는 항상 켜 두세요.** 설정 → 시스템 → 전원 → 화면/절전 **'안 함'**. 본체가 꺼지거나 절전이면 모두 접속 불가이고, 검은 창(프로그램)을 닫아도 꺼집니다.
5. **IP가 바뀌면 접속이 안 됩니다.** 공유기 설정에서 본체의 IP를 고정(DHCP 예약)해 두면 편합니다.
- ⚠ 보안: 이 방식은 암호화(HTTPS) 없이 사무실 네트워크로 통신합니다. **비밀번호가 걸린 사무실 와이파이/유선망에서만** 쓰고, 손님용 와이파이와 분리하세요. 외부(집·카페)에서는 쓰지 마세요.
- 백업은 본체에서 `windows\backup.bat` 으로 하고 **다른 장치에 복사**하세요.

## 7. 백업과 복구 (꼭 하세요)
- **백업**: `windows\backup.bat` 더블클릭 → `backups` 폴더에 날짜가 붙은 파일이 생깁니다(사진은 별도 압축으로). **매일 업무 종료 시 실행**하고, 주 1회는 `backups` 폴더를 외장하드·클라우드에 복사하세요.
- **복구**(데이터를 백업 시점으로 되돌림):
```powershell
node scripts/dbtool.mjs restore backups\centa_날짜_시간.sql.gz
```
확인 문구가 나오면 `YES` 를 입력합니다. 사진도 복구하려면 `--uploads backups\centa_uploads_날짜_시간.tar.gz` 를 뒤에 붙입니다.
- (검증됨: 리눅스에서 백업→새 DB 복구→주요 데이터·사진 일치, 취소·잘못된 비밀번호·없는 파일 동작 확인. 윈도우 경로 탐색은 미검증)

## 8. 업데이트할 때
1. 프로그램(검은 창)을 **끕니다.**
2. `windows\update.bat` 을 더블클릭합니다. 자동으로 ① DB 백업 → ② 최신 파일 내려받기 → ③ 복사(설정·사진·백업은 유지) → ④ 부품·DB 표 업데이트 → ⑤ 빌드를 순서대로 진행합니다. 백업이 실패하면 아무것도 바꾸지 않고 멈춥니다.
3. 끝나면 `windows\start.bat` 으로 다시 시작합니다.
- ⚠ 이 도구는 윈도우에서 직접 시험해 보지 못했습니다. 문제가 생기면 화면 메시지를 알려주세요. (수동 방법: 새 ZIP을 받아 `.env`, `uploads`, `backups` 폴더는 그대로 두고 나머지를 덮어쓴 뒤 `npm.cmd install`, `npx.cmd prisma db push`, `npm.cmd run build`)

## 9. 문제 해결
| 증상 | 조치 |
|---|---|
| `npm` 을 찾을 수 없음 | Node.js 설치 후 PowerShell을 **새로 열기** |
| `Can't reach database server` | PostgreSQL 서비스 실행 확인(서비스 → postgresql-x64-16), `.env`의 DB 비밀번호·포트 확인 |
| `password authentication failed` | `.env` 비밀번호와 §2에서 만든 비밀번호가 다름 (특수문자가 있으면 영문+숫자로 바꿔 재설정) |
| 로그인이 계속 풀림 | http 주소(LAN)로 접속 중 → §6의 `COOKIE_SECURE` 설정 확인, PC에서는 `localhost` 로 접속 |
| 화면에 "오류 번호" | 오류 번호를 알려주세요(서버 창의 로그에서 원인을 찾을 수 있습니다) |
| 포트 3000 사용 중 | 다른 프로그램이 쓰는 중. 그 프로그램을 종료하거나 `start.bat`의 `3000`을 다른 번호로 변경 |
| `pg_dump 를 찾을 수 없음`(백업 오류) | PostgreSQL 설치 폴더의 `bin` 경로를 윈도우 환경변수 PATH에 추가 |
