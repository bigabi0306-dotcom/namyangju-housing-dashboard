# CENTA REALTY OS (센타부동산 AI 통합 업무관리센터)

Next.js 15 · React 19 · TypeScript · Tailwind · Prisma 6 · PostgreSQL 16. 기존 정적 대시보드(저장소 루트)는 그대로 두고 이 폴더에 신규 구축했습니다.

## 실행
```bash
cp .env.example .env            # DATABASE_URL, AUTH_SECRET 설정
npm install
npx prisma db push
ADMIN_PASSWORD='10자이상비밀번호' npm run db:seed        # 대표 관리자 + 역할/권한 (SEED_DEMO=1 추가 시 '테스트' 데이터)
npm run build && npm start      # http://localhost:3000
npm test                        # 단위 테스트 / npx tsx tests/db.integration.ts (DB 통합)
./scripts/backup.sh · ./scripts/restore.sh <파일>        # 백업·복구
```

## 구조
`src/lib` 도메인 로직(format·matching·briefing·import·rbac·auth) / `src/app/actions.ts` 서버 액션(권한검사·감사로그) / `src/app/(app)/*` 화면 / `prisma/schema.prisma` 전체 34개 모델(요구사항 목록 전부 + 보조 테이블).
핵심 관계: Property 1–N PriceHistory/Image/Document/Source, Client 1–N Consultation, Property N–M Client (PropertyClientMatch), Contract → Property/Client, Settlement → Contract. 금액은 BigInt(원), 면적은 ㎡ 저장·평 병기. 원본 데이터(PropertySource)와 내부 메모(Property.internalMemo)는 분리.

## 구현·검증 현황 (1~2단계 일부)
| 기능 | 구현 | 검증 |
|---|---|---|
| 로그인(bcrypt+JWT 쿠키, 5회 실패 제한), 역할 5종 RBAC, 감사로그 | ✅ | 자동 E2E (조회전용 차단 포함) |
| 메인 대시보드 KPI 11종, AI 업무 브리핑(규칙 기반·DB 값만) | ✅ | E2E |
| 브리핑 완료/내일로 처리 | ✅ | 수동 확인 전 — 코드 구현만 |
| 매물장: 등록·수정·삭제(대표만)·복합필터(종류/거래/상태/지역/가격/면적)·표/카드 | ✅ | E2E |
| 억·만원 입력/표시, ㎡↔평, 중복 매물 경고, 가격이력 | ✅ | 단위+E2E |
| CSV 가져오기(중복 연결, 메모 보존, 누락→확인대기, 동기화 로그) | ✅ | DB 통합 테스트 |
| 고객 CRM: 등록·검색·상담이력·파이프라인·연락처 중복 경고 | ✅ | E2E |
| 고객↔매물 자동 매칭(점수·사유·불일치·필수조건 표시), 추천 저장 | ✅ | 단위+E2E |
| PWA 매니페스트/서비스워커(설치 가능, 업무데이터 캐시 안 함) | ✅ | 미검증(실기기 설치) |
| 반응형(모바일 390px 가로스크롤 없음) | ✅ | 자동 확인 |
| 백업/복구 스크립트 | ✅ | 실제 삭제→복구 확인 |

## 미구현 (메뉴에 "준비중" 표시, 작동하는 척하지 않음)
물건분석·재무계산·보고서(4단계) / 업무일지·일정·알림(3단계) / 콘텐츠 스튜디오·AI 원고(5단계) / 계약·정산·경영통계(6단계) / 관리자 설정 화면(가중치·브리핑 시각은 DB 값으로만 존재) / 지도 보기·검색조건 저장·비교·엑셀 내보내기 / 매물 사진·문서 업로드(S3) / 사용자 관리 화면 / 브리핑 자동 생성 스케줄 / 고객용 소개자료 출력 / FastAPI 분석 모듈.

## 외부 연동 상태와 필요한 권한
- **기존 매물 사이트(010-8848-7727.com/map)**: 이 개발 환경의 네트워크에서 접속이 차단되어(프록시 403) 구조·API 존재 여부를 **확인하지 못했습니다.** 따라서 API·DB 연동은 만들지 않았고, 운영자가 받은 CSV/Excel(CSV 저장) 가져오기만 제공합니다. 필요: 사이트 관리자 내보내기 또는 공식 API/DB 읽기 권한 정보.
- 지도(네이버/카카오 JS 키), 공공데이터포털 서비스키(실거래가·토지이용계획·건축물대장), Google Calendar OAuth 클라이언트, AI API 키(고객정보 전송 전 사용자 승인 UI 필요), 블로그·유튜브·인스타 공식 API 승인 — 모두 미연결.
- AI 브리핑은 현재 외부 AI를 호출하지 않는 규칙 기반 집계입니다.

## 운영 전 필수 사항
- `AUTH_SECRET`·관리자 비밀번호 교체, HTTPS 리버스 프록시 적용, 로그인 시도 제한은 현재 단일 프로세스 메모리 방식(다중 인스턴스 시 Redis 등 필요).
- 테스트 데이터는 `isTestData=true`로 표시되며 `SEED_DEMO=1`일 때만 생성됩니다. 운영 DB에서는 사용하지 마세요.
