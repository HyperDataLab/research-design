# DESIGN.md

UI and interaction rules for Research Design. The shell, tokens and primitives are PaperLab's and Writing Bank's,
so the lab's apps look and behave alike. A new pattern is added here first, then built.

## 1. Navigation: a text sidebar driven by a module registry

A left sidebar of words only, in the order of the workflow, and a slide-in drawer below 768 px. No icons in
navigation and no icon rail: the labels are short and distinct.

- Items come from `src/app/modules.ts`. Each `ModuleDefinition` has `id`, `label` (vi), `summary`, `icon` (kept
  for other uses), `path`, `group`, `order`, `status: 'ready' | 'beta' | 'soon'` and a lazy `page`.
- Groups (`src/app/groups.ts`): (none) Tổng quan · Tài liệu: Tìm bài báo, Tập bài báo, Bảng so sánh · Thiết kế:
  Câu hỏi và giả thuyết, Thiết kế nghiên cứu, Đo lường · Kế hoạch: Phân tích thống kê, Ma trận chạy, Gói kế
  hoạch. Writing Bank and Cài đặt sit in the sidebar footer in smaller type.
- **A sidebar label is the page's title.** No two items, or an item and its group, share a name.
- A screen that is not built is listed with a "Sắp có" badge and is not a link.
- Active item: tinted background, accent text, `aria-current="page"`.
- Inside a module, sub-views are tabs, never a second sidebar.
- **Account** sits at the right end of the top bar. Signed out: a secondary button "Đăng nhập". Signed in: the
  account's name as a ghost button that opens a small menu with the email and "Đăng xuất". A sign-in error is
  shown as text beside it, never as a dialog.
- **The project is in the URL.** A project's screens live under `/p/<projectId>/…`, so a link opens the same
  project for a colleague and two tabs can hold two projects. The last opened project is remembered only to
  offer "Mở lại" on Dự án.

## 2. Screen patterns

- **Page header**: the screen's name and one line saying what it is for; at most one primary action.
- **Workspace layout**: from 1100 px a screen with a list and a detail shows them side by side (2 : 3), each
  scrolling on its own. Below that the detail opens in a right drawer.
- **Comparison table** (Bảng so sánh): one row per paper, one column per question (task, dataset, baseline,
  metric, design, reported result). The first column stays in view. A cell shows the extracted value; opening it
  shows the source sentence, its location and the review state. An empty cell says "Không tìm thấy", never a
  guess.
- **Source quote**: the paper's sentence in the reading face inside a quiet bordered block, followed by the paper
  and location as a text link. The quote is never edited.
- **Candidate content**: anything the AI produced and nobody approved carries the badge "Đề xuất của AI" and sits
  on a `--soft` surface. Approving and rejecting are explicit buttons; bulk approval is offered for a list.
- **The chain**: wherever a hypothesis, variable, metric or analysis is shown, the objects it links to are text
  links on one line ("H1 → Độ chính xác → test/accuracy → Welch t-test"). An object with a missing link says
  which link is missing.
- **Gate checklist** (Gói kế hoạch): the rules PP-01..PP-10 as a list; each line states the rule in words, its
  result in words (Đạt, Chặn, Cảnh báo) and links to the object at fault. Freezing is the page's one primary
  button and is disabled while a blocking issue remains, with the reason beside it.
- **Frozen content** is read-only and labelled with its version and date. "Tạo phiên bản mới" asks for the
  deviation note first.
- **Cost before action**: a button that starts AI work on more than one paper states the estimated tokens and
  the remaining daily budget before it runs.

- **Dự án** (project list): one row per project with its title in the reading face as a text link, then a quiet
  line "Chủ dự án · cập nhật <ngày>". Row actions are ghost buttons: Đổi tên, Lưu trữ (Khôi phục for an archived
  one). The page's one primary button is "Tạo dự án", which opens a Dialog with one TextField. Archived projects
  are hidden behind a Chip filter "Đã lưu trữ" with its count and are labelled with a Badge.
- **Inside a project.** Every screen under `/p/<projectId>/…` shows the project's title as a quiet text link
  above the page header ("‹ Reranker study"), leading to the project page. In the sidebar, the screens of a
  project are links only while a project is open; elsewhere they are plain text with the hint "Mở một dự án
  trước". An archived project is read-only: its screens show a Badge "Đã lưu trữ · chỉ đọc" and no control that
  writes.
- **Tập bài báo** (papers of a project): tabs "Bài báo" and "Nhật ký". Bài báo: Chip filters with counts for the
  decision (Tất cả, Chưa quyết định, Đã chọn, Đã loại); one row per paper with its title in the reading face,
  a quiet line "tác giả · năm · nơi đăng", the DOI as a text link to doi.org, and Badges in words for the
  decision and for "Có paper model". Row actions are ghost buttons: Chọn, Loại, Bỏ quyết định. "Loại" opens a
  Dialog that requires a reason; the reason is shown under an excluded paper. The page's primary button is
  "Thêm bài báo" (a Dialog: DOI, tên bài, tác giả, năm, nơi đăng); "Nhập paper model" is a secondary button that
  takes a `.json` file. A refused file states the one reason in a sentence (not a paper model, an unsupported
  version, or the first schema problems as a short list). Nhật ký: the decisions newest first, each as one
  sentence with account and time ("a@… đã loại «Title»: lý do").
- **Someone else changed it.** When a save meets a newer version, the app re-reads and re-applies the change
  without asking. Only when the change no longer applies does it say so in a toast and show the current state.
