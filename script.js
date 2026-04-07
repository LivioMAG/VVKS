// Anforderungs- und Produktevaluation (Frontend-only)
// Datenhaltung: sessionStorage (nur aktuelle Browser-Sitzung)

const STORAGE_KEY = "evaluation_app_state_v2";

const PRIORITY_POINTS = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 1,
};

const TYPE_FACTOR = {
  must: 1.5,
  nice: 1.0,
};

const RATING_FACTOR = {
  full: 1,
  mostly: 0.66,
  partial: 0.33,
  none: 0,
  na: 0,
};

const RATING_LABELS = {
  full: "Erfüllt",
  mostly: "Mehrheitlich erfüllt",
  partial: "Teilweise erfüllt",
  none: "Nicht erfüllt",
  na: "Nicht bewertet",
};

const state = loadState();

const requirementForm = document.getElementById("requirementForm");
const productForm = document.getElementById("productForm");
const requirementsList = document.getElementById("requirementsList");
const productsList = document.getElementById("productsList");
const matrixContainer = document.getElementById("matrixContainer");
const resultsContent = document.getElementById("resultsContent");
const resetBtn = document.getElementById("resetBtn");
const exportPdfBtn = document.getElementById("exportPdfBtn");
const exportProjectBtn = document.getElementById("exportProjectBtn");
const openProjectBtn = document.getElementById("openProjectBtn");
const projectDialog = document.getElementById("projectDialog");
const createProjectBtn = document.getElementById("createProjectBtn");
const chooseProjectBtn = document.getElementById("chooseProjectBtn");
const projectCsvInput = document.getElementById("projectCsvInput");
const projectNameInput = document.getElementById("projectNameInput");
const projectNameDisplay = document.getElementById("projectNameDisplay");
const uploadRequirementsCsvBtn = document.getElementById("uploadRequirementsCsvBtn");
const requirementsCsvInput = document.getElementById("requirementsCsvInput");
const requirementsInfoBtn = document.getElementById("requirementsInfoBtn");
const requirementsPromptBtn = document.getElementById("requirementsPromptBtn");
const uploadProductsCsvBtn = document.getElementById("uploadProductsCsvBtn");
const productsCsvInput = document.getElementById("productsCsvInput");
const productsInfoBtn = document.getElementById("productsInfoBtn");
const productsPromptBtn = document.getElementById("productsPromptBtn");
const helperDialog = document.getElementById("helperDialog");
const helperDialogTitle = document.getElementById("helperDialogTitle");
const helperDialogText = document.getElementById("helperDialogText");
const helperDialogPrompt = document.getElementById("helperDialogPrompt");
const helperDialogCloseBtn = document.getElementById("helperDialogCloseBtn");
const helperDialogOpenChatgptBtn = document.getElementById("helperDialogOpenChatgptBtn");
const toggleRequirementsBtn = document.getElementById("toggleRequirementsBtn");
const toggleProductsBtn = document.getElementById("toggleProductsBtn");
const requirementsBody = document.getElementById("requirementsBody");
const productsBody = document.getElementById("productsBody");
const quickEditDialog = document.getElementById("quickEditDialog");
const quickEditTitle = document.getElementById("quickEditTitle");
const quickEditLabel = document.getElementById("quickEditLabel");
const quickEditSelect = document.getElementById("quickEditSelect");
const quickEditSaveBtn = document.getElementById("quickEditSaveBtn");
const quickEditCancelBtn = document.getElementById("quickEditCancelBtn");

const csvAssistantConfig = {
  requirements: {
    label: "Anforderungen",
    info:
      "Prompt kopieren → LLM öffnen (z. B. ChatGPT) → Prompt einfügen → darunter den Fließtext mit deinen Anforderungen ergänzen → ausführen → erzeugte CSV herunterladen → hier per Upload importieren.",
    prompt:
      "Erstelle eine CSV-Datei zum Download (kein Fließtext). Nutze exakt die Spalten: title,category,description,type,priority,note. type nur must/nice, priority nur critical/high/medium/low. Unten findest du die betrieblichen Anforderungen. Kategorisiere jede Anforderung als Must-have oder Nice-to-have und bestimme die Priorität eigenständig.",
  },
  products: {
    label: "Produkte",
    info:
      "Prompt kopieren → LLM öffnen (z. B. ChatGPT) → Prompt eingeben → alle gewünschten Produkte als Fließtext darunter einfügen (z. B. aus Webseiten kopiert) → Run klicken → CSV herunterladen → hier hochladen.",
    prompt:
      "Erstelle eine CSV-Datei zum Download (kein Fließtext). Nutze exakt die Spalten: name,vendor,summary,price,note. Pflichtfelder sind name,vendor,price; summary und note sind optional. Unten folgen Produktinformationen als Fließtext. Extrahiere alle Produkte in eine saubere CSV mit einer Zeile pro Produkt.",
  },
};
let editingRequirementId = null;
let editingProductId = null;
let pendingQuickEdit = null;
let matrixFilterValue = "all";

requirementForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(requirementForm);
  const payload = {
    title: data.get("title").toString().trim(),
    description: data.get("description").toString().trim(),
    category: data.get("category").toString().trim(),
    type: data.get("type").toString(),
    priority: data.get("priority").toString(),
    note: data.get("note").toString().trim(),
  };

  if (editingRequirementId) {
    state.requirements = state.requirements.map((req) => (req.id === editingRequirementId ? { ...req, ...payload } : req));
    editingRequirementId = null;
  } else {
    state.requirements.push({ id: makeId("req"), ...payload });
  }

  requirementForm.reset();
  setFormEditingState("requirement", false);
  persistAndRender();
});

productForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(productForm);
  const payload = {
    name: data.get("name").toString().trim(),
    vendor: data.get("vendor").toString().trim(),
    summary: data.get("summary").toString().trim(),
    price: data.get("price").toString().trim(),
    note: data.get("note").toString().trim(),
  };

  if (editingProductId) {
    state.products = state.products.map((prd) => (prd.id === editingProductId ? { ...prd, ...payload } : prd));
    editingProductId = null;
  } else {
    state.products.push({ id: makeId("prd"), ...payload });
  }

  productForm.reset();
  setFormEditingState("product", false);
  persistAndRender();
});

resetBtn.addEventListener("click", () => {
  const confirmReset = window.confirm("Alle Daten in dieser Sitzung wirklich löschen?");
  if (!confirmReset) return;
  sessionStorage.removeItem(STORAGE_KEY);
  state.projectName = "";
  state.requirements = [];
  state.products = [];
  state.ratings = {};
  state.mustWeight = 50;
  state.niceWeight = 20;
  state.priceWeight = 30;
  state.lockedWeightKey = null;
  state.collapsed = { requirements: false, products: false };
  render();
  if (projectDialog?.showModal) projectDialog.showModal();
});

