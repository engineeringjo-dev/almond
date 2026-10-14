# Almond: professional app and launch plan

Status: first review batch, 14 October 2026. Baseline: `e2aec44395f0aab5079762fa1db4182f0787da29`.
This is a source-backed plan, not confirmation that production services work.

## المقصود بتطبيق احترافي

تجربة سريعة وواضحة: يفتح الزبون التطبيق، يختار فرعه وطلبه، يعرف السعر النهائي، ويعرض الباركود أو يتابع الطلب بدون حيرة. الهوية الحالية البنفسجية، خط ألموند، وصور المنتجات الحقيقية هي الأساس. لا نغيّر قواعد النقاط أو نضيف وعوداً تسويقية غير منفّذة.

## What this first batch changes

- Home stays available while location or branch data is loading. Branch errors are shown in their own section with retry.
- Active order, loyalty and ordering appear together before campaigns. Conditional banners no longer leave empty section margins.
- Home uses the shared 680px maximum width; existing ordering and cart layouts already use this token.
- Header controls have accessible names and the shared 44pt/web, 48dp/Android touch targets.
- Wallet and gift entry use quieter surfaces so the order action remains prominent.
- Wallet loading/failure is distinct from a real zero balance; loyalty failures offer retry.
- Featured products are labelled as a menu selection, not a sales ranking. Product names have two lines.
- Pull to refresh updates branch, loyalty and order queries with a real refreshing state.
- Both languages carry the new copy. Existing rewards, wallet, gifts and branch functions remain reachable.
- Browser regression cases cover home with location pending, Arabic/English, 320/390/1280px widths, named controls, touch sizes and opening the order sheet.

