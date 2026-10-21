// Theme toggle (remembers choice)
const root = document.documentElement;
const themeBtn = document.getElementById("theme-btn");
if (themeBtn) {
  themeBtn.addEventListener("click", () => {
    const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
    // update code theme links
    setCodeTheme(next);
  });
}

// set code theme links according to current theme
function setCodeTheme(theme) {
  try {
    const light = document.getElementById('code-theme-light');
    const dark = document.getElementById('code-theme-dark');
    if (light) light.disabled = (theme === 'dark');
    if (dark) dark.disabled = (theme !== 'dark');
  } catch (e) { /* ignore */ }
}

// initialize code theme on load
setCodeTheme(root.getAttribute('data-theme'));

// Mobile menu
const menuBtn = document.getElementById("menu-btn");
const menu = document.getElementById("menu");
if (menuBtn && menu) {
  menuBtn.addEventListener("click", () => {
    const open = menu.classList.toggle("open");
    menuBtn.setAttribute("aria-expanded", open);
    menuBtn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  });
}

// Footer year
const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = new Date().getFullYear();

// Apply site.json configuration at runtime (updates top-level pages without rebuilding)
// This updates the logo text, document title, footer socials, and copyright site name.
async function applySiteConfig() {
  try {
    const base = (typeof window !== 'undefined' && window.__SITE_BASE) ? window.__SITE_BASE : '';
    const res = await fetch(base + 'site.json');
    if (!res.ok) return;
    const cfg = await res.json();
    if (!cfg) return;

    // site name -> logo and title
    if (cfg.siteName) {
      const logo = document.querySelector('.logo');
      if (logo) logo.textContent = cfg.siteName;

      // update <title> while preserving page-specific prefixes like "About |"
      try {
        const cur = document.title || '';
        if (cur.includes('|')) {
          const parts = cur.split('|').map(s => s.trim());
          parts[parts.length - 1] = cfg.siteName;
          document.title = parts.join(' | ');
        } else {
          document.title = cfg.siteName;
        }
      } catch (e) { /* ignore */ }

      // update copyright block if present
      const copy = document.querySelector('.copy');
      if (copy) {
        copy.innerHTML = `Copyright &copy; <span id="year">${new Date().getFullYear()}</span> &nbsp;—&nbsp; ${cfg.siteName} &nbsp;|&nbsp; All rights reserved.`;
      }
    }

    // socials -> update footer anchors if present
    if (cfg.socials) {
      const s = cfg.socials;
      const footer = document.querySelector('footer .socials');
      if (footer) {
        const map = { github: 'GitHub', x: 'X', linkedin: 'LinkedIn', email: 'Email' };
        Object.keys(map).forEach(k => {
          if (!(k in s)) return;
          const label = map[k];
          const a = footer.querySelector(`a[aria-label="${label}"]`);
          if (a) a.href = s[k];
        });
      }
    }
  } catch (e) {
    // ignore errors — non-critical
  }
}

// Posts cache & fetch helper
let postsCache = null;
async function fetchPosts() {
  if (postsCache) return postsCache;
  // determine base path — pages may set window.__SITE_BASE (in generated post pages)
  const base = (typeof window !== 'undefined' && window.__SITE_BASE) ? window.__SITE_BASE : '';
  const candidates = [base + 'posts/index.json', '/posts/index.json', 'posts/index.json'];

  for (const p of candidates) {
    try {
      const res = await fetch(p);
      if (!res.ok) continue;
      const posts = await res.json();
      postsCache = posts;
      return posts;
    } catch (e) {
      // try next
    }
  }

  console.debug('Could not load posts index from any candidate path', candidates);
  return [];
}

