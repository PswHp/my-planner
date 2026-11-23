# 보안 정책

## 취약점 신고

보안 취약점을 발견하셨다면 **공개 이슈로 올리지 마시고**, 이 저장소의
**Security 탭 → Report a vulnerability** (GitHub 비공개 취약점 신고)로 알려주세요.

가능하면 다음 내용을 포함해 주세요.

- 영향받는 기능/엔드포인트
- 재현 절차
- 예상되는 영향

확인 후 가능한 한 빨리 답변드리겠습니다.

## 적용된 보안 조치

- Google OAuth 2.0 (Authorization Code + PKCE S256 + state)
- 세션 토큰은 SHA-256 해시로만 저장, `__Host-` 접두사 + `HttpOnly` + `Secure` + `SameSite=Lax` 쿠키
- 상태 변경 요청(POST/PATCH/DELETE)은 `Origin` 헤더 검증 (CSRF 방어)
- 모든 데이터 쿼리는 로그인 사용자 ID로 제한 (사용자 간 데이터 격리)
- 입력값 검증, 요청 본문 크기 제한(32KB), 사용자별 저장 개수 제한
- CSP, HSTS, X-Frame-Options 등 보안 헤더 (`public/_headers`)
