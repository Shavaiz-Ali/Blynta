# Credit information and generation confirmation dialogs

The credit explanation uses a 740px desktop dialog with two compact pricing cards, a server-provided example, one reservation message and one rounding note. Default backend pricing displays 6 source + 3 output = 9 credits for the existing 30-minute/three-minute example. Different rates and examples are displayed from the backend without frontend credit calculations. Studio/subscription paragraphs and duplicate reservation sections were removed.

The 640px generation confirmation presents the approved maximum, available balance, exact source duration, source credits and combined output allowance/credits in one card. The plan-specific highlight target is conditional and does not promise a guaranteed clip count. One concise sentence explains the maximum reservation, potentially lower final charge and returned unused credits. Cancel and Generate clips replace the transaction-heavy CTA. The primary button also shows the dynamic approved maximum so it remains visible when short screens require scrolling.

Both use the existing AppDialog/AppButton components and theme. Their body can shrink and scroll within the available viewport; scrollbar chrome is hidden without disabling scrolling. Headers and actions stay accessible. Desktop pricing cards sit side by side and stack on mobile.

## Authorization behavior

The existing backend estimate remains authoritative. Initial estimate requests and approval are guarded against duplicate clicks. Clicking Generate clips refreshes the estimate before submitting. Changes to authorized source/output duration, total credits, pricing version, displayed breakdown or plan target update the review and require another explicit confirmation; changed authorization gets a new operation ID. Unchanged retries of the same confirmation preserve its operation ID. No refreshed estimate can automatically raise authorization and start processing.

Loading states cover both estimate retrieval and submission, with dismissal/approval disabled during confirmation checking or submission. Refresh errors prevent creation and offer a concise retry message. A newly insufficient balance prevents creation, displays the backend's newly observed balance and refreshes balance data. The existing View plans & upgrade link remains `/billing`. Cancellation creates no job or reservation. The existing duration-overage review flow passes its owned job ID when requesting refreshed estimates.

No backend pricing, billing business logic, API contract, plan entitlement or environment variable was changed for this redesign. Prior uncommitted duration-validation work was preserved.

## Validation

- 11 frontend tests passed via `node --test scripts/tests/billing-ui.test.mjs`: backend rates/examples, confirmation values/plan target/consent, cancellation, generation approval, insufficient-credit link, loading, duplicate estimate/approval clicks, changed-estimate reapproval and refresh failures.
- Main app TypeScript check and focused lint for the three dialog/creation components passed.
- Actual shared components rendered in a local Chromium preview at desktop, tablet, 390px and 320px mobile widths, short-height screens and a 640×400 viewport representing the effective layout space at 200% zoom on 1280×800. This was viewport-equivalent zoom testing, not a browser zoom setting.
- The help dialog measured 740×501.5px and confirmation 640×451.25px on desktop with no body scrolling. Smaller/shorter layouts stayed within the viewport, had no horizontal overflow and preserved body scrolling with hidden scrollbar chrome where needed.
- Real-time browser keyboard events verified initial focus, six successive Tab presses remaining inside the dialog, Escape, focus restoration, Cancel/Got it and successful confirmation. Insufficient credit confirmation remained disabled. These replaced unreliable virtual-clock close-animation checks; production animation/focus code was unchanged.

Screenshots and browser measurements are saved under the task's `credit-dialogs-qa` visualization directory. Preview scripts, profiles and bundles are removed from the repository after validation. No deployment or production job creation was performed.
