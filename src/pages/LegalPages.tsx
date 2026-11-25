import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { SITE } from '../lib/site'

function LegalLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 md:py-14">
      <Link to="/" className="btn-ghost btn-sm -ml-3">
        ← {SITE.name}
      </Link>
      <h1 className="mt-4 mb-2 text-2xl font-bold tracking-tight">{title}</h1>
      <p className="mb-8 text-sm text-ink-muted">시행일: {SITE.effectiveDate}</p>
      <div className="card space-y-7 p-6 text-sm leading-relaxed text-ink-muted md:p-8 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-ink [&_li]:ml-5 [&_li]:list-disc">
        {children}
      </div>
    </div>
  )
}

export function PrivacyPage() {
  return (
    <LegalLayout title="개인정보처리방침">
      <p>
        {SITE.operator}(이하 “운영자”)는 {SITE.name}({SITE.nameKo}) 서비스(이하 “서비스”) 이용자의 개인정보를 「개인정보 보호법」 등 관련
        법령에 따라 보호하며, 다음과 같이 개인정보를 처리합니다.
      </p>
      <section>
        <h2>1. 수집하는 개인정보 항목</h2>
        <ul>
          <li>Google 로그인 시: Google 계정 고유 식별자, 이메일 주소, 이름, 프로필 사진 주소</li>
          <li>서비스 이용 중 이용자가 직접 입력한 정보: 일정, 할 일, 타임 블록 및 그 메모</li>
          <li>로그인 유지를 위한 세션 정보(무작위 세션 토큰의 해시값, 만료 시각)</li>
        </ul>
      </section>
      <section>
        <h2>2. 수집 및 이용 목적</h2>
        <ul>
          <li>회원 식별 및 로그인 유지</li>
          <li>일정·할 일·타임 블록 저장 및 통계 제공 등 서비스 기능 제공</li>
        </ul>
        <p className="mt-2">운영자는 위 목적 외의 용도로 개인정보를 이용하지 않으며, 광고나 마케팅에 사용하지 않습니다.</p>
      </section>
      <section>
        <h2>3. 보유 및 이용 기간</h2>
        <ul>
          <li>회원 탈퇴 시 모든 개인정보와 이용자가 입력한 데이터를 지체 없이 삭제합니다.</li>
          <li>
            다만 장애 복구를 위해 데이터베이스 호스팅 업체(Cloudflare)가 자동으로 보관하는 복구용 기록은 최대 30일간 남아 있다가 자동으로
            파기되며, 이 기간에도 서비스에서 조회하거나 이용할 수 없습니다. 장애 복구로 데이터베이스를 이전 시점으로 되돌리는 경우, 그
            사이에 탈퇴한 이용자의 데이터는 다시 삭제합니다.
          </li>
          <li>로그인 세션은 발급 후 최대 30일간 유지되며 로그아웃 시 즉시 삭제됩니다.</li>
        </ul>
      </section>
      <section>
        <h2>4. 개인정보 처리 위탁 및 국외 이전</h2>
        <p>서비스 제공을 위해 아래 업체의 인프라를 이용하며, 이 과정에서 개인정보가 국외에 저장·처리될 수 있습니다.</p>
        <ul>
          <li>Cloudflare, Inc. (미국) — 웹 호스팅 및 데이터베이스 저장 (Cloudflare 데이터센터 네트워크)</li>
          <li>Google LLC (미국) — 로그인 인증 (Google 계정 정보 제공)</li>
        </ul>
        <p className="mt-2">이전 항목: 제1조의 항목 / 이전 시기: 서비스 이용 시 네트워크를 통해 전송 / 보유 기간: 제3조와 같음</p>
      </section>
      <section>
        <h2>5. 개인정보의 제3자 제공</h2>
        <p>운영자는 법령에 근거가 있는 경우를 제외하고 이용자의 개인정보를 제3자에게 제공하지 않습니다.</p>
      </section>
      <section>
        <h2>6. 이용자의 권리</h2>
        <ul>
          <li>이용자는 언제든지 [설정] 메뉴에서 자신의 데이터를 내려받거나(열람), 회원 탈퇴로 모든 데이터를 삭제할 수 있습니다.</li>
          <li>그 밖의 열람·정정·삭제·처리정지 요구는 아래 문의처로 요청할 수 있습니다.</li>
        </ul>
      </section>
      <section>
        <h2>7. 쿠키 사용</h2>
        <p>
          로그인 상태 유지를 위한 필수 쿠키만 사용하며, 광고·분석 목적의 쿠키나 외부 추적 도구는 사용하지 않습니다. 브라우저에서 쿠키를
          차단하면 로그인할 수 없습니다.
        </p>
      </section>
      <section>
        <h2>8. 안전성 확보 조치</h2>
        <ul>
          <li>모든 통신은 HTTPS로 암호화됩니다.</li>
          <li>세션 토큰은 해시값으로만 저장하며, 이용자별로 데이터 접근을 분리합니다.</li>
        </ul>
      </section>
      <section>
        <h2>9. 개인정보 보호책임자 및 문의처</h2>
        <ul>
          <li>보호책임자: {SITE.operator}</li>
          <li>이메일: {SITE.contactEmail}</li>
        </ul>
        <p className="mt-2">
          개인정보 침해에 관한 신고·상담은 개인정보침해신고센터(privacy.kisa.or.kr, 국번 없이 118) 또는 개인정보분쟁조정위원회(kopico.go.kr,
          1833-6972)에 문의할 수 있습니다.
        </p>
      </section>
      <section>
        <h2>10. 방침의 변경</h2>
        <p>이 방침이 변경되는 경우 시행 7일 전부터 서비스 화면을 통해 알립니다.</p>
      </section>
    </LegalLayout>
  )
}