// Load posts metadata (for homepage dynamic lists)
async function loadPosts() {
  const posts = await fetchPosts();
  const featuredEl = document.getElementById('featured-list');
  const recentEl = document.getElementById('recent-list');
  if (!featuredEl || !recentEl) return;

  const base = (typeof window !== 'undefined' && window.__SITE_BASE) ? window.__SITE_BASE : '';
  let featured = [];

  try {
    const res = await fetch(base + 'site.json');
    if (res.ok) {
      const cfg = await res.json();
      const fl = cfg && (cfg['featured-list'] || cfg['featuredList'] || cfg.featured);
      if (fl) {
        let vals = [];
        if (Array.isArray(fl)) vals = fl;
        else if (typeof fl === 'object') vals = Object.values(fl);
        vals = vals.filter(v => v && v !== 'null' && typeof v === 'string');

        for (const rel of vals) {
          // try to match against the posts index first
          const match = posts.find(p => p.url === rel || p.url === '/' + rel || p.url.endsWith(rel));
          if (match) {
            featured.push(match);
          } else {
            // fallback: construct a minimal post object so the UI can still render a link
            const name = rel.split('/').pop() || rel;
            const title = name.replace(/\.html?$/i, '').replace(/[-_]/g, ' ');
            featured.push({ title, url: rel, formattedDate: '', excerpt: '' });
          }
        }
      }
    }
  } catch (e) {
    // ignore — non-critical
  }

  // if no featured defined, default to the newest post
  if (!featured.length && posts.length) featured = [posts[0]];

  // show only the 5 most recent posts on the homepage
  const recent = posts.slice(0, 5);

  featuredEl.innerHTML = featured.map(p => renderPostItem(p)).join('');
  recentEl.innerHTML = recent.map(p => renderPostItem(p)).join('');
}

function renderPostItem(p) {
  return `
    <li>
      <a href="${p.url}">${p.title}</a>
      <div class="date"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg><time>${p.formattedDate}</time></div>
      <p>${p.excerpt}</p>
    </li>
  `;
}

// Run on load
document.addEventListener('DOMContentLoaded', async () => {
  // apply site.json-driven changes first so the page reflects config immediately
  try { await applySiteConfig(); } catch (e) { /* ignore */ }
  await loadPosts();
  try {
    if (window.hljs && typeof window.hljs.highlightAll === 'function') {
      window.hljs.highlightAll();
    }
  } catch (e) {
    // ignore
  }
  // add copy buttons to code blocks
  try {
    addCopyButtons();
  } catch (e) { /* ignore */ }
});