- **Cài đặt** (top-level screen, in the sidebar footer): three Cards in one column.
  "Tài khoản": name, email, and the mode (Google or "Chế độ phát triển").
  "Gửi dữ liệu cho AI": the consent text in the reading face — what is sent (the content of the project you work on: approved facts, quoted
  sentences, questions and the plan), to whom (the provider's name from the Worker), what is not kept (the ledger stores counts, never
  text) — then the state in words ("Đã đồng ý ngày …" or "Chưa đồng ý") and one button: "Đồng ý" (primary) when
  not accepted. When the Worker has no router: a warning Badge "AI chưa được cấu hình" and no button.
  "Hạn mức token": today's use against the daily budget as "12.300 / 300.000 token" with a meter (a bar on
  `--bg-sunken` filled with `--accent`, turning `--warning` from 80 % and `--danger` at 100 %, always with the
  numbers in words beside it), the note "Hạn mức tính theo ngày UTC, đặt lại lúc 07:00 giờ Việt Nam", the
  month's total, a small table of today's use per feature (Tính năng, Số lần gọi, Token vào, Token ra), a line
  "Có n lần gọi được ước lượng" when the router reported no usage, and a secondary button "Kiểm tra kết nối"
  that makes one tiny call and reports the result in a toast. The button is disabled without consent.
- **Consent gate.** A screen that needs AI and finds no current consent shows, in place of its AI action, the
  sentence "Cần đồng ý gửi dữ liệu cho AI trước khi dùng tính năng này." with a text link to Cài đặt. Over
  budget: "Đã hết hạn mức token hôm nay." with the same link.
- **Signed-out screens** that need the account show an Empty state that says what signing in gives and holds the
  "Đăng nhập" button; they never render an empty list.
- **Dev sign-in.** On the dev server without Firebase config, the account button reads "Đăng nhập (dev)" and a
  warning Badge "Chế độ phát triển" stays in the top bar while signed in. It does not exist in a production build.
- **Not configured.** A production build without Firebase config shows "Chưa cấu hình đăng nhập" in place of the
  account button, with no action.

## 3. Visual tokens

- Fonts: `--font-ui` (Inter), `--font-reading` (Source Serif 4, loaded at 400–700 with optical sizes so no weight
  is synthesised), `--font-mono` (JetBrains Mono). Page titles, source quotes and plan statements use the
  reading face; everything you operate uses Inter. Reading text uses `--text-reading` (17 px) / 1.6.
- Pages fill the width beside the sidebar, left-aligned; nothing is centred in a fixed column. Running text
  keeps a readable measure (about 60–80 characters); tables, fact grids and lists of entries use the full width.
- **Contrast is measured, not judged by eye.** All text, including `--text-faint` labels and placeholders, is at
  least 4.5:1 on every surface it sits on, in both themes. The border of anything operated (inputs, buttons,
  radios, checkboxes) uses `--control-border`, at least 3:1; `--border` and `--border-strong` are for dividers.
- **Links to other entries are text links**, underlined, never pills. A list of them reads as a sentence
  ("H1, H2, H3"). Status words
  (Bắt buộc, Tuỳ chọn) are a quiet second line, not grey tags.
- Semantic colours include `--danger`, `--success`, `--warning` with `--danger-soft` and `--warning-soft` surfaces,
  `--scrim` and the existing highlights; `--soft` / `--soft-strong` are subdued accent surfaces for selected and
  highlighted content; `--text-faint` is for tertiary text; `--bg-sunken` for wells. `--shadow-sm` lifts panels,
  `--shadow-overlay` is for overlays only. The Danger button is outlined; it fills only on hover.
- Neutral palette on `:root` (`--bg`, `--surface`, `--border`, `--text`, `--text-muted`, `--accent`), redefined
  for dark mode under `prefers-color-scheme: dark` and `[data-theme="dark"]`. Contrast ≥ 4.5:1 for text.
- Components live in `src/shared/ui/`: Button (primary, secondary, ghost, danger; md/sm), IconButton (md/sm),
  TextField, Select, Checkbox, SegmentedControl, Chip, Tabs, Badge (neutral, accent, success, warning, danger),
  Card (md/lg), Drawer, Tooltip (top/right), Toast, Kbd and EmptyState. Modules compose these; no one-off
  styled buttons in modules. Styling: CSS Modules + CSS variables.
- ESLint restricts native controls in app and module JSX, except the hidden file input. The
  `design system: CSS modules use tokens` test guards colours and spacing, radius and type values.
- Icons: `lucide-react`.

## 4. Copy and states

- Vietnamese UI copy, sentence case, short verbs. Plan content and paper text are English and are not translated.
- Every view has loading, empty (what is missing and how to get the first item) and error states.
- A draft Writing Bank entry is labelled "Bản nháp của bank" wherever it is shown.
- Numbers keep their unit and, for a reported result, their paper.

## 5. Rules every screen must meet

These are checked on each screen, by looking at it, before a change is accepted.

- **One primary button per view,** named for what it does.
- **Filters are `Chip`s with counts** when the options are few, `Select`s when they are many. Labels on items
  are `Badge`s.
- **Never promise a control the screen does not have.** Empty states name an action only where it exists.
- **Provenance comes last.** Source, prompt and model version, author and reviewer sit below the content.
- **Colour is never the only signal.** Review state, gate results and frozen state are stated in words.
- Modules compose `shared/ui`; no one-off buttons or inputs. CSS Modules use tokens only (a test enforces it).
