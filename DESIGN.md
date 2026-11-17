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
- **Comparison table** (Bảng so sánh): one row per included paper, one column per kind of fact in this order:
  Task, Dataset, Baseline, Phương pháp, Metric, Thiết kế, Mẫu, Kết quả. The first column (the paper's title) stays
  in view. A cell lists its facts as Chips showing the value as the paper states it; a Chip carries the project's
  decision as a Badge ("Dùng", or "Loại" in the quiet tone) and facts PaperLab has not reviewed carry the quiet
  Badge "Chưa duyệt". An empty cell says "Không có", never a guess; the columns Task, Thiết kế and Mẫu say "PaperLab
  chưa cung cấp" in the header's second line. A paper with no facts shows one quiet line across the row, "Chưa có
  dữ kiện từ PaperLab", with a text link to Tập bài báo. Facts read for an older paper model show the warning line
  "Dữ kiện thuộc paper model cũ hơn bản dự án đang giữ." on the row.
  Opening a Chip shows the fact in a Drawer: the value, then number, unit, uncertainty and condition when present,
  the metric, dataset and system it belongs to by their values, PaperLab's status in words, and its anchors: each
  sentence as a Source quote with its page, and a table cell as "Bảng, hàng r, cột c" with the header texts and
  the table's text in a quiet block. An anchor that is not in the held paper model says "Không tìm thấy trong
  paper model đang giữ". Under them the decision: who and when, and the buttons "Dùng", "Loại" (asks for a reason
  in the same Drawer) and "Bỏ quyết định". A fact with no anchor found cannot be set to "Dùng"; the button is
  disabled with that sentence beside it. Nothing here edits a value.
  Bank match (metric and dataset facts, when the project has a bank snapshot): the Drawer shows "Writing Bank" with
  either the confirmed entry (name, id in the mono face, release, and "Bỏ khớp"), or the entries offered by exact
  name ("Khớp theo tên: …" with the button "Xác nhận"), or the quiet line "Không có mục trùng tên trong Writing Bank".
  A match pinned to another release carries the warning Badge "Khác bản phát hành".
  Under the table, a Card "Dùng trong nhiều bài" with three lists (Baseline, Dataset, Metric): each line is the value
  (or the bank entry's name when matched) and "n bài" in the mono face, most papers first; only facts decided "Dùng"
  count. With none: the quiet line "Chưa có dữ kiện nào được đặt Dùng".
  Several facts: a Checkbox on each Chip and an ActionBar "Đã chọn n" with "Dùng" and "Loại"; the action applies to
  all or to none, and a refusal names the reason in one sentence.
- **AI suggestions** (Câu hỏi và giả thuyết, Đo lường, Thiết kế nghiên cứu): a secondary button "Gợi ý từ bảng so sánh"
  opens a Drawer. Before any call it states "Sẽ gửi n dữ kiện đã đặt Dùng (loại, giá trị, tên bài) cùng câu hỏi và giả
  thuyết của dự án. Không gửi câu trích hay nội dung Writing Bank." and the primary button "Gửi và nhận gợi ý"; with no
  such fact the button is absent and the line reads "Chưa có dữ kiện nào được đặt Dùng." Without consent or over budget
  the Consent gate sentences apply. Each suggestion is a Card: the text, the Badge "Gợi ý của AI", and the facts it
  cites as Chips (value · paper title) that open the fact in Bảng so sánh. Buttons "Thêm vào bản nháp" and "Bỏ qua".
  Suggestions are not stored; closing the Drawer discards them.
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
- **Gói kế hoạch** (the screen): three Cards.
  "Bản nháp hiện tại": Tên kế hoạch (a TextField saved with a secondary button "Lưu tên"; the project's title is
  the placeholder), then one of three states. Not yet a plan: the sentence "Bản nháp chưa đủ để thành kế
  hoạch." and a list of what is missing, each line in words with a text link to the screen where it is fixed
  ("Chưa có giả thuyết nào", "m-1 «Name» còn thiếu: key, đơn vị", "Thiết kế chưa chọn cách phân nhóm", "t-2
  «Name» chưa ghi cách giảm"). A plan: the gate checklist (above), one line per rule PP-01..PP-10 in Vietnamese
  with Đạt, Chặn or Cảnh báo and the objects at fault as links. No change: "Bản nháp không khác phiên bản n."
  The page's one primary button is "Đóng băng phiên bản n"; it is disabled, with the reason beside it, while
  the draft is not a plan, a rule blocks, or nothing changed. It opens a Dialog that states the version, the
  number of runs and the warnings that remain, asks for "Thay đổi so với phiên bản trước và lý do" (required)
  from version 2 on, and confirms with "Đóng băng". A refusal by the server is shown in the Dialog in one
  sentence (someone else froze this version: the list is reloaded).
  "Các phiên bản đã đóng băng": newest first, each row "Phiên bản n · người đóng băng · ngày giờ", its
  deviation note in the reading face, and ghost buttons "Xem", "Tải gói (.zip)", "Mã mẫu cho runner".
  "Xem" opens a Drawer with the plan as readable text (the same content as `plan.md`), labelled "Phiên bản n ·
  đã đóng băng · chỉ đọc". "Mã mẫu cho runner" opens a Drawer with three blocks in the mono face (MLflow tags in
  Python, Hydra, W&B), each with "Sao chép" and "Tải về", under the sentence "Điểm bắt đầu cho mã chạy; ứng
  dụng này không chạy chúng."
  "Cờ trên bản nháp": the count of open draft flags per screen as text links ("Đo lường: 2"), or "Không còn cờ
  nào." An archived project shows versions and downloads only.
- **Frozen content** is read-only and labelled with its version and date. "Tạo phiên bản mới" asks for the
  deviation note first.
- **Cost before action**: a button that starts AI work on more than one paper states the estimated tokens and
  the remaining daily budget before it runs.

- **Dự án** (project list): one row per project with its title in the reading face as a text link, then a quiet
  line "Chủ dự án · cập nhật <ngày>". Row actions are ghost buttons: Đổi tên, Lưu trữ (Khôi phục for an archived
  one). The page's one primary button is "Tạo dự án", which opens a Dialog with one TextField. Archived projects
  are hidden behind a Chip filter "Đã lưu trữ" with its count and are labelled with a Badge.
- **Thành viên** (a Card on the project page, below the screens of the project): the members as rows, each an
  email with the quiet label "Chủ dự án" on the owner's row, sorted with the owner first. The owner sees a
  TextField "Email thành viên" with the secondary button "Thêm" beside it, and a ghost button "Gỡ" on every row
  but their own; "Gỡ" asks for confirmation in a Dialog ("Gỡ a@… khỏi dự án? Người này sẽ không còn thấy dự
  án."). A member who is not the owner sees the list and the quiet line "Chỉ chủ dự án thêm hoặc gỡ thành
  viên." An email outside the lab's domain, a malformed one or one already in the list is refused under the
  field in one sentence before anything is sent. An archived project shows the list only.
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
- **Writing Bank** (a project screen, last in the "Thiết kế" group): one Card. With no snapshot: an Empty state
  saying that designs, threats and claim types come from a snapshot of Writing Bank, and the primary button
  "Nhập bản chụp" (takes a `.json` file). With one: the release in the mono face, "Nguồn" (the file's source
  line), who imported it and when, the count per collection as a sentence, and a secondary button "Thay bản
  chụp". A snapshot cut by the bank also shows "Ngày phát hành" and, when it contains unpublished entries, a
  warning Badge "Có mục bản nháp" with the sentence "Bản phát hành này gồm cả các mục Writing Bank chưa xuất
  bản." When the bank's address is configured, two more secondary buttons: "Kiểm tra bản mới" (says in a sentence
  whether a newer release exists) and "Lấy bản mới" (fetches and stores it, with the same confirmation as
  replacing). A refused file states the one reason in a sentence, as for a paper model. Replacing a snapshot asks for
  confirmation in a Dialog when the draft holds references to the current one.
- **Từ PaperLab** (Tập bài báo, only when PaperLab's address is configured): a secondary button "Thêm từ PaperLab"
  opens a Dialog listing the papers PaperLab has published: title in the reading face, DOI in the mono face, who
  published, and the state of its facts in words ("Chưa có dữ kiện", "Dữ kiện chưa duyệt", "Dữ kiện đã duyệt"). The
  list is loaded when the Dialog opens. On the row of a paper whose model came from PaperLab, a text button "Lấy dữ
  kiện", or "Cập nhật dữ kiện" once facts are stored. Results and refusals are one sentence in a toast.
- **Câu hỏi và giả thuyết**: questions as Cards in one column, in id order. A question shows its id in the mono
  face, its text in the reading face, "Khoảng trống" (the gap, or the quiet line "Chưa ghi khoảng trống") and its
  papers as text links to Tập bài báo. Under it, its hypotheses as rows: id, statement in the reading face, a
  Badge for the kind in words (Có hướng, Không hướng, Tương đương, Thăm dò), the claim type's name or the quiet
  line "Chưa phân loại nhận định", and the design flag when there is one (below). Hypotheses with no question
  sit in a last Card "Chưa gắn câu hỏi". The page's primary button is "Thêm câu hỏi"; "Thêm giả thuyết" is a
  ghost button on each question. Adding and editing happen in a Dialog; Sửa and Xoá are ghost buttons on the
  row. A question that still has hypotheses cannot be deleted and the Dialog says why. An id is never shown as
  editable.
- **Thiết kế nghiên cứu**: three Cards in one column.
  "Thiết kế": with none chosen, an Empty state and the primary button "Chọn thiết kế", which opens a Drawer
  listing the snapshot's designs (name, family, causal licence in words, the first sentence of the definition)
  and a last entry "Tự mô tả thiết kế" (name and assignment). With no snapshot the Drawer offers only that entry
  and a text link to the Writing Bank screen. Once chosen: the name in the reading face, a SegmentedControl for
  the assignment (Ngẫu nhiên, Không ngẫu nhiên, Không phân nhóm), fixed and explained in a quiet line when the
  bank fixes it, and a ghost button "Đổi thiết kế".
  "Thiết kế này cho phép kết luận gì": two lists, "Hỗ trợ" (the names of the claim types) and "Không hỗ trợ"
  (the bank's sentences, unchanged), then "Giả thuyết cần xem lại": one line per flagged hypothesis.
  "Mối đe doạ": the register as rows (id, name, "Cách giảm trong nghiên cứu này" as an editable text, or the
  warning line "Chưa ghi cách giảm"), then "Gợi ý từ thiết kế": the design's threats not yet in the register,
  each with its mechanism, the bank's general advice as a quiet line, and a ghost button "Thêm vào danh sách".
  "Thêm mối đe doạ" (secondary) adds one written by the person.
- **Đo lường**: Tabs "Chuỗi", "Biến", "Metric", "Dataset", "Điều kiện", each tab's label followed by its count.
  Chuỗi: one row per hypothesis showing the chain (below) and, for a person who can write, a ghost button "Gắn
  biến" that opens a Dialog with two groups of Checkboxes (biến độc lập, biến phụ thuộc; only variables of the
  matching role are offered). The other tabs are lists of rows with Sửa and Xoá as ghost buttons and one
  "Thêm …" button per tab (primary; it is the view's one primary button). A row shows the id in the mono face,
  the name, the object's own fields as a quiet line (a metric: `key` in the mono face · unit · goal in words ·
  aggregation in words; a dataset: source · version · split; a condition: a Badge "Baseline" and its params as
  `name = value` in the mono face), and its chain flags. Adding a metric or a dataset opens a Drawer: the
  snapshot's entries with a text filter and Chips for the metric family (with counts), each entry with its
  definition, unit, direction in words, "Không hỗ trợ" sentences and a button "Dùng", plus a last entry to
  describe one by hand. Choosing a bank entry opens the same Dialog as editing, pre-filled with what the bank
  gives; the MLflow key, aggregation and protocol are always empty for the person to write. A bank protocol is
  shown beside the protocol field as a hint ("Gợi ý từ bank") and can be marked as followed; its text is never
  copied in. A benchmark shows its lifecycle in words and its known flaws. A field that is still empty is said in
  words in the row's quiet line ("chưa có key", "chưa có đơn vị", "chưa chọn hướng tốt", "chưa chọn cách gộp",
  "Chưa ghi nguồn", "chưa có metric", "chưa có mức"), never as a bare separator. A picker entry states the
  bank's limit as "Nhận định mạnh nhất mà metric tự nó hỗ trợ: …". A delete Dialog names the kind and the object
  ("Xoá metric", "Xoá m-1 «Name»?") and confirms with the Danger button. Deleting something that is still
  referred to is refused in the Dialog with a sentence naming what refers to it.
- **Chain line** (shared component, used on Đo lường, Phân tích thống kê and each hypothesis row of Câu hỏi và
  giả thuyết): one line per dependent variable, "h-1 → v-2 Accuracy → m-1 `test/accuracy`", followed on the
  same line by the analyses of the hypothesis ("→ a-1 Welch t-test") or, for a hypothesis that is not
  exploratory and has none, the warning "chưa có phân tích"; ids in the mono face, each object a
  text link to its tab. A missing link is said in place of the object, in `--warning` text with the Badge "Cần
  xem lại": "chưa gắn biến phụ thuộc", "chưa có metric", "metric chưa có key". Independent variables follow on a
  quiet second line with their levels ("Biến độc lập: v-1 Reranker (A, B)").
- **Phân tích thống kê**: one Card per hypothesis, in id order, then a last Card "Không gắn giả thuyết". A Card
  shows the hypothesis id and statement, its Chain line, and its analyses as rows: id in the mono face, the
  method in words, a Badge "SRD chưa hỗ trợ" (warning) for a method SRD plans for later, then quiet lines
  "Biến: v-1 Name, …", "So sánh: c-1 Name → c-2 Name" (in the stored order), "α = 0.05 · hiệu chỉnh: Holm ·
  thiếu dữ liệu: loại theo danh sách", parameters as `name = value` in the mono face and the assumptions as a
  list. Row actions Sửa and Xoá are ghost buttons; "Thêm phân tích" is a ghost button on each Card and the
  page has no primary button. The Dialog: Phương pháp (Select grouped "SRD hỗ trợ ngay" / "SRD chưa hỗ trợ",
  with one quiet sentence under it saying what the chosen method compares), Biến (Checkboxes; the hypothesis's
  dependent variables are ticked for a new analysis), Điều kiện so sánh (an ordered list: a Select "Thêm điều
  kiện" appends, each row has ghost buttons Lên, Xuống, Gỡ; a method that compares two conditions says so),
  α, Hiệu chỉnh đa so sánh, Dữ liệu thiếu, Giả định (one per line), Tham số (name/value rows).
- **Ma trận chạy**: three Cards. "Lưới chạy": Tên experiment MLflow (mono), Checkboxes for the conditions and
  for the datasets of the draft (each with its id; a Badge "Baseline"), Seed as one TextField that takes
  numbers and ranges ("0-4, 7") with the parsed list shown under it, and "Vì sao số lần chạy này là đủ"
  (multiline); one primary button "Lưu lưới". "Số lần chạy": the count as a sentence in the reading face
  ("3 điều kiện × 2 dataset × 5 seed = 30 lần chạy") and the checks of the grid. "Các ô đầu tiên": a table of
  the first 20 cells (Điều kiện, Dataset, Seed, and the tags `plan.condition_id`, `plan.dataset_id`,
  `plan.seed` in the mono face), the first column staying in view when the table scrolls sideways, with the
  quiet line "plan.id và plan.version được gán khi đóng băng." and, past 20, "… và n ô nữa".
- **What the screens add to the two patterns above.** A method's name starts with a capital where it opens a row
  or an option ("Kiểm định t Welch") and is lower-case inside a sentence. In "Các ô đầu tiên" a cell shows the
  id and the name ("c-1 Base") under a header that names the tag carrying the id. A read-only project shows the
  saved grid as text. The top bar shows the project's title on the project page.
- **In-use refusal.** Deleting anything that an analysis or the run grid refers to is refused like any other
  object in use, with the sentence that names what refers to it.
- **Design flag.** A check of the draft against the snapshot (DS-01..DS-05) is shown on the object it is about
  as a warning Badge "Cần xem lại" followed by one sentence that names both sides, for example "H2 là nhận định
  nhân quả; thiết kế «Test benchmark» không hỗ trợ loại nhận định này." A flag never blocks saving. A
  reference to an entry that the current snapshot no longer has says "… không còn trong bản chụp hiện tại";
  this is said even when the reference also names an older snapshot. References that name an older snapshot
  but still exist in the current one are not flagged row by row: Thiết kế nghiên cứu shows one line "Một số
  tham chiếu thuộc bản chụp cũ nhưng vẫn có trong bản chụp hiện tại." with a ghost button "Ghim lại theo bản
  chụp hiện tại". When every threat the design suggests is in the register, the suggestions are replaced by the
  quiet line "Đã thêm mọi mối đe doạ mà thiết kế này gợi ý."
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
- **Links to other entries are text links** in the accent colour, underlined on hover and focus, never pills. A list of them reads as a sentence
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