// Add copy buttons to all code blocks
function addCopyButtons() {
  const codeBlocks = document.querySelectorAll('pre > code');
  codeBlocks.forEach(codeEl => {
    const pre = codeEl.parentElement;
    if (!pre || pre.querySelector('.copy-btn')) return;

    const btn = document.createElement('button');
    btn.className = 'copy-btn';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Copy code');
    btn.title = 'Copy';
    // clipboard SVG icon (default)
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 4h-1.5a2.5 2.5 0 00-5 0H8a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V6a2 2 0 00-2-2z"/></svg>
    `;

    const checkSvg = `
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>
    `;

    btn.addEventListener('click', async () => {
      const text = codeEl.innerText;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          const ta = document.createElement('textarea');
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
        }
        btn.classList.add('copied');
        const originalHTML = btn.innerHTML;
        btn.innerHTML = checkSvg;
        btn.setAttribute('aria-label', 'Copied');
        setTimeout(() => {
          btn.classList.remove('copied');
          btn.innerHTML = originalHTML;
          btn.setAttribute('aria-label', 'Copy code');
        }, 1500);
      } catch (err) {
        btn.title = 'Error';
        setTimeout(() => btn.title = 'Copy', 1500);
      }
    });

    // place button inside pre
    pre.appendChild(btn);
  });
}

// Ensure the "All Posts" button scrolls to the posts section reliably
// (handles cases where anchor navigation might not work due to hosting or overlays)
document.addEventListener('click', function (e) {
  try {
    const btn = e.target.closest('a.btn[href="#posts"]');
    if (!btn) return;
    e.preventDefault();
    const target = document.getElementById('posts');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
      // update URL hash without adding history entry
      if (history && history.replaceState) {
        history.replaceState(null, '', '#posts');
      } else {
        location.hash = '#posts';
      }
    }
  } catch (err) {
    // ignore
  }
});

// ---------- Search overlay & logic ----------
(function () {
  let overlay = null;
  let input = null;
  let resultsEl = null;
  let debounceTimer = null;

  function createOverlay() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.setAttribute('id', 'search-overlay');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.style.position = 'fixed';
    overlay.style.left = '0';
    overlay.style.top = '0';
    overlay.style.right = '0';
    overlay.style.bottom = '0';
    overlay.style.background = 'rgba(0,0,0,0.4)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'flex-start';
    overlay.style.justifyContent = 'center';
    overlay.style.paddingTop = '5vh';
    overlay.style.zIndex = '1000';

    // Insert a small style block so placeholder color and other pseudo styles adapt to theme
    const styleEl = document.createElement('style');
    styleEl.textContent = `#search-overlay input::placeholder { color: color-mix(in srgb, var(--foreground) 60%, transparent); }
#search-overlay .icon-btn { color: var(--foreground); }
#search-overlay a { color: var(--accent); }`;
    overlay.appendChild(styleEl);

    const box = document.createElement('div');
    box.style.width = 'min(48rem, 95%)';
    box.style.background = 'var(--background)';
    box.style.color = 'var(--foreground)';
    box.style.border = '1px solid var(--border)';
    box.style.borderRadius = '6px';
    box.style.padding = '1rem';
    box.style.boxShadow = '0 6px 30px rgba(0,0,0,0.2)';

    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    header.style.gap = '0.5rem';

    input = document.createElement('input');
    input.type = 'search';
    input.setAttribute('placeholder', 'Search posts by keyword...');
    input.style.flex = '1';
    input.style.fontSize = '1rem';
    input.style.padding = '0.5rem';
    // Use CSS variables so the input adapts to light/dark theme
    input.style.background = 'var(--muted)';
    input.style.color = 'var(--foreground)';
    input.style.border = '1px solid var(--border)';
    input.style.borderRadius = '4px';
    input.style.outline = 'none';
    input.style.width = '100%';
    input.style.boxSizing = 'border-box';
    // Remove native search styling and shadows to ensure dark mode looks correct
    input.style.webkitAppearance = 'none';
    input.style.appearance = 'none';
    input.style.boxShadow = 'none';
    input.style.backgroundClip = 'padding-box';
    input.style.caretColor = 'var(--accent)';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'icon-btn';
    closeBtn.innerHTML = 'Close';
    closeBtn.addEventListener('click', closeOverlay);

    header.appendChild(input);
    header.appendChild(closeBtn);

    resultsEl = document.createElement('div');
    resultsEl.style.marginTop = '0.75rem';
    resultsEl.style.maxHeight = '60vh';
    resultsEl.style.overflow = 'auto';

    box.appendChild(header);
    box.appendChild(resultsEl);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    input.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => doSearch(input.value.trim()), 250);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeOverlay();
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeOverlay();
    });
  }

  async function openOverlay() {
    createOverlay();
    overlay.style.display = 'flex';
    input.value = '';
    resultsEl.innerHTML = '<div style="opacity:.8">Loading index…</div>';
    // ensure posts are loaded and show count
    const posts = await fetchPosts();
    if (posts && posts.length) {
      resultsEl.innerHTML = `<div style="opacity:.9;margin-bottom:.5rem">Indexed posts: ${posts.length}</div>`;
    } else {
      resultsEl.innerHTML = `<div style="opacity:.9;margin-bottom:.5rem">No index available — search limited to this page</div>`;
    }
    setTimeout(() => input.focus(), 50);
  }

  function closeOverlay() {
    if (!overlay) return;
    overlay.style.display = 'none';
  }

  async function doSearch(q) {
    if (!q) {
      resultsEl.innerHTML = '';
      return;
    }
    const posts = await fetchPosts();
    const ql = q.toLowerCase();
    const results = posts.filter(p => {
      return (p.title && p.title.toLowerCase().includes(ql)) ||
             (p.excerpt && p.excerpt.toLowerCase().includes(ql)) ||
             (p.content && p.content.toLowerCase().includes(ql));
    }).slice(0, 50);

    if (!results.length) {
      resultsEl.innerHTML = '<p>No results</p>';
      return;
    }

    resultsEl.innerHTML = results.map(r => `
      <div style="padding:.5rem 0;border-bottom:1px solid var(--border)">
        <a href="${r.url}" style="font-weight:600">${r.title}</a>
        <div style="opacity:.85;font-size:.9rem">${r.formattedDate}</div>
        <p style="margin:.25rem 0">${r.excerpt}</p>
      </div>
    `).join('');
  }

  // open search when clicking any search button in the nav
  document.addEventListener('click', function (e) {
    const el = e.target.closest('[aria-label="Search"], [title="Search"]');
    if (!el) return;
    e.preventDefault();
    openOverlay();
  });
})();
