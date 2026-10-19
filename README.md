# PTO Balance Calculator (1년 미만 연차 계산기)

입사 1년 미만의 "매달 1개씩 쌓이는" 연차를 추적하는 모바일 웹 앱.
기준일과 잔여 연차만 입력하면 이후 발생/사용을 자동 계산하고, 등록한 연차마다
그 날짜에 **사용 가능(초록) / 연차 부족(빨강)** 을 판정해준다.

- 기획: [PRD.md](./PRD.md) · 기술 설계: [DEV.md](./DEV.md)
- 스택: Cloudflare Workers (Static Assets) + Hono + D1 + React/Vite/TS + Mantine

## 로컬 개발

```bash
npm install
npx wrangler d1 migrations apply pto-db --local   # 로컬 D1 스키마
cp .dev.vars.example .dev.vars                    # 세션 시크릿·시드 계정 설정
npm run dev                                        # vite(5173, /api 프록시) + wrangler dev(8787)
npm test                                           # 계산 로직 단위 테스트
```

계정은 화면의 **회원가입 탭**에서 직접 만들 수 있다 (아이디 3~20자, 비밀번호 8자+).
`SIGNUP_CODE` 시크릿을 설정하면 그 코드를 입력한 사람만 가입할 수 있다.
`.dev.vars`의 `SEED_USERNAME`/`SEED_PASSWORD` 계정 자동 생성(최초 로그인 시)도 계속 지원된다.

## Cloudflare 배포

main에 push(PR 머지)되면 GitHub Actions(`.github/workflows/deploy.yml`)가
테스트 → 빌드 → D1 마이그레이션 → `wrangler deploy`를 자동으로 수행한다.
Actions 탭의 **Run workflow**로 수동 실행도 된다.

필요한 GitHub 저장소 시크릿 (Settings → Secrets and variables → Actions):

- `CLOUDFLARE_API_TOKEN` — Cloudflare API 토큰 ("Edit Cloudflare Workers" 템플릿 + Account › D1 › Edit 권한)
- `CLOUDFLARE_ACCOUNT_ID` — Cloudflare 계정 ID

새 Cloudflare 계정에 처음 셋업할 때만 아래를 한 번 실행한다.

```bash
npx wrangler login
npx wrangler d1 create pto-db
# → 출력된 database_id를 wrangler.toml의 [[d1_databases]]에 반영
npx wrangler d1 migrations apply pto-db --remote

npx wrangler secret put SESSION_SECRET   # 긴 랜덤 문자열
npx wrangler secret put SIGNUP_CODE      # (선택) 설정하면 가입 시 코드 요구
# (선택) 회원가입 대신 시드 계정을 쓰려면:
npx wrangler secret put SEED_USERNAME
npx wrangler secret put SEED_PASSWORD

npm run deploy                            # (선택) 로컬에서 직접 배포: vite build + wrangler deploy
```

배포 후 발급된 `*.workers.dev` URL로 접속해 회원가입 후 로그인하면 된다.
계정을 수동으로 넣고 싶으면 `npm run hash-password -- <비밀번호>`로 해시를 만들어
`wrangler d1 execute pto-db --remote --command "INSERT INTO users (username, password_hash) VALUES ('아이디', '<해시>')"` 하면 된다.

## 동작 규칙 요약

- 매달 설정한 발생일에 연차 +1 (그 날짜가 없는 달은 말일). 발생일 당일부터 사용 가능
- 기준일 이전 건은 계산 제외, 잔여는 기준일 입력값에서 출발
- 사용 단위: 연차 1 / 반차 0.5 / 반반차 0.25 / 직접 입력(0 초과~1, 소수 둘째 자리)
- 부족(빨강) 판정 건도 잔여에서 그대로 차감된다 — 색은 경고일 뿐