createProjectBtn.addEventListener("click", () => {
  const enteredName = (projectNameInput.value || "").trim();
  if (!enteredName) {
    window.alert("Bitte einen Projektnamen eingeben.");
    return;
  }
  state.projectName = enteredName;
  state.requirements = [];
  state.products = [];
  state.ratings = {};
  state.mustWeight = 50;
  state.niceWeight = 20;
  state.priceWeight = 30;
  state.lockedWeightKey = null;
  state.collapsed = { requirements: false, products: false };
  editingRequirementId = null;
  editingProductId = null;
  setFormEditingState("requirement", false);
  setFormEditingState("product", false);
  persistAndRender();
  projectDialog.close();
});

chooseProjectBtn.addEventListener("click", () => projectCsvInput.click());
openProjectBtn.addEventListener("click", () => projectCsvInput.click());

projectCsvInput.addEventListener("change", async () => {
  const file = projectCsvInput.files?.[0];
  if (!file) return;

  try {
    const rows = parseCsv(await file.text());
    const importedState = rowsToProjectState(rows);
    state.projectName = importedState.projectName;
    state.mustWeight = importedState.mustWeight;
    state.niceWeight = importedState.niceWeight;
    state.priceWeight = importedState.priceWeight;
    state.lockedWeightKey = importedState.lockedWeightKey;
    state.requirements = importedState.requirements;
    state.products = importedState.products;
    state.ratings = importedState.ratings;
    state.collapsed = importedState.collapsed;
    editingRequirementId = null;
    editingProductId = null;
    setFormEditingState("requirement", false);
    setFormEditingState("product", false);
    persistAndRender();
    if (projectDialog.open) projectDialog.close();
    window.alert("Projekt erfolgreich geladen.");
  } catch (error) {
    window.alert(error.message);
  } finally {
    projectCsvInput.value = "";
  }
});

exportProjectBtn.addEventListener("click", () => {
  const fileName = `${slugifyProjectName(getProjectName())}-${new Date().toISOString().slice(0, 10)}.csv`;
  downloadCsvFile(fileName, buildProjectCsvRows());
});

exportPdfBtn.addEventListener("click", () => {
  if (typeof window.html2pdf === "undefined") {
    window.alert("PDF-Bibliothek konnte nicht geladen werden.");
    return;
  }

  const report = buildPdfReportNode();
  const opt = {
    margin: [0, 0, 0, 0],
    filename: `${slugifyProjectName(getProjectName())}-report-${new Date().toISOString().slice(0, 10)}.pdf`,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    pagebreak: { mode: ["avoid-all", "css", "legacy"] },
  };

  window.html2pdf().set(opt).from(report).save();
});

uploadRequirementsCsvBtn.addEventListener("click", () => requirementsCsvInput.click());
requirementsCsvInput.addEventListener("change", async () => {
  const file = requirementsCsvInput.files?.[0];
  if (!file) return;

  try {
    const rows = parseCsv(await file.text());
    const importedRequirements = rowsToRequirements(rows);
    state.requirements = importedRequirements;
    state.ratings = {};
    editingRequirementId = null;
    setFormEditingState("requirement", false);
    persistAndRender();
    window.alert(`${importedRequirements.length} Anforderungen erfolgreich importiert.`);
  } catch (error) {
    window.alert(error.message);
  } finally {
    requirementsCsvInput.value = "";
  }
});

uploadProductsCsvBtn.addEventListener("click", () => productsCsvInput.click());
productsCsvInput.addEventListener("change", async () => {
  const file = productsCsvInput.files?.[0];
  if (!file) return;

  try {
    const rows = parseCsv(await file.text());
    const importedProducts = rowsToProducts(rows);
    state.products = importedProducts;
    state.ratings = {};
    editingProductId = null;
    setFormEditingState("product", false);
    persistAndRender();
    window.alert(`${importedProducts.length} Produkte erfolgreich importiert.`);
  } catch (error) {
    window.alert(error.message);
  } finally {
    productsCsvInput.value = "";
  }
});

requirementsInfoBtn.addEventListener("click", () => openHelperDialog("requirements", "info"));
requirementsPromptBtn.addEventListener("click", () => openHelperDialog("requirements", "prompt"));
productsInfoBtn.addEventListener("click", () => openHelperDialog("products", "info"));
productsPromptBtn.addEventListener("click", () => openHelperDialog("products", "prompt"));
helperDialogCloseBtn.addEventListener("click", () => helperDialog.close());
helperDialogOpenChatgptBtn.addEventListener("click", () => {
  const prompt = helperDialogOpenChatgptBtn.getAttribute("data-prompt") || "";
  if (!prompt) return;
  const url = `https://chatgpt.com/?q=${encodeURIComponent(prompt)}`;
  window.open(url, "_blank", "noopener,noreferrer");
});
toggleRequirementsBtn.addEventListener("click", () => {
  state.collapsed.requirements = !state.collapsed.requirements;
  persistAndRender();
});
toggleProductsBtn.addEventListener("click", () => {
  state.collapsed.products = !state.collapsed.products;
  persistAndRender();
});
quickEditCancelBtn.addEventListener("click", () => {
  pendingQuickEdit = null;
  quickEditDialog.close();
});
quickEditSaveBtn.addEventListener("click", applyQuickEditSelection);

function loadState() {
  const fallback = {
    projectName: "",
    requirements: [],
    products: [],
    ratings: {},
    mustWeight: 50,
    niceWeight: 20,
    priceWeight: 30,
    lockedWeightKey: null,
    collapsed: { requirements: false, products: false },
  };
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return {
      projectName: typeof parsed.projectName === "string" ? parsed.projectName : "",
      requirements: Array.isArray(parsed.requirements) ? parsed.requirements : [],
      products: Array.isArray(parsed.products) ? parsed.products : [],
      ratings: parsed.ratings && typeof parsed.ratings === "object" ? parsed.ratings : {},
      mustWeight: clamp(Number(parsed.mustWeight ?? 50), 0, 100),
      niceWeight: clamp(Number(parsed.niceWeight ?? 20), 0, 100),
      priceWeight: clamp(Number(parsed.priceWeight ?? 30), 0, 100),
      lockedWeightKey: ["mustWeight", "niceWeight", "priceWeight"].includes(parsed.lockedWeightKey) ? parsed.lockedWeightKey : null,
      collapsed: {
        requirements: Boolean(parsed.collapsed?.requirements),
        products: Boolean(parsed.collapsed?.products),
      },
    };
  } catch {
    return fallback;
  }
}

function persistAndRender() {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render();
}

function render() {
  renderHeaderProjectName();
  renderCollapseUi();
  renderRequirements();
  renderProducts();
  renderMatrix();
  renderResults();
}

