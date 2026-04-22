(function () {
  const { API_BASE, API_KEY } = window.CONFIG || {};

  const state = {
    sections: [],
    testCases: [],
    activeSectionId: null,
    activeTab: "testcases",
    search: "",
  };

  const $ = (id) => document.getElementById(id);

  const els = {
    // tabs
    tabs: document.querySelectorAll(".tab"),
    views: {
      dashboard: $("view-dashboard"),
      documentation: $("view-documentation"),
      testcases: $("view-testcases"),
    },
    // sidebar
    sectionList: $("sectionList"),
    sectionEmpty: $("sectionEmpty"),
    btnAddSection: $("btnAddSection"),
    // content
    sectionTitle: $("sectionTitle"),
    sectionMeta: $("sectionMeta"),
    search: $("search"),
    btnAddTc: $("btnAddTc"),
    btnRenameSection: $("btnRenameSection"),
    btnDeleteSection: $("btnDeleteSection"),
    tcBody: $("tcBody"),
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
    // toast
    toast: $("toast"),
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

  // ---------- tab routing ----------
  function setTab(tab) {
    state.activeTab = tab;
    els.tabs.forEach((btn) =>
      btn.classList.toggle("is-active", btn.dataset.tab === tab)
    );
    Object.entries(els.views).forEach(([name, view]) => {
      view.classList.toggle("hidden", name !== tab);
    });
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
      if (!state.sections.find((s) => s.id === state.activeSectionId)) {
        state.activeSectionId = state.sections[0]?.id || null;
      }
      renderSections();
      renderContent();
    } catch (e) {
      toast("Failed to load: " + e.message, true);
    } finally {
      els.loadState.classList.add("hidden");
    }
  }

  // ---------- sections sidebar ----------
  function renderSections() {
    els.sectionEmpty.classList.toggle("hidden", state.sections.length > 0);
    els.sectionList.innerHTML = state.sections
      .map((s) => {
        const count = state.testCases.filter((t) => t.sectionId === s.id).length;
        const active = s.id === state.activeSectionId;
        return `
          <li class="section-item ${active ? "is-active" : ""}" data-id="${escapeHtml(s.id)}">
            <span class="section-item__name">${escapeHtml(s.name)}</span>
            <span class="section-item__count">${count}</span>
          </li>`;
      })
      .join("");
  }

  // ---------- main content ----------
  function currentSection() {
    return state.sections.find((s) => s.id === state.activeSectionId) || null;
  }

  function filteredCases() {
    const q = state.search.trim().toLowerCase();
    return state.testCases
      .filter((t) => t.sectionId === state.activeSectionId)
      .filter(
        (t) =>
          !q ||
          t.id.toLowerCase().includes(q) ||
          t.title.toLowerCase().includes(q)
      );
  }

  function renderContent() {
    const section = currentSection();

    const noSection = !section;
    els.btnAddTc.disabled = noSection;
    els.btnRenameSection.disabled = noSection;
    els.btnDeleteSection.disabled = noSection;
    els.noSectionState.classList.toggle("hidden", !noSection);

    if (noSection) {
      els.sectionTitle.textContent = state.sections.length
        ? "Select a section"
        : "No sections yet";
      els.sectionMeta.textContent = "";
      els.tcBody.innerHTML = "";
      els.emptyState.classList.add("hidden");
      return;
    }

    els.sectionTitle.textContent = section.name;
    const rows = filteredCases();
    const total = state.testCases.filter((t) => t.sectionId === section.id).length;
    els.sectionMeta.textContent = `${rows.length} of ${total} test case${total === 1 ? "" : "s"}`;

    els.emptyState.classList.toggle("hidden", rows.length > 0);
    els.tcBody.innerHTML = rows
      .map(
        (tc) => `
        <tr data-id="${escapeHtml(tc.id)}">
          <td class="mono">${escapeHtml(tc.id)}</td>
          <td class="cell-title">${escapeHtml(tc.title)}</td>
          <td><span class="chip chip-module">${escapeHtml(tc.module)}</span></td>
          <td><span class="chip pri pri-${slug(tc.priority)}">${escapeHtml(tc.priority)}</span></td>
          <td><span class="chip auto auto-${slug(tc.automationStatus)}">${escapeHtml(tc.automationStatus)}</span></td>
          <td class="col-actions">
            <button class="btn btn-ghost btn-sm" data-action="edit" data-id="${escapeHtml(tc.id)}">Edit</button>
          </td>
        </tr>`
      )
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
  function openAddSection() {
    els.sectionForm.reset();
    els.sectionForm.id.value = "";
    els.sectionModalTitle.textContent = "Add Section";
    openModal(els.sectionModal);
    setTimeout(() => els.sectionForm.name.focus(), 20);
  }

  function openRenameSection() {
    const s = currentSection();
    if (!s) return;
    els.sectionForm.reset();
    els.sectionForm.id.value = s.id;
    els.sectionForm.name.value = s.name;
    els.sectionModalTitle.textContent = "Rename Section";
    openModal(els.sectionModal);
    setTimeout(() => els.sectionForm.name.select(), 20);
  }

  async function onSectionSubmit(e) {
    e.preventDefault();
    const id = els.sectionForm.id.value;
    const name = els.sectionForm.name.value.trim();
    if (!name) return;
    els.btnSaveSection.disabled = true;
    els.btnSaveSection.textContent = "Saving...";
    try {
      if (id) {
        await api(`/sections/${encodeURIComponent(id)}`, {
          method: "PUT",
          body: JSON.stringify({ name }),
        });
        toast(`Renamed to "${name}"`);
      } else {
        const created = await api(`/sections`, {
          method: "POST",
          body: JSON.stringify({ name }),
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

  async function onDeleteSection() {
    const s = currentSection();
    if (!s) return;
    const count = state.testCases.filter((t) => t.sectionId === s.id).length;
    const msg = count
      ? `Delete section "${s.name}" and its ${count} test case(s)? This cannot be undone.`
      : `Delete section "${s.name}"?`;
    if (!confirm(msg)) return;
    try {
      await api(`/sections/${encodeURIComponent(s.id)}`, { method: "DELETE" });
      state.activeSectionId = null;
      toast(`Deleted "${s.name}"`);
      await load();
    } catch (err) {
      toast("Delete failed: " + err.message, true);
    }
  }

  // ---------- test case modal ----------
  function openAddTc() {
    const section = currentSection();
    if (!section) return;
    els.tcForm.reset();
    els.tcForm.id.value = "";
    els.tcForm.sectionId.value = section.id;
    els.tcModalTitle.textContent = `Add Test Case — ${section.name}`;
    els.btnDeleteTc.classList.add("hidden");
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
    els.tcForm.steps.value = (tc.steps || []).join("\n");
    els.tcForm.expectedResult.value = tc.expectedResult || "";
    els.tcModalTitle.textContent = `Edit ${tc.id}`;
    els.btnDeleteTc.classList.remove("hidden");
    openModal(els.tcModal);
    setTimeout(() => els.tcForm.title.focus(), 20);
  }

  async function onTcSubmit(e) {
    e.preventDefault();
    const fd = new FormData(els.tcForm);
    const payload = {
      sectionId: fd.get("sectionId"),
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
    } catch (err) {
      toast("Save failed: " + err.message, true);
    } finally {
      els.btnSaveTc.disabled = false;
      els.btnSaveTc.textContent = "Save";
    }
  }

  async function onDeleteTc() {
    const id = els.tcForm.id.value;
    if (!id) return;
    if (!confirm(`Delete ${id}? This cannot be undone.`)) return;
    try {
      await api(`/testcases/${encodeURIComponent(id)}`, { method: "DELETE" });
      toast(`Deleted ${id}`);
      closeModal(els.tcModal);
      await load();
    } catch (err) {
      toast("Delete failed: " + err.message, true);
    }
  }

  // ---------- event wiring ----------
  els.tabs.forEach((btn) =>
    btn.addEventListener("click", () => setTab(btn.dataset.tab))
  );

  els.sectionList.addEventListener("click", (e) => {
    const li = e.target.closest(".section-item");
    if (!li) return;
    state.activeSectionId = li.dataset.id;
    renderSections();
    renderContent();
  });

  els.btnAddSection.addEventListener("click", openAddSection);
  els.btnRenameSection.addEventListener("click", openRenameSection);
  els.btnDeleteSection.addEventListener("click", onDeleteSection);
  els.sectionForm.addEventListener("submit", onSectionSubmit);

  els.btnAddTc.addEventListener("click", openAddTc);
  els.tcForm.addEventListener("submit", onTcSubmit);
  els.btnDeleteTc.addEventListener("click", onDeleteTc);

  els.tcBody.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action='edit']");
    if (!btn) return;
    const tc = state.testCases.find((t) => t.id === btn.dataset.id);
    if (tc) openEditTc(tc);
  });

  els.search.addEventListener("input", (e) => {
    state.search = e.target.value;
    renderContent();
  });

  // close modal on backdrop or Cancel / Escape
  document.addEventListener("click", (e) => {
    if (e.target.matches("[data-close-modal]")) {
      closeModal(e.target.closest(".modal"));
    } else if (e.target.classList.contains("modal")) {
      closeModal(e.target);
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      document
        .querySelectorAll(".modal:not(.hidden)")
        .forEach((m) => closeModal(m));
    }
  });

  // boot
  setTab("testcases");
  load();
})();