export function TermsPage() {
  return (
    <LegalLayout title="이용약관">
      <section>
        <h2>1. 목적</h2>
        <p>
          이 약관은 {SITE.operator}(이하 “운영자”)가 제공하는 {SITE.name}({SITE.nameKo}) 서비스(이하 “서비스”)의 이용 조건과 절차를
          정합니다.
        </p>
      </section>
      <section>
        <h2>2. 서비스 내용</h2>
        <p>서비스는 일정 관리, 할 일 관리, 타임 블록, 통계 기능을 무료로 제공합니다.</p>
      </section>
      <section>
        <h2>3. 회원 가입과 탈퇴</h2>
        <ul>
          <li>
            이용자는 Google 계정으로 로그인하여 서비스를 이용할 수 있으며, 로그인 시 이 약관과 개인정보처리방침에 동의한 것으로 봅니다.
          </li>
          <li>
            이용자는 언제든지 [설정] 메뉴에서 탈퇴할 수 있으며, 탈퇴 시 모든 데이터가 즉시 삭제되며, 이용자의 요청으로 복구할 수 없습니다.
            (장애 복구용 기록의 보관은 개인정보처리방침 제3조를 따릅니다.)
          </li>
        </ul>
      </section>
      <section>
        <h2>4. 이용자의 의무</h2>
        <ul>
          <li>타인의 계정을 도용하거나 서비스의 정상적인 운영을 방해해서는 안 됩니다.</li>
          <li>자동화된 수단으로 과도한 요청을 보내거나 서비스의 보안을 우회하려 해서는 안 됩니다.</li>
        </ul>
        <p className="mt-2">위 의무를 위반한 경우 운영자는 사전 통지 없이 이용을 제한할 수 있습니다.</p>
      </section>
      <section>
        <h2>5. 서비스의 제공과 변경</h2>
        <ul>
          <li>
            서비스는 무료로 “있는 그대로” 제공되며, 운영자는 서비스를 변경하거나 중단할 수 있습니다. 중단 시 가능한 한 사전에 알립니다.
          </li>
          <li>저장 가능한 데이터의 양에는 합리적인 제한이 있을 수 있습니다.</li>
        </ul>
      </section>
      <section>
        <h2>6. 책임의 제한</h2>
        <p>
          운영자는 고의 또는 중대한 과실이 없는 한, 천재지변·외부 서비스 장애 등으로 인한 서비스 중단이나 데이터 손실에 대해 책임을 지지
          않습니다. 중요한 데이터는 [설정] 메뉴의 내보내기 기능으로 별도 보관하기를 권장합니다.
        </p>
      </section>
      <section>
        <h2>7. 약관의 변경</h2>
        <p>약관이 변경되는 경우 시행 7일 전부터 서비스 화면을 통해 알립니다.</p>
      </section>
      <section>
        <h2>8. 문의</h2>
        <p>{SITE.contactEmail}</p>
      </section>
    </LegalLayout>
  )
}
