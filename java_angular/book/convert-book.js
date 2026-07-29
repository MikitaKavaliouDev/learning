#!/usr/bin/env node
/**
 * Convert Java & Angular markdown book to a single, beautiful HTML file.
 *
 * Usage: node convert-book.js
 * Output: ./index.html
 *
 * Dependencies: marked (via npx), highlight.js (via CDN)
 */

const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

// ── Book structure ──────────────────────────────────────────────────────────
const BOOK_DIR = __dirname;

const CHAPTERS = [
  // Part I — Fundamentals
  { part: 'Часть I — Фундамент (Core)', file: 'part-01-fundamentals/01-java-core/01-java-core.md' },
  { part: null,                         file: 'part-01-fundamentals/02-spring-boot/02-spring-boot.md' },
  { part: null,                         file: 'part-01-fundamentals/03-angular/03-angular.md' },
  // Part II — Migration
  { part: 'Часть II — История миграции', file: 'part-02-migration/04-legacy-monolith/04-legacy-monolith.md' },
  { part: null,                          file: 'part-02-migration/05-agile/05-agile-migration.md' },
  { part: null,                          file: 'part-02-migration/06-strategy/06-migration-strategy.md' },
  { part: null,                          file: 'part-02-migration/07-java-migration/07-java-8-to-21.md' },
  { part: null,                          file: 'part-02-migration/08-angular-migration/08-angular-8-to-20.md' },
  { part: null,                          file: 'part-02-migration/09-microservices/09-monolith-to-microservices.md' },
  { part: null,                          file: 'part-02-migration/10-cloud/10-cloud-migration.md' },
  { part: null,                          file: 'part-02-migration/11-pitch/11-pitch-migration-story.md' },
  // Part III — Interview
  { part: 'Часть III — Senior-интервью (Франция)', file: 'part-03-interview/12-self-presentation/12-self-presentation.md' },
  { part: null,                                      file: 'part-03-interview/13-top-questions/13-top-80-questions.md' },
  { part: null,                                      file: 'part-03-interview/14-bridge-guide/14-bridge-nodejs-to-java.md' },
  { part: null,                                      file: 'part-03-interview/15-codingame/15-codingame-strategy.md' },
  // Part IV — Practice
  { part: 'Часть IV — Практика', file: 'part-04-practice/16-task-tracker/16-task-tracker.md' },
  { part: null,                    file: 'part-04-practice/17-lab-migration/17-lab-migration.md' },
  { part: null,                    file: 'part-04-practice/18-checklist/18-senior-checklist.md' },
];

// ── Configure marked ────────────────────────────────────────────────────────
marked.setOptions({
  gfm: true,
  breaks: false,
  headerIds: true,
  mangle: false,
});

