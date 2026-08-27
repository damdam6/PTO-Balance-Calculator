# DEV — 기술 설계 문서 (1년 미만 연차 계산기)

| 항목 | 내용 |
|---|---|
| 문서 버전 | v0.1 |
| 작성일 | 2026-08-27 |
| 근거 문서 | PRD.md v0.4 |

---

## 1. 기술 스택 (확정)

| 레이어 | 선택 | 선정 이유 |
|---|---|---|
| 배포/호스팅 | **Cloudflare Workers (Static Assets)** | Pages보다 Workers+정적 에셋이 현재 Cloudflare 권장 방식. 프런트 정적 파일과 API를 워커 하나로 배포 |
| API 프레임워크 | **Hono** | Workers 표준 라우터. 경량, 타입 지원, 미들웨어(쿠키/인증) 내장 |
| 데이터베이스 | **Cloudflare D1** (SQLite) | 계정 1개 + 설정 + 연차 내역 수준의 소규모 데이터에 충분, 무료 티어로 커버 |
| 프런트엔드 | **React 18 + Vite + TypeScript** | SPA 1장짜리 앱. 캘린더/모달/뷰 전환 등 상태 관리에 React가 적합 |
| 스타일 | **CSS (vanilla, CSS 변수)** | 화면 4개 수준이라 Tailwind 등 불필요. 모바일 단일 레이아웃 |
| 캘린더 | **자체 구현** | 월간 그리드 + 커스텀 셀(상태색/뱃지)이 핵심이라 라이브러리보다 직접 그리는 게 단순 |
| 인증 | **PBKDF2 (Web Crypto) + HMAC 서명 세션 쿠키** | Workers 런타임엔 bcrypt 불가 → Web Crypto 내장 PBKDF2 사용. 세션은 서버 저장 없이 서명 쿠키(stateless) |
| 테스트 | **Vitest** | 계산 로직(발생/차감/판정) 단위 테스트 |
| 배포 도구 | **Wrangler** | `wrangler deploy` 한 번으로 워커+에셋+D1 마이그레이션 관리 |

### 명시적으로 선택하지 않은 것
- **Next.js / Remix**: SSR 불필요. 정적 SPA + 작은 API면 충분
- **Cloudflare KV**: 연차 내역은 목록 조회·수정·삭제가 있어 관계형(D1)이 맞음
- **외부 인증(OAuth 등)**: 사전 등록 단일 계정 정책(PRD §8)이라 과함

---

## 2. 아키텍처

```
[브라우저 (모바일 웹 SPA)]
        │  fetch /api/*  (세션 쿠키 포함)
        ▼
[Cloudflare Worker]
  ├─ Static Assets  ── dist/ (React 빌드 산출물)
  └─ Hono API (/api/*)
        ├─ auth 미들웨어 (쿠키 검증)
        └─ D1 바인딩 (DB)
```

- 잔여 연차 **계산 로직은 프런트/백 공용 TypeScript 모듈**(`shared/`)로 작성.
  서버는 저장만 담당하고, 판정(초록/빨강)·잔여 계산은 클라이언트에서 수행 → API 왕복 최소화.

## 3. 디렉터리 구조

```
/
├─ src/                    # 프런트 (React SPA)
│  ├─ main.tsx
│  ├─ App.tsx              # 라우팅(로그인 게이트) + 뷰 전환
│  ├─ views/
│  │  ├─ Login.tsx
│  │  ├─ CalendarView.tsx
│  │  ├─ ListView.tsx
│  │  └─ Settings.tsx
│  ├─ components/
│  │  ├─ SummaryBar.tsx    # 오늘 잔여 + 선택 날짜 잔여
│  │  └─ LeaveModal.tsx    # 연차 등록/수정
│  └─ api.ts               # fetch 래퍼
├─ shared/
│  └─ balance.ts           # 발생/차감/판정 순수 함수 (프런트·워커 공용)
├─ worker/
│  ├─ index.ts             # Hono 앱 (정적 에셋 fallback 포함)
│  ├─ auth.ts              # PBKDF2 검증, 쿠키 서명/검증
│  └─ routes/              # settings, leaves CRUD
├─ migrations/             # D1 마이그레이션 (0001_init.sql …)
├─ test/                   # balance.ts 단위 테스트
├─ wrangler.toml
└─ vite.config.ts
```

## 4. 데이터베이스 스키마 (D1)

