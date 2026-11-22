# Mendeleev Tools

A Chrome Extension (Manifest V3, `v2.0.0`) that enhances productivity, multi-agent orchestration, conversation management, diagram rendering, and document export on [Google Gemini](https://gemini.google.com/).

---

## Quick Installation
1. Open `chrome://extensions` in Chrome / Chromium (`v111+`).
2. Enable **Developer mode** in the top-right corner.
3. Click **Load unpacked** and select the root folder of this extension.

---

## Key Features

### 1. AI Orchestration & Model Routing
- **Multi-Agent Orchestrator (`/oc/`, `@orchestrate-mode`):** Decomposes complex requests via a Planner step (with optional interactive plan review), dispatches subtasks in parallel across a background worker pool (`In-Chat` or `Clean 1-Turn`), and synthesizes the final response.
- **Periodic Table Model Picker:** Element-inspired visual selector for switching Gemini models and Thinking Levels directly from the composer.
- **Declarative Model Routing ([config/model-routing.json](config/model-routing.json)):** Centralized JSON configuration mapping tasks (`optimize`, `grammar`, `checkpoint`, `orchestrate`) to specific models and thinking levels, paired with a live DOM extractor and validator CLI (`node scripts/extract-models.js --validate`).

### 2. Reasoning Skills & Prompt Engineering
- **Reasoning Skills & Chaining:** Built-in technical reasoning modes (`/og/`, `/an/`, `/bd/`, `/pl/`, `/db/`, `/sm/`, `/rv/`, `/nc/`, etc.) supporting left-to-right command chaining, `/customize/skills` account migration, and an **Adaptive Skill-Aware Prompt Injector**.
- **Prompt Optimizer & Grammar Fix:** One-click prompt optimization across 3 tiers (`Lite`, `Flash`, `Pro`) and background grammar correction.
- **Prompt Library (`//`), Prompt Chains (`,,`) & Message Queue:** Trigger saved prompt templates via `//`, run multi-step sequential prompts via `,,`, and queue follow-up messages while Gemini is still generating.

### 3. Navigation, Branching & Export
- **Conversation Outline:** Floating outline tracking conversation turns, response headings (`H1`–`H3`), bookmarks, and indexed assets (code blocks, diagrams, and attached files).
- **Fork / Hand-off & Smart Checkpoint Handoff:** Branch conversations into a new chat (`Balanced`, `Compact`, `Full Verbatim`) or pick non-contiguous turns from the Outline and compress them via a background AI worker into a fixed **5-section technical checkpoint** (`Smart Checkpoint`), complete with a persistent **`Forked from: <Source Chat>`** back-link pill.
- **Selective Export:** Export full threads, selected turns, or bookmarked responses to **Markdown (`.md`)**, **PDF (`.pdf`)** (with full Unicode support), **Word (`.docx`)**, or **Plain Text (`.txt`)**.

### 4. Workspace Organization & Developer Tools
- **Folders, Pinned Chats, Bookmarks & Chat Notes:** Organize chats into nested drag-and-drop folders, pin threads, bookmark key responses, and attach per-chat notes.
- **Command Palette & Custom Keybinds:** Keyboard-first command center (`Ctrl+K`) for searching chats, executing actions, inserting prompts, jumping to bookmarks, and customizing shortcuts.
- **Selective Folder Uploader:** Upload local project trees with `.gitignore` filtering and live token budget estimation.
- **Sandbox Diagram Renderer & Code Tools:** Render diagrams inline from code fences (**Mermaid**, **Graphviz/DOT**, **WaveDrom**, **Chart.js**, **netlistsvg**), alongside collapsible code blocks, one-click copy, and a **Side-by-Side Code Diff** viewer.
- **UI & Backup Utilities:** Wide Mode, Auto-hide Sidebar, Hide Gems toggle, live Usage Counter, **Google Drive Sync**, and a **Unified Backup & System Diagnostics Center**.

---

## Third-Party Libraries & Credits

All third-party open-source libraries are bundled locally under [`lib/`](lib/) in compliance with Manifest V3 Content Security Policy (zero external CDN requests):

| Library | Version | License | Author / Source & Purpose |
|---|---|---|---|
| [**jsPDF**](https://github.com/parallax/jsPDF) | `2.5.2` | MIT | James Hall (Parallax) & yWorks GmbH — Client-side PDF generation (`lib/jspdf.umd.min.js`). |
| [**jsPDF-AutoTable**](https://github.com/simonbengtsson/jsPDF-AutoTable) | `3.8.4` | MIT | Simon Bengtsson — Table layout plugin for PDF export (`lib/jspdf-autotable.min.js`). |
| [**Roboto Font**](https://fonts.google.com/specimen/Roboto) | — | Apache-2.0 | Google Fonts — Embedded Unicode font data for jsPDF (`lib/pdf-fonts.js`). |
| [**docx**](https://github.com/dolanmiu/docx) | `8.x` | MIT | Dolan Miu — Microsoft Word `.docx` document generation (`lib/docx.umd.min.js`). |
| [**Mermaid**](https://github.com/mermaid-js/mermaid) | `10.x` | MIT | Knut Sveidqvist & Mermaid Contributors — Flowchart, sequence, state, class, and ER diagram rendering (`lib/diagrams/mermaid.min.js`). |
| [**Chart.js**](https://www.chartjs.org/) | `4.6.1` | MIT | Chart.js Contributors — Interactive data chart rendering from JSON specs (`lib/diagrams/chart.umd.min.js`). |
| [**Viz.js**](https://github.com/mdaines/viz-js) *(Graphviz & Expat)* | `3.31.0` | MIT / EPL-1.0 | Michael Daines, Graphviz & Expat Contributors — Graphviz DOT graph rendering (`lib/diagrams/viz-standalone.js`). |
| [**WaveDrom**](https://wavedrom.com/) | `3.8.0` | MIT | Aliaksei Chapyzhenka & WaveDrom Contributors — Digital timing diagram and register rendering (`lib/diagrams/wavedrom.min.js`). |
| [**netlistsvg**](https://github.com/nturley/netlistsvg) | `1.x` | MIT | Neil Turley — Digital logic schematic and Yosys JSON netlist rendering (`lib/diagrams/netlistsvg.min.js`). |
| [**elkjs**](https://github.com/kieler/elkjs) *(Eclipse Layout Kernel)* | `0.8.x` | EPL-2.0 | Kiel University / OpenKieler — Automatic graph layout engine used by `netlistsvg` (`lib/diagrams/elk.bundled.js`). |
