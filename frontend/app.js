(function () {
  const { API_BASE, API_KEY } = window.CONFIG || {};

  const state = {
    sections: [],
    testCases: [],
    activeSectionId: null,
    activeTab: "dashboard",
    search: "",
    sectionDeleteMode: false,
    selectedSectionIds: new Set(),
    selectedTcIds: new Set(),
    // Server-provided feature flags (loaded once at boot)
    features: {
      aiEnabled: false,
      jiraEnabled: false,
      automationUrl: "",
    },
    // Documentation
    docs: {
      loaded: false,
      loading: false,
      sections: [],
      activeId: null,
      dirty: false,
      saving: false,
      saveTimer: null,
      editing: false,
      originalContent: "",
    },
    // JIRA tickets
    jira: {
      loaded: false,
      loading: false,
      sections: [],
      tickets: [],
      activeSectionId: "__all__", // "__all__" | "__unassigned__" | section id
      search: "",
      selectedKeys: new Set(),
      selectedSectionIds: new Set(),
      sectionDeleteMode: false,
    },
  };

  const $ = (id) => document.getElementById(id);

  const els = {
    // tabs
    tabs: document.querySelectorAll(".tab"),
    views: {
      dashboard: $("view-dashboard"),
      documentation: $("view-documentation"),
      testcases: $("view-testcases"),
      jira: $("view-jira"),
    },
    // sidebar
    sectionList: $("sectionList"),
    sectionEmpty: $("sectionEmpty"),
    btnAddSection: $("btnAddSection"),
    btnRenameSectionIcon: $("btnRenameSectionIcon"),
    btnDeleteSectionIcon: $("btnDeleteSectionIcon"),
    sectionDeleteBar: $("sectionDeleteBar"),
    sectionDeleteCount: $("sectionDeleteCount"),
    btnCancelSectionDelete: $("btnCancelSectionDelete"),
    btnConfirmSectionDelete: $("btnConfirmSectionDelete"),
    // content
    sectionTitle: $("sectionTitle"),
    sectionMeta: $("sectionMeta"),
    search: $("search"),
    btnAddTc: $("btnAddTc"),
    tcTable: $("tcTable"),
    tcBody: $("tcBody"),
    tcSelectAll: $("tcSelectAll"),
    tcBulkBar: $("tcBulkBar"),
    tcBulkCount: $("tcBulkCount"),
    btnClearTcSelection: $("btnClearTcSelection"),
    btnBulkDeleteTc: $("btnBulkDeleteTc"),
    emptyState: $("emptyState"),
    noSectionState: $("noSectionState"),
    loadState: $("loadState"),
    // tc modal
    tcModal: $("tcModal"),
    tcForm: $("tcForm"),
    tcModalTitle: $("tcModalTitle"),
    btnSaveTc: $("btnSaveTc"),
    btnDeleteTc: $("btnDeleteTc"),
    // section modal
    sectionModal: $("sectionModal"),
    sectionForm: $("sectionForm"),
    sectionModalTitle: $("sectionModalTitle"),
    btnSaveSection: $("btnSaveSection"),
    sectionLevel: $("sectionLevel"),
    sectionParent: $("sectionParent"),
    sectionParentLabel: $("sectionParentLabel"),
    // confirm modal
    confirmModal: $("confirmModal"),
    confirmTitle: $("confirmTitle"),
    confirmMessage: $("confirmMessage"),
    btnConfirmOk: $("btnConfirmOk"),
    btnConfirmCancel: $("btnConfirmCancel"),
    // dashboard
    ringFg: $("ringFg"),
    ringPct: $("ringPct"),
    overallLegend: $("overallLegend"),
    moduleChart: $("moduleChart"),
    moduleChartEmpty: $("moduleChartEmpty"),
    // toast
    toast: $("toast"),
    // documentation
    docSectionList: $("docSectionList"),
    docSectionEmpty: $("docSectionEmpty"),
    btnAddDocSection: $("btnAddDocSection"),
    btnRenameDocSection: $("btnRenameDocSection"),
    btnDeleteDocSection: $("btnDeleteDocSection"),
    docSectionTitle: $("docSectionTitle"),
    docSectionMeta: $("docSectionMeta"),
    docEditorWrap: $("docEditorWrap"),
    docEditor: $("docEditor"),
    docViewer: $("docViewer"),
    docEmptyState: $("docEmptyState"),
    docSaveStatus: $("docSaveStatus"),
    btnSaveDoc: $("btnSaveDoc"),
    btnEditDoc: $("btnEditDoc"),
    btnCancelDoc: $("btnCancelDoc"),
    docBlockStyle: $("docBlockStyle"),
    docFontFamily: $("docFontFamily"),
    docFontSize: $("docFontSize"),
    docFontColor: $("docFontColor"),
    docSectionModal: $("docSectionModal"),
    docSectionForm: $("docSectionForm"),
    docSectionModalTitle: $("docSectionModalTitle"),
    btnSaveDocSection: $("btnSaveDocSection"),
    docSectionTypeFieldset: $("docSectionTypeFieldset"),
    docSectionParentLabel: $("docSectionParentLabel"),
    docSectionParent: $("docSectionParent"),
    // docs: AI generator
    btnGenerateDocSection: $("btnGenerateDocSection"),
    docGenerateModal: $("docGenerateModal"),
    docGenerateForm: $("docGenerateForm"),
    docGenerateError: $("docGenerateError"),
    btnDocGenerateSubmit: $("btnDocGenerateSubmit"),
    // docs: table/cards
    btnInsertTable: $("btnInsertTable"),
    tablePicker: $("tablePicker"),
    tablePickerGrid: $("tablePickerGrid"),
    tablePickerLabel: $("tablePickerLabel"),
    btnInsertCards: $("btnInsertCards"),
    tableContextGroup: $("tableContextGroup"),
    cardsContextGroup: $("cardsContextGroup"),
    btnTableAddRow: $("btnTableAddRow"),
    btnTableAddCol: $("btnTableAddCol"),
    btnTableDelRow: $("btnTableDelRow"),
    btnTableDelCol: $("btnTableDelCol"),
    btnTableDelete: $("btnTableDelete"),
    btnCardAdd: $("btnCardAdd"),
    btnCardRemove: $("btnCardRemove"),
    btnCardMoveLeft: $("btnCardMoveLeft"),
    btnCardMoveRight: $("btnCardMoveRight"),
    btnCardsDelete: $("btnCardsDelete"),
    // test case modal extras
    tcSectionPickerLabel: $("tcSectionPickerLabel"),
    tcSectionPicker: $("tcSectionPicker"),
    // jira tab
    jiraSectionList: $("jiraSectionList"),
    jiraSectionEmpty: $("jiraSectionEmpty"),
    btnAddJiraSection: $("btnAddJiraSection"),
    btnRenameJiraSectionIcon: $("btnRenameJiraSectionIcon"),
    btnDeleteJiraSectionIcon: $("btnDeleteJiraSectionIcon"),
    jiraSectionDeleteBar: $("jiraSectionDeleteBar"),
    jiraSectionDeleteCount: $("jiraSectionDeleteCount"),
    btnCancelJiraSectionDelete: $("btnCancelJiraSectionDelete"),
    btnConfirmJiraSectionDelete: $("btnConfirmJiraSectionDelete"),
    jiraSectionTitle: $("jiraSectionTitle"),
    jiraSectionMeta: $("jiraSectionMeta"),
    jiraSearch: $("jiraSearch"),
    btnJiraExtract: $("btnJiraExtract"),
    btnJiraGenerate: $("btnJiraGenerate"),
    jiraBulkBar: $("jiraBulkBar"),
    jiraBulkCount: $("jiraBulkCount"),
    btnJiraMoveMenu: $("btnJiraMoveMenu"),
    jiraMoveMenu: $("jiraMoveMenu"),
    btnClearJiraSelection: $("btnClearJiraSelection"),
    btnJiraBulkDelete: $("btnJiraBulkDelete"),
    jiraTable: $("jiraTable"),
    jiraBody: $("jiraBody"),
    jiraSelectAll: $("jiraSelectAll"),
    jiraEmptyState: $("jiraEmptyState"),
    jiraLoadState: $("jiraLoadState"),
    jiraSectionModal: $("jiraSectionModal"),
    jiraSectionForm: $("jiraSectionForm"),
    jiraSectionModalTitle: $("jiraSectionModalTitle"),
    btnSaveJiraSection: $("btnSaveJiraSection"),
    jiraExtractModal: $("jiraExtractModal"),
    jiraExtractForm: $("jiraExtractForm"),
    jiraExtractSection: $("jiraExtractSection"),
    jiraExtractError: $("jiraExtractError"),
    btnJiraExtractSubmit: $("btnJiraExtractSubmit"),
  };

  // ---------- API helpers ----------
  async function api(path, options = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(API_KEY ? { "x-api-key": API_KEY } : {}),
        ...(options.headers || {}),
      },
    });
    if (!res.ok) {
      let msg = `${res.status}`;
      try {
        const body = await res.json();
        msg = body.error || msg;
      } catch {
        msg = (await res.text()) || msg;
      }
      throw new Error(msg);
    }
    return res.status === 204 ? null : res.json();
  }

  // ---------- utilities ----------
  function toast(msg, isError = false) {
    els.toast.textContent = msg;
    els.toast.classList.toggle("error", isError);
    els.toast.classList.remove("hidden");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => els.toast.classList.add("hidden"), 3200);
  }

  function escapeHtml(s = "") {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  }

  function slug(s) {
    return String(s).toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  }

  const JIRA_KEY_RE = /^[A-Z][A-Z0-9_]+-\d+$/;

  function extractJiraKey(value) {
    const s = String(value || "").trim();
    if (!s) return "";
    const m = s.match(/([A-Z][A-Z0-9_]+-\d+)/i);
    const key = (m ? m[1] : s).toUpperCase();
    return JIRA_KEY_RE.test(key) ? key : "";
  }

  function jiraKeyToUrl(key) {
    const K = String(key || "").toUpperCase();
    if (!JIRA_KEY_RE.test(K)) return "";
    const ticket = (state.jira?.tickets || []).find(
      (t) => String(t.key || "").toUpperCase() === K
    );
    return ticket?.url || "";
  }

  function automationUrlFor(tcId) {
    const template = state.features.automationUrl;
    if (!template) return "";
    return template.includes("{id}")
      ? template.replace(/\{id\}/g, encodeURIComponent(tcId))
      : template;
  }

  async function loadFeatures() {
    try {
      const cfg = await api("/ai/config");
      state.features.aiEnabled = !!cfg.aiEnabled;
      state.features.jiraEnabled = !!cfg.jiraEnabled;
      state.features.automationUrl = cfg.automationUrl || "";
    } catch {
      // Older backend without /api/ai/config - silently keep AI disabled.
      state.features.aiEnabled = false;
      state.features.jiraEnabled = false;
      state.features.automationUrl = "";
    }
    applyFeatureFlags();
  }

  function applyFeatureFlags() {
    const showJiraAi = state.features.aiEnabled && state.features.jiraEnabled;
    els.btnJiraGenerate?.classList.toggle("hidden", !showJiraAi);
    els.btnGenerateDocSection?.classList.toggle(
      "hidden",
      !state.features.aiEnabled
    );
  }

  // ---------- SVG icons ----------
  const ICONS = {
    edit:
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"></path></svg>',
    trash:
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"></path></svg>',
    check:
      '<svg class="auto-menu__check" viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 8.5 7 12 13 5"></polyline></svg>',
    bolt:
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>',
    move:
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h13"></path><path d="M3 12h13"></path><path d="M3 18h9"></path><path d="M17 9l4 3-4 3"></path></svg>',
  };

  const AUTO_OPTIONS = ["Not Started", "In Progress", "Done"];
  const MODULE_ORDER = [
    "Analysis",
    "Buildings",
    "ESPM",
    "Measures",
    "Mobile",
    "Project",
    "Proposal",
  ];
  const PRIORITY_ORDER = ["Highest", "High", "Medium", "Low"];
  const MAX_SECTION_DEPTH = 2; // 0 = main, 1 = sub, 2 = sub-of-sub
  const UNDEFINED_SECTION_ID = "sec-undefined";
  const ALL_SECTION_ID = "__all__";

  // ---------- section hierarchy helpers ----------
  function sectionsById() {
    return new Map(state.sections.map((s) => [s.id, s]));
  }

  function sectionDepth(section, byId = sectionsById()) {
    let depth = 0;
    let cur = section;
    const seen = new Set();
    while (cur && cur.parentId) {
      if (seen.has(cur.id)) return depth;
      seen.add(cur.id);
      const parent = byId.get(cur.parentId);
      if (!parent) break;
      depth += 1;
      cur = parent;
    }
    return depth;
  }

  // Hierarchical walk: returns sections in depth-first order so children
  // immediately follow their parent, each annotated with `depth`.
  function orderedSections() {
    const byId = sectionsById();
    const childrenOf = new Map();
    for (const s of state.sections) {
      const key = s.parentId || null;
      if (!childrenOf.has(key)) childrenOf.set(key, []);
      childrenOf.get(key).push(s);
    }
    for (const arr of childrenOf.values()) {
      arr.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }
    const out = [];
    const walk = (parentId, depth) => {
      const kids = childrenOf.get(parentId) || [];
      for (const kid of kids) {
        out.push({ section: kid, depth });
        walk(kid.id, depth + 1);
      }
    };
    walk(null, 0);
    // Append any sections whose parent no longer exists (safety).
    const placed = new Set(out.map((x) => x.section.id));
    for (const s of state.sections) {
      if (!placed.has(s.id)) out.push({ section: s, depth: sectionDepth(s, byId) });
    }
    return out;
  }

  // Count a section's test cases plus those of all descendants.
  function sectionTotalCount(sectionId) {
    const descendants = new Set([sectionId]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const s of state.sections) {
        if (!descendants.has(s.id) && s.parentId && descendants.has(s.parentId)) {
          descendants.add(s.id);
          grew = true;
        }
      }
    }
    return state.testCases.filter((t) => descendants.has(t.sectionId)).length;
  }

  // Returns list of descendant ids for a given section (excluding itself).
  function descendantIds(sectionId) {
    const out = new Set();
    let grew = true;
    let frontier = new Set([sectionId]);
    while (grew) {
      grew = false;
      const next = new Set();
      for (const s of state.sections) {
        if (s.parentId && frontier.has(s.parentId) && !out.has(s.id)) {
          out.add(s.id);
          next.add(s.id);
          grew = true;
        }
      }
      frontier = next;
    }
    return out;
  }

  function compareCases(a, b) {
    const mA = MODULE_ORDER.indexOf(a.module);
    const mB = MODULE_ORDER.indexOf(b.module);
    const modCmp = (mA === -1 ? 999 : mA) - (mB === -1 ? 999 : mB);
    if (modCmp !== 0) return modCmp;
    const pA = PRIORITY_ORDER.indexOf(a.priority);
    const pB = PRIORITY_ORDER.indexOf(b.priority);
    const priCmp = (pA === -1 ? 999 : pA) - (pB === -1 ? 999 : pB);
    if (priCmp !== 0) return priCmp;
    return String(a.id).localeCompare(String(b.id));
  }

  function sectionDisplayPath(section) {
    if (!section) return "";
    const byId = sectionsById();
    const parts = [];
    let cur = section;
    const seen = new Set();
    while (cur) {
      if (seen.has(cur.id)) break;
      seen.add(cur.id);
      parts.unshift(cur.name);
      cur = cur.parentId ? byId.get(cur.parentId) : null;
    }
    return parts.join(" › ");
  }

  // ---------- Automation status dropdown (custom, opens below trigger) ----------
  let openAutoMenu = null;

  function closeAutoMenu() {
    if (!openAutoMenu) return;
    const { trigger, menu } = openAutoMenu;
    trigger.setAttribute("aria-expanded", "false");
    menu.remove();
    openAutoMenu = null;
  }

  function toggleAutoMenu(trigger) {
    if (openAutoMenu && openAutoMenu.trigger === trigger) {
      closeAutoMenu();
      return;
    }
    closeAutoMenu();
    closeTcMoveMenu();

    const id = trigger.dataset.id;
    const tc = state.testCases.find((t) => t.id === id);
    if (!tc) return;
    const current = tc.automationStatus;

    const menu = document.createElement("ul");
    menu.className = "auto-menu";
    menu.setAttribute("role", "listbox");
    menu.innerHTML = AUTO_OPTIONS.map(
      (opt) => `
        <li class="auto-menu__option auto-${slug(opt)} ${
        opt === current ? "is-current" : ""
      }" role="option" data-value="${escapeHtml(opt)}" aria-selected="${
        opt === current ? "true" : "false"
      }">
          <span class="auto-menu__label">
            <span class="auto-menu__dot" aria-hidden="true"></span>
            ${escapeHtml(opt)}
          </span>
          ${ICONS.check}
        </li>`
    ).join("");

    document.body.appendChild(menu);

    const rect = trigger.getBoundingClientRect();
    const menuWidth = Math.max(menu.offsetWidth, rect.width);
    let left = rect.left;
    if (left + menuWidth > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - menuWidth - 8);
    }
    menu.style.top = `${rect.bottom + 6}px`;
    menu.style.left = `${left}px`;
    menu.style.minWidth = `${rect.width}px`;

    trigger.setAttribute("aria-expanded", "true");
    openAutoMenu = { trigger, menu, id };

    menu.addEventListener("click", (e) => {
      const opt = e.target.closest(".auto-menu__option");
      if (!opt) return;
      const value = opt.dataset.value;
      closeAutoMenu();
      updateAutomationStatus(id, value);
    });
  }

  // ---------- Move test case to a section dropdown ----------
  let openMoveMenu = null;

  function closeTcMoveMenu() {
    if (!openMoveMenu) return;
    const { trigger, menu } = openMoveMenu;
    trigger.setAttribute("aria-expanded", "false");
    menu.remove();
    openMoveMenu = null;
  }

  function toggleTcMoveMenu(trigger) {
    if (openMoveMenu && openMoveMenu.trigger === trigger) {
      closeTcMoveMenu();
      return;
    }
    closeTcMoveMenu();
    closeAutoMenu();

    const id = trigger.dataset.id;
    const tc = state.testCases.find((t) => t.id === id);
    if (!tc) return;

    const menu = document.createElement("ul");
    menu.className = "auto-menu auto-menu--move";
    menu.setAttribute("role", "listbox");
    const ordered = orderedSections();
    menu.innerHTML = ordered
      .map(({ section: s, depth }) => {
        const isCurrent = s.id === tc.sectionId;
        const indent = 8 + depth * 14;
        return `
          <li class="auto-menu__option auto-menu__option--move ${
            isCurrent ? "is-current" : ""
          }" role="option" data-section-id="${escapeHtml(s.id)}" aria-selected="${
          isCurrent ? "true" : "false"
        }" style="padding-left:${indent}px">
            <span class="auto-menu__label">
              <span class="auto-menu__label-text">${escapeHtml(s.name)}</span>
            </span>
            ${ICONS.check}
          </li>`;
      })
      .join("");

    document.body.appendChild(menu);

    const rect = trigger.getBoundingClientRect();
    const menuWidth = Math.max(menu.offsetWidth, 220);
    let left = rect.right - menuWidth;
    if (left < 8) left = 8;
    if (left + menuWidth > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - menuWidth - 8);
    }
    menu.style.top = `${rect.bottom + 6}px`;
    menu.style.left = `${left}px`;
    menu.style.minWidth = `${menuWidth}px`;

    trigger.setAttribute("aria-expanded", "true");
    openMoveMenu = { trigger, menu, id };

    menu.addEventListener("click", async (e) => {
      const opt = e.target.closest(".auto-menu__option");
      if (!opt) return;
      const newSectionId = opt.dataset.sectionId;
      closeTcMoveMenu();
      if (!newSectionId || newSectionId === tc.sectionId) return;
      await moveTestCaseToSection(id, newSectionId);
    });
  }

  async function moveTestCaseToSection(id, newSectionId) {
    const tc = state.testCases.find((t) => t.id === id);
    if (!tc || tc.sectionId === newSectionId) return;
    const payload = {
      sectionId: newSectionId,
      title: tc.title,
      module: tc.module,
      priority: tc.priority,
      automationStatus: tc.automationStatus,
      description: tc.description || "",
      steps: tc.steps || [],
      expectedResult: tc.expectedResult || "",
      sources: tc.sources || [],
    };
    try {
      const updated = await api(`/testcases/${encodeURIComponent(id)}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      const idx = state.testCases.findIndex((t) => t.id === id);
      if (idx !== -1) state.testCases[idx] = updated;
      const target = state.sections.find((s) => s.id === newSectionId);
      toast(
        `Moved ${id}${target ? ` → ${sectionDisplayPath(target)}` : ""}`
      );
      renderContent();
      renderSections();
    } catch (err) {
      toast("Move failed: " + err.message, true);
    }
  }

  // ---------- confirm modal ----------
  function confirmDialog({ title = "Confirm", message, confirmText = "Delete", danger = true }) {
    return new Promise((resolve) => {
      els.confirmTitle.textContent = title;
      els.confirmMessage.textContent = message;
      els.btnConfirmOk.textContent = confirmText;
      els.btnConfirmOk.classList.toggle("btn-danger", danger);
      els.btnConfirmOk.classList.toggle("btn-primary", !danger);
      openModal(els.confirmModal);

      const cleanup = () => {
        els.btnConfirmOk.removeEventListener("click", onOk);
        els.btnConfirmCancel.removeEventListener("click", onCancel);
        els.confirmModal.removeEventListener("click", onBackdrop);
        document.removeEventListener("keydown", onKey);
      };
      const finish = (v) => {
        cleanup();
        closeModal(els.confirmModal);
        resolve(v);
      };
      const onOk = () => finish(true);
      const onCancel = () => finish(false);
      const onBackdrop = (e) => {
        if (e.target === els.confirmModal) finish(false);
      };
      const onKey = (e) => {
        if (e.key === "Escape") finish(false);
        else if (e.key === "Enter") finish(true);
      };
      els.btnConfirmOk.addEventListener("click", onOk);
      els.btnConfirmCancel.addEventListener("click", onCancel);
      els.confirmModal.addEventListener("click", onBackdrop);
      document.addEventListener("keydown", onKey);
    });
  }

  // ---------- tab routing ----------
  function setTab(tab) {
    state.activeTab = tab;
    els.tabs.forEach((btn) =>
      btn.classList.toggle("is-active", btn.dataset.tab === tab)
    );
    Object.entries(els.views).forEach(([name, view]) => {
      view.classList.toggle("hidden", name !== tab);
    });
    if (tab === "dashboard") renderDashboard();
    if (tab === "documentation") loadDocs();
    if (tab === "jira") loadJira();
  }

  // ---------- loading ----------
  async function load() {
    els.loadState.classList.remove("hidden");
    try {
      const data = await api("/testcases");
      state.sections = (data.sections || []).slice().sort(
        (a, b) => (a.order ?? 0) - (b.order ?? 0)
      );
      state.testCases = data.testCases || [];
      const activeIsVirtual = state.activeSectionId === ALL_SECTION_ID;
      if (
        !activeIsVirtual &&
        !state.sections.find((s) => s.id === state.activeSectionId)
      ) {
        state.activeSectionId = state.sections[0]?.id || null;
      }
      // clear stale selections
      state.selectedTcIds = new Set(
        [...state.selectedTcIds].filter((id) =>
          state.testCases.some((t) => t.id === id)
        )
      );
      state.selectedSectionIds = new Set(
        [...state.selectedSectionIds].filter((id) =>
          state.sections.some((s) => s.id === id)
        )
      );
      renderSections();
      renderContent();
      if (state.activeTab === "dashboard") renderDashboard();
    } catch (e) {
      toast("Failed to load: " + e.message, true);
    } finally {
      els.loadState.classList.add("hidden");
    }
  }

  // ---------- sections sidebar ----------
  function renderSections() {
    els.sectionEmpty.classList.toggle("hidden", state.sections.length > 0);
    const deleteMode = state.sectionDeleteMode;
    els.sectionList.classList.toggle("is-select-mode", deleteMode);
    const ordered = orderedSections();
    // Virtual "All test cases" entry pinned to the top of the list, with the
    // protected "Undefined" catch-all rendered as its visual child.
    const allActive =
      state.activeSectionId === ALL_SECTION_ID && !deleteMode;
    const allCount = state.testCases.length;
    const allItem = `
      <li class="section-item section-item--all section-item--level-0 ${
        allActive ? "is-active" : ""
      }" data-id="${ALL_SECTION_ID}">
        <span class="section-item__name">All Test Cases</span>
        <span class="section-item__count">${allCount}</span>
      </li>`;
    els.sectionList.innerHTML = allItem + ordered
      .map(({ section: s, depth }) => {
        // Undefined lives logically at root, but it's visually nested under
        // the "All test cases" virtual entry — force its depth by one.
        if (s.id === UNDEFINED_SECTION_ID && s.parentId == null) {
          depth = Math.max(1, depth + 1);
        }
        return { section: s, depth };
      })
      .map(({ section: s, depth }) => {
        const count = sectionTotalCount(s.id);
        const active = s.id === state.activeSectionId;
        const selected = state.selectedSectionIds.has(s.id);
        const isUndefined = s.id === UNDEFINED_SECTION_ID;
        const canDelete = deleteMode && !isUndefined;
        const check = canDelete
          ? `<input type="checkbox" class="section-item__check" ${
              selected ? "checked" : ""
            } data-id="${escapeHtml(s.id)}" aria-label="Select ${escapeHtml(s.name)}" />`
          : "";
        const lvl = Math.max(0, Math.min(MAX_SECTION_DEPTH, depth));
        return `
          <li class="section-item section-item--level-${lvl} ${
          active && !deleteMode ? "is-active" : ""
        } ${selected ? "is-selected" : ""} ${
          isUndefined ? "section-item--undefined" : ""
        }" data-id="${escapeHtml(s.id)}">
            ${check}
            <span class="section-item__name" title="${escapeHtml(
              sectionDisplayPath(s)
            )}">${escapeHtml(s.name)}</span>
            <span class="section-item__count">${count}</span>
          </li>`;
      })
      .join("");

    // delete bar
    els.sectionDeleteBar.classList.toggle("hidden", !deleteMode);
    const n = state.selectedSectionIds.size;
    els.sectionDeleteCount.textContent = `${n} selected`;
    els.btnConfirmSectionDelete.disabled = n === 0;

    // rename icon enabled only when a section is active, not Undefined, not in delete mode
    const active = currentSection();
    const activeIsProtected = active?.id === UNDEFINED_SECTION_ID;
    els.btnRenameSectionIcon.disabled =
      deleteMode || !active || activeIsProtected;
    els.btnDeleteSectionIcon.classList.toggle("is-active", deleteMode);
    // Disable delete mode entry if there are no deletable sections.
    const hasDeletable = state.sections.some(
      (s) => s.id !== UNDEFINED_SECTION_ID
    );
    els.btnDeleteSectionIcon.disabled = !hasDeletable;
    els.btnAddSection.disabled = deleteMode;
  }

  // ---------- main content ----------
  function currentSection() {
    return state.sections.find((s) => s.id === state.activeSectionId) || null;
  }

  function casesInActiveSection() {
    const id = state.activeSectionId;
    if (!id) return [];
    if (id === ALL_SECTION_ID) return state.testCases.slice();
    const ids = new Set([id, ...descendantIds(id)]);
    return state.testCases.filter((t) => ids.has(t.sectionId));
  }

  function filteredCases() {
    const q = state.search.trim().toLowerCase();
    return casesInActiveSection()
      .filter(
        (t) =>
          !q ||
          t.id.toLowerCase().includes(q) ||
          t.title.toLowerCase().includes(q)
      )
      .slice()
      .sort(compareCases);
  }

  function renderContent() {
    const section = currentSection();
    const isAllView = state.activeSectionId === ALL_SECTION_ID;

    const noSection = !section && !isAllView;
    // With the Undefined catch-all section we almost always have at least one
    // section, so allow adding test cases whenever any section exists.
    els.btnAddTc.disabled = state.sections.length === 0;
    els.noSectionState.classList.toggle("hidden", !noSection);

    if (noSection) {
      els.sectionTitle.textContent = state.sections.length
        ? "Select a section"
        : "No sections yet";
      els.sectionMeta.textContent = "";
      els.tcBody.innerHTML = "";
      els.emptyState.classList.add("hidden");
      renderBulkBar();
      return;
    }

    els.sectionTitle.textContent = isAllView ? "All Test Cases" : section.name;
    const rows = filteredCases();
    const total = casesInActiveSection().length;
    els.sectionMeta.textContent = `${rows.length} of ${total} test case${total === 1 ? "" : "s"}`;

    els.emptyState.classList.toggle("hidden", rows.length > 0);
    els.tcBody.innerHTML = rows
      .map((tc) => {
        const selected = state.selectedTcIds.has(tc.id);
        return `
        <tr data-id="${escapeHtml(tc.id)}" class="${selected ? "is-selected" : ""}">
          <td class="col-check">
            <input type="checkbox" class="tc-check" data-id="${escapeHtml(tc.id)}" ${selected ? "checked" : ""} aria-label="Select ${escapeHtml(tc.id)}" />
          </td>
          <td class="mono">${escapeHtml(tc.id)}</td>
          <td class="cell-title">${escapeHtml(tc.title)}</td>
          <td><span class="chip chip-module">${escapeHtml(tc.module)}</span></td>
          <td><span class="chip pri pri-${slug(tc.priority)}">${escapeHtml(tc.priority)}</span></td>
          <td class="col-auto">
            <button type="button"
              class="auto-trigger auto-${slug(tc.automationStatus)}"
              data-id="${escapeHtml(tc.id)}"
              aria-haspopup="listbox"
              aria-expanded="false"
              aria-label="Automation status for ${escapeHtml(tc.id)}">
              <span class="auto-trigger__label">${escapeHtml(tc.automationStatus)}</span>
              <svg class="auto-trigger__caret" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4.5l4 4 4-4"/></svg>
            </button>
          </td>
          <td class="col-actions">
            <div class="action-group">
              ${
                state.features.automationUrl
                  ? `<a class="btn-icon btn-icon--sm btn-icon--automation" href="${escapeHtml(
                      automationUrlFor(tc.id)
                    )}" target="_blank" rel="noopener" title="Run on GitHub Actions" aria-label="Run automation for ${escapeHtml(
                      tc.id
                    )}">${ICONS.bolt}</a>`
                  : ""
              }
              <button class="btn-icon btn-icon--sm" data-action="move" data-id="${escapeHtml(tc.id)}" title="Move to section" aria-label="Move ${escapeHtml(tc.id)} to section" aria-haspopup="listbox" aria-expanded="false">${ICONS.move}</button>
              <button class="btn-icon btn-icon--sm" data-action="edit" data-id="${escapeHtml(tc.id)}" title="Edit" aria-label="Edit ${escapeHtml(tc.id)}">${ICONS.edit}</button>
              <button class="btn-icon btn-icon--sm btn-icon--danger" data-action="delete" data-id="${escapeHtml(tc.id)}" title="Delete" aria-label="Delete ${escapeHtml(tc.id)}">${ICONS.trash}</button>
            </div>
          </td>
        </tr>`;
      })
      .join("");

    renderBulkBar();
  }

  function renderBulkBar() {
    const visibleIds = filteredCases().map((t) => t.id);
    const selectedVisible = visibleIds.filter((id) => state.selectedTcIds.has(id));
    const n = state.selectedTcIds.size;
    els.tcBulkBar.classList.toggle("hidden", n === 0);
    els.tcBulkCount.textContent = `${n} selected`;
    if (els.tcSelectAll) {
      els.tcSelectAll.checked =
        visibleIds.length > 0 && selectedVisible.length === visibleIds.length;
      els.tcSelectAll.indeterminate =
        selectedVisible.length > 0 && selectedVisible.length < visibleIds.length;
    }
  }

  // ---------- dashboard ----------
  function renderDashboard() {
    const cases = state.testCases;
    const total = cases.length;
    const done = cases.filter((t) => t.automationStatus === "Done").length;
    const inProgress = cases.filter(
      (t) => t.automationStatus === "In Progress"
    ).length;
    const notStarted = total - done - inProgress;
    const pct = total ? Math.round((done / total) * 100) : 0;

    // Ring: circumference = 2*pi*52 ≈ 326.7
    const C = 2 * Math.PI * 52;
    els.ringFg.style.strokeDashoffset = String(C - (pct / 100) * C);
    els.ringPct.textContent = `${pct}%`;

    els.overallLegend.innerHTML = [
      { label: "Done", color: "#22c55e", value: done },
      { label: "In Progress", color: "#f59e0b", value: inProgress },
      { label: "Not Started", color: "#94a3b8", value: notStarted },
    ]
      .map(
        (it) => `
        <li>
          <span class="legend__label">
            <span class="legend__swatch" style="background:${it.color}"></span>
            ${it.label}
          </span>
          <span class="legend__value">${it.value}</span>
        </li>`
      )
      .join("");

    // Per-module
    const byModule = new Map();
    cases.forEach((t) => {
      const m = t.module || "Other";
      if (!byModule.has(m))
        byModule.set(m, { name: m, total: 0, done: 0, inProgress: 0, notStarted: 0 });
      const row = byModule.get(m);
      row.total++;
      if (t.automationStatus === "Done") row.done++;
      else if (t.automationStatus === "In Progress") row.inProgress++;
      else row.notStarted++;
    });

    const rows = [...byModule.values()].sort((a, b) => b.total - a.total);
    els.moduleChartEmpty.classList.toggle("hidden", rows.length > 0);
    els.moduleChart.innerHTML = rows
      .map((r) => {
        const donePct = r.total ? (r.done / r.total) * 100 : 0;
        const progPct = r.total ? (r.inProgress / r.total) * 100 : 0;
        const notPct = r.total ? (r.notStarted / r.total) * 100 : 0;
        const coverage = Math.round(donePct);
        return `
          <div class="chart__row">
            <div class="chart__head">
              <span class="chart__name">${escapeHtml(r.name)}</span>
              <span class="chart__meta">${coverage}% &middot; ${r.done}/${r.total}</span>
            </div>
            <div class="chart__track" title="${r.done} done, ${r.inProgress} in progress, ${r.notStarted} not started">
              <div class="chart__seg chart__seg--done" style="width:${donePct}%"></div>
              <div class="chart__seg chart__seg--progress" style="width:${progPct}%"></div>
              <div class="chart__seg chart__seg--notstarted" style="width:${notPct}%"></div>
            </div>
          </div>`;
      })
      .join("");
  }

  // ---------- modal helpers ----------
  function openModal(modal) {
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
  }
  function closeModal(modal) {
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
  }

  // ---------- section modal ----------
  // Populate the "Parent section" picker with candidates that are valid at the
  // requested level (0 = main, 1 = sub, 2 = sub-of-sub). When editing, we also
  // exclude the section being edited and its descendants to prevent cycles.
  function refreshSectionParentPicker(level, editingId) {
    const lvl = Number(level) || 0;
    const show = lvl > 0;
    els.sectionParentLabel.classList.toggle("hidden", !show);
    if (!show) return;
    const targetParentDepth = lvl - 1;
    const excluded = editingId
      ? new Set([editingId, ...descendantIds(editingId)])
      : new Set();
    const byId = sectionsById();
    const candidates = state.sections.filter((s) => {
      if (excluded.has(s.id)) return false;
      return sectionDepth(s, byId) === targetParentDepth;
    });
    candidates.sort((a, b) =>
      sectionDisplayPath(a).localeCompare(sectionDisplayPath(b))
    );
    if (!candidates.length) {
      els.sectionParent.innerHTML = `<option value="" disabled selected>No ${
        targetParentDepth === 0 ? "main" : "sub"
      }-section available — create one first</option>`;
      return;
    }
    els.sectionParent.innerHTML = candidates
      .map(
        (s) =>
          `<option value="${escapeHtml(s.id)}">${escapeHtml(
            sectionDisplayPath(s)
          )}</option>`
      )
      .join("");
  }

  function openAddSection() {
    els.sectionForm.reset();
    els.sectionForm.id.value = "";
    els.sectionLevel.value = "0";
    els.sectionModalTitle.textContent = "Add Section";
    // If the active section is a main/sub section, default to creating a
    // child of it for quicker nesting workflows.
    const active = currentSection();
    if (active && active.id !== UNDEFINED_SECTION_ID) {
      const depth = sectionDepth(active);
      if (depth < MAX_SECTION_DEPTH) {
        els.sectionLevel.value = String(depth + 1);
      }
    }
    refreshSectionParentPicker(els.sectionLevel.value, null);
    if (active && els.sectionLevel.value !== "0") {
      const targetDepth = Number(els.sectionLevel.value) - 1;
      if (sectionDepth(active) === targetDepth) {
        els.sectionParent.value = active.id;
      }
    }
    openModal(els.sectionModal);
    setTimeout(() => els.sectionForm.name.focus(), 20);
  }

  function openRenameSection() {
    const s = currentSection();
    if (!s) return;
    if (s.id === UNDEFINED_SECTION_ID) return;
    els.sectionForm.reset();
    els.sectionForm.id.value = s.id;
    els.sectionForm.name.value = s.name;
    const depth = sectionDepth(s);
    els.sectionLevel.value = String(depth);
    els.sectionModalTitle.textContent = "Edit Section";
    refreshSectionParentPicker(els.sectionLevel.value, s.id);
    if (s.parentId) els.sectionParent.value = s.parentId;
    openModal(els.sectionModal);
    setTimeout(() => els.sectionForm.name.select(), 20);
  }

  async function onSectionSubmit(e) {
    e.preventDefault();
    const id = els.sectionForm.id.value;
    const name = els.sectionForm.name.value.trim();
    if (!name) return;
    const level = Number(els.sectionLevel.value) || 0;
    let parentId = null;
    if (level > 0) {
      parentId = els.sectionParent.value || "";
      if (!parentId) {
        toast(
          `Pick a parent ${
            level === 1 ? "main section" : "sub-section"
          } first, or create one.`,
          true
        );
        return;
      }
    }
    els.btnSaveSection.disabled = true;
    els.btnSaveSection.textContent = "Saving...";
    try {
      if (id) {
        await api(`/sections/${encodeURIComponent(id)}`, {
          method: "PUT",
          body: JSON.stringify({ name, parentId }),
        });
        toast(`Saved "${name}"`);
      } else {
        const created = await api(`/sections`, {
          method: "POST",
          body: JSON.stringify({ name, parentId }),
        });
        state.activeSectionId = created.id;
        toast(`Created section "${created.name}"`);
      }
      closeModal(els.sectionModal);
      await load();
    } catch (err) {
      toast("Save failed: " + err.message, true);
    } finally {
      els.btnSaveSection.disabled = false;
      els.btnSaveSection.textContent = "Save";
    }
  }

  // ---------- section delete mode ----------
  function toggleSectionDeleteMode(force) {
    const next = typeof force === "boolean" ? force : !state.sectionDeleteMode;
    state.sectionDeleteMode = next;
    if (!next) state.selectedSectionIds.clear();
    renderSections();
  }

  async function onConfirmSectionDelete() {
    const ids = [...state.selectedSectionIds];
    if (!ids.length) return;
    const names = state.sections
      .filter((s) => ids.includes(s.id))
      .map((s) => s.name);
    // Count affected test cases including descendants of the selected sections.
    const affectedSectionIds = new Set();
    for (const id of ids) {
      affectedSectionIds.add(id);
      descendantIds(id).forEach((d) => affectedSectionIds.add(d));
    }
    const tcCount = state.testCases.filter((t) =>
      affectedSectionIds.has(t.sectionId)
    ).length;
    const label =
      ids.length === 1
        ? `section "${names[0]}"`
        : `${ids.length} sections (${names.slice(0, 3).join(", ")}${
            names.length > 3 ? ", …" : ""
          })`;
    const msg = tcCount
      ? `Delete ${label}? ${tcCount} test case${
          tcCount === 1 ? "" : "s"
        } inside will move to the Undefined section.`
      : `Delete ${label}? This cannot be undone.`;
    const ok = await confirmDialog({
      title: ids.length === 1 ? "Delete Section" : "Delete Sections",
      message: msg,
      confirmText: "Delete",
    });
    if (!ok) return;
    els.btnConfirmSectionDelete.disabled = true;
    try {
      for (const id of ids) {
        await api(`/sections/${encodeURIComponent(id)}`, { method: "DELETE" });
      }
      if (ids.includes(state.activeSectionId)) state.activeSectionId = null;
      toast(`Deleted ${ids.length} section${ids.length === 1 ? "" : "s"}`);
      toggleSectionDeleteMode(false);
      await load();
    } catch (err) {
      toast("Delete failed: " + err.message, true);
    } finally {
      els.btnConfirmSectionDelete.disabled = false;
    }
  }

  // ---------- test case modal ----------
  function setTcSectionPickerVisible(visible, selectedId) {
    els.tcSectionPickerLabel.classList.toggle("hidden", !visible);
    if (!visible) return;
    els.tcSectionPicker.innerHTML = state.sections
      .map(
        (s) =>
          `<option value="${escapeHtml(s.id)}" ${
            s.id === selectedId ? "selected" : ""
          }>${escapeHtml(s.name)}</option>`
      )
      .join("");
  }

  function openAddTc() {
    const section =
      currentSection() ||
      state.sections.find((s) => s.id === UNDEFINED_SECTION_ID) ||
      state.sections[0];
    if (!section) return;
    els.tcForm.reset();
    els.tcForm.id.value = "";
    els.tcForm.sectionId.value = section.id;
    const isAllView = state.activeSectionId === ALL_SECTION_ID;
    els.tcModalTitle.textContent = isAllView
      ? "Add Test Case"
      : `Add Test Case — ${section.name}`;
    els.btnDeleteTc.classList.add("hidden");
    // Let the user pick a section explicitly from the "All test cases" view.
    setTcSectionPickerVisible(isAllView, section.id);
    openModal(els.tcModal);
    setTimeout(() => els.tcForm.title.focus(), 20);
  }

  function openEditTc(tc) {
    els.tcForm.reset();
    els.tcForm.id.value = tc.id;
    els.tcForm.sectionId.value = tc.sectionId;
    els.tcForm.title.value = tc.title;
    els.tcForm.module.value = tc.module;
    els.tcForm.priority.value = tc.priority;
    els.tcForm.automationStatus.value = tc.automationStatus;
    els.tcForm.description.value = tc.description || "";
    els.tcForm.sources.value = (tc.sources || [])
      .map((s) => jiraKeyToUrl(s) || s)
      .join(", ");
    els.tcForm.steps.value = (tc.steps || []).join("\n");
    els.tcForm.expectedResult.value = tc.expectedResult || "";
    els.tcModalTitle.textContent = `Edit ${tc.id}`;
    els.btnDeleteTc.classList.remove("hidden");
    setTcSectionPickerVisible(false);
    openModal(els.tcModal);
    setTimeout(() => els.tcForm.title.focus(), 20);
  }

  async function onTcSubmit(e) {
    e.preventDefault();
    const fd = new FormData(els.tcForm);
    const pickerVisible = !els.tcSectionPickerLabel.classList.contains("hidden");
    const sectionId = pickerVisible
      ? els.tcSectionPicker.value
      : fd.get("sectionId");
    const sources = Array.from(
      new Set(
        String(fd.get("sources") || "")
          .split(/[\s,]+/)
          .map((s) => extractJiraKey(s))
          .filter(Boolean)
      )
    );
    const payload = {
      sectionId,
      title: fd.get("title").trim(),
      module: fd.get("module"),
      priority: fd.get("priority"),
      automationStatus: fd.get("automationStatus"),
      description: fd.get("description").trim(),
      steps: fd
        .get("steps")
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      expectedResult: fd.get("expectedResult").trim(),
      sources,
    };
    const id = fd.get("id");
    els.btnSaveTc.disabled = true;
    els.btnSaveTc.textContent = "Saving...";
    try {
      if (id) {
        await api(`/testcases/${encodeURIComponent(id)}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        toast(`Updated ${id}`);
      } else {
        const created = await api(`/testcases`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast(`Created ${created.id}`);
      }
      closeModal(els.tcModal);
      await load();
      if (state.jira.loaded) renderJiraContent();
    } catch (err) {
      toast("Save failed: " + err.message, true);
    } finally {
      els.btnSaveTc.disabled = false;
      els.btnSaveTc.textContent = "Save";
    }
  }

  async function deleteTestCases(ids) {
    if (!ids.length) return;
    const label =
      ids.length === 1
        ? ids[0]
        : `${ids.length} test cases`;
    const ok = await confirmDialog({
      title: ids.length === 1 ? "Delete Test Case" : "Delete Test Cases",
      message: `Delete ${label}? This cannot be undone.`,
      confirmText: "Delete",
    });
    if (!ok) return;
    try {
      for (const id of ids) {
        await api(`/testcases/${encodeURIComponent(id)}`, { method: "DELETE" });
      }
      ids.forEach((id) => state.selectedTcIds.delete(id));
      toast(`Deleted ${ids.length} test case${ids.length === 1 ? "" : "s"}`);
      await load();
    } catch (err) {
      toast("Delete failed: " + err.message, true);
    }
  }

  function setTriggerStatus(trigger, status) {
    if (!trigger) return;
    trigger.classList.remove(
      "auto-not-started",
      "auto-in-progress",
      "auto-done"
    );
    trigger.classList.add(`auto-${slug(status)}`);
    const label = trigger.querySelector(".auto-trigger__label");
    if (label) label.textContent = status;
  }

  async function updateAutomationStatus(id, newStatus) {
    const tc = state.testCases.find((t) => t.id === id);
    if (!tc || tc.automationStatus === newStatus) return;
    const prev = tc.automationStatus;
    const trigger = els.tcBody.querySelector(
      `.auto-trigger[data-id="${CSS.escape(id)}"]`
    );
    setTriggerStatus(trigger, newStatus);
    const payload = {
      sectionId: tc.sectionId,
      title: tc.title,
      module: tc.module,
      priority: tc.priority,
      automationStatus: newStatus,
      description: tc.description || "",
      steps: tc.steps || [],
      expectedResult: tc.expectedResult || "",
      sources: tc.sources || [],
    };
    try {
      const updated = await api(`/testcases/${encodeURIComponent(id)}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      const idx = state.testCases.findIndex((t) => t.id === id);
      if (idx !== -1) state.testCases[idx] = updated;
      toast(`Updated ${id} → ${newStatus}`);
      if (state.activeTab === "dashboard") renderDashboard();
    } catch (err) {
      toast("Update failed: " + err.message, true);
      setTriggerStatus(trigger, prev);
    }
  }

  async function onDeleteTcFromModal() {
    const id = els.tcForm.id.value;
    if (!id) return;
    const ok = await confirmDialog({
      title: "Delete Test Case",
      message: `Delete ${id}? This cannot be undone.`,
      confirmText: "Delete",
    });
    if (!ok) return;
    try {
      await api(`/testcases/${encodeURIComponent(id)}`, { method: "DELETE" });
      state.selectedTcIds.delete(id);
      toast(`Deleted ${id}`);
      closeModal(els.tcModal);
      await load();
    } catch (err) {
      toast("Delete failed: " + err.message, true);
    }
  }

  // ---------- AI / JIRA flow ----------
  function setExtractLoading(loading) {
    els.btnJiraExtractSubmit.disabled = loading;
    els.btnJiraExtractSubmit.classList.toggle("is-loading", loading);
    const label = els.btnJiraExtractSubmit.querySelector(".ai-btn-label");
    const spinner = els.btnJiraExtractSubmit.querySelector(".ai-spinner");
    if (label) label.textContent = loading ? "Extracting..." : "Extract";
    if (spinner) spinner.classList.toggle("hidden", !loading);
  }

  function openPrefilledTcModalFromTickets(draft, issues) {
    if (!state.sections.length) {
      toast(
        "Create a Test Case section first (on the Test Cases tab)",
        true
      );
      return;
    }
    const firstSection = state.sections[0];
    els.tcForm.reset();
    els.tcForm.id.value = "";
    els.tcForm.sectionId.value = firstSection.id;
    els.tcForm.title.value = draft.title || "";
    els.tcForm.module.value = draft.module || "Project";
    els.tcForm.priority.value = draft.priority || "High";
    els.tcForm.automationStatus.value = draft.automationStatus || "Not Started";
    const keys = (issues || []).map((i) => i.key).filter(Boolean);
    const urls = (issues || []).map((i) => i.url).filter(Boolean);
    els.tcForm.description.value = draft.description || "";
    els.tcForm.sources.value = (urls.length ? urls : keys).join(", ");
    els.tcForm.steps.value = (draft.steps || []).join("\n");
    els.tcForm.expectedResult.value = draft.expectedResult || "";
    const label =
      keys.length === 1
        ? `Draft from ${keys[0]}`
        : `Draft from ${keys.length} tickets`;
    els.tcModalTitle.textContent = label;
    els.btnDeleteTc.classList.add("hidden");
    setTcSectionPickerVisible(true, firstSection.id);
    openModal(els.tcModal);
    setTimeout(() => els.tcForm.title.focus(), 20);
  }

  // ---------- event wiring ----------
  els.tabs.forEach((btn) =>
    btn.addEventListener("click", () => setTab(btn.dataset.tab))
  );

  els.sectionList.addEventListener("click", (e) => {
    const checkbox = e.target.closest(".section-item__check");
    if (checkbox) {
      const id = checkbox.dataset.id;
      if (id === UNDEFINED_SECTION_ID || id === ALL_SECTION_ID) return;
      if (checkbox.checked) state.selectedSectionIds.add(id);
      else state.selectedSectionIds.delete(id);
      renderSections();
      return;
    }
    const li = e.target.closest(".section-item");
    if (!li) return;
    const liId = li.dataset.id;
    if (state.sectionDeleteMode) {
      if (liId === UNDEFINED_SECTION_ID || liId === ALL_SECTION_ID) return;
      if (state.selectedSectionIds.has(liId)) state.selectedSectionIds.delete(liId);
      else state.selectedSectionIds.add(liId);
      renderSections();
      return;
    }
    state.activeSectionId = liId;
    state.selectedTcIds.clear();
    renderSections();
    renderContent();
  });

  els.btnAddSection.addEventListener("click", openAddSection);
  els.btnRenameSectionIcon.addEventListener("click", openRenameSection);
  els.btnDeleteSectionIcon.addEventListener("click", () => toggleSectionDeleteMode());
  els.btnCancelSectionDelete.addEventListener("click", () => toggleSectionDeleteMode(false));
  els.btnConfirmSectionDelete.addEventListener("click", onConfirmSectionDelete);
  els.sectionForm.addEventListener("submit", onSectionSubmit);
  els.sectionLevel.addEventListener("change", () => {
    refreshSectionParentPicker(
      els.sectionLevel.value,
      els.sectionForm.id.value || null
    );
  });

  els.btnAddTc.addEventListener("click", openAddTc);
  els.tcForm.addEventListener("submit", onTcSubmit);
  els.btnDeleteTc.addEventListener("click", onDeleteTcFromModal);

  // TC row actions + checkboxes
  els.tcBody.addEventListener("click", (e) => {
    const check = e.target.closest(".tc-check");
    if (check) {
      const id = check.dataset.id;
      if (check.checked) state.selectedTcIds.add(id);
      else state.selectedTcIds.delete(id);
      const row = check.closest("tr");
      if (row) row.classList.toggle("is-selected", check.checked);
      renderBulkBar();
      return;
    }
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.dataset.action === "edit") {
      const tc = state.testCases.find((t) => t.id === id);
      if (tc) openEditTc(tc);
    } else if (btn.dataset.action === "delete") {
      deleteTestCases([id]);
    } else if (btn.dataset.action === "move") {
      e.stopPropagation();
      toggleTcMoveMenu(btn);
    }
  });

  // Inline automation-status dropdown trigger
  els.tcBody.addEventListener("click", (e) => {
    const trigger = e.target.closest(".auto-trigger");
    if (!trigger) return;
    e.stopPropagation();
    toggleAutoMenu(trigger);
  });

  // Close the custom dropdown on outside click / Escape / scroll / resize
  document.addEventListener("click", (e) => {
    if (!openAutoMenu) return;
    if (
      openAutoMenu.menu.contains(e.target) ||
      openAutoMenu.trigger.contains(e.target)
    )
      return;
    closeAutoMenu();
  });
  document.addEventListener("click", (e) => {
    if (!openMoveMenu) return;
    if (
      openMoveMenu.menu.contains(e.target) ||
      openMoveMenu.trigger.contains(e.target)
    )
      return;
    closeTcMoveMenu();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (openAutoMenu) closeAutoMenu();
      if (openMoveMenu) closeTcMoveMenu();
    }
  });
  window.addEventListener("scroll", closeAutoMenu, true);
  window.addEventListener("resize", closeAutoMenu);
  window.addEventListener("scroll", closeTcMoveMenu, true);
  window.addEventListener("resize", closeTcMoveMenu);

  // Select all (visible/filtered)
  els.tcSelectAll.addEventListener("change", () => {
    const visibleIds = filteredCases().map((t) => t.id);
    if (els.tcSelectAll.checked) {
      visibleIds.forEach((id) => state.selectedTcIds.add(id));
    } else {
      visibleIds.forEach((id) => state.selectedTcIds.delete(id));
    }
    renderContent();
  });

  els.btnClearTcSelection.addEventListener("click", () => {
    state.selectedTcIds.clear();
    renderContent();
  });
  els.btnBulkDeleteTc.addEventListener("click", () => {
    deleteTestCases([...state.selectedTcIds]);
  });

  els.search.addEventListener("input", (e) => {
    state.search = e.target.value;
    renderContent();
  });

  // close modal on backdrop or Cancel / Escape (skip confirm modal — handled by dialog)
  document.addEventListener("click", (e) => {
    if (e.target.matches("[data-close-modal]")) {
      const m = e.target.closest(".modal");
      if (m && m.id !== "confirmModal") closeModal(m);
    } else if (e.target.classList.contains("modal") && e.target.id !== "confirmModal") {
      closeModal(e.target);
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      document
        .querySelectorAll(".modal:not(.hidden)")
        .forEach((m) => {
          if (m.id !== "confirmModal") closeModal(m);
        });
    }
  });

  // ==========================================================================
  // Documentation
  // ==========================================================================
  function currentDocSection() {
    return state.docs.sections.find((s) => s.id === state.docs.activeId) || null;
  }

  function setDocSaveStatus(kind) {
    const map = {
      idle: { text: "", cls: "" },
      dirty: { text: "Unsaved changes", cls: "is-dirty" },
      saving: { text: "Saving…", cls: "is-dirty" },
      saved: { text: "Saved", cls: "is-saved" },
      error: { text: "Save failed", cls: "is-dirty" },
    };
    const { text, cls } = map[kind] || map.idle;
    els.docSaveStatus.textContent = text;
    els.docSaveStatus.classList.remove("is-dirty", "is-saved");
    if (cls) els.docSaveStatus.classList.add(cls);
  }

  async function loadDocs() {
    if (state.docs.loading) return;
    state.docs.loading = true;
    try {
      const data = await api("/docs");
      state.docs.sections = (data.sections || [])
        .slice()
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      state.docs.loaded = true;
      // keep active id if still present, otherwise pick first
      if (!state.docs.sections.find((s) => s.id === state.docs.activeId)) {
        state.docs.activeId = state.docs.sections[0]?.id || null;
      }
      renderDocSections();
      renderDocContent();
    } catch (e) {
      toast("Failed to load documentation: " + e.message, true);
    } finally {
      state.docs.loading = false;
    }
  }

  function sortedDocSections() {
    return state.docs.sections
      .slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  function docSectionIds() {
    return new Set(state.docs.sections.map((s) => s.id));
  }

  function topLevelDocSections() {
    const ids = docSectionIds();
    // Treat orphan sub pages (parent was deleted) as top-level for rendering.
    return sortedDocSections().filter(
      (s) => !s.parentId || !ids.has(s.parentId)
    );
  }

  function childDocSections(parentId) {
    return sortedDocSections().filter((s) => s.parentId === parentId);
  }

  function renderDocSectionItem(s, isChild) {
    const active = s.id === state.docs.activeId;
    const draftBadge = s.isDraft
      ? `<span class="section-item__badge" title="Draft — click × to remove the tag">
           <span>Draft</span>
           <button
             type="button"
             class="section-item__badge-clear"
             data-action="clear-draft"
             data-id="${escapeHtml(s.id)}"
             aria-label="Remove draft tag"
             title="Remove draft tag"
           >×</button>
         </span>`
      : "";
    const classes = [
      "section-item",
      "section-item--doc",
      isChild ? "section-item--doc-sub" : "",
      active ? "is-active" : "",
    ]
      .filter(Boolean)
      .join(" ");
    return `
      <li
        class="${classes}"
        data-id="${escapeHtml(s.id)}"
        data-parent-id="${escapeHtml(s.parentId || "")}"
        draggable="true"
      >
        <span class="section-item__name">${escapeHtml(s.name)}</span>
        ${draftBadge}
      </li>`;
  }

  function renderDocSections() {
    const hasSections = state.docs.sections.length > 0;
    els.docSectionEmpty.classList.toggle("hidden", hasSections);
    els.docSectionList.innerHTML = topLevelDocSections()
      .map((parent) => {
        const children = childDocSections(parent.id);
        const childItems = children
          .map((c) => renderDocSectionItem(c, true))
          .join("");
        return renderDocSectionItem(parent, false) + childItems;
      })
      .join("");

    const hasActive = !!currentDocSection();
    els.btnRenameDocSection.disabled = !hasActive;
    els.btnDeleteDocSection.disabled = !hasActive;
  }

  function renderDocContent() {
    const s = currentDocSection();
    if (!s) {
      els.docSectionTitle.textContent = state.docs.sections.length
        ? "Select a section"
        : "No sections yet";
      els.docSectionMeta.textContent = "";
      els.docEditorWrap.classList.add("hidden");
      els.docViewer.classList.add("hidden");
      els.docEmptyState.classList.remove("hidden");
      state.docs.editing = false;
      updateDocModeChrome();
      return;
    }
    els.docSectionTitle.textContent = s.name;
    els.docSectionMeta.textContent = s.updatedAt
      ? `Last updated ${new Date(s.updatedAt).toLocaleString()}`
      : "";
    els.docEmptyState.classList.add("hidden");

    // Always refresh the viewer when switching sections
    if (els.docViewer.dataset.loadedId !== s.id) {
      els.docViewer.innerHTML = s.content || "";
      els.docViewer.dataset.loadedId = s.id;
    }

    // Refresh the editor only when switching sections (avoids clobbering edits)
    if (els.docEditor.dataset.loadedId !== s.id) {
      els.docEditor.innerHTML = s.content || "";
      els.docEditor.dataset.loadedId = s.id;
      state.docs.originalContent = s.content || "";
      state.docs.dirty = false;
      setDocSaveStatus("idle");
    }

    applyDocMode();
    updateToolbarState();
  }

  function applyDocMode() {
    if (state.docs.editing) {
      els.docViewer.classList.add("hidden");
      els.docEditorWrap.classList.remove("hidden");
    } else {
      els.docEditorWrap.classList.add("hidden");
      els.docViewer.classList.remove("hidden");
    }
    updateDocModeChrome();
    renderDocSections();
  }

  function updateDocModeChrome() {
    const hasSection = !!currentDocSection();
    const editing = state.docs.editing && hasSection;
    els.btnEditDoc.classList.toggle("hidden", editing);
    els.btnEditDoc.disabled = !hasSection;
    els.btnCancelDoc.classList.toggle("hidden", !editing);
    els.btnSaveDoc.classList.toggle("hidden", !editing);
    // Save button is disabled unless dirty
    els.btnSaveDoc.disabled = !state.docs.dirty;
    // Save status is only meaningful while editing
    if (!editing) setDocSaveStatus("idle");
  }

  function enterDocEditMode() {
    const s = currentDocSection();
    if (!s) return;
    state.docs.editing = true;
    state.docs.originalContent = s.content || "";
    // Make sure the editor has the latest content
    els.docEditor.innerHTML = s.content || "";
    els.docEditor.dataset.loadedId = s.id;
    state.docs.dirty = false;
    applyDocMode();
    setDocSaveStatus("idle");
    setTimeout(() => {
      els.docEditor.focus();
      updateToolbarState();
      updateDocContextToolbar();
    }, 20);
  }

  function exitDocEditMode() {
    state.docs.editing = false;
    // Sync viewer with the latest saved section content
    const s = currentDocSection();
    if (s) {
      els.docViewer.innerHTML = s.content || "";
      els.docViewer.dataset.loadedId = s.id;
    }
    applyDocMode();
  }

  async function cancelDocEdit() {
    if (state.docs.dirty) {
      const ok = await confirmDialog({
        title: "Discard changes?",
        message: "Your unsaved changes will be lost.",
        confirmText: "Discard",
      });
      if (!ok) return;
    }
    // Cancel pending autosave
    clearTimeout(state.docs.saveTimer);
    // Revert editor to original
    els.docEditor.innerHTML = state.docs.originalContent || "";
    state.docs.dirty = false;
    exitDocEditMode();
  }

  // ---------- Editor: toolbar wiring ----------
  function execCmd(cmd, value = null) {
    els.docEditor.focus();
    try {
      document.execCommand(cmd, false, value);
    } catch (_) {
      /* no-op */
    }
    markDocDirty();
    updateToolbarState();
  }

  function wrapSelectionWith(tag) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (range.collapsed) return;
    const el = document.createElement(tag);
    try {
      el.appendChild(range.extractContents());
      range.insertNode(el);
      // Reselect inserted node
      range.selectNodeContents(el);
      sel.removeAllRanges();
      sel.addRange(range);
    } catch (_) {
      /* no-op */
    }
    markDocDirty();
  }

  function applyBlockStyle(tag) {
    // Make sure the caret is back inside the editor (the <select> stole focus)
    restoreEditorSelection();
    // Firefox requires the tag in angle-bracket form; Chrome accepts either.
    const value = `<${String(tag).toUpperCase()}>`;
    try {
      document.execCommand("formatBlock", false, value);
    } catch (_) {
      /* no-op */
    }
    markDocDirty();
    // Defer so the DOM update from execCommand has settled
    setTimeout(updateToolbarState, 0);
  }

  function updateToolbarState() {
    const cmds = ["bold", "italic", "underline", "strikeThrough"];
    document.querySelectorAll(".doc-btn[data-cmd]").forEach((btn) => {
      const cmd = btn.dataset.cmd;
      if (!cmds.includes(cmd)) return;
      try {
        btn.classList.toggle("is-active", document.queryCommandState(cmd));
      } catch (_) {
        /* some browsers throw when editor isn't focused */
      }
    });
    // Block-style select
    try {
      const block = (document.queryCommandValue("formatBlock") || "")
        .toLowerCase()
        .replace(/[<>]/g, "");
      const allowed = ["p", "h1", "h2", "h3", "blockquote", "pre"];
      els.docBlockStyle.value = allowed.includes(block) ? block : "p";
    } catch (_) {
      /* no-op */
    }
  }

  function markDocDirty() {
    if (!state.docs.editing) return;
    state.docs.dirty = true;
    els.btnSaveDoc.disabled = false;
    setDocSaveStatus("dirty");
  }

  async function saveActiveDoc(isAuto = false) {
    const s = currentDocSection();
    if (!s) return;
    if (!state.docs.dirty && isAuto) return;
    if (state.docs.saving) return;
    const content = els.docEditor.innerHTML;
    state.docs.saving = true;
    setDocSaveStatus("saving");
    els.btnSaveDoc.disabled = true;
    try {
      const updated = await api(
        `/docs/sections/${encodeURIComponent(s.id)}`,
        {
          method: "PUT",
          body: JSON.stringify({ content }),
        }
      );
      const idx = state.docs.sections.findIndex((x) => x.id === s.id);
      if (idx !== -1) state.docs.sections[idx] = updated;
      state.docs.dirty = false;
      state.docs.originalContent = updated.content || "";
      setDocSaveStatus("saved");
      els.docSectionMeta.textContent = updated.updatedAt
        ? `Last updated ${new Date(updated.updatedAt).toLocaleString()}`
        : "";
      // Explicit save returns to view mode
      if (!isAuto) {
        toast("Saved");
        exitDocEditMode();
      }
    } catch (err) {
      setDocSaveStatus("error");
      els.btnSaveDoc.disabled = false;
      toast("Save failed: " + err.message, true);
    } finally {
      state.docs.saving = false;
    }
  }

  // ---------- Doc section modal ----------
  function populateDocSectionParentPicker(excludeId = "") {
    const options = topLevelDocSections()
      .filter((s) => s.id !== excludeId)
      .map(
        (s) =>
          `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)}</option>`
      )
      .join("");
    els.docSectionParent.innerHTML =
      options || `<option value="" disabled>No main pages available</option>`;
  }

  function setDocSectionModalMode({ editingId = "", defaultType = "main" } = {}) {
    const renaming = Boolean(editingId);
    const typeRadios = els.docSectionForm.querySelectorAll(
      "input[name='type']"
    );
    typeRadios.forEach((r) => {
      r.checked = r.value === defaultType;
      // Reparenting existing sections goes through drag-and-drop; keep the
      // rename modal focused on the name.
      r.disabled = renaming;
    });
    els.docSectionTypeFieldset.classList.toggle("hidden", renaming);
    syncParentVisibility();
  }

  function syncParentVisibility() {
    const typeInput = els.docSectionForm.querySelector(
      "input[name='type']:checked"
    );
    const isSub = typeInput?.value === "sub";
    const noMains = topLevelDocSections().length === 0;
    els.docSectionParentLabel.classList.toggle(
      "hidden",
      !isSub || noMains
    );
    const subRadio = els.docSectionForm.querySelector(
      "input[name='type'][value='sub']"
    );
    if (subRadio) subRadio.disabled = noMains;
    if (noMains && isSub) {
      const mainRadio = els.docSectionForm.querySelector(
        "input[name='type'][value='main']"
      );
      if (mainRadio) mainRadio.checked = true;
      els.docSectionParentLabel.classList.add("hidden");
    }
  }

  function openAddDocSection() {
    els.docSectionForm.reset();
    els.docSectionForm.id.value = "";
    const active = currentDocSection();
    const suggestedParent = active?.parentId || active?.id || "";
    populateDocSectionParentPicker("");
    setDocSectionModalMode({ defaultType: "main" });
    if (
      suggestedParent &&
      topLevelDocSections().some((s) => s.id === suggestedParent)
    ) {
      els.docSectionParent.value = suggestedParent;
    }
    els.docSectionModalTitle.textContent = "Add Section";
    openModal(els.docSectionModal);
    setTimeout(() => els.docSectionForm.name.focus(), 20);
  }

  function openRenameDocSection() {
    const s = currentDocSection();
    if (!s) return;
    els.docSectionForm.reset();
    els.docSectionForm.id.value = s.id;
    els.docSectionForm.name.value = s.name;
    populateDocSectionParentPicker(s.id);
    setDocSectionModalMode({ editingId: s.id });
    els.docSectionModalTitle.textContent = "Rename Section";
    openModal(els.docSectionModal);
    setTimeout(() => els.docSectionForm.name.select(), 20);
  }

  async function onDocSectionSubmit(e) {
    e.preventDefault();
    const id = els.docSectionForm.id.value;
    const name = els.docSectionForm.name.value.trim();
    if (!name) return;
    const typeInput = els.docSectionForm.querySelector(
      "input[name='type']:checked"
    );
    const wantsSub = !id && typeInput?.value === "sub";
    const parentId = wantsSub ? els.docSectionParent.value || "" : "";
    if (wantsSub && !parentId) {
      toast("Pick a parent page for the sub section.", true);
      return;
    }
    els.btnSaveDocSection.disabled = true;
    els.btnSaveDocSection.textContent = "Saving...";
    try {
      if (id) {
        const updated = await api(
          `/docs/sections/${encodeURIComponent(id)}`,
          {
            method: "PUT",
            body: JSON.stringify({ name }),
          }
        );
        const idx = state.docs.sections.findIndex((s) => s.id === id);
        if (idx !== -1) state.docs.sections[idx] = updated;
        toast(`Renamed to "${name}"`);
      } else {
        const payload = { name, content: "" };
        if (wantsSub) payload.parentId = parentId;
        const created = await api(`/docs/sections`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        state.docs.sections.push(created);
        state.docs.activeId = created.id;
        els.docEditor.dataset.loadedId = "";
        els.docViewer.dataset.loadedId = "";
        toast(
          wantsSub
            ? `Created sub page "${created.name}"`
            : `Created section "${created.name}"`
        );
      }
      closeModal(els.docSectionModal);
      const justCreated = !id;
      renderDocSections();
      renderDocContent();
      if (justCreated) enterDocEditMode();
    } catch (err) {
      toast("Save failed: " + err.message, true);
    } finally {
      els.btnSaveDocSection.disabled = false;
      els.btnSaveDocSection.textContent = "Save";
    }
  }

  async function clearDocDraftTag(id) {
    if (!id) return;
    const section = state.docs.sections.find((s) => s.id === id);
    if (!section || !section.isDraft) return;
    const ok = await confirmDialog({
      title: "Remove draft tag?",
      message: `"${section.name}" will no longer be marked as a draft.`,
      confirmText: "Remove",
      danger: false,
    });
    if (!ok) return;
    try {
      const updated = await api(
        `/docs/sections/${encodeURIComponent(id)}`,
        {
          method: "PUT",
          body: JSON.stringify({ isDraft: false }),
        }
      );
      const idx = state.docs.sections.findIndex((x) => x.id === id);
      if (idx !== -1) state.docs.sections[idx] = updated;
      renderDocSections();
      toast(`Removed draft tag from "${updated.name}"`);
    } catch (err) {
      toast("Could not remove draft tag: " + err.message, true);
    }
  }

  async function onDeleteDocSection() {
    const s = currentDocSection();
    if (!s) return;
    const children = state.docs.sections.filter((x) => x.parentId === s.id);
    const message = children.length
      ? `Delete "${s.name}" and its ${children.length} sub page${
          children.length === 1 ? "" : "s"
        }? This cannot be undone.`
      : `Delete section "${s.name}" and all of its content? This cannot be undone.`;
    const ok = await confirmDialog({
      title: "Delete Section",
      message,
      confirmText: "Delete",
    });
    if (!ok) return;
    try {
      await api(`/docs/sections/${encodeURIComponent(s.id)}`, {
        method: "DELETE",
      });
      const removedIds = new Set([s.id, ...children.map((c) => c.id)]);
      state.docs.sections = state.docs.sections.filter(
        (x) => !removedIds.has(x.id)
      );
      state.docs.activeId = state.docs.sections[0]?.id || null;
      els.docEditor.dataset.loadedId = "";
      toast(`Deleted section "${s.name}"`);
      renderDocSections();
      renderDocContent();
    } catch (err) {
      toast("Delete failed: " + err.message, true);
    }
  }

  // ---------- Doc AI generate ----------
  function setDocGenerateLoading(loading) {
    if (!els.btnDocGenerateSubmit) return;
    els.btnDocGenerateSubmit.disabled = loading;
    els.btnDocGenerateSubmit.classList.toggle("is-loading", loading);
    const label = els.btnDocGenerateSubmit.querySelector(".ai-btn-label");
    const spinner = els.btnDocGenerateSubmit.querySelector(".ai-spinner");
    if (label) label.textContent = loading ? "Drafting…" : "Generate draft";
    if (spinner) spinner.classList.toggle("hidden", !loading);
  }

  function openGenerateDocSection() {
    if (!state.features.aiEnabled) {
      toast("AI is not configured on the backend.", true);
      return;
    }
    els.docGenerateForm.reset();
    els.docGenerateError.classList.add("hidden");
    els.docGenerateError.textContent = "";
    setDocGenerateLoading(false);
    openModal(els.docGenerateModal);
    setTimeout(() => els.docGenerateForm.url.focus(), 20);
  }

  function uniqueDocSectionName(base) {
    const taken = new Set(
      state.docs.sections.map((s) => (s.name || "").toLowerCase())
    );
    const trimmed = (base || "Draft section").trim() || "Draft section";
    if (!taken.has(trimmed.toLowerCase())) return trimmed;
    for (let i = 2; i < 100; i++) {
      const candidate = `${trimmed} (${i})`;
      if (!taken.has(candidate.toLowerCase())) return candidate;
    }
    return `${trimmed} ${Date.now()}`;
  }

  async function onGenerateDocSubmit(e) {
    e.preventDefault();
    const url = els.docGenerateForm.url.value.trim();
    const text = els.docGenerateForm.text.value.trim();
    const hint = els.docGenerateForm.hint.value.trim();
    if (!url && !text) {
      els.docGenerateError.textContent =
        "Provide either a source URL or paste the source text.";
      els.docGenerateError.classList.remove("hidden");
      return;
    }
    els.docGenerateError.classList.add("hidden");
    els.docGenerateError.textContent = "";
    setDocGenerateLoading(true);
    try {
      const { draft } = await api("/ai/generate-doc-section", {
        method: "POST",
        body: JSON.stringify({ url, text, hint }),
      });
      const name = uniqueDocSectionName(draft?.title);
      const created = await api("/docs/sections", {
        method: "POST",
        body: JSON.stringify({
          name,
          content: draft?.content || "",
          isDraft: true,
        }),
      });
      state.docs.sections.push(created);
      state.docs.activeId = created.id;
      els.docEditor.dataset.loadedId = "";
      els.docViewer.dataset.loadedId = "";
      closeModal(els.docGenerateModal);
      renderDocSections();
      renderDocContent();
      enterDocEditMode();
      toast(`Draft "${created.name}" ready — review and save when done.`);
    } catch (err) {
      els.docGenerateError.textContent =
        err.message || "Failed to generate draft.";
      els.docGenerateError.classList.remove("hidden");
    } finally {
      setDocGenerateLoading(false);
    }
  }

  // ---------- Doc event wiring ----------
  els.btnAddDocSection.addEventListener("click", openAddDocSection);
  els.btnRenameDocSection.addEventListener("click", openRenameDocSection);
  els.btnDeleteDocSection.addEventListener("click", onDeleteDocSection);
  els.btnGenerateDocSection?.addEventListener(
    "click",
    openGenerateDocSection
  );
  els.docGenerateForm?.addEventListener("submit", onGenerateDocSubmit);
  els.docSectionForm.addEventListener("submit", onDocSectionSubmit);
  els.docSectionForm
    .querySelectorAll("input[name='type']")
    .forEach((r) => r.addEventListener("change", syncParentVisibility));

  // ---------- Doc sidebar: drag and drop reordering ----------
  const dragState = { id: null };

  function clearDocDragIndicators() {
    els.docSectionList
      .querySelectorAll(".drop-before, .drop-after, .drop-into")
      .forEach((el) =>
        el.classList.remove("drop-before", "drop-after", "drop-into")
      );
  }

  function isDescendantOrSelf(sectionId, candidateId) {
    if (!sectionId || !candidateId) return false;
    if (sectionId === candidateId) return true;
    // Nesting is 1-level: sectionId is a descendant iff its parentId === candidateId.
    const s = state.docs.sections.find((x) => x.id === sectionId);
    return !!s && s.parentId === candidateId;
  }

  function computeDropPlacement(draggedId, targetLi, mouseY) {
    const targetId = targetLi.dataset.id;
    if (!targetId || targetId === draggedId) return null;
    const dragged = state.docs.sections.find((s) => s.id === draggedId);
    const target = state.docs.sections.find((s) => s.id === targetId);
    if (!dragged || !target) return null;

    const rect = targetLi.getBoundingClientRect();
    const offset = mouseY - rect.top;
    const h = rect.height;
    const isTargetTopLevel = !target.parentId;
    const draggedHasChildren = state.docs.sections.some(
      (s) => s.parentId === dragged.id
    );

    // "Drop into" only works when:
    //  - the target is a top-level page
    //  - the dragged section has no children (max nesting depth = 1)
    //  - the dragged section isn't already a child of the target
    const canNest =
      isTargetTopLevel &&
      !draggedHasChildren &&
      dragged.parentId !== target.id;

    let placement;
    if (canNest && offset > h * 0.33 && offset < h * 0.66) {
      placement = "into";
    } else if (offset < h * 0.5) {
      placement = "before";
    } else {
      placement = "after";
    }

    // A parent (page with sub pages) cannot become a sub page itself.
    if (!isTargetTopLevel && draggedHasChildren) return null;

    return { placement, target };
  }

  function applyDropIndicator(targetLi, placement) {
    clearDocDragIndicators();
    if (!targetLi || !placement) return;
    if (placement === "before") targetLi.classList.add("drop-before");
    else if (placement === "after") targetLi.classList.add("drop-after");
    else if (placement === "into") targetLi.classList.add("drop-into");
  }

  function reorderSiblings(parentId, orderedIds) {
    // Re-number sibling orders contiguously starting at 0.
    const updates = [];
    orderedIds.forEach((id, idx) => {
      const s = state.docs.sections.find((x) => x.id === id);
      if (!s) return;
      updates.push({
        id,
        parentId,
        order: idx,
        section: s,
      });
    });
    return updates;
  }

  function buildReorderPlan(draggedId, targetId, placement) {
    const dragged = state.docs.sections.find((s) => s.id === draggedId);
    const target = state.docs.sections.find((s) => s.id === targetId);
    if (!dragged || !target) return null;

    let newParentId;
    if (placement === "into") newParentId = target.id;
    else newParentId = target.parentId || null;

    // Siblings of the new group, excluding the dragged item (in case it was
    // already there).
    const targetSiblings = sortedDocSections().filter(
      (s) => (s.parentId || null) === newParentId && s.id !== dragged.id
    );

    let insertAt;
    if (placement === "into") {
      insertAt = targetSiblings.length; // append inside parent
    } else {
      const targetIdx = targetSiblings.findIndex((s) => s.id === target.id);
      insertAt =
        placement === "before"
          ? Math.max(0, targetIdx)
          : targetIdx === -1
          ? targetSiblings.length
          : targetIdx + 1;
    }
    const newSiblingOrder = targetSiblings.map((s) => s.id);
    newSiblingOrder.splice(insertAt, 0, dragged.id);

    const updates = reorderSiblings(newParentId, newSiblingOrder);

    // If the dragged item moved out of its previous group, compact the old
    // group's order too.
    const oldParentId = dragged.parentId || null;
    if (oldParentId !== newParentId) {
      const oldGroup = sortedDocSections()
        .filter(
          (s) => (s.parentId || null) === oldParentId && s.id !== dragged.id
        )
        .map((s) => s.id);
      updates.push(...reorderSiblings(oldParentId, oldGroup));
    }
    return updates;
  }

  async function commitDocReorder(updates) {
    if (!updates?.length) return;
    // Optimistic update
    const backup = JSON.parse(JSON.stringify(state.docs.sections));
    updates.forEach((u) => {
      const idx = state.docs.sections.findIndex((s) => s.id === u.id);
      if (idx !== -1) {
        state.docs.sections[idx] = {
          ...state.docs.sections[idx],
          parentId: u.parentId || null,
          order: u.order,
        };
      }
    });
    renderDocSections();
    try {
      await api("/docs/sections/reorder", {
        method: "POST",
        body: JSON.stringify({
          items: updates.map((u) => ({
            id: u.id,
            parentId: u.parentId,
            order: u.order,
          })),
        }),
      });
    } catch (err) {
      state.docs.sections = backup;
      renderDocSections();
      toast("Reorder failed: " + err.message, true);
    }
  }

  els.docSectionList.addEventListener("dragstart", (e) => {
    const li = e.target.closest(".section-item--doc");
    if (!li) return;
    dragState.id = li.dataset.id;
    li.classList.add("is-dragging");
    try {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", dragState.id);
    } catch {
      /* no-op */
    }
  });

  els.docSectionList.addEventListener("dragend", () => {
    els.docSectionList
      .querySelectorAll(".is-dragging")
      .forEach((el) => el.classList.remove("is-dragging"));
    clearDocDragIndicators();
    dragState.id = null;
  });

  els.docSectionList.addEventListener("dragover", (e) => {
    if (!dragState.id) return;
    const li = e.target.closest(".section-item--doc");
    if (!li) return;
    if (isDescendantOrSelf(li.dataset.id, dragState.id)) {
      // Disallow dropping a parent into its own child
      clearDocDragIndicators();
      return;
    }
    const info = computeDropPlacement(dragState.id, li, e.clientY);
    if (!info) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    applyDropIndicator(li, info.placement);
  });

  els.docSectionList.addEventListener("dragleave", (e) => {
    const li = e.target.closest(".section-item--doc");
    if (li && !els.docSectionList.contains(e.relatedTarget)) {
      clearDocDragIndicators();
    }
  });

  els.docSectionList.addEventListener("drop", async (e) => {
    const li = e.target.closest(".section-item--doc");
    if (!li || !dragState.id) {
      clearDocDragIndicators();
      return;
    }
    e.preventDefault();
    const info = computeDropPlacement(dragState.id, li, e.clientY);
    clearDocDragIndicators();
    if (!info) return;
    const plan = buildReorderPlan(dragState.id, li.dataset.id, info.placement);
    if (!plan) return;
    await commitDocReorder(plan);
  });

  async function confirmDiscardIfDirty() {
    if (!state.docs.dirty) return true;
    return await confirmDialog({
      title: "Discard changes?",
      message: "You have unsaved changes in this section. Discard them?",
      confirmText: "Discard",
    });
  }

  els.docSectionList.addEventListener("click", async (e) => {
    const clearBtn = e.target.closest("[data-action='clear-draft']");
    if (clearBtn) {
      e.stopPropagation();
      await clearDocDraftTag(clearBtn.dataset.id);
      return;
    }

    const li = e.target.closest(".section-item");
    if (!li) return;
    const id = li.dataset.id;
    if (id === state.docs.activeId) return;
    if (!(await confirmDiscardIfDirty())) return;
    state.docs.activeId = id;
    state.docs.editing = false;
    state.docs.dirty = false;
    els.docEditor.dataset.loadedId = "";
    els.docViewer.dataset.loadedId = "";
    renderDocSections();
    renderDocContent();
  });

  els.docEditor.addEventListener("input", () => {
    markDocDirty();
  });
  els.docEditor.addEventListener("keyup", updateToolbarState);
  els.docEditor.addEventListener("mouseup", updateToolbarState);
  els.docEditor.addEventListener("focus", updateToolbarState);

  // Convert pasted content to plain text to keep the document clean
  els.docEditor.addEventListener("paste", (e) => {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData("text");
    document.execCommand("insertText", false, text);
  });

  // Toolbar clicks
  document.querySelectorAll(".doc-btn[data-cmd]").forEach((btn) => {
    btn.addEventListener("mousedown", (e) => e.preventDefault()); // keep selection
    btn.addEventListener("click", () => {
      const cmd = btn.dataset.cmd;
      if (cmd === "createLink") {
        const url = prompt("Enter URL");
        if (!url) return;
        const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`;
        execCmd("createLink", normalized);
      } else if (cmd === "inlineCode") {
        wrapSelectionWith("code");
      } else {
        execCmd(cmd);
      }
    });
  });

  // Capture the editor caret BEFORE the <select> opens and steals focus, so
  // we can restore it in the change handler and formatBlock has something to
  // act on.
  ["mousedown", "focus", "keydown"].forEach((evt) =>
    els.docBlockStyle.addEventListener(evt, captureEditorSelection)
  );
  els.docBlockStyle.addEventListener("change", () => {
    applyBlockStyle(els.docBlockStyle.value);
  });

  // Font family / size / color controls
  function applyFontSize(px) {
    if (!px) return;
    restoreEditorSelection();
    try {
      document.execCommand("fontSize", false, "7");
    } catch (_) {
      /* no-op */
    }
    els.docEditor
      .querySelectorAll('font[size="7"]')
      .forEach((f) => {
        const span = document.createElement("span");
        span.style.fontSize = px;
        while (f.firstChild) span.appendChild(f.firstChild);
        f.replaceWith(span);
      });
    markDocDirty();
  }

  function applyFontFamily(family) {
    if (!family) return;
    restoreEditorSelection();
    try {
      document.execCommand("fontName", false, family);
    } catch (_) {
      /* no-op */
    }
    markDocDirty();
  }

  function applyFontColor(color) {
    if (!color) return;
    restoreEditorSelection();
    try {
      document.execCommand("styleWithCSS", false, true);
      document.execCommand("foreColor", false, color);
    } catch (_) {
      /* no-op */
    }
    markDocDirty();
  }

  ["mousedown", "focus", "keydown"].forEach((evt) => {
    els.docFontFamily.addEventListener(evt, captureEditorSelection);
    els.docFontSize.addEventListener(evt, captureEditorSelection);
  });
  els.docFontColor.addEventListener("mousedown", captureEditorSelection);
  els.docFontColor.addEventListener("focus", captureEditorSelection);

  els.docFontFamily.addEventListener("change", () => {
    const v = els.docFontFamily.value;
    if (v) applyFontFamily(v);
    els.docFontFamily.selectedIndex = 0;
  });

  els.docFontSize.addEventListener("change", () => {
    const v = els.docFontSize.value;
    if (v) applyFontSize(v);
    els.docFontSize.selectedIndex = 0;
  });

  const docColorWrap = els.docFontColor.closest(".doc-color");
  function syncColorSwatch() {
    if (docColorWrap) {
      docColorWrap.style.setProperty("--doc-color-value", els.docFontColor.value);
    }
  }
  syncColorSwatch();
  els.docFontColor.addEventListener("input", () => {
    applyFontColor(els.docFontColor.value);
    syncColorSwatch();
  });
  els.docFontColor.addEventListener("change", () => {
    applyFontColor(els.docFontColor.value);
    syncColorSwatch();
  });

  els.btnSaveDoc.addEventListener("click", () => saveActiveDoc(false));
  els.btnEditDoc.addEventListener("click", enterDocEditMode);
  els.btnCancelDoc.addEventListener("click", cancelDocEdit);

  // ==========================================================================
  // Docs editor — tables & cards
  // ==========================================================================

  // Remember the last selection inside the editor so toolbar buttons can
  // insert at the caret even after the editor lost focus to the toolbar.
  let lastDocRange = null;

  function captureEditorSelection() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (els.docEditor.contains(range.commonAncestorContainer)) {
      lastDocRange = range.cloneRange();
    }
  }

  function restoreEditorSelection() {
    els.docEditor.focus();
    const sel = window.getSelection();
    if (!lastDocRange) {
      // Fall back to end of editor
      const range = document.createRange();
      range.selectNodeContents(els.docEditor);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
      lastDocRange = range.cloneRange();
      return;
    }
    sel.removeAllRanges();
    sel.addRange(lastDocRange);
  }

  ["keyup", "mouseup", "input", "focus"].forEach((evt) =>
    els.docEditor.addEventListener(evt, captureEditorSelection)
  );

  function ancestor(node, predicate) {
    let n = node;
    while (n && n !== els.docEditor) {
      if (n.nodeType === 1 && predicate(n)) return n;
      n = n.parentNode;
    }
    return null;
  }

  function currentSelectionNode() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0);
    if (!els.docEditor.contains(range.commonAncestorContainer)) return null;
    return range.commonAncestorContainer;
  }

  function getActiveTableContext() {
    const node = currentSelectionNode();
    if (!node) return null;
    const cell = ancestor(node, (el) => el.tagName === "TD" || el.tagName === "TH");
    const table = ancestor(node, (el) => el.classList?.contains("doc-table"));
    if (!cell || !table) return null;
    const row = cell.parentElement;
    const tbody = row.parentElement;
    const rowIndex = Array.from(tbody.children).indexOf(row);
    const colIndex = Array.from(row.children).indexOf(cell);
    return { table, tbody, row, cell, rowIndex, colIndex };
  }

  function getActiveCardContext() {
    const node = currentSelectionNode();
    if (!node) return null;
    const card = ancestor(node, (el) => el.classList?.contains("doc-card"));
    const grid = ancestor(node, (el) => el.classList?.contains("doc-cards"));
    if (!grid) return null;
    return { grid, card };
  }

  function updateDocContextToolbar() {
    // Clear highlight classes
    els.docEditor
      .querySelectorAll(".doc-table--active, .doc-card--active, .doc-cards--active")
      .forEach((el) =>
        el.classList.remove(
          "doc-table--active",
          "doc-card--active",
          "doc-cards--active"
        )
      );

    const tCtx = getActiveTableContext();
    const cCtx = getActiveCardContext();

    els.tableContextGroup.hidden = !tCtx;
    els.cardsContextGroup.hidden = !cCtx;

    if (tCtx) tCtx.table.classList.add("doc-table--active");
    if (cCtx) {
      cCtx.grid.classList.add("doc-cards--active");
      if (cCtx.card) cCtx.card.classList.add("doc-card--active");
    }

    // Enable/disable card buttons that require a specific card
    els.btnCardRemove.disabled = !(cCtx && cCtx.card);
    els.btnCardMoveLeft.disabled = !(cCtx && cCtx.card && cCtx.card.previousElementSibling);
    els.btnCardMoveRight.disabled = !(cCtx && cCtx.card && cCtx.card.nextElementSibling);
  }

  ["keyup", "mouseup", "focus", "input"].forEach((evt) =>
    els.docEditor.addEventListener(evt, updateDocContextToolbar)
  );

  // ---------- Insert table ----------
  function buildTableHTML(rows, cols) {
    const headers = Array.from(
      { length: cols },
      (_, i) => `<th>Column ${i + 1}</th>`
    ).join("");
    const bodyRows = Array.from({ length: rows }, () => {
      const cells = Array.from({ length: cols }, () => "<td><br></td>").join("");
      return `<tr>${cells}</tr>`;
    }).join("");
    return `<table class="doc-table"><thead><tr>${headers}</tr></thead><tbody>${bodyRows}</tbody></table><p><br></p>`;
  }

  function insertHtmlAtCaret(html) {
    restoreEditorSelection();
    document.execCommand("insertHTML", false, html);
    markDocDirty();
    updateDocContextToolbar();
  }

  function insertTable(rows, cols) {
    insertHtmlAtCaret(buildTableHTML(rows, cols));
  }

  // ---------- Table size picker ----------
  const PICKER_ROWS = 8;
  const PICKER_COLS = 8;
  let pickerHot = { r: 0, c: 0 };

  function renderTablePicker() {
    const cells = [];
    for (let r = 0; r < PICKER_ROWS; r++) {
      for (let c = 0; c < PICKER_COLS; c++) {
        cells.push(
          `<div class="table-picker__cell" data-r="${r + 1}" data-c="${
            c + 1
          }"></div>`
        );
      }
    }
    els.tablePickerGrid.innerHTML = cells.join("");
  }
  renderTablePicker();

  function setPickerHot(r, c) {
    pickerHot = { r, c };
    els.tablePickerLabel.textContent = `${r} × ${c}`;
    els.tablePickerGrid
      .querySelectorAll(".table-picker__cell")
      .forEach((cell) => {
        const cr = Number(cell.dataset.r);
        const cc = Number(cell.dataset.c);
        cell.classList.toggle("is-hot", cr <= r && cc <= c);
      });
  }

  function openTablePicker() {
    captureEditorSelection();
    els.tablePicker.classList.remove("hidden");
    els.btnInsertTable.setAttribute("aria-expanded", "true");
    setPickerHot(0, 0);
  }
  function closeTablePicker() {
    els.tablePicker.classList.add("hidden");
    els.btnInsertTable.setAttribute("aria-expanded", "false");
  }

  els.btnInsertTable.addEventListener("mousedown", (e) => e.preventDefault());
  els.btnInsertTable.addEventListener("click", (e) => {
    e.stopPropagation();
    if (els.tablePicker.classList.contains("hidden")) openTablePicker();
    else closeTablePicker();
  });

  els.tablePickerGrid.addEventListener("mousemove", (e) => {
    const cell = e.target.closest(".table-picker__cell");
    if (!cell) return;
    setPickerHot(Number(cell.dataset.r), Number(cell.dataset.c));
  });
  els.tablePickerGrid.addEventListener("click", (e) => {
    const cell = e.target.closest(".table-picker__cell");
    if (!cell) return;
    const r = Number(cell.dataset.r);
    const c = Number(cell.dataset.c);
    closeTablePicker();
    insertTable(r, c);
  });

  document.addEventListener("click", (e) => {
    if (els.tablePicker.classList.contains("hidden")) return;
    if (
      els.tablePicker.contains(e.target) ||
      els.btnInsertTable.contains(e.target)
    )
      return;
    closeTablePicker();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !els.tablePicker.classList.contains("hidden")) {
      closeTablePicker();
    }
  });

  // ---------- Table ops (row/col) ----------
  function tableAddRow() {
    const ctx = getActiveTableContext();
    if (!ctx) return;
    const cols = ctx.row.children.length;
    const tr = document.createElement("tr");
    for (let i = 0; i < cols; i++) {
      const td = document.createElement("td");
      td.innerHTML = "<br>";
      tr.appendChild(td);
    }
    ctx.row.insertAdjacentElement("afterend", tr);
    markDocDirty();
  }
  function tableAddCol() {
    const ctx = getActiveTableContext();
    if (!ctx) return;
    const insertAt = ctx.colIndex + 1;
    // header row
    const thead = ctx.table.querySelector("thead tr");
    if (thead) {
      const th = document.createElement("th");
      th.textContent = `Column ${thead.children.length + 1}`;
      thead.insertBefore(th, thead.children[insertAt] || null);
    }
    // body rows
    ctx.tbody.querySelectorAll("tr").forEach((tr) => {
      const td = document.createElement("td");
      td.innerHTML = "<br>";
      tr.insertBefore(td, tr.children[insertAt] || null);
    });
    markDocDirty();
  }
  function tableDeleteRow() {
    const ctx = getActiveTableContext();
    if (!ctx) return;
    if (ctx.tbody.children.length <= 1) {
      toast("A table needs at least one row", true);
      return;
    }
    ctx.row.remove();
    markDocDirty();
    updateDocContextToolbar();
  }
  function tableDeleteCol() {
    const ctx = getActiveTableContext();
    if (!ctx) return;
    const firstRow = ctx.table.querySelector("tr");
    if (firstRow && firstRow.children.length <= 1) {
      toast("A table needs at least one column", true);
      return;
    }
    const idx = ctx.colIndex;
    ctx.table.querySelectorAll("tr").forEach((tr) => {
      if (tr.children[idx]) tr.children[idx].remove();
    });
    markDocDirty();
    updateDocContextToolbar();
  }
  function tableDelete() {
    const ctx = getActiveTableContext();
    if (!ctx) return;
    ctx.table.remove();
    markDocDirty();
    updateDocContextToolbar();
  }

  els.btnTableAddRow.addEventListener("mousedown", (e) => e.preventDefault());
  els.btnTableAddCol.addEventListener("mousedown", (e) => e.preventDefault());
  els.btnTableDelRow.addEventListener("mousedown", (e) => e.preventDefault());
  els.btnTableDelCol.addEventListener("mousedown", (e) => e.preventDefault());
  els.btnTableDelete.addEventListener("mousedown", (e) => e.preventDefault());
  els.btnTableAddRow.addEventListener("click", tableAddRow);
  els.btnTableAddCol.addEventListener("click", tableAddCol);
  els.btnTableDelRow.addEventListener("click", tableDeleteRow);
  els.btnTableDelCol.addEventListener("click", tableDeleteCol);
  els.btnTableDelete.addEventListener("click", tableDelete);

  // ---------- Insert cards ----------
  function buildCardsHTML(count) {
    const cards = Array.from(
      { length: count },
      (_, i) => `
        <div class="doc-card">
          <strong class="doc-card__title">Card ${i + 1}</strong>
          <span class="doc-card__body">Describe this card…</span>
        </div>`
    ).join("");
    return `<div class="doc-cards">${cards}</div><p><br></p>`;
  }

  els.btnInsertCards.addEventListener("mousedown", (e) => e.preventDefault());
  els.btnInsertCards.addEventListener("click", () => {
    const raw = prompt("How many cards?", "4");
    if (raw == null) return;
    const n = Math.max(1, Math.min(12, parseInt(raw, 10) || 0));
    if (!n) return;
    insertHtmlAtCaret(buildCardsHTML(n));
  });

  // ---------- Cards ops ----------
  function cardAdd() {
    const ctx = getActiveCardContext();
    if (!ctx) return;
    const card = document.createElement("div");
    card.className = "doc-card";
    card.innerHTML =
      '<strong class="doc-card__title">New card</strong><span class="doc-card__body">Describe this card…</span>';
    if (ctx.card && ctx.card.parentElement === ctx.grid) {
      ctx.card.insertAdjacentElement("afterend", card);
    } else {
      ctx.grid.appendChild(card);
    }
    markDocDirty();
  }
  function cardRemove() {
    const ctx = getActiveCardContext();
    if (!ctx || !ctx.card) return;
    if (ctx.grid.querySelectorAll(".doc-card").length <= 1) {
      // Remove the whole grid if it's the last card
      ctx.grid.remove();
    } else {
      ctx.card.remove();
    }
    markDocDirty();
    updateDocContextToolbar();
  }

  function cardMove(direction) {
    const ctx = getActiveCardContext();
    if (!ctx || !ctx.card) return;
    if (direction === "left") {
      const prev = ctx.card.previousElementSibling;
      if (!prev) return;
      ctx.grid.insertBefore(ctx.card, prev);
    } else if (direction === "right") {
      const next = ctx.card.nextElementSibling;
      if (!next) return;
      ctx.grid.insertBefore(next, ctx.card);
    } else {
      return;
    }
    markDocDirty();
    updateDocContextToolbar();
  }

  function cardsDelete() {
    const ctx = getActiveCardContext();
    if (!ctx) return;
    ctx.grid.remove();
    markDocDirty();
    updateDocContextToolbar();
  }

  els.btnCardAdd?.addEventListener("mousedown", (e) => e.preventDefault());
  els.btnCardRemove?.addEventListener("mousedown", (e) => e.preventDefault());
  els.btnCardMoveLeft?.addEventListener("mousedown", (e) => e.preventDefault());
  els.btnCardMoveRight?.addEventListener("mousedown", (e) => e.preventDefault());
  els.btnCardsDelete?.addEventListener("mousedown", (e) => e.preventDefault());
  els.btnCardAdd?.addEventListener("click", cardAdd);
  els.btnCardRemove?.addEventListener("click", cardRemove);
  els.btnCardMoveLeft?.addEventListener("click", () => cardMove("left"));
  els.btnCardMoveRight?.addEventListener("click", () => cardMove("right"));
  els.btnCardsDelete?.addEventListener("click", cardsDelete);

  // Warn if the user navigates away with unsaved changes
  window.addEventListener("beforeunload", (e) => {
    if (state.docs.dirty) {
      e.preventDefault();
      e.returnValue = "";
    }
  });

  // ==========================================================================
  // JIRA tickets tab
  // ==========================================================================
  const JIRA_ALL = "__all__";
  const JIRA_UNASSIGNED = "__unassigned__";

  async function loadJira() {
    if (state.jira.loading) return;
    state.jira.loading = true;
    els.jiraLoadState.classList.remove("hidden");
    try {
      const data = await api("/jira");
      state.jira.sections = (data.sections || [])
        .slice()
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      state.jira.tickets = data.tickets || [];
      state.jira.loaded = true;
      const valid = new Set(
        state.jira.tickets.map((t) => t.key.toUpperCase())
      );
      state.jira.selectedKeys = new Set(
        [...state.jira.selectedKeys].filter((k) => valid.has(k))
      );
      const sids = new Set(state.jira.sections.map((s) => s.id));
      state.jira.selectedSectionIds = new Set(
        [...state.jira.selectedSectionIds].filter((id) => sids.has(id))
      );
      if (
        state.jira.activeSectionId !== JIRA_ALL &&
        state.jira.activeSectionId !== JIRA_UNASSIGNED &&
        !sids.has(state.jira.activeSectionId)
      ) {
        state.jira.activeSectionId = JIRA_ALL;
      }
      renderJiraSections();
      renderJiraContent();
    } catch (e) {
      toast("Failed to load JIRA tickets: " + e.message, true);
    } finally {
      state.jira.loading = false;
      els.jiraLoadState.classList.add("hidden");
    }
  }

  function currentJiraSection() {
    return (
      state.jira.sections.find(
        (s) => s.id === state.jira.activeSectionId
      ) || null
    );
  }

  function jiraTicketsInScope() {
    const id = state.jira.activeSectionId;
    if (id === JIRA_ALL) return state.jira.tickets.slice();
    if (id === JIRA_UNASSIGNED) {
      return state.jira.tickets.filter((t) => !t.sectionId);
    }
    return state.jira.tickets.filter((t) => t.sectionId === id);
  }

  function filteredJiraTickets() {
    const q = state.jira.search.trim().toLowerCase();
    const rows = jiraTicketsInScope().filter(
      (t) =>
        !q ||
        t.key.toLowerCase().includes(q) ||
        (t.summary || "").toLowerCase().includes(q)
    );
    if (state.jira.activeSectionId === JIRA_ALL) {
      rows.sort((a, b) => {
        const ga = jiraGroupName(a).toLowerCase();
        const gb = jiraGroupName(b).toLowerCase();
        const aUn = !a.sectionId;
        const bUn = !b.sectionId;
        if (aUn !== bUn) return aUn ? 1 : -1;
        if (ga !== gb) return ga.localeCompare(gb);
        return a.key.localeCompare(b.key, undefined, { numeric: true });
      });
    }
    return rows;
  }

  function jiraGroupName(ticket) {
    if (!ticket || !ticket.sectionId) return "Unassigned";
    const s = state.jira.sections.find((x) => x.id === ticket.sectionId);
    return s ? s.name : "Unassigned";
  }

  function ticketHasTestCase(key) {
    const K = String(key || "").toUpperCase();
    return state.testCases.some(
      (tc) =>
        Array.isArray(tc.sources) &&
        tc.sources.some((s) => String(s).toUpperCase() === K)
    );
  }

  function ticketTestCaseIds(key) {
    const K = String(key || "").toUpperCase();
    return state.testCases
      .filter(
        (tc) =>
          Array.isArray(tc.sources) &&
          tc.sources.some((s) => String(s).toUpperCase() === K)
      )
      .map((tc) => tc.id)
      .filter(Boolean);
  }

  function renderJiraSections() {
    const deleteMode = state.jira.sectionDeleteMode;
    els.jiraSectionList.classList.toggle("is-select-mode", deleteMode);
    const sections = state.jira.sections;
    els.jiraSectionEmpty.classList.toggle(
      "hidden",
      sections.length > 0 || deleteMode
    );

    const allCount = state.jira.tickets.length;
    const unassignedCount = state.jira.tickets.filter(
      (t) => !t.sectionId
    ).length;

    const active = state.jira.activeSectionId;
    const specialItems = deleteMode
      ? ""
      : `
      <li class="section-item ${
        active === JIRA_ALL ? "is-active" : ""
      }" data-id="${JIRA_ALL}">
        <span class="section-item__name">All tickets</span>
        <span class="section-item__count">${allCount}</span>
      </li>
      <li class="section-item ${
        active === JIRA_UNASSIGNED ? "is-active" : ""
      }" data-id="${JIRA_UNASSIGNED}">
        <span class="section-item__name">Unassigned</span>
        <span class="section-item__count">${unassignedCount}</span>
      </li>`;

    const sectionItems = sections
      .map((s) => {
        const count = state.jira.tickets.filter(
          (t) => t.sectionId === s.id
        ).length;
        const isActive = s.id === active;
        const selected = state.jira.selectedSectionIds.has(s.id);
        const check = deleteMode
          ? `<input type="checkbox" class="jira-section-check" ${
              selected ? "checked" : ""
            } data-id="${escapeHtml(s.id)}" aria-label="Select ${escapeHtml(
              s.name
            )}" />`
          : "";
        return `
          <li class="section-item ${isActive && !deleteMode ? "is-active" : ""} ${
          selected ? "is-selected" : ""
        }" data-id="${escapeHtml(s.id)}">
            ${check}
            <span class="section-item__name">${escapeHtml(s.name)}</span>
            <span class="section-item__count">${count}</span>
          </li>`;
      })
      .join("");

    els.jiraSectionList.innerHTML = specialItems + sectionItems;

    els.jiraSectionDeleteBar.classList.toggle("hidden", !deleteMode);
    const n = state.jira.selectedSectionIds.size;
    els.jiraSectionDeleteCount.textContent = `${n} selected`;
    els.btnConfirmJiraSectionDelete.disabled = n === 0;

    const s = currentJiraSection();
    els.btnRenameJiraSectionIcon.disabled = deleteMode || !s;
    els.btnDeleteJiraSectionIcon.classList.toggle("is-active", deleteMode);
    els.btnDeleteJiraSectionIcon.disabled = sections.length === 0;
    els.btnAddJiraSection.disabled = deleteMode;
  }

  function renderJiraContent() {
    const id = state.jira.activeSectionId;
    const s = currentJiraSection();
    const title =
      id === JIRA_ALL
        ? "All tickets"
        : id === JIRA_UNASSIGNED
        ? "Unassigned"
        : s?.name || "Select a group";
    els.jiraSectionTitle.textContent = title;

    const rows = filteredJiraTickets();
    const total = jiraTicketsInScope().length;
    els.jiraSectionMeta.textContent = `${rows.length} of ${total} ticket${
      total === 1 ? "" : "s"
    }`;

    els.jiraEmptyState.classList.toggle("hidden", rows.length > 0);

    els.jiraBody.innerHTML = rows
      .map((t) => {
        const key = escapeHtml(t.key);
        const selected = state.jira.selectedKeys.has(t.key.toUpperCase());
        const hasTc = ticketHasTestCase(t.key);
        const tcIds = ticketTestCaseIds(t.key);
        const tcIdHtml = tcIds.length
          ? tcIds
              .map(
                (id) =>
                  `<a class="tc-id" href="#" data-action="open-tc" data-id="${escapeHtml(
                    id
                  )}" title="Open ${escapeHtml(id)}">${escapeHtml(id)}</a>`
              )
              .join(" ")
          : '<span class="tc-id-empty">—</span>';
        return `
        <tr data-key="${key}" class="${selected ? "is-selected" : ""}">
          <td class="col-check">
            <input type="checkbox" class="jira-check" data-key="${key}" ${
          selected ? "checked" : ""
        } aria-label="Select ${key}" />
          </td>
          <td class="mono">
            <a class="jira-link" href="${escapeHtml(
              t.url || "#"
            )}" target="_blank" rel="noopener">${key}</a>
          </td>
          <td class="cell-title">${escapeHtml(t.summary || "")}</td>
          <td class="col-group">${
            t.sectionId
              ? `<span class="group-chip">${escapeHtml(jiraGroupName(t))}</span>`
              : `<span class="group-chip group-chip--unassigned" spellcheck="false">Unassigned</span>`
          }</td>
          <td class="col-tc">
            <span class="chip tc-chip ${hasTc ? "tc-yes" : "tc-no"}">${
          hasTc ? "Yes" : "No"
        }</span>
          </td>
          <td class="col-tc-id mono">${tcIdHtml}</td>
          <td class="col-actions">
            <div class="action-group">
              <button class="btn-icon btn-icon--sm btn-icon--danger" data-action="delete-jira" data-key="${key}" title="Remove from portal" aria-label="Remove ${key}">${ICONS.trash}</button>
            </div>
          </td>
        </tr>`;
      })
      .join("");

    renderJiraBulkBar();
  }

  function renderJiraBulkBar() {
    const visibleKeys = filteredJiraTickets().map((t) =>
      t.key.toUpperCase()
    );
    const selectedVisible = visibleKeys.filter((k) =>
      state.jira.selectedKeys.has(k)
    );
    const n = state.jira.selectedKeys.size;
    els.jiraBulkBar.classList.toggle("hidden", n === 0);
    els.jiraBulkCount.textContent = `${n} selected`;
    if (els.jiraSelectAll) {
      els.jiraSelectAll.checked =
        visibleKeys.length > 0 &&
        selectedVisible.length === visibleKeys.length;
      els.jiraSelectAll.indeterminate =
        selectedVisible.length > 0 &&
        selectedVisible.length < visibleKeys.length;
    }
    const showAi =
      state.features.aiEnabled && state.features.jiraEnabled && n > 0;
    els.btnJiraGenerate.disabled = !showAi;
  }

  // ---------- Jira section CRUD ----------
  function openAddJiraSection() {
    els.jiraSectionForm.reset();
    els.jiraSectionForm.id.value = "";
    els.jiraSectionModalTitle.textContent = "Add Group";
    openModal(els.jiraSectionModal);
    setTimeout(() => els.jiraSectionForm.name.focus(), 20);
  }

  function openRenameJiraSection() {
    const s = currentJiraSection();
    if (!s) return;
    els.jiraSectionForm.reset();
    els.jiraSectionForm.id.value = s.id;
    els.jiraSectionForm.name.value = s.name;
    els.jiraSectionModalTitle.textContent = "Rename Group";
    openModal(els.jiraSectionModal);
    setTimeout(() => els.jiraSectionForm.name.select(), 20);
  }

  async function onJiraSectionSubmit(e) {
    e.preventDefault();
    const id = els.jiraSectionForm.id.value;
    const name = els.jiraSectionForm.name.value.trim();
    if (!name) return;
    els.btnSaveJiraSection.disabled = true;
    els.btnSaveJiraSection.textContent = "Saving...";
    try {
      if (id) {
        await api(`/jira/sections/${encodeURIComponent(id)}`, {
          method: "PUT",
          body: JSON.stringify({ name }),
        });
        toast(`Renamed to "${name}"`);
      } else {
        const created = await api(`/jira/sections`, {
          method: "POST",
          body: JSON.stringify({ name }),
        });
        state.jira.activeSectionId = created.id;
        toast(`Created section "${created.name}"`);
      }
      closeModal(els.jiraSectionModal);
      await loadJira();
    } catch (err) {
      toast("Save failed: " + err.message, true);
    } finally {
      els.btnSaveJiraSection.disabled = false;
      els.btnSaveJiraSection.textContent = "Save";
    }
  }

  function toggleJiraSectionDeleteMode(force) {
    const next =
      typeof force === "boolean" ? force : !state.jira.sectionDeleteMode;
    state.jira.sectionDeleteMode = next;
    if (!next) state.jira.selectedSectionIds.clear();
    renderJiraSections();
  }

  async function onConfirmJiraSectionDelete() {
    const ids = [...state.jira.selectedSectionIds];
    if (!ids.length) return;
    const names = state.jira.sections
      .filter((s) => ids.includes(s.id))
      .map((s) => s.name);
    const label =
      ids.length === 1
        ? `group "${names[0]}"`
        : `${ids.length} groups`;
    const ok = await confirmDialog({
      title: ids.length === 1 ? "Delete Group" : "Delete Groups",
      message: `Delete ${label}? Tickets inside will become unassigned. This cannot be undone.`,
      confirmText: "Delete",
    });
    if (!ok) return;
    els.btnConfirmJiraSectionDelete.disabled = true;
    try {
      for (const id of ids) {
        await api(`/jira/sections/${encodeURIComponent(id)}`, {
          method: "DELETE",
        });
      }
      if (ids.includes(state.jira.activeSectionId)) {
        state.jira.activeSectionId = JIRA_ALL;
      }
      toast(`Deleted ${ids.length} group${ids.length === 1 ? "" : "s"}`);
      toggleJiraSectionDeleteMode(false);
      await loadJira();
    } catch (err) {
      toast("Delete failed: " + err.message, true);
    } finally {
      els.btnConfirmJiraSectionDelete.disabled = false;
    }
  }

  // ---------- Jira extract ----------
  function openJiraExtract() {
    els.jiraExtractForm.reset();
    els.jiraExtractError.classList.add("hidden");
    els.jiraExtractError.textContent = "";
    setExtractLoading(false);
    els.jiraExtractForm.maxResults.value = 50;
    els.jiraExtractSection.innerHTML =
      `<option value="">— Unassigned —</option>` +
      state.jira.sections
        .map(
          (s) =>
            `<option value="${escapeHtml(s.id)}">${escapeHtml(
              s.name
            )}</option>`
        )
        .join("");
    const curr = state.jira.activeSectionId;
    if (
      curr &&
      curr !== JIRA_ALL &&
      curr !== JIRA_UNASSIGNED &&
      state.jira.sections.some((s) => s.id === curr)
    ) {
      els.jiraExtractSection.value = curr;
    }
    openModal(els.jiraExtractModal);
    setTimeout(() => els.jiraExtractForm.jql.focus(), 20);
  }

  async function onJiraExtractSubmit(e) {
    e.preventDefault();
    const jql = els.jiraExtractForm.jql.value.trim();
    if (!jql) return;
    const sectionId = els.jiraExtractSection.value || null;
    const maxResults =
      Number(els.jiraExtractForm.maxResults.value) || 50;
    els.jiraExtractError.classList.add("hidden");
    els.jiraExtractError.textContent = "";
    setExtractLoading(true);
    try {
      const resp = await api("/jira/extract", {
        method: "POST",
        body: JSON.stringify({ jql, sectionId, maxResults }),
      });
      closeModal(els.jiraExtractModal);
      if (sectionId) state.jira.activeSectionId = sectionId;
      await loadJira();
      toast(
        `Extracted ${resp.found} ticket${resp.found === 1 ? "" : "s"} (+${
          resp.added
        } new, ~${resp.updated} updated)`
      );
    } catch (err) {
      els.jiraExtractError.textContent =
        err.message || "Failed to extract tickets.";
      els.jiraExtractError.classList.remove("hidden");
    } finally {
      setExtractLoading(false);
    }
  }

  // ---------- Jira bulk: move / delete / generate ----------
  function openJiraMoveMenu() {
    const sections = state.jira.sections;
    const items = [
      `<li class="auto-menu__option" role="option" data-move-to="">
        <span class="auto-menu__label">
          <span class="auto-menu__dot" aria-hidden="true"></span>
          Unassigned
        </span>
      </li>`,
      ...sections.map(
        (s) => `
        <li class="auto-menu__option" role="option" data-move-to="${escapeHtml(
          s.id
        )}">
          <span class="auto-menu__label">
            <span class="auto-menu__dot" aria-hidden="true"></span>
            ${escapeHtml(s.name)}
          </span>
        </li>`
      ),
      `<li class="auto-menu__option auto-menu__option--new" role="option" data-move-to="__new__">
        <span class="auto-menu__label">
          <span class="auto-menu__dot" aria-hidden="true"></span>
          + New group…
        </span>
      </li>`,
    ];
    els.jiraMoveMenu.innerHTML = items.join("");
    const rect = els.btnJiraMoveMenu.getBoundingClientRect();
    els.jiraMoveMenu.classList.remove("hidden");
    els.jiraMoveMenu.style.position = "fixed";
    els.jiraMoveMenu.style.top = `${rect.bottom + 6}px`;
    els.jiraMoveMenu.style.left = `${rect.left}px`;
    els.jiraMoveMenu.style.minWidth = `${rect.width}px`;
    els.btnJiraMoveMenu.setAttribute("aria-expanded", "true");
  }
  function closeJiraMoveMenu() {
    els.jiraMoveMenu.classList.add("hidden");
    els.btnJiraMoveMenu.setAttribute("aria-expanded", "false");
  }

  async function moveSelectedJiraTickets(sectionId) {
    const keys = [...state.jira.selectedKeys];
    if (!keys.length) return;
    try {
      for (const key of keys) {
        await api(`/jira/tickets/${encodeURIComponent(key)}`, {
          method: "PUT",
          body: JSON.stringify({ sectionId: sectionId || null }),
        });
      }
      toast(
        `Moved ${keys.length} ticket${keys.length === 1 ? "" : "s"}${
          sectionId ? "" : " to Unassigned"
        }`
      );
      state.jira.selectedKeys.clear();
      await loadJira();
    } catch (err) {
      toast("Move failed: " + err.message, true);
    }
  }

  async function onCombineIntoNewSection() {
    const name = prompt("New group name");
    if (!name || !name.trim()) return;
    try {
      const created = await api(`/jira/sections`, {
        method: "POST",
        body: JSON.stringify({ name: name.trim() }),
      });
      await moveSelectedJiraTickets(created.id);
      state.jira.activeSectionId = created.id;
      await loadJira();
    } catch (err) {
      toast("Create failed: " + err.message, true);
    }
  }

  async function deleteSelectedJiraTickets() {
    const keys = [...state.jira.selectedKeys];
    if (!keys.length) return;
    const ok = await confirmDialog({
      title: keys.length === 1 ? "Remove ticket" : "Remove tickets",
      message: `Remove ${keys.length} ticket${
        keys.length === 1 ? "" : "s"
      } from the portal? The ticket in JIRA is not affected.`,
      confirmText: "Remove",
    });
    if (!ok) return;
    try {
      for (const key of keys) {
        await api(`/jira/tickets/${encodeURIComponent(key)}`, {
          method: "DELETE",
        });
      }
      state.jira.selectedKeys.clear();
      toast(`Removed ${keys.length} ticket${keys.length === 1 ? "" : "s"}`);
      await loadJira();
    } catch (err) {
      toast("Remove failed: " + err.message, true);
    }
  }

  async function deleteJiraTicket(key) {
    const ok = await confirmDialog({
      title: "Remove ticket",
      message: `Remove ${key} from the portal? The ticket in JIRA is not affected.`,
      confirmText: "Remove",
    });
    if (!ok) return;
    try {
      await api(`/jira/tickets/${encodeURIComponent(key)}`, {
        method: "DELETE",
      });
      state.jira.selectedKeys.delete(key.toUpperCase());
      toast(`Removed ${key}`);
      await loadJira();
    } catch (err) {
      toast("Remove failed: " + err.message, true);
    }
  }

  async function generateFromSelection() {
    const keys = [...state.jira.selectedKeys];
    if (!keys.length) {
      toast("Select one or more tickets first", true);
      return;
    }
    if (keys.length > 8) {
      toast("Please select at most 8 tickets", true);
      return;
    }
    if (!state.features.aiEnabled || !state.features.jiraEnabled) {
      toast("AI / JIRA integration is not configured", true);
      return;
    }
    els.btnJiraGenerate.disabled = true;
    els.btnJiraGenerate.classList.add("is-loading");
    try {
      toast(
        keys.length === 1
          ? `Drafting test case from ${keys[0]}…`
          : `Drafting test case from ${keys.length} tickets…`
      );
      const { issues, draft } = await api("/ai/generate-from-tickets", {
        method: "POST",
        body: JSON.stringify({ keys }),
      });
      openPrefilledTcModalFromTickets(draft, issues);
    } catch (err) {
      toast(err.message || "AI generation failed", true);
    } finally {
      els.btnJiraGenerate.disabled = false;
      els.btnJiraGenerate.classList.remove("is-loading");
      renderJiraBulkBar();
    }
  }

  // ---------- Jira event wiring ----------
  els.btnAddJiraSection?.addEventListener("click", openAddJiraSection);
  els.btnRenameJiraSectionIcon?.addEventListener(
    "click",
    openRenameJiraSection
  );
  els.btnDeleteJiraSectionIcon?.addEventListener("click", () =>
    toggleJiraSectionDeleteMode()
  );
  els.btnCancelJiraSectionDelete?.addEventListener("click", () =>
    toggleJiraSectionDeleteMode(false)
  );
  els.btnConfirmJiraSectionDelete?.addEventListener(
    "click",
    onConfirmJiraSectionDelete
  );
  els.jiraSectionForm?.addEventListener("submit", onJiraSectionSubmit);

  els.jiraSectionList?.addEventListener("click", (e) => {
    const check = e.target.closest(".jira-section-check");
    if (check) {
      const id = check.dataset.id;
      if (check.checked) state.jira.selectedSectionIds.add(id);
      else state.jira.selectedSectionIds.delete(id);
      renderJiraSections();
      return;
    }
    const li = e.target.closest(".section-item");
    if (!li) return;
    const id = li.dataset.id;
    if (state.jira.sectionDeleteMode) {
      if (id === JIRA_ALL || id === JIRA_UNASSIGNED) return;
      if (state.jira.selectedSectionIds.has(id)) {
        state.jira.selectedSectionIds.delete(id);
      } else {
        state.jira.selectedSectionIds.add(id);
      }
      renderJiraSections();
      return;
    }
    state.jira.activeSectionId = id;
    state.jira.selectedKeys.clear();
    renderJiraSections();
    renderJiraContent();
  });

  els.btnJiraExtract?.addEventListener("click", openJiraExtract);
  els.jiraExtractForm?.addEventListener("submit", onJiraExtractSubmit);
  els.btnJiraGenerate?.addEventListener("click", generateFromSelection);

  els.jiraBody?.addEventListener("click", (e) => {
    const tcLink = e.target.closest("a[data-action='open-tc']");
    if (tcLink) {
      e.preventDefault();
      openTestCaseById(tcLink.dataset.id);
      return;
    }
    const check = e.target.closest(".jira-check");
    if (check) {
      const key = check.dataset.key.toUpperCase();
      if (check.checked) state.jira.selectedKeys.add(key);
      else state.jira.selectedKeys.delete(key);
      const row = check.closest("tr");
      if (row) row.classList.toggle("is-selected", check.checked);
      renderJiraBulkBar();
      return;
    }
    const btn = e.target.closest("[data-action='delete-jira']");
    if (btn) {
      deleteJiraTicket(btn.dataset.key);
    }
  });

  function openTestCaseById(id) {
    const tc = state.testCases.find((t) => t.id === id);
    if (!tc) {
      toast(`Test case ${id} not found`);
      return;
    }
    if (state.sections.some((s) => s.id === tc.sectionId)) {
      state.activeSectionId = tc.sectionId;
    }
    setTab("testcases");
    renderSections();
    renderContent();
    openEditTc(tc);
  }

  els.jiraSelectAll?.addEventListener("change", () => {
    const visibleKeys = filteredJiraTickets().map((t) =>
      t.key.toUpperCase()
    );
    if (els.jiraSelectAll.checked) {
      visibleKeys.forEach((k) => state.jira.selectedKeys.add(k));
    } else {
      visibleKeys.forEach((k) => state.jira.selectedKeys.delete(k));
    }
    renderJiraContent();
  });

  els.btnClearJiraSelection?.addEventListener("click", () => {
    state.jira.selectedKeys.clear();
    renderJiraContent();
  });

  els.btnJiraBulkDelete?.addEventListener("click", deleteSelectedJiraTickets);

  els.btnJiraMoveMenu?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (els.jiraMoveMenu.classList.contains("hidden")) openJiraMoveMenu();
    else closeJiraMoveMenu();
  });
  els.jiraMoveMenu?.addEventListener("click", async (e) => {
    const opt = e.target.closest(".auto-menu__option");
    if (!opt) return;
    const target = opt.dataset.moveTo;
    closeJiraMoveMenu();
    if (target === "__new__") {
      await onCombineIntoNewSection();
    } else {
      await moveSelectedJiraTickets(target || null);
    }
  });
  document.addEventListener("click", (e) => {
    if (!els.jiraMoveMenu || els.jiraMoveMenu.classList.contains("hidden")) return;
    if (
      els.jiraMoveMenu.contains(e.target) ||
      els.btnJiraMoveMenu?.contains(e.target)
    )
      return;
    closeJiraMoveMenu();
  });
  document.addEventListener("keydown", (e) => {
    if (
      e.key === "Escape" &&
      !!els.jiraMoveMenu && !els.jiraMoveMenu.classList.contains("hidden")
    ) {
      closeJiraMoveMenu();
    }
  });
  window.addEventListener("scroll", closeJiraMoveMenu, true);
  window.addEventListener("resize", closeJiraMoveMenu);

  els.jiraSearch?.addEventListener("input", (e) => {
    state.jira.search = e.target.value;
    renderJiraContent();
  });

  // boot
  setTab("testcases");
  loadFeatures();
  load();
})();