```sql
-- 0001_init.sql
CREATE TABLE users (
  id            INTEGER PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,          -- pbkdf2$<iter>$<salt>$<hash> (base64)
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE settings (
  user_id      INTEGER PRIMARY KEY REFERENCES users(id),
  accrual_day  INTEGER NOT NULL CHECK (accrual_day BETWEEN 1 AND 31),
  base_date    TEXT NOT NULL,           -- 'YYYY-MM-DD'
  base_balance REAL NOT NULL
);

CREATE TABLE leaves (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  date       TEXT NOT NULL,             -- 'YYYY-MM-DD'
  amount     REAL NOT NULL CHECK (amount > 0 AND amount <= 1),
  type       TEXT NOT NULL CHECK (type IN ('full','half','quarter','custom')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_leaves_user_date ON leaves(user_id, date);
```

- `amount`는 소수 둘째 자리로 반올림해 저장 (0 초과 ~ 1.00 이하, PRD §8).
- 계정은 시드 스크립트(`0002_seed_user.sql` 또는 wrangler 명령)로 1개 등록. 회원가입 없음.

## 5. API 명세

모든 응답은 JSON. 인증 실패 시 `401 {"error":"unauthorized"}`.

| 메서드 | 경로 | 요청 | 응답 | 비고 |
|---|---|---|---|---|
| POST | /api/login | `{username, password}` | `{ok}` + Set-Cookie | 실패 401 |
| POST | /api/logout | – | `{ok}` | 쿠키 삭제 |
| GET  | /api/me | – | `{username}` | 세션 확인용 |
| GET  | /api/settings | – | `{accrualDay, baseDate, baseBalance}` | 미설정 시 null |
| PUT  | /api/settings | `{accrualDay, baseDate, baseBalance}` | `{ok}` | upsert |
| GET  | /api/leaves | – | `{leaves: [{id, date, amount, type}]}` | date ASC |
| POST | /api/leaves | `{date, amount, type}` | `{id}` | 검증: 0<amount≤1 |
| PUT  | /api/leaves/:id | `{date, amount, type}` | `{ok}` | |
| DELETE | /api/leaves/:id | – | `{ok}` | |

### 세션 쿠키
- 이름 `session`, 값 `<payload>.<HMAC-SHA256 서명>` (payload: userId + 만료시각)
- `HttpOnly; Secure; SameSite=Lax; Max-Age=30일`
- 서명 키는 워커 시크릿 `SESSION_SECRET` (wrangler secret)

## 6. 핵심 로직 — `shared/balance.ts`

```ts
type Leave = { id: number; date: string; amount: number };
type Settings = { accrualDay: number; baseDate: string; baseBalance: number };

// 기준일 초과 ~ D 이하에 도래한 발생일 횟수 (29~31일은 해당 월 말일로 보정)
function accrualsBetween(s: Settings, until: string): number;

// 날짜순 순차 차감으로 각 건의 잔여·가능 여부 계산
// 빨간색(불가) 건도 그대로 차감 (PRD §8 확정)
function evaluate(s: Settings, leaves: Leave[]):
  { perLeave: { id: number; ok: boolean; balanceAfter: number }[] };

// 특정 날짜 시점 잔여 (그 날짜의 발생·사용 포함)
function balanceAt(s: Settings, leaves: Leave[], date: string): number;
```

- 부동소수점 오차 방지: 내부 계산은 **×100 정수(센트 방식)**로 수행 후 표시 시 나눔.
- 이 모듈만 Vitest로 집중 테스트 (말일 보정, 기준일 경계, 순차 차감, 음수 잔여).

## 7. 로컬 개발 & 배포

```bash
npm run dev        # vite dev + wrangler dev --local (D1 로컬, concurrently)
npm test           # vitest
npm run deploy     # vite build && wrangler deploy
```

- D1 생성: `wrangler d1 create pto-db` → `wrangler.toml`에 바인딩 `DB`
- 마이그레이션: `wrangler d1 migrations apply pto-db`
- 시크릿: `wrangler secret put SESSION_SECRET`
- 계정 시드: `wrangler d1 execute pto-db --command "INSERT INTO users ..."` (해시는 스크립트로 생성)

## 8. 구현 순서 (PRD 마일스톤 매핑)

| 단계 | 작업 | 완료 기준 |
|---|---|---|
| M1 | 프로젝트 셋업(Vite+React+Hono+wrangler), `shared/balance.ts` + 테스트 | `npm test` 그린 |
| M2 | D1 스키마·마이그레이션, 로그인/세션, settings·leaves API | curl로 CRUD 동작 |
| M3 | 로그인 화면, 요약 바(오늘+선택 날짜), 캘린더 뷰, 리스트 뷰, 등록 모달 | 로컬에서 전체 플로우 동작 |
| M4 | 모바일 스타일 폴리시(~430px), 배포 스크립트, 실배포 | Cloudflare 실제 URL 접속 확인 |