// ── Collect heading info for navigation ─────────────────────────────────────
function collectHeadings(mdText, file, partLabel, chapterIndex) {
  const headings = [];
  const lines = mdText.split('\n');
  let isFirstH1 = true;
  for (const line of lines) {
    const m = line.match(/^(#{1,4})\s+(.+)/);
    if (m) {
      let level = m[1].length;
      const rawText = m[2];
      const text = rawText.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1');
      // Demote extra h1s after the first (chapter title) to h2 level in nav
      if (level === 1 && isFirstH1) {
        isFirstH1 = false;
      } else if (level === 1 && !isFirstH1) {
        level = 2;
      }
      // Build anchor id same way marked does
      const id = text
        .toLowerCase()
        .replace(/[^\w\u0400-\u04ff\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '');
      headings.push({ level, text, id, file, part: partLabel });
    }
  }
  return headings;
}

// ── Main ────────────────────────────────────────────────────────────────────
function main() {
  const allHtml = [];
  const navItems = [];
  let tocCounter = 0;

  for (const ch of CHAPTERS) {
    const fullPath = path.join(BOOK_DIR, ch.file);
    if (!fs.existsSync(fullPath)) {
      console.warn(`⚠ File not found: ${ch.file}`);
      continue;
    }
    const mdText = fs.readFileSync(fullPath, 'utf-8');

    // Collect nav headings
    const headings = collectHeadings(mdText, ch.file, ch.part, tocCounter);
    for (const h of headings) {
      navItems.push(h);
    }

    // Convert chapter markdown to HTML
    const chapterHtml = marked.parse(mdText);

    // Wrap in a section
    const chapterId = `ch-${String(tocCounter).padStart(2, '0')}`;
    allHtml.push(`<section id="${chapterId}" class="chapter">\n${chapterHtml}\n</section>`);
    tocCounter++;
  }

  // ── Build navigation sidebar ──────────────────────────────────────────────
  function buildSidebar(navItems) {
    let html = '';
    let openPart = null;
    let chIdx = 0;

    for (const item of navItems) {
      if (item.level === 1) {
        // Chapter title
        const chId = `ch-${String(chIdx).padStart(2, '0')}`;
        if (item.part && item.part !== openPart) {
          openPart = item.part;
          html += `<div class="nav-part">${item.part}</div>`;
        }
        html += `<a href="#${chId}" class="nav-h1" data-id="${chId}">${item.text}</a>`;
        chIdx++;
      } else {
        // Sub-heading
        const indent = item.level - 1;
        html += `<a href="#${item.id}" class="nav-h${item.level}" style="padding-left:${16 + (indent-1)*12}px">${item.text}</a>`;
      }
    }
    return html;
  }

  const sidebarHtml = buildSidebar(navItems);

  // ── HTML template ─────────────────────────────────────────────────────────
  const fullHtml = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Java & Angular — Полное руководство для Senior-интервью</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/github-dark.min.css">
<style>
  /* ── Reset & Base ───────────────────────────────────────────── */
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { scroll-behavior: smooth; font-size: 16px; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', 'Helvetica Neue', Arial, sans-serif;
    color: #1a1a2e;
    background: #f8f9fa;
    line-height: 1.7;
    display: flex;
    min-height: 100vh;
  }
  a { color: #2563eb; text-decoration: none; }
  a:hover { text-decoration: underline; }

  /* ── Layout wrapper ────────────────────────────────────────── */
  .layout { display: flex; width: 100%; min-height: 100vh; }

  /* ── Toggle button ─────────────────────────────────────────── */
  .sidebar-toggle {
    position: fixed;
    top: 12px;
    left: 12px;
    z-index: 200;
    width: 36px;
    height: 36px;
    border: none;
    border-radius: 8px;
    background: #1a1a2e;
    color: #cbd5e1;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    transition: background 0.2s, left 0.3s ease, color 0.2s;
    box-shadow: 0 2px 8px rgba(0,0,0,0.25);
  }
  .sidebar-toggle:hover { background: #2d2d4a; color: #f1f5f9; }
  .sidebar-toggle svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .layout.sidebar-collapsed .sidebar-toggle { left: 12px; }

  /* ── Sidebar ────────────────────────────────────────────────── */
  .sidebar {
    width: 300px;
    min-width: 300px;
    height: 100vh;
    position: sticky;
    top: 0;
    overflow-y: auto;
    background: #1a1a2e;
    color: #cbd5e1;
    padding: 24px 0;
    font-size: 14px;
    line-height: 1.5;
    z-index: 100;
    transition: width 0.3s ease, min-width 0.3s ease, padding 0.3s ease, opacity 0.2s ease;
  }
  .layout.sidebar-collapsed .sidebar {
    width: 0;
    min-width: 0;
    padding: 24px 0;
    overflow: hidden;
    opacity: 0;
  }
  .sidebar::-webkit-scrollbar { width: 6px; }
  .sidebar::-webkit-scrollbar-thumb { background: #334155; border-radius: 3px; }

  .sidebar-header {
    padding: 0 20px 20px;
    border-bottom: 1px solid #2d2d4a;
    margin-bottom: 12px;
    white-space: nowrap;
  }
  .sidebar-header h1 {
    font-size: 16px;
    color: #e2e8f0;
    font-weight: 700;
    line-height: 1.3;
  }
  .sidebar-header p {
    font-size: 12px;
    color: #94a3b8;
    margin-top: 4px;
  }

  .sidebar .nav-part {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #64748b;
    padding: 16px 20px 4px;
    font-weight: 600;
    margin-top: 4px;
    white-space: nowrap;
  }

  .sidebar a {
    display: block;
    color: #cbd5e1;
    padding: 3px 20px;
    font-size: 13px;
    transition: background 0.15s, color 0.15s;
    border-left: 3px solid transparent;
    text-decoration: none;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .sidebar a:hover {
    background: #1e293b;
    color: #f1f5f9;
    text-decoration: none;
  }
  .sidebar a.nav-h1 {
    font-weight: 600;
    color: #e2e8f0;
    padding-top: 5px;
    padding-bottom: 5px;
    font-size: 13.5px;
  }
  .sidebar a.nav-h1:hover { border-left-color: #3b82f6; }
  .sidebar a.nav-h3 { color: #94a3b8; font-size: 12.5px; }
  .sidebar a.nav-h4 { color: #64748b; font-size: 12px; }

  /* ── Search in sidebar ──────────────────────────────────────── */
  .sidebar-search {
    margin: 0 16px 12px;
    white-space: nowrap;
  }
  .sidebar-search input {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid #334155;
    border-radius: 6px;
    background: #0f172a;
    color: #e2e8f0;
    font-size: 13px;
    outline: none;
    transition: border-color 0.2s;
  }
  .sidebar-search input:focus { border-color: #3b82f6; }
  .sidebar-search input::placeholder { color: #64748b; }

  /* ── Content ────────────────────────────────────────────────── */
  .content {
    flex: 1;
    max-width: 860px;
    padding: 48px 56px 80px;
    margin: 0 auto;
    transition: padding 0.3s ease;
  }
  .layout.sidebar-collapsed .content {
    padding-left: 64px;
  }

  /* ── Chapter sections ────────────────────────────────────────── */
  .chapter {
    margin-bottom: 48px;
    padding-bottom: 32px;
  }
  .chapter:not(:last-child) { border-bottom: 1px solid #e2e8f0; }

  .chapter h1 {
    font-size: 2rem;
    font-weight: 800;
    color: #0f172a;
    margin: 0 0 16px;
    padding-bottom: 8px;
    border-bottom: 3px solid #3b82f6;
    line-height: 1.3;
  }
  .chapter h2 {
    font-size: 1.5rem;
    font-weight: 700;
    color: #1e293b;
    margin: 32px 0 12px;
    padding-bottom: 4px;
    border-bottom: 1px solid #e2e8f0;
  }
  .chapter h3 {
    font-size: 1.2rem;
    font-weight: 600;
    color: #334155;
    margin: 24px 0 10px;
  }
  .chapter h4 {
    font-size: 1.05rem;
    font-weight: 600;
    color: #475569;
    margin: 20px 0 8px;
  }
  .chapter p {
    margin: 0 0 14px;
    color: #334155;
  }
  .chapter strong { color: #0f172a; }

  /* ── Blockquotes ─────────────────────────────────────────────── */
  .chapter blockquote {
    margin: 16px 0;
    padding: 12px 20px;
    border-left: 4px solid #3b82f6;
    background: #eff6ff;
    border-radius: 0 8px 8px 0;
    color: #1e40af;
    font-style: normal;
  }
  .chapter blockquote p { margin: 4px 0; color: #1e40af; }
  .chapter blockquote strong { color: #1e3a8a; }

  /* ── Code blocks ─────────────────────────────────────────────── */
  .chapter pre {
    margin: 16px 0;
    border-radius: 8px;
    overflow-x: auto;
    font-size: 13.5px;
    line-height: 1.5;
    position: relative;
  }
  .chapter pre code {
    padding: 16px 20px;
    font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
    font-size: 13.5px;
    background: transparent;
    color: inherit;
    tab-size: 2;
  }
  /* Inline code */
  .chapter code:not(pre code) {
    background: #f1f5f9;
    color: #b91c1c;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 0.875em;
    font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
  }
  /* Code block language badge */
  .chapter pre::before {
    content: attr(data-language);
    position: absolute;
    top: 0;
    right: 12px;
    font-size: 11px;
    color: #64748b;
    padding: 4px 8px;
    background: #1e293b;
    border-radius: 0 0 6px 6px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  /* ── Tables ──────────────────────────────────────────────────── */
  .chapter table {
    width: 100%;
    border-collapse: collapse;
    margin: 16px 0;
    font-size: 14px;
    display: block;
    overflow-x: auto;
  }
  .chapter thead { background: #f1f5f9; }
  .chapter th, .chapter td {
    padding: 10px 14px;
    border: 1px solid #e2e8f0;
    text-align: left;
    vertical-align: top;
  }
  .chapter th {
    font-weight: 600;
    color: #0f172a;
    background: #f8fafc;
  }
  .chapter td { color: #334155; }
  .chapter tr:nth-child(even) td { background: #fafbfc; }

  /* ── Lists ───────────────────────────────────────────────────── */
  .chapter ul, .chapter ol {
    margin: 8px 0 14px;
    padding-left: 24px;
    color: #334155;
  }
  .chapter li { margin: 4px 0; }
  .chapter li > ul, .chapter li > ol { margin: 4px 0 4px; }

  /* ── Horizontal rules ─────────────────────────────────────────── */
  .chapter hr {
    border: none;
    border-top: 1px solid #e2e8f0;
    margin: 32px 0;
  }

  /* ── Links inside content ─────────────────────────────────────── */
  .chapter a { color: #2563eb; word-break: break-word; }
  .chapter a:hover { text-decoration: underline; }

  /* ── Images ──────────────────────────────────────────────────── */
  .chapter img {
    max-width: 100%;
    height: auto;
    border-radius: 8px;
    margin: 16px 0;
    border: 1px solid #e2e8f0;
  }

  /* ── Active nav highlight ─────────────────────────────────────── */
  .sidebar a.active {
    border-left-color: #3b82f6;
    background: #1e293b;
    color: #f8fafc;
  }

  /* ── Mobile ──────────────────────────────────────────────────── */
  @media (max-width: 900px) {
    body { flex-direction: column; }
    .layout { flex-direction: column; }
    .sidebar-toggle { left: 12px; top: 12px; }
    .sidebar {
      width: 100%;
      min-width: unset;
      height: auto;
      max-height: 300px;
      position: relative;
      padding: 12px 0;
      transition: max-height 0.3s ease, padding 0.3s ease, opacity 0.2s ease;
    }
    .layout.sidebar-collapsed .sidebar {
      width: 100%;
      min-width: unset;
      max-height: 0;
      padding: 0;
      opacity: 0;
    }
    .sidebar-header { padding: 0 16px 12px; }
    .sidebar-search { margin: 0 12px 8px; }
    .sidebar a { padding: 3px 16px; }
    .content { padding: 48px 20px 60px; max-width: 100%; }
    .layout.sidebar-collapsed .content { padding-left: 20px; }
    .chapter h1 { font-size: 1.6rem; }
    .chapter h2 { font-size: 1.3rem; }
    .chapter pre { font-size: 12px; }
  }
</style>
</head>
<body>

<div class="layout" id="layout">

<!-- ─── Toggle button ─────────────────────────────────────── -->
<button class="sidebar-toggle" id="sidebarToggle" aria-label="Toggle sidebar">
  <svg viewBox="0 0 24 24"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
</button>

<!-- ─── Sidebar ──────────────────────────────────────────── -->
<nav class="sidebar" id="sidebar">
  <div class="sidebar-header">
    <h1>Java &amp; Angular</h1>
    <p>Полное руководство для Senior-интервью</p>
  </div>
  <div class="sidebar-search">
    <input type="text" id="searchInput" placeholder="Поиск по книге…" aria-label="Поиск">
  </div>
  <div id="navLinks">
    ${sidebarHtml}
  </div>
</nav>

<!-- ─── Content ───────────────────────────────────────────── -->
<main class="content" id="content">
  ${allHtml.join('\n')}
</main>

</div>

<!-- ─── Highlight.js ──────────────────────────────────────── -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/highlight.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/languages/java.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/languages/typescript.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/languages/bash.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/languages/sql.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/languages/dockerfile.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/languages/python.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/languages/xml.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/languages/yaml.min.js"></script>

<script>
(function() {
  // ── Sidebar toggle ───────────────────────────────────────
  const layout = document.getElementById('layout');
  const toggleBtn = document.getElementById('sidebarToggle');
  const SIDEBAR_STORAGE_KEY = 'java-angular-book-sidebar';

  function setSidebarState(collapsed) {
    if (collapsed) {
      layout.classList.add('sidebar-collapsed');
    } else {
      layout.classList.remove('sidebar-collapsed');
    }
    try { localStorage.setItem(SIDEBAR_STORAGE_KEY, collapsed ? '1' : '0'); } catch(e) {}
  }

  // Restore saved state
  try {
    if (localStorage.getItem(SIDEBAR_STORAGE_KEY) === '1') {
      setSidebarState(true);
    }
  } catch(e) {}

  if (toggleBtn) {
    toggleBtn.addEventListener('click', function() {
      const isCollapsed = layout.classList.contains('sidebar-collapsed');
      setSidebarState(!isCollapsed);
    });
  }

  // ── Syntax highlight ──────────────────────────────────────
  document.querySelectorAll('pre code').forEach((block) => {
    const pre = block.parentElement;
    const lang = block.className.replace('language-', '');
    if (lang && lang !== '') {
      pre.setAttribute('data-language', lang);
    }
    hljs.highlightElement(block);
  });

  // ── Active nav tracking (Intersection Observer) ────────────
  const navLinks = document.querySelectorAll('#navLinks a');
  const chapters = document.querySelectorAll('.chapter');
  const navMap = [];
  navLinks.forEach((a, i) => {
    const href = a.getAttribute('href');
    if (href && href.startsWith('#')) {
      navMap.push({ el: a, target: href.slice(1) });
    }
  });

  if ('IntersectionObserver' in window && navMap.length > 0) {
    const visibleChapters = new Set();
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const id = entry.target.id || entry.target.closest('[id]')?.id;
        if (!id) return;
        if (entry.isIntersecting) {
          visibleChapters.add(id);
        } else {
          visibleChapters.delete(id);
        }
        // Find the first visible anchor and activate it
        let activeId = null;
        for (const { target } of navMap) {
          if (visibleChapters.has(target)) {
            activeId = target;
            break;
          }
        }
        if (!activeId && visibleChapters.size > 0) {
          activeId = [...visibleChapters][0];
        }
        navLinks.forEach(a => a.classList.remove('active'));
        if (activeId) {
          const active = document.querySelector(\`a[href="\\#\${activeId}"]\`);
          if (active) active.classList.add('active');
        }
      });
    }, { rootMargin: '-80px 0px -60% 0px', threshold: 0 });

    chapters.forEach(ch => observer.observe(ch));
    // Also observe all heading elements
    document.querySelectorAll('.chapter h1, .chapter h2, .chapter h3, .chapter h4').forEach(h => observer.observe(h));
  }

  // ── Search ────────────────────────────────────────────────
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    let searchTimeout;
    searchInput.addEventListener('input', function() {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        const q = this.value.toLowerCase().trim();
        const navA = document.querySelectorAll('#navLinks a');
        const contentEl = document.getElementById('content');

        if (!q) {
          navA.forEach(a => a.style.display = '');
          document.querySelectorAll('.chapter').forEach(ch => ch.style.display = '');
          return;
        }

        // Search in nav
        navA.forEach(a => {
          const text = a.textContent.toLowerCase();
          a.style.display = text.includes(q) ? '' : 'none';
        });

        // Search in content (show/hide chapters)
        const chapters = contentEl.querySelectorAll('.chapter');
        chapters.forEach(ch => {
          const text = ch.textContent.toLowerCase();
          ch.style.display = text.includes(q) ? '' : 'none';
        });
      }, 200);
    });
  }
})();
</script>

</body>
</html>`;
  fs.writeFileSync(path.join(BOOK_DIR, 'index.html'), fullHtml, 'utf-8');
  console.log(`✅ Book generated: ${path.join(BOOK_DIR, 'index.html')}`);
  console.log(`   Chapters processed: ${tocCounter}`);
}

main();