Precedents reviewed: [Starbucks app](https://www.starbucks.com/download-app/) groups ordering, menu, rewards and store discovery; [W3C target-size guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced) explains larger touch targets. Almond's existing shared platform target token remains the implementation source.

## Confirmed launch blockers and evidence

| Priority | Finding | Evidence | Work / acceptance |
| --- | --- | --- | --- |
| P0 | Customer authentication is simulated | `almond-app/services/auth.service.ts`, `almond-web/src/store/authStore.ts`, `packages/shared/src/config/index.ts` | Connect both clients to BFF OTP verification. An incorrect/expired OTP must fail. Signed-in identity must come from verified tokens, not a client-created user ID. |
| P0 | Production SMS provider is not implemented | `bff/src/auth/sms.ts`, `bff/src/routes/auth.ts` | Integrate the selected provider server-side. Test delivery, resend limits, timeouts and expiry on staging with dedicated test numbers. |
| P0 | Session lifecycle is incomplete | `bff/src/routes/auth.ts`, `bff/src/plugins/auth.ts`, `almond-app/stores/authStore.ts`, `almond-app/lib/apiClient.ts` | Agree on short access-token / refresh-session policy. Native secure storage; server-managed HttpOnly browser sessions where appropriate. Test expiry, refresh rotation, logout/revocation, reinstall and account change. Never put privileged keys in public client config. |
| P0 | OTP/rate-limit state is in process memory | `bff/src/auth/otp.ts`, `bff/src/server.ts` | Use shared expiry-aware storage before running multiple API instances. Test two instances, atomic OTP consumption, brute-force limits and restart behavior. |
| P0 | Live money and order journeys need end-to-end proof | `docs/AUTH-AND-PAYMENTS.md`, `docs/IMPLEMENTATION-PLAYBOOK.md`, BFF and app service adapters | On staging: item/modifier prices, availability, branch routing, confirmed payment, unique order, POS receipt, cancellation/refund and ledger reconciliation. Duplicate/replayed requests must not charge twice. Do not enable checkout on a public release until these pass. |
| P1 | Scheduled menu sync currently fails before pulling data | GitHub Actions run [38531223038](https://github.com/engineeringjo-dev/almond/actions/runs/38531223038): failed step `Secrets present?` | Owner/operator supplies the required read-only integration configuration in GitHub Actions secrets. Re-run safely, inspect menu diff and timestamps. The exact missing value has not been verified; do not paste credentials into chat or commits. |
| P1 | Deployment success does not prove live integrations | [Preview deploy 38396689461](https://github.com/engineeringjo-dev/almond/actions/runs/38396689461) succeeded for baseline; `.github/workflows/deploy-web.yml` exports Expo to Pages | Check the deployed artifact on real devices, base-path assets, deep links, cache updates and API origin. Diagnose any blank screen from browser/network evidence. Pages serves the client; a separately hosted BFF supplies real authentication, orders and balances. |
| P1 | Shared-password admin access | `almond-web/src/server/admin.ts` and admin session route | Before multiple operators: individual roles, audit trail, MFA/identity provider and explicit session invalidation. Verify server configuration across replicas. |

Existing baseline CI run [38396689590](https://github.com/engineeringjo-dev/almond/actions/runs/38396689590) passed. This does not replace verification of this branch. Existing Playwright configuration already builds/tests the customer app as well as the website; its suite uses mock services.

## مراحل التنفيذ وبوابات القبول

| المرحلة | التنفيذ | متى نعتبرها منجزة؟ |
| --- | --- | --- |
| 1 — أساس التجربة | هذه الدفعة للرئيسية، ثم مراجعة القائمة وتخصيص المنتج والسلة والملف الشخصي بنفس الأسلوب | فحوصات ناجحة + مراجعة صور عربية وإنجليزية + تجربة على هاتف صغير وكبير، بدون قصّ نص أو أزرار غامضة |
| 2 — الدخول والحساب | OTP حقيقي، جلسات آمنة، خروج واضح، تجربة ضيف، عدم ظهور أرصدة حساب سابق بعد تبديل المستخدم | اختبارات نجاح وفشل الدخول وانتهاء الجلسة وتبديل الحساب تمر عبر الخادم |
| 3 — الطلب والدفع والولاء | ربط الفرع وOdoo وPOS ومزوّد الدفع، صلاحية الباركود، منع التكرار وتسوية الأرصدة | طلب كامل على staging يصل مرة واحدة ويتطابق سعره ورصيده مع النظام، مع اختبار الفشل والاسترجاع |
| 4 — الاعتمادية والتشغيل | مراقبة الأخطاء بدون بيانات حساسة، تنبيهات، نسخ احتياطية واستعادة، تحديث المنيو، دعم وسياسات واضحة | تجربة استعادة ناجحة وتنبيه لفشل خدمة/مزامنة، مع مسؤول واضح لكل بلاغ |
| 5 — إطلاق محدود ثم التوسّع | تجربة مع فريق وفرع محدد، ثم مراجعة المشكلات قبل التعميم | موافقة مالك المنتج بعد تجربة حقيقية، وخطة رجوع موثّقة للإصدار السابق |

## Product acceptance checklist

- **Home:** order and points are discoverable without dismissing campaigns; location permission is optional for browsing.
- **Menu:** real images, accurate availability, searchable Arabic/English names, sizes/modifiers priced from the shared rules.
- **Cart:** branch and fulfilment method visible, final amount before payment, actionable errors, no accidental duplicate submissions.
- **Barcode / loyalty:** server-issued code, visible loading/error/expiry, no invented balance or reward claims.
- **Account:** guest and member states are distinct; failed sign-in cannot unlock a member's history, wallet or rewards.
- **Accessibility:** RTL/LTR order, keyboard focus, readable contrast, larger text, labelled controls and reduced motion.
- **Performance:** record cold-start and key journey timings on an ordinary Android phone and throttled mobile connection; set a measured baseline before agreeing on budgets.
- **Release:** full repository gate green; no production Odoo writes during review; staging proof and owner go/no-go before publishing or merging.

## Dependencies needed for the later launch stages

The owner/operator must identify the production API host/domain, SMS and payment providers, read-only menu access, POS staging environment, and support/privacy contacts. Configuration belongs in the relevant service's secret store. No real customer/payment data is needed for this first UI review.

## Verification status

The working environment could read the repository through GitHub but could not clone over its network or launch its browser. Local parsing/copy and controlled component-state checks are used for this batch; the repository CI is the full build/type/test gate. Browser attachments from the new home tests support visual review once CI completes. Native-device review and real-service journeys remain release gates; this draft is not a production launch.