function renderHeaderProjectName() {
  projectNameDisplay.textContent = state.projectName
    ? `Projekt: ${state.projectName}`
    : "Frontend-basierte Bewertung mit automatischer Auswertung und PDF-Export";
}

function renderCollapseUi() {
  const reqToggleVisible = state.requirements.length > 1;
  const prdToggleVisible = state.products.length > 2;
  toggleRequirementsBtn.hidden = !reqToggleVisible;
  toggleProductsBtn.hidden = !prdToggleVisible;

  if (!reqToggleVisible) state.collapsed.requirements = false;
  if (!prdToggleVisible) state.collapsed.products = false;

  requirementsBody.classList.toggle("collapsed", state.collapsed.requirements);
  productsBody.classList.toggle("collapsed", state.collapsed.products);

  toggleRequirementsBtn.textContent = state.collapsed.requirements ? "Erweitern" : "Minimieren";
  toggleProductsBtn.textContent = state.collapsed.products ? "Erweitern" : "Minimieren";
}

function renderRequirements() {
  if (!state.requirements.length) {
    requirementsList.innerHTML = "<p class='meta'>Noch keine Anforderungen erfasst.</p>";
    return;
  }

  requirementsList.innerHTML = state.requirements
    .map((req) => {
      const weight = getRequirementWeight(req);
      return `
        <article class="list-item">
          <div class="item-content">
            <div class="item-topline">
              <h3>${escapeHtml(req.title)}</h3>
              <div class="item-badges">
                <button class="pill pill-btn ${req.type}" type="button" data-quick-edit-type="${req.id}" aria-label="Typ für ${escapeHtml(
                  req.title
                )} ändern">${labelType(req.type)}</button>
                <button class="pill pill-btn ${req.priority}" type="button" data-quick-edit-priority="${req.id}" aria-label="Priorität für ${escapeHtml(
                  req.title
                )} ändern">${labelPriority(req.priority)}</button>
              </div>
            </div>
            <p class="meta">${escapeHtml(req.description)}</p>
            <p class="meta">Kategorie: ${escapeHtml(req.category)} | Gewicht: ${weight.toFixed(1)}</p>
            ${req.note ? `<p class="meta">Notiz: ${escapeHtml(req.note)}</p>` : ""}
            <div class="item-actions item-actions-bottom">
              <button class="icon-btn" type="button" data-edit-req="${req.id}" aria-label="Anforderung bearbeiten">✏️</button>
              <button class="icon-btn danger" type="button" data-remove-req="${req.id}" aria-label="Anforderung löschen">🗑️</button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  document.querySelectorAll("[data-remove-req]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-remove-req");
      state.requirements = state.requirements.filter((r) => r.id !== id);
      Object.keys(state.ratings).forEach((key) => {
        if (key.startsWith(`${id}__`)) delete state.ratings[key];
      });
      persistAndRender();
    });
  });

  document.querySelectorAll("[data-edit-req]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-edit-req");
      const req = state.requirements.find((item) => item.id === id);
      if (!req) return;
      requirementForm.elements.title.value = req.title;
      requirementForm.elements.category.value = req.category;
      requirementForm.elements.description.value = req.description;
      requirementForm.elements.type.value = req.type;
      requirementForm.elements.priority.value = req.priority;
      requirementForm.elements.note.value = req.note || "";
      editingRequirementId = req.id;
      setFormEditingState("requirement", true);
    });
  });

  document.querySelectorAll("[data-quick-edit-type]").forEach((btn) => {
    btn.addEventListener("click", () => openQuickEditDialog(btn.getAttribute("data-quick-edit-type"), "type"));
  });

  document.querySelectorAll("[data-quick-edit-priority]").forEach((btn) => {
    btn.addEventListener("click", () => openQuickEditDialog(btn.getAttribute("data-quick-edit-priority"), "priority"));
  });
}

function renderProducts() {
  if (!state.products.length) {
    productsList.innerHTML = "<p class='meta'>Noch keine Produkte erfasst.</p>";
    return;
  }

  productsList.innerHTML = state.products
    .map(
      (prd) => `
      <article class="list-item">
        <div class="item-content">
          <h3>${escapeHtml(prd.name)}</h3>
          <p class="meta">Hersteller: ${escapeHtml(prd.vendor)}</p>
          ${prd.summary ? `<p class="meta">${escapeHtml(prd.summary)}</p>` : ""}
          ${prd.price ? `<p class="meta">Preis: ${escapeHtml(formatPriceCHF(prd.price))}</p>` : ""}
          ${prd.note ? `<p class="meta">Notiz: ${escapeHtml(prd.note)}</p>` : ""}
          <div class="item-actions item-actions-bottom">
            <button class="icon-btn" type="button" data-edit-prd="${prd.id}" aria-label="Produkt bearbeiten">✏️</button>
            <button class="icon-btn danger" type="button" data-remove-prd="${prd.id}" aria-label="Produkt löschen">🗑️</button>
          </div>
        </div>
      </article>
    `
    )
    .join("");

  document.querySelectorAll("[data-remove-prd]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-remove-prd");
      state.products = state.products.filter((p) => p.id !== id);
      Object.keys(state.ratings).forEach((key) => {
        if (key.endsWith(`__${id}`)) delete state.ratings[key];
      });
      persistAndRender();
    });
  });

  document.querySelectorAll("[data-edit-prd]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-edit-prd");
      const product = state.products.find((item) => item.id === id);
      if (!product) return;
      productForm.elements.name.value = product.name;
      productForm.elements.vendor.value = product.vendor;
      productForm.elements.summary.value = product.summary;
      productForm.elements.price.value = product.price || "";
      productForm.elements.note.value = product.note || "";
      editingProductId = product.id;
      setFormEditingState("product", true);
    });
  });
}

function renderMatrix() {
  if (!state.requirements.length || !state.products.length) {
    matrixContainer.innerHTML = "<p class='meta'>Bitte zuerst mindestens eine Anforderung und ein Produkt erfassen.</p>";
    return;
  }

  const filterOptions = [
    { value: "all", label: "Alle Bewertungen" },
    { value: "full", label: "Erfüllt (100%)" },
    { value: "mostly", label: "Mehrheitlich erfüllt (66%)" },
    { value: "partial", label: "Teilweise erfüllt (33%)" },
    { value: "none", label: "Nicht erfüllt (0%)" },
    { value: "na", label: "Nicht bewertet (0%)" },
  ];
  const activeFilter = filterOptions.some((option) => option.value === matrixFilterValue) ? matrixFilterValue : "all";

  let html = `
    <div class="matrix-filter-box">
      <label>
        Filter (Bewertungsmatrix)
        <select id="matrixRatingFilter">
          ${filterOptions
            .map((option) => `<option value="${option.value}" ${option.value === activeFilter ? "selected" : ""}>${option.label}</option>`)
            .join("")}
        </select>
      </label>
    </div>
    <table><thead><tr><th>Anforderung</th>`;
  for (const prd of state.products) {
    html += `<th>${escapeHtml(prd.name)}</th>`;
  }
  html += "</tr></thead><tbody>";

  for (const req of state.requirements) {
    html += `<tr><td><strong>${escapeHtml(req.title)}</strong><br><span class='meta'>${labelType(req.type)} | ${labelPriority(req.priority)}</span></td>`;
    for (const prd of state.products) {
      const key = ratingKey(req.id, prd.id);
      const selected = state.ratings[key] || "na";
      const filteredClass = activeFilter !== "all" && selected !== activeFilter ? " matrix-cell-filtered" : "";
      html += `<td>
        <select data-matrix="${key}" class="${filteredClass.trim()}">
          ${Object.entries(RATING_LABELS)
            .map(([value, label]) => `<option value="${value}" ${selected === value ? "selected" : ""}>${label}</option>`)
            .join("")}
        </select>
      </td>`;
    }
    html += "</tr>";
  }

  html += "</tbody></table>";
  matrixContainer.innerHTML = html;

  document.querySelectorAll("select[data-matrix]").forEach((select) => {
    select.addEventListener("change", () => {
      state.ratings[select.getAttribute("data-matrix")] = select.value;
      persistAndRender();
    });
  });

  const matrixRatingFilter = document.getElementById("matrixRatingFilter");
  matrixRatingFilter?.addEventListener("change", () => {
    matrixFilterValue = matrixRatingFilter.value;
    renderMatrix();
  });
}

function renderResults() {
  if (!state.requirements.length || !state.products.length) {
    resultsContent.innerHTML = "<p class='meta'>Auswertung erscheint automatisch, sobald Daten vorhanden sind.</p>";
    return;
  }

  const evaluation = evaluateProducts();
  const requirementCharts = buildRequirementCharts(evaluation);
  const overallChart = buildOverallChart(evaluation);

  resultsContent.innerHTML = `
    <div class="price-weight-box">
      <label>
        Must-Have Relevanz in der Gesamtauswertung: <strong><span id="mustWeightValue">${evaluation.mustWeight}%</span></strong>
        <div class="weight-control-row">
          <input id="mustWeightSlider" class="weight-slider weight-slider-must" type="range" min="0" max="100" step="1" value="${evaluation.mustWeight}" />
          <label class="weight-lock-label"><input type="radio" name="weightLock" value="mustWeight" ${state.lockedWeightKey === "mustWeight" ? "checked" : ""} /> Koppeln</label>
        </div>
      </label>
      <label>
        Nice to Have Relevanz in der Gesamtauswertung: <strong><span id="niceWeightValue">${evaluation.niceWeight}%</span></strong>
        <div class="weight-control-row">
          <input id="niceWeightSlider" class="weight-slider weight-slider-nice" type="range" min="0" max="100" step="1" value="${evaluation.niceWeight}" />
          <label class="weight-lock-label"><input type="radio" name="weightLock" value="niceWeight" ${state.lockedWeightKey === "niceWeight" ? "checked" : ""} /> Koppeln</label>
        </div>
      </label>
      <label>
        Preis-Relevanz in der Gesamtauswertung: <strong><span id="priceWeightValue">${evaluation.priceWeight}%</span></strong>
        <div class="weight-control-row">
          <input id="priceWeightSlider" class="weight-slider weight-slider-price" type="range" min="0" max="100" step="1" value="${evaluation.priceWeight}" />
          <label class="weight-lock-label"><input type="radio" name="weightLock" value="priceWeight" ${state.lockedWeightKey === "priceWeight" ? "checked" : ""} /> Koppeln</label>
        </div>
      </label>
      <button id="clearWeightLockBtn" type="button" class="btn btn-ghost btn-small">Kopplung entfernen</button>
      <p class="meta">Mit Kopplung bleibt ein Regler fix. Du setzt einen zweiten Regler, der dritte berechnet sich automatisch (gesamt 100%).</p>
    </div>
    <div class="beautiful-chart" id="beautifulChart">
      <h3>Gesamtauswertung je Produkt (inkl. Preisfaktor)</h3>
      ${overallChart}
    </div>
    <div class="beautiful-chart">
      <h3>Erfüllung pro Anforderung (Säulendiagramme)</h3>
      ${requirementCharts}
    </div>
  `;

  applyWeightSliderDisabledState();

  const mustWeightSlider = document.getElementById("mustWeightSlider");
  mustWeightSlider?.addEventListener("input", () => {
    setWeightsWithFixedTotal("mustWeight", Number(mustWeightSlider.value));
    persistAndRender();
  });

  const niceWeightSlider = document.getElementById("niceWeightSlider");
  niceWeightSlider?.addEventListener("input", () => {
    setWeightsWithFixedTotal("niceWeight", Number(niceWeightSlider.value));
    persistAndRender();
  });

  const priceWeightSlider = document.getElementById("priceWeightSlider");
  priceWeightSlider?.addEventListener("input", () => {
    setWeightsWithFixedTotal("priceWeight", Number(priceWeightSlider.value));
    persistAndRender();
  });

  document.querySelectorAll('input[name="weightLock"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      state.lockedWeightKey = radio.value;
      persistAndRender();
    });
  });

  document.getElementById("clearWeightLockBtn")?.addEventListener("click", () => {
    state.lockedWeightKey = null;
    persistAndRender();
  });
}

function setWeightsWithFixedTotal(changedKey, rawValue) {
  if (state.lockedWeightKey && changedKey === state.lockedWeightKey) return;

  const nextValue = clamp(Math.round(Number(rawValue) || 0), 0, 100);
  const keys = ["mustWeight", "niceWeight", "priceWeight"];
  const lockedKey = state.lockedWeightKey;

  if (lockedKey && keys.includes(lockedKey)) {
    const freeKey = keys.find((key) => key !== lockedKey && key !== changedKey);
    if (!freeKey) return;
    const lockedValue = clamp(Math.round(Number(state[lockedKey]) || 0), 0, 100);
    const boundedValue = clamp(nextValue, 0, 100 - lockedValue);
    state[changedKey] = boundedValue;
    state[freeKey] = 100 - lockedValue - boundedValue;
    return;
  }

  const otherKeys = keys.filter((key) => key !== changedKey);
  const remainder = 100 - nextValue;
  const currentOtherTotal = otherKeys.reduce((sum, key) => sum + (Number(state[key]) || 0), 0);

  state[changedKey] = nextValue;
  if (currentOtherTotal <= 0) {
    const firstShare = Math.round(remainder / 2);
    state[otherKeys[0]] = firstShare;
    state[otherKeys[1]] = remainder - firstShare;
    return;
  }

  const firstProportional = (Number(state[otherKeys[0]]) || 0) / currentOtherTotal;
  const firstShare = Math.round(remainder * firstProportional);
  state[otherKeys[0]] = firstShare;
  state[otherKeys[1]] = remainder - firstShare;
}

function applyWeightSliderDisabledState() {
  const sliderMap = {
    mustWeight: document.getElementById("mustWeightSlider"),
    niceWeight: document.getElementById("niceWeightSlider"),
    priceWeight: document.getElementById("priceWeightSlider"),
  };

  Object.entries(sliderMap).forEach(([key, slider]) => {
    if (!slider) return;
    slider.disabled = state.lockedWeightKey === key;
  });
}

function evaluateProducts() {
  normalizeWeightsToHundred();
  const mustWeight = Number.isFinite(state.mustWeight) ? state.mustWeight : 50;
  const niceWeight = Number.isFinite(state.niceWeight) ? state.niceWeight : 20;
  const priceWeight = Number.isFinite(state.priceWeight) ? state.priceWeight : 30;
  const maxMustPoints = state.requirements.filter((req) => req.type === "must").reduce((sum, req) => sum + getRequirementWeight(req), 0);
  const maxNicePoints = state.requirements.filter((req) => req.type === "nice").reduce((sum, req) => sum + getRequirementWeight(req), 0);
  const maxPoints = maxMustPoints + maxNicePoints;

  const ranked = state.products.map((prd) => {
    let points = 0;
    let mustPoints = 0;
    let nicePoints = 0;
    const failedCritical = [];

    state.requirements.forEach((req) => {
      const key = ratingKey(req.id, prd.id);
      const rating = state.ratings[key] || "na";
      const factor = RATING_FACTOR[rating] ?? 0;
      const reqWeight = getRequirementWeight(req);

      points += reqWeight * factor;
      if (req.type === "must") mustPoints += reqWeight * factor;
      if (req.type === "nice") nicePoints += reqWeight * factor;

      if (req.priority === "critical" && ["partial", "none"].includes(rating)) {
        failedCritical.push(req.title);
      }
    });

    const excluded = failedCritical.length > 0;
    const percent = maxPoints > 0 ? (points / maxPoints) * 100 : 0;
    const mustPercent = maxMustPoints > 0 ? (mustPoints / maxMustPoints) * 100 : 0;
    const nicePercent = maxNicePoints > 0 ? (nicePoints / maxNicePoints) * 100 : 0;

    return {
      id: prd.id,
      name: prd.name,
      points,
      percent,
      failedCritical,
      excluded,
      priceRaw: prd.price || "",
      priceValue: extractPriceValue(prd.price),
      priceScore: 0,
      finalScore: percent,
      weightedMustScore: 0,
      weightedNiceScore: 0,
      weightedPriceScore: 0,
      mustPercent,
      nicePercent,
    };
  });

  const qualified = ranked.filter((item) => !item.excluded && Number.isFinite(item.priceValue));
  if (qualified.length) {
    const minPrice = Math.min(...qualified.map((item) => item.priceValue));
    const maxPrice = Math.max(...qualified.map((item) => item.priceValue));
    ranked.forEach((item) => {
      if (!Number.isFinite(item.priceValue)) {
        item.priceScore = 50;
      } else if (maxPrice === minPrice) {
        item.priceScore = 100;
      } else {
        const relativeScore = (maxPrice - item.priceValue) / (maxPrice - minPrice);
        item.priceScore = 50 + relativeScore * 50;
      }
      const totalWeight = mustWeight + niceWeight + priceWeight;
      item.weightedMustScore = totalWeight > 0 ? (item.mustPercent * mustWeight) / totalWeight : 0;
      item.weightedNiceScore = totalWeight > 0 ? (item.nicePercent * niceWeight) / totalWeight : 0;
      item.weightedPriceScore = totalWeight > 0 ? (item.priceScore * priceWeight) / totalWeight : 0;
      item.finalScore = clamp(item.weightedMustScore + item.weightedNiceScore + item.weightedPriceScore, 0, 100);
    });
  } else {
    ranked.forEach((item) => {
      item.priceScore = 50;
      const totalWeight = mustWeight + niceWeight + priceWeight;
      item.weightedMustScore = totalWeight > 0 ? (item.mustPercent * mustWeight) / totalWeight : 0;
      item.weightedNiceScore = totalWeight > 0 ? (item.nicePercent * niceWeight) / totalWeight : 0;
      item.weightedPriceScore = totalWeight > 0 ? (item.priceScore * priceWeight) / totalWeight : 0;
      item.finalScore = clamp(item.weightedMustScore + item.weightedNiceScore + item.weightedPriceScore, 0, 100);
    });
  }

  ranked.sort((a, b) => {
    if (a.excluded !== b.excluded) return a.excluded ? 1 : -1;
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    return b.points - a.points;
  });

  return { maxPoints, ranking: ranked, mustWeight, niceWeight, priceWeight };
}

function buildRequirementCharts(evaluation, compact = false) {
  if (!state.requirements.length || !state.products.length) {
    return "<p class='meta'>Keine Daten für Anforderungsdiagramme vorhanden.</p>";
  }

  return state.requirements
    .map((req) => {
      const bars = state.products
        .map((prd) => {
          const rating = state.ratings[ratingKey(req.id, prd.id)] || "na";
          const percent = (RATING_FACTOR[rating] ?? 0) * 100;
          const safeHeight = Math.max(4, Math.min(100, percent));
          const failedCriticalClass = req.priority === "critical" && ["partial", "none"].includes(rating) ? " failed-critical" : "";
          return `
            <div class="mini-chart-col">
              <div class="mini-chart-track">
                <div class="mini-chart-fill type-${req.type}${failedCriticalClass}" style="height:${safeHeight}%">${percent.toFixed(0)}%</div>
              </div>
              <div class="mini-chart-label">${escapeHtml(prd.name)}</div>
            </div>
          `;
        })
        .join("");

      const compactStyle = compact ? " style='break-inside:avoid;margin-bottom:12px;'" : "";
      return `
        <article class="requirement-chart"${compactStyle}>
          <h4>${escapeHtml(req.title)}</h4>
          <div class="mini-chart-grid">${bars}</div>
        </article>
      `;
    })
    .join("");
}

function buildOverallChart(evaluation) {
  if (!evaluation.ranking.length) {
    return "<p class='meta'>Keine Produkte für die Gesamtauswertung vorhanden.</p>";
  }

  return evaluation.ranking
    .map((item) => `
      <div class="chart-row">
        <div class="chart-label ${item.excluded ? "muted-product" : ""}">${escapeHtml(item.name)}</div>
        <div class="chart-bars">
          <div class="bar final ${item.excluded ? "excluded" : ""}" style="width:${Math.max(2, Math.min(100, item.finalScore))}%">Gesamt ${item.finalScore.toFixed(1)}%</div>
          <div class="bar must ${item.excluded ? "excluded" : ""}" style="width:${Math.max(2, Math.min(100, item.weightedMustScore))}%">Must-Have ${item.weightedMustScore.toFixed(1)}%</div>
          <div class="bar nice ${item.excluded ? "excluded" : ""}" style="width:${Math.max(2, Math.min(100, item.weightedNiceScore))}%">Nice to Have ${item.weightedNiceScore.toFixed(1)}%</div>
          <div class="bar price ${item.excluded ? "excluded" : ""}" style="width:${Math.max(2, Math.min(100, item.weightedPriceScore))}%">Preisanteil ${item.weightedPriceScore.toFixed(1)}%</div>
        </div>
        ${item.excluded ? "<p class='meta excluded-note'>Hat eine zwingende Anforderung nicht erfüllt.</p>" : ""}
      </div>
    `)
    .join("");
}

function buildPdfReportNode() {
  const wrapper = document.createElement("div");
  const evaluation = evaluateProducts();
  const date = new Date().toLocaleDateString("de-DE");
  const headingColor = "#a3b26b";
  const productList = state.products
    .map((prd) => `<li><strong>${escapeHtml(prd.name)}</strong> – ${escapeHtml(prd.vendor)} – ${escapeHtml(formatPriceCHF(prd.price || "k. A."))}</li>`)
    .join("");
  const overallChart = buildOverallChart(evaluation);
  const requirementCharts = buildRequirementCharts(evaluation, true);

  wrapper.style.fontFamily = "Inter, Arial, sans-serif";
  wrapper.style.color = "#1f2937";
  wrapper.innerHTML = `
    <style>
      .pdf-page {
        padding: 14mm;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        gap: 8mm;
        position: relative;
        page-break-after: always;
        break-after: page;
      }
      .pdf-page.has-fixed-footer {
        padding-bottom: 52mm;
      }
      .pdf-page-content {
        flex: 1;
      }
      .pdf-page:last-of-type {
        page-break-after: auto;
        break-after: auto;
      }
      .pdf-title-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8mm;
      }
      .pdf-footer {
        padding: 4mm 0 0;
        display: flex;
        justify-content: space-between;
        gap: 8mm;
        border-top: 1px solid #d7dee8;
        background: #ffffff;
        font-size: 10px;
        line-height: 1.35;
        color: #475569;
      }
      .pdf-page.has-fixed-footer .pdf-footer {
        position: absolute;
        left: 14mm;
        right: 14mm;
        bottom: 0;
      }
      .pdf-footer-left,
      .pdf-footer-right {
        padding: 4mm 5mm;
      }
      .pdf-footer-right { text-align: right; color: #334155; }
      .pdf-muted { color: #64748b; }
      .chart-row { margin-bottom: 20px; }
      .chart-row:last-child { margin-bottom: 0; }
      .chart-label { font-size: 11px; font-weight: 600; margin-bottom: 2px; }
      .chart-label.muted-product { color: #7c8798; }
      .chart-bars { display: grid; gap: 5px; }
      .bar {
        border-radius: 9px;
        font-size: 10px;
        padding: 4px 8px;
        color: #0f172a;
      }
      .bar.final { background: #60a5fa; color: #0b2a52; }
      .bar.must { background: #93c5fd; color: #0b2a52; }
      .bar.nice { background: #c7d2fe; color: #312e81; }
      .bar.price { background: #bfdbfe; color: #0b2a52; }
      .bar.excluded { background: #fecaca; color: #7f1d1d; }
      .excluded-note { margin-top: 4px; color: #6b7280; font-size: 10px; }
      .requirement-chart { border: none; border-radius: 0; padding: 0; margin: 0 0 12px; background: transparent; }
      .requirement-chart h4 { margin: 0 0 6px; font-size: 12px; font-weight: 600; }
      .mini-chart-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(70px, 1fr)); gap: 8px; }
      .mini-chart-track { background: #e5e7eb; border-radius: 8px; min-height: 90px; }
      .mini-chart-fill { color: #0b2a52; font-size: 9px; }
      .mini-chart-fill.type-must { background: #93c5fd; }
      .mini-chart-fill.type-nice { background: #c7d2fe; color: #312e81; }
      .mini-chart-fill.failed-critical { background: #fecaca; color: #7f1d1d; }
      .mini-chart-label { font-size: 9px; color: #475569; }
    </style>

    <section class="pdf-page has-fixed-footer">
      <div class="pdf-page-content">
        <div class="pdf-title-row">
          <div>
            <h1 style="margin:0 0 2px 0;color:${headingColor};">${escapeHtml(getProjectName())}</h1>
            <p style="margin:0;font-size:20px;font-weight:700;color:${headingColor};">Evaluation Rapport</p>
            <p style="margin:2px 0 16px 0;color:#475569;">Datum: ${date}</p>
          </div>
          <img
            src="logo.PNG"
            alt="Logo"
            style="max-width:140px;max-height:56px;object-fit:contain;"
            onerror="this.onerror=null;this.src='Logo.png';"
          />
        </div>
        <h2 style="color:${headingColor};padding-left:2px;margin:0 0 4mm;">Produkte</h2>
        <ul class="pdf-muted">
          ${productList || "<li>Keine Produkte vorhanden.</li>"}
        </ul>
      </div>
      ${buildPdfFooter()}
    </section>

    <section class="pdf-page">
      <div class="pdf-page-content">
        <h2 style="color:${headingColor};padding-left:2px;margin:0 0 4mm;">Gesamtauswertung</h2>
        ${overallChart || "<p>Keine Gesamtauswertung verfügbar.</p>"}
      </div>
    </section>

    <section class="pdf-page">
      <div class="pdf-page-content">
        <h2 style="color:${headingColor};padding-left:2px;margin:0 0 4mm;">Säulendiagramme je Anforderung</h2>
        ${requirementCharts || "<p>Keine Grafik verfügbar.</p>"}
      </div>
    </section>
  `;

  return wrapper;
}

function buildPdfFooter() {
  return `
    <div class="pdf-footer">
      <div class="pdf-footer-left">
        <div>Verein Kooperative Speicherbibliothek Schweiz</div>
        <div>Grammattenstrasse 15</div>
        <div>CH-6233 Büron</div>
      </div>
      <div class="pdf-footer-right">
        <div><strong>Mike Märki</strong></div>
        <div>Tel. 041 932 00 00</div>
        <div>mike.maerki@speicherbibliothek.ch</div>
        <div>www.speicherbibliothek.ch</div>
      </div>
    </div>
  `;
}

function getRequirementWeight(req) {
  return PRIORITY_POINTS[req.priority] * TYPE_FACTOR[req.type];
}

function extractPriceValue(priceText) {
  if (!priceText) return Number.NaN;
  const cleaned = priceText.replace(/\./g, "").replace(",", ".");
  const match = cleaned.match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : Number.NaN;
}

function formatPriceCHF(priceText) {
  const value = (priceText || "").trim();
  if (!value || value.toLowerCase() === "k. a.") return "k. A.";
  return /\bCHF\b/i.test(value) ? value : `${value} CHF`;
}

function rowsToRequirements(rows) {
  const requiredHeaders = ["title", "category", "description", "type", "priority"];
  ensureHeaders(rows.headers, requiredHeaders, "Anforderungen");

  const rowsWithoutEmpty = rows.data.filter((entry) => Object.values(entry).some((value) => value.trim() !== ""));
  const imported = rowsWithoutEmpty.map((entry, idx) => {
    const type = normalizeType(entry.type);
    const priority = normalizePriority(entry.priority);

    if (!entry.title.trim() || !entry.category.trim() || !entry.description.trim()) {
      throw new Error(`Anforderungen CSV: Pflichtfeld leer in Zeile ${idx + 2}.`);
    }

    return {
      id: makeId("req"),
      title: entry.title.trim(),
      category: entry.category.trim(),
      description: entry.description.trim(),
      type,
      priority,
      note: (entry.note || "").trim(),
    };
  });

  if (!imported.length) {
    throw new Error("Anforderungen CSV enthält keine Datenzeilen.");
  }

  return imported;
}

function rowsToProducts(rows) {
  const requiredHeaders = ["name", "vendor", "price"];
  ensureHeaders(rows.headers, requiredHeaders, "Produkte");

  const rowsWithoutEmpty = rows.data.filter((entry) => Object.values(entry).some((value) => value.trim() !== ""));
  const imported = rowsWithoutEmpty.map((entry, idx) => {
    if (!entry.name.trim() || !entry.vendor.trim() || !entry.price.trim()) {
      throw new Error(`Produkte CSV: Pflichtfeld leer in Zeile ${idx + 2}.`);
    }

    return {
      id: makeId("prd"),
      name: entry.name.trim(),
      vendor: entry.vendor.trim(),
      summary: (entry.summary || "").trim(),
      price: (entry.price || "").trim(),
      note: (entry.note || "").trim(),
    };
  });

  if (!imported.length) {
    throw new Error("Produkte CSV enthält keine Datenzeilen.");
  }

  return imported;
}

function ensureHeaders(actualHeaders, requiredHeaders, context) {
  const normalized = actualHeaders.map((header) => header.toLowerCase().trim());
  const missing = requiredHeaders.filter((required) => !normalized.includes(required));
  if (missing.length) {
    throw new Error(`${context} CSV: Fehlende Spalten: ${missing.join(", ")}.`);
  }
}

function parseCsv(csvText) {
  const lines = csvText.replace(/^\uFEFF/, "").replaceAll("\r\n", "\n").split("\n").filter((line) => line.trim() !== "");
  if (!lines.length) throw new Error("CSV ist leer.");

  const headers = splitCsvLine(lines[0]).map((value) => value.trim());
  const data = lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    const row = {};
    headers.forEach((header, idx) => {
      row[header.toLowerCase()] = (values[idx] || "").trim();
    });
    return row;
  });

  return { headers, data };
}

function splitCsvLine(line) {
  const values = [];
  let value = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      const nextChar = line[i + 1];
      if (inQuotes && nextChar === '"') {
        value += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      values.push(value);
      value = "";
    } else {
      value += char;
    }
  }
  values.push(value);
  return values;
}

function normalizeType(value) {
  const normalized = value.trim().toLowerCase();
  if (normalized === "must" || normalized === "must-have") return "must";
  if (normalized === "nice" || normalized === "nice-to-have") return "nice";
  throw new Error(`Anforderungen CSV: Ungültiger Typ "${value}". Erlaubt: must oder nice.`);
}

function normalizePriority(value) {
  const normalized = value.trim().toLowerCase();
  if (["critical", "high", "medium", "low"].includes(normalized)) return normalized;
  throw new Error(`Anforderungen CSV: Ungültige Priorität "${value}". Erlaubt: critical, high, medium, low.`);
}

function downloadCsvFile(filename, rows) {
  const content = rows.map((row) => row.map((value) => toCsvCell(value)).join(",")).join("\n");
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function toCsvCell(value) {
  const text = value.toString();
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function buildProjectCsvRows() {
  const rows = [["section", "id", "field", "value"]];
  rows.push(["meta", "project", "version", "3"]);
  rows.push(["meta", "project", "exportedAt", new Date().toISOString()]);
  rows.push(["meta", "project", "projectName", getProjectName()]);
  rows.push(["meta", "project", "mustWeight", String(state.mustWeight ?? 50)]);
  rows.push(["meta", "project", "niceWeight", String(state.niceWeight ?? 20)]);
  rows.push(["meta", "project", "priceWeight", String(state.priceWeight ?? 30)]);

  state.requirements.forEach((req) => {
    rows.push(["requirements", req.id, "title", req.title]);
    rows.push(["requirements", req.id, "category", req.category]);
    rows.push(["requirements", req.id, "description", req.description]);
    rows.push(["requirements", req.id, "type", req.type]);
    rows.push(["requirements", req.id, "priority", req.priority]);
    rows.push(["requirements", req.id, "note", req.note || ""]);
  });

  state.products.forEach((prd) => {
    rows.push(["products", prd.id, "name", prd.name]);
    rows.push(["products", prd.id, "vendor", prd.vendor]);
    rows.push(["products", prd.id, "summary", prd.summary]);
    rows.push(["products", prd.id, "price", prd.price || ""]);
    rows.push(["products", prd.id, "note", prd.note || ""]);
  });

  Object.entries(state.ratings).forEach(([key, rating]) => {
    rows.push(["ratings", key, "rating", rating]);
  });

  return rows;
}

function rowsToProjectState(rows) {
  const requiredHeaders = ["section", "id", "field", "value"];
  ensureHeaders(rows.headers, requiredHeaders, "Projekt");

  const requirementsMap = new Map();
  const productsMap = new Map();
  const ratings = {};
  const meta = {};

  rows.data.forEach((entry, idx) => {
    const section = (entry.section || "").trim().toLowerCase();
    const id = (entry.id || "").trim();
    const field = (entry.field || "").trim().toLowerCase();
    const value = (entry.value || "").trim();
    const rowNo = idx + 2;

    if (section === "meta") {
      meta[field] = value;
      return;
    }

    if (!section || !id || !field) {
      throw new Error(`Projekt CSV: Ungültige Zeile ${rowNo}. section, id und field sind Pflicht.`);
    }

    if (section === "requirements") {
      if (!requirementsMap.has(id)) requirementsMap.set(id, { id, title: "", category: "", description: "", type: "", priority: "", note: "" });
      requirementsMap.get(id)[field] = value;
      return;
    }

    if (section === "products") {
      if (!productsMap.has(id)) productsMap.set(id, { id, name: "", vendor: "", summary: "", price: "", note: "" });
      productsMap.get(id)[field] = value;
      return;
    }

    if (section === "ratings") {
      if (field !== "rating") {
        throw new Error(`Projekt CSV: Ungültiges Feld in Zeile ${rowNo}. Für ratings nur field=rating erlaubt.`);
      }
      if (!Object.hasOwn(RATING_LABELS, value)) {
        throw new Error(`Projekt CSV: Ungültiger Rating-Wert in Zeile ${rowNo}.`);
      }
      ratings[id] = value;
      return;
    }

    throw new Error(`Projekt CSV: Unbekannte section "${section}" in Zeile ${rowNo}.`);
  });

  const requirements = Array.from(requirementsMap.values()).map((req, idx) => {
    if (!req.title || !req.category || !req.description) {
      throw new Error(`Projekt CSV: Unvollständige Anforderung in Block ${idx + 1}.`);
    }
    req.type = normalizeType(req.type);
    req.priority = normalizePriority(req.priority);
    return req;
  });

  const products = Array.from(productsMap.values()).map((prd, idx) => {
    if (!prd.name || !prd.vendor || !prd.price) {
      throw new Error(`Projekt CSV: Unvollständiges Produkt in Block ${idx + 1}.`);
    }
    return prd;
  });

  const requirementIds = new Set(requirements.map((item) => item.id));
  const productIds = new Set(products.map((item) => item.id));
  const filteredRatings = {};
  Object.entries(ratings).forEach(([key, rating]) => {
    const [reqId, prdId] = key.split("__");
    if (requirementIds.has(reqId) && productIds.has(prdId)) {
      filteredRatings[key] = rating;
    }
  });

  return {
    projectName: meta.projectname || "Importiertes Projekt",
    mustWeight: clamp(Number(meta.mustweight ?? 50), 0, 100),
    niceWeight: clamp(Number(meta.niceweight ?? 20), 0, 100),
    priceWeight: clamp(Number(meta.priceweight ?? 30), 0, 100),
    requirements,
    products,
    ratings: filteredRatings,
    collapsed: { requirements: false, products: false },
  };
}

function ratingKey(requirementId, productId) {
  return `${requirementId}__${productId}`;
}

function makeId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function labelType(type) {
  return type === "must" ? "Must-have" : "Nice-to-have";
}

function labelPriority(priority) {
  return {
    critical: "Zwingend",
    high: "Hoch",
    medium: "Mittel",
    low: "Niedrig",
  }[priority];
}

function getProjectName() {
  return state.projectName?.trim() || "Evaluation";
}

function slugifyProjectName(name) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "evaluation";
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

function escapeHtml(value) {
  return value
    .toString()
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function initializeProjectPicker() {
  if (!Number.isFinite(state.mustWeight)) state.mustWeight = 50;
  if (!Number.isFinite(state.niceWeight)) state.niceWeight = 20;
  if (!Number.isFinite(state.priceWeight)) state.priceWeight = 30;
  if (!["mustWeight", "niceWeight", "priceWeight", null].includes(state.lockedWeightKey)) state.lockedWeightKey = null;
  normalizeWeightsToHundred();
  render();
  if (!state.projectName && typeof projectDialog.showModal === "function" && !projectDialog.open) {
    projectDialog.showModal();
  }
}

function normalizeWeightsToHundred() {
  const rawMust = Number(state.mustWeight) || 0;
  const rawNice = Number(state.niceWeight) || 0;
  const rawPrice = Number(state.priceWeight) || 0;
  const total = rawMust + rawNice + rawPrice;

  if (total <= 0) {
    state.mustWeight = 50;
    state.niceWeight = 20;
    state.priceWeight = 30;
    return;
  }

  const must = Math.round((rawMust / total) * 100);
  const nice = Math.round((rawNice / total) * 100);
  state.mustWeight = must;
  state.niceWeight = nice;
  state.priceWeight = 100 - must - nice;
}

function openHelperDialog(type, mode) {
  const config = csvAssistantConfig[type];
  const showPrompt = mode === "prompt";
  helperDialogTitle.textContent = showPrompt ? `${config.label}: ChatGPT Prompt` : `${config.label}: Info`;
  helperDialogText.textContent = showPrompt ? "Kopiere den Prompt und füge darunter deinen Fließtext ein." : config.info;
  helperDialogPrompt.hidden = !showPrompt;
  helperDialogPrompt.textContent = showPrompt ? config.prompt : "";
  helperDialogOpenChatgptBtn.hidden = !showPrompt;
  helperDialogOpenChatgptBtn.setAttribute("data-prompt", showPrompt ? config.prompt : "");
  helperDialog.showModal();
}

function openQuickEditDialog(requirementId, field) {
  const requirement = state.requirements.find((item) => item.id === requirementId);
  if (!requirement) return;

  pendingQuickEdit = { requirementId, field };
  quickEditTitle.textContent = field === "type" ? "Typ direkt ändern" : "Priorität direkt ändern";
  quickEditLabel.textContent = field === "type" ? "Typ auswählen" : "Priorität auswählen";

  const options =
    field === "type"
      ? [
          { value: "must", label: "Must-have" },
          { value: "nice", label: "Nice-to-have" },
        ]
      : [
          { value: "critical", label: "Zwingend" },
          { value: "high", label: "Hoch" },
          { value: "medium", label: "Mittel" },
          { value: "low", label: "Niedrig" },
        ];

  const selectedValue = field === "type" ? requirement.type : requirement.priority;
  quickEditSelect.innerHTML = options
    .map((option) => `<option value="${option.value}" ${selectedValue === option.value ? "selected" : ""}>${option.label}</option>`)
    .join("");
  quickEditDialog.showModal();
}

function applyQuickEditSelection() {
  if (!pendingQuickEdit) return;
  const { requirementId, field } = pendingQuickEdit;
  const selectedValue = quickEditSelect.value;
  state.requirements = state.requirements.map((req) =>
    req.id === requirementId
      ? {
          ...req,
          [field]: selectedValue,
        }
      : req
  );
  pendingQuickEdit = null;
  quickEditDialog.close();
  persistAndRender();
}

function setFormEditingState(kind, isEditing) {
  const form = kind === "requirement" ? requirementForm : productForm;
  const submitBtn = form.querySelector("button[type='submit']");
  submitBtn.textContent = isEditing ? "Änderung speichern" : kind === "requirement" ? "Anforderung hinzufügen" : "Produkt hinzufügen";
}

initializeProjectPicker();
