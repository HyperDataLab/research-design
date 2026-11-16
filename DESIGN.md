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
