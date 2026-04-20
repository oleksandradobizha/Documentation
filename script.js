(function () {
  'use strict';

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  /* --------- Theme --------- */
  const themeToggle = $('#themeToggle');
  const applyTheme = (t) => document.documentElement.setAttribute('data-theme', t);
  const storedTheme = localStorage.getItem('theme');
  const systemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(storedTheme || (systemDark ? 'dark' : 'light'));

  themeToggle.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem('theme', next);
  });

  /* --------- Doc switcher --------- */
  const tabs = $$('.doc-tab');
  const docs = { playwright: $('#doc-playwright'), qa: $('#doc-qa') };

  const tocGroups = {
    playwright: [
      { group: 'Introduction', items: [
        { id: 'top', label: 'Introduction' },
        { id: 'overview', label: 'Overview' },
        { id: 'tech-stack', label: 'Tech Stack' },
        { id: 'project-structure', label: 'Project Structure' },
      ]},
      { group: 'Setup', items: [
        { id: 'getting-started', label: 'Getting Started' },
        { id: 'prerequisites', label: 'Prerequisites', sub: true },
        { id: 'installation', label: 'Installation', sub: true },
        { id: 'env-setup', label: 'Environment Setup', sub: true },
        { id: 'environment', label: 'Environment & Credentials' },
      ]},
      { group: 'Usage', items: [
        { id: 'running-tests', label: 'Running Tests' },
        { id: 'architecture', label: 'Test Architecture' },
        { id: 'pom', label: 'Page Object Model' },
        { id: 'test-data', label: 'Test Data' },
      ]},
      { group: 'Operations', items: [
        { id: 'cicd', label: 'CI/CD Pipeline' },
        { id: 'reporting', label: 'Reporting & TestRail' },
        { id: 'tags', label: 'Tags & Filtering' },
        { id: 'utilities', label: 'Utility Modules' },
        { id: 'test-inventory', label: 'Test Inventory' },
      ]},
      { group: 'Reference', items: [
        { id: 'extending', label: 'Extending the Framework' },
        { id: 'best-practices', label: 'Best Practices' },
        { id: 'troubleshooting', label: 'Troubleshooting' },
      ]},
    ],
    qa: [
      { group: 'Introduction', items: [
        { id: 'qa-top', label: 'Introduction' },
        { id: 'qa-overview', label: '1. Overview' },
      ]},
      { group: 'Onboarding', items: [
        { id: 'qa-onboarding', label: '2. Onboarding Guide' },
        { id: 'qa-welcome', label: '2.1 Welcome', sub: true },
        { id: 'qa-getting-started', label: '2.2 Getting Started', sub: true },
        { id: 'qa-links', label: '2.3 Important Links' },
        { id: 'qa-tools', label: '2.4 Tools Overview' },
      ]},
      { group: 'Processes', items: [
        { id: 'qa-jira', label: '3. Jira Workflow' },
        { id: 'qa-validation', label: '4. Validation Requirements' },
        { id: 'qa-testrail', label: '5. TestRail' },
        { id: 'qa-regression', label: '6. Regression Testing' },
        { id: 'qa-defects', label: '7. Defect Management' },
        { id: 'qa-prod-validation', label: '8. Production Validation' },
      ]},
      { group: 'Team', items: [
        { id: 'qa-roles', label: '9. Roles & Responsibilities' },
        { id: 'qa-best-practices', label: '10. Best Practices' },
      ]},
    ],
  };

  const tocEl = $('#toc');

  function renderToc(docKey) {
    tocEl.innerHTML = '';
    tocGroups[docKey].forEach(group => {
      const header = document.createElement('div');
      header.className = 'toc-group';
      header.textContent = group.group;
      tocEl.appendChild(header);
      group.items.forEach(item => {
        const a = document.createElement('a');
        a.href = '#' + item.id;
        a.textContent = item.label;
        if (item.sub) a.classList.add('sub');
        a.addEventListener('click', () => {
          if (window.innerWidth <= 900) closeSidebar();
        });
        tocEl.appendChild(a);
      });
    });
    observeSections();
  }

  function switchDoc(key) {
    tabs.forEach(t => {
      const isActive = t.dataset.doc === key;
      t.classList.toggle('active', isActive);
      t.setAttribute('aria-selected', String(isActive));
    });
    Object.entries(docs).forEach(([k, el]) => {
      el.classList.toggle('hidden', k !== key);
    });
    renderToc(key);
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
    localStorage.setItem('doc', key);
  }

  tabs.forEach(t => t.addEventListener('click', () => switchDoc(t.dataset.doc)));

  const savedDoc = localStorage.getItem('doc');
  const initialDoc = ['playwright', 'qa'].includes(savedDoc) ? savedDoc : 'playwright';
  switchDoc(initialDoc);

  /* --------- Active section highlighting --------- */
  let observer;
  function observeSections() {
    if (observer) observer.disconnect();
    const activeDoc = document.querySelector('.doc:not(.hidden)');
    if (!activeDoc) return;
    const sections = $$('section[id]', activeDoc);
    const links = $$('a', tocEl);

    observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          links.forEach(l => l.classList.toggle('active', l.getAttribute('href') === '#' + id));
        }
      });
    }, { rootMargin: '-80px 0px -70% 0px', threshold: 0 });

    sections.forEach(s => observer.observe(s));
  }

  /* --------- Copy buttons on code blocks --------- */
  $$('pre.code').forEach(pre => {
    const btn = document.createElement('button');
    btn.className = 'copy-btn';
    btn.type = 'button';
    btn.textContent = 'Copy';
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const code = pre.querySelector('code');
      const text = code ? code.textContent : pre.textContent;
      try {
        await navigator.clipboard.writeText(text);
        btn.textContent = 'Copied!';
        btn.classList.add('ok');
        setTimeout(() => {
          btn.textContent = 'Copy';
          btn.classList.remove('ok');
        }, 1400);
      } catch {
        btn.textContent = 'Failed';
        setTimeout(() => { btn.textContent = 'Copy'; }, 1400);
      }
    });
    pre.appendChild(btn);
  });

  /* --------- Back to top --------- */
  const backBtn = $('#backToTop');
  window.addEventListener('scroll', () => {
    backBtn.classList.toggle('visible', window.scrollY > 400);
  });
  backBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  /* --------- Mobile sidebar --------- */
  const sidebar = $('#sidebar');
  const menuBtn = $('#menuBtn');
  let backdrop;

  function openSidebar() {
    sidebar.classList.add('open');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.className = 'backdrop';
      backdrop.addEventListener('click', closeSidebar);
      document.body.appendChild(backdrop);
    }
    requestAnimationFrame(() => backdrop.classList.add('visible'));
  }
  function closeSidebar() {
    sidebar.classList.remove('open');
    if (backdrop) backdrop.classList.remove('visible');
  }
  menuBtn.addEventListener('click', () => {
    sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
  });

  /* --------- Search --------- */
  const searchInput = $('#searchInput');

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
    if (e.key === 'Escape' && document.activeElement === searchInput) {
      searchInput.value = '';
      searchInput.dispatchEvent(new Event('input'));
      searchInput.blur();
    }
  });

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Unwrap previous highlights
  function unhighlight(root) {
    $$('mark.search-hit', root).forEach(m => {
      const parent = m.parentNode;
      parent.replaceChild(document.createTextNode(m.textContent), m);
      parent.normalize();
    });
  }

  function highlight(root, term) {
    if (!term) return;
    const re = new RegExp('(' + escapeRegex(term) + ')', 'ig');
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (parent.closest('pre.code, .toc, .topbar, script, style')) return NodeFilter.FILTER_REJECT;
        return re.test(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    const targets = [];
    let n;
    while ((n = walker.nextNode())) targets.push(n);
    targets.forEach(node => {
      const frag = document.createElement('span');
      frag.innerHTML = escapeHtml(node.nodeValue).replace(re, '<mark class="search-hit">$1</mark>');
      node.parentNode.replaceChild(frag, node);
    });
  }

  function runSearch(term) {
    const activeDoc = document.querySelector('.doc:not(.hidden)');
    if (!activeDoc) return;

    unhighlight(activeDoc);
    const sections = $$('section', activeDoc);

    // Clean up any existing empty-state
    const existingEmpty = activeDoc.querySelector('.search-empty');
    if (existingEmpty) existingEmpty.remove();

    if (!term || term.length < 2) {
      sections.forEach(s => s.classList.remove('search-hidden'));
      return;
    }

    const needle = term.toLowerCase();
    let hits = 0;
    sections.forEach(s => {
      const text = s.textContent.toLowerCase();
      const match = text.includes(needle);
      s.classList.toggle('search-hidden', !match);
      if (match) hits++;
    });

    if (hits === 0) {
      const empty = document.createElement('div');
      empty.className = 'search-empty';
      empty.innerHTML = `<h3>No results for "${escapeHtml(term)}"</h3><p>Try a different keyword or clear the search.</p>`;
      activeDoc.appendChild(empty);
    } else {
      highlight(activeDoc, term);
    }
  }

  let searchDebounce;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchDebounce);
    const val = e.target.value.trim();
    searchDebounce = setTimeout(() => runSearch(val), 120);
  });

  // Re-run search when switching docs
  tabs.forEach(t => t.addEventListener('click', () => {
    setTimeout(() => runSearch(searchInput.value.trim()), 0);
  }));
})();
