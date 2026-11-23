# 플래너

개인 일정 관리 사이트 — 캘린더 · 할 일 · 타임 블록 · 통계

**스택**: React 19 + Vite + TypeScript + Tailwind CSS v4 / Cloudflare Pages Functions + D1 / Google 로그인

## 구조

```
src/                      프론트엔드 (React)
  pages/                  CalendarPage, TasksPage, TimeBlocksPage, StatsPage, LoginPage
  components/             Layout, Modal, ColorPicker, Icons
  lib/api.ts              API 클라이언트 + 타입
functions/                Cloudflare Pages Functions (= /api/*)
  api/_middleware.ts      로그인 확인 + 에러 처리
  api/auth/               login, callback, logout (Google OAuth)
  api/events, tasks, blocks   CRUD
  api/stats.ts            통계 집계
  _lib/                   공통 코드 (검증, CRUD, 세션)
migrations/               D1 스키마
```

날짜·시간은 사용자 로컬 기준 문자열(`YYYY-MM-DD`, `YYYY-MM-DDTHH:mm`)로 저장합니다. 그래서 시간대 변환 문제가 생기지 않습니다.

---

## 1. Google OAuth 클라이언트 만들기

1. <https://console.cloud.google.com/apis/credentials>에서 프로젝트를 만들거나 선택합니다.
2. **OAuth 동의 화면**: 외부(External)를 선택하고 앱 이름을 입력합니다. 테스트 사용자에 본인 이메일을 추가합니다.
3. **사용자 인증 정보 만들기 → OAuth 클라이언트 ID → 웹 애플리케이션**을 선택합니다.
4. **승인된 리디렉션 URI**에 아래 주소를 추가합니다.
   - `http://localhost:5173/api/auth/callback` (로컬)
   - `https://<프로젝트명>.pages.dev/api/auth/callback` (배포)
   - 커스텀 도메인을 쓴다면 `https://<도메인>/api/auth/callback`도 추가합니다.
5. 발급된 **클라이언트 ID**와 **클라이언트 보안 비밀번호**를 저장해 둡니다.

## 2. 로컬 개발

```bash
npm install
cp .dev.vars.example .dev.vars        # 열어서 GOOGLE_CLIENT_ID / SECRET / ALLOWED_EMAILS 입력
npm run db:migrate:local              # 로컬 D1에 테이블 생성
npm run build                         # wrangler가 dist 폴더를 필요로 해서 최초 1회 실행
```

터미널 두 개를 엽니다.

```bash
npm run dev:api    # wrangler: API + 로컬 D1 (localhost:8788)
npm run dev        # vite: 프론트 (localhost:5173), /api 요청은 8788로 프록시
```

<http://localhost:5173>에 접속해서 Google로 로그인합니다.

## 3. Cloudflare 배포 (GitHub 연동)

```bash
npx wrangler login
npx wrangler d1 create planner-db     # 출력된 database_id를 wrangler.toml에 붙여넣기
npm run db:migrate:remote             # 원격 D1에 테이블 생성
```

1. 이 저장소를 GitHub에 push합니다.
2. Cloudflare 대시보드에서 **Workers & Pages → Create → Pages → Connect to Git**으로 저장소를 선택합니다.
   - Build command: `npm run build`
   - Build output directory: `dist`
3. D1 바인딩(`DB`)은 `wrangler.toml`에서 자동으로 적용됩니다.
4. **Settings → Variables and Secrets**에 아래 값을 추가합니다. 비밀값은 *Encrypt*로 설정합니다.
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET` (Encrypt)
   - `ALLOWED_EMAILS`: 로그인을 허용할 이메일입니다. 쉼표로 구분하고, **꼭 설정하세요.** 비워 두면 모든 구글 계정이 가입할 수 있습니다. 데이터는 계정별로 분리됩니다.
   - `APP_URL`은 배포 환경에서는 설정하지 않습니다.
5. 다시 배포하면 이후로는 `main`에 push할 때마다 자동으로 배포됩니다.

스키마를 바꿀 때는 `migrations/0002_xxx.sql`을 추가하고 `npm run db:migrate:remote`를 실행합니다.

## API

모든 `/api/*` 요청은 세션 쿠키(`sid`)가 필요합니다. 단, `/api/auth/*`는 예외입니다.

| Method | Path | 설명 |
|---|---|---|
| GET | `/api/me` | 로그인 사용자 |
| GET/POST | `/api/events?from&to` | 기간과 겹치는 일정 / 생성 |
| PATCH/DELETE | `/api/events/:id` | 수정 / 삭제 |
| GET/POST | `/api/tasks` | 전체 할 일 / 생성 |
| PATCH/DELETE | `/api/tasks/:id` | 수정 (완료 시 `completed_at` 필요) / 삭제 |
| GET/POST | `/api/blocks?from&to` | 타임 블록 / 생성 |
| PATCH/DELETE | `/api/blocks/:id` | 수정 / 삭제 |
| GET | `/api/stats?from&to&today` | 통계 집계 |
