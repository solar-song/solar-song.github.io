const fs = require('fs').promises;
const path = require('path');
const matter = require('gray-matter');
const { marked } = require('marked');

const POSTS_DIR = path.join(__dirname, 'posts');
const TEMPLATE = path.join(__dirname, 'post-template.html');

function slugify(name) {
  return name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-_]/g, '').toLowerCase();
}

function formatDate(d) {
  try {
    const date = new Date(d);
    const opts = { day: 'numeric', month: 'short', year: 'numeric' };
    return new Intl.DateTimeFormat('en-US', opts).format(date);
  } catch (e) {
    return d;
  }
}

(async () => {
  const files = await fs.readdir(POSTS_DIR);
  const mdFiles = files.filter(f => f.endsWith('.md'));
  const template = await fs.readFile(TEMPLATE, 'utf8');
  // load site config (siteName, socials)
  let siteName = 'My Blog';
  let socialsCfg = null;
  try {
    const siteCfg = await fs.readFile(path.join(__dirname, 'site.json'), 'utf8');
    const cfg = JSON.parse(siteCfg);
    if (cfg && cfg.siteName) siteName = cfg.siteName;
    if (cfg && cfg.socials) socialsCfg = cfg.socials;
  } catch (e) {
    // ignore if no site.json
  }

  // build socials HTML from config (fallback defaults)
  const defaultSocials = {
    github: 'https://github.com/',
    x: 'https://x.com/',
    linkedin: 'https://www.linkedin.com/',
    email: 'mailto:you@example.com'
  };

  const socialsSource = socialsCfg || defaultSocials;
  const socialsHtml = [];
  if (socialsSource.github) socialsHtml.push(`<a href="${socialsSource.github}" title="GitHub" aria-label="GitHub"><svg viewBox="0 0 24 24"><path d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 00-1.3-3.2 4.2 4.2 0 00-.1-3.2s-1.1-.3-3.5 1.3a12 12 0 00-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 00-.1 3.2A4.6 4.6 0 004 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21"/></svg></a>`);
  if (socialsSource.x) socialsHtml.push(`<a href="${socialsSource.x}" title="X" aria-label="X"><svg viewBox="0 0 24 24"><path d="M4 4l16 16M20 4L4 20"/></svg></a>`);
  if (socialsSource.linkedin) socialsHtml.push(`<a href="${socialsSource.linkedin}" title="LinkedIn" aria-label="LinkedIn"><svg viewBox="0 0 24 24"><path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-4 0v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z"/><circle cx="4" cy="4" r="2"/></svg></a>`);
  if (socialsSource.email) socialsHtml.push(`<a href="${socialsSource.email}" title="Email" aria-label="Email"><svg viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 6L2 7"/></svg></a>`);
  const socialsHtmlStr = `<div class="socials">${socialsHtml.join('\n')}</div>`;


  const posts = [];

  for (const file of mdFiles) {
    const filePath = path.join(POSTS_DIR, file);
    const raw = await fs.readFile(filePath, 'utf8');
    const { data, content } = matter(raw);
    // Preprocess fenced code blocks so Markdown parser won't accidentally
    // interpret lines inside code (e.g., -----) as other Markdown constructs.
    const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const codeBlocks = [];
    // Match fences using ``` or ~~~ with optional language on the same line.
    const fenceRe = /(?:```|~~~)(\w+)?\n([\s\S]*?)\n(?:```|~~~)/g;
    const tokenized = content.replace(fenceRe, (m, lang, code) => {
      const id = codeBlocks.length;
      codeBlocks.push({ lang: (lang || '').trim(), code });
      return `@@CODEBLOCK_${id}@@`;
    });

    let html = marked.parse(tokenized);

    // Replace tokens with safe pre/code blocks (escaped content)
    codeBlocks.forEach((cb, i) => {
      const cls = cb.lang ? ` class="language-${cb.lang}"` : '';
      const blockHtml = `<pre><code${cls}>${escapeHtml(cb.code)}</code></pre>`;
      const token = `@@CODEBLOCK_${i}@@`;
      // Replace token possibly wrapped in <p>..</p> produced by the markdown parser
      html = html.replace(new RegExp(`<p>\\s*${token}\\s*<\\/p>`, 'g'), blockHtml);
      // Replace any remaining bare tokens
      const escToken = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      html = html.replace(new RegExp(escToken, 'g'), blockHtml);
    });

    const title = data.title || file.replace(/\.md$/, '');
    const date = data.date || new Date().toISOString();
    const slug = data.slug || slugify(file.replace(/\.md$/, ''));
    const url = `posts/${slug}.html`;
    const excerpt = data.excerpt || (content.split('\n\n')[0] || '').replace(/\n/g, ' ');

    // compute correct relative path from the generated post file to site root
    const outPath = path.join(POSTS_DIR, `${slug}.html`);
    let relPrefix = path.relative(path.dirname(outPath), __dirname).split(path.sep).join('/');
    if (!relPrefix) relPrefix = '.';
    if (!relPrefix.endsWith('/')) relPrefix += '/';

    // populate template (replace asset path & site name placeholders)
    let out = template.replace(/%%ASSET_PATH%%/g, relPrefix)
      .replace(/%%SITE_NAME%%/g, siteName)
      .replace(/%%SOCIALS%%/g, socialsHtmlStr)
      .replace(/%%TITLE%%/g, title)
      .replace(/%%DATE%%/g, formatDate(date))
      .replace(/%%CONTENT%%/g, html)
      .replace(/%%DESCRIPTION%%/g, (data.description || excerpt || title).replace(/\"/g, "'"));

    await fs.writeFile(outPath, out, 'utf8');

    // create a plain-text content blob for client-side search
    const stripHtml = (s) => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const contentText = stripHtml(html + '\n' + content).substring(0, 5000);

    posts.push({
      title,
      date,
      formattedDate: formatDate(date),
      url,
      slug,
      excerpt: excerpt.substring(0, 200),
      content: contentText,
    });
  }

  // sort posts newest first
  posts.sort((a, b) => new Date(b.date) - new Date(a.date));

  // write index.json into posts/
  await fs.writeFile(path.join(POSTS_DIR, 'index.json'), JSON.stringify(posts, null, 2), 'utf8');

  // Update top-level HTML files with configured site name (always ensure titles and logo match)
  const topFiles = ['index.html', 'about.html', 'all-posts.html'];
  for (const f of topFiles) {
    try {
      const p = path.join(__dirname, f);
      let txt = await fs.readFile(p, 'utf8');

      // If file contains placeholder, replace it
      if (txt.includes('%%SITE_NAME%%')) {
        txt = txt.replace(/%%SITE_NAME%%/g, siteName);
      }
      if (txt.includes('%%SOCIALS%%')) {
        txt = txt.replace(/%%SOCIALS%%/g, socialsHtmlStr);
      }

      // Ensure the logo text is updated (matches <a ... class="logo">...)
      txt = txt.replace(/(<a\b[^>]*\bclass=(?:"|')[^"']*\blogo\b[^"']*(?:"|')[^>]*>)([\s\S]*?)(<\/a>)/gi, `$1${siteName}$3`);

      // Replace or insert socials block in top-level pages so links reflect site.json
      if (txt.includes('%%SOCIALS%%')) {
        txt = txt.replace(/%%SOCIALS%%/g, socialsHtmlStr);
      } else {
        // try to replace an existing .socials block if present
        if (/<div\s+class=(?:"|')socials(?:"|')[\s\S]*?<\/div>/i.test(txt)) {
          txt = txt.replace(/<div\s+class=(?:"|')socials(?:"|')[\s\S]*?<\/div>/gi, socialsHtmlStr);
        }
      }

      // Update the <title> appropriately per page
      if (f === 'index.html') {
        txt = txt.replace(/<title>[\s\S]*?<\/title>/i, `<title>${siteName}</title>`);
      } else if (f === 'about.html') {
        txt = txt.replace(/<title>[\s\S]*?<\/title>/i, `<title>About | ${siteName}</title>`);
      } else if (f === 'all-posts.html') {
        txt = txt.replace(/<title>[\s\S]*?<\/title>/i, `<title>All Posts | ${siteName}</title>`);
      }

      await fs.writeFile(p, txt, 'utf8');
    } catch (e) {
      // ignore errors
    }
  }

  console.log(`Built ${posts.length} posts and created posts/index.json`);
})();
