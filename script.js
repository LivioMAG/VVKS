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
  partial: 0.5,
  none: 0,
  na: 0,
};

const RATING_LABELS = {
  full: "Erfüllt",
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
const toggleRequirementsBtn = document.getElementById("toggleRequirementsBtn");
const toggleProductsBtn = document.getElementById("toggleProductsBtn");
const requirementsBody = document.getElementById("requirementsBody");
const productsBody = document.getElementById("productsBody");

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
      "Erstelle eine CSV-Datei zum Download (kein Fließtext). Nutze exakt die Spalten: name,vendor,summary,price,note. Unten folgen Produktinformationen als Fließtext. Extrahiere alle Produkte in eine saubere CSV mit einer Zeile pro Produkt.",
  },
};
let editingRequirementId = null;
let editingProductId = null;

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
    state.priceWeight = importedState.priceWeight;
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
    margin: [10, 8, 10, 8],
    filename: `${slugifyProjectName(getProjectName())}-report-${new Date().toISOString().slice(0, 10)}.pdf`,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: "mm", format: "a4", orientation: "landscape" },
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
toggleRequirementsBtn.addEventListener("click", () => {
  state.collapsed.requirements = !state.collapsed.requirements;
  persistAndRender();
});
toggleProductsBtn.addEventListener("click", () => {
  state.collapsed.products = !state.collapsed.products;
  persistAndRender();
});

function loadState() {
  const fallback = { projectName: "", requirements: [], products: [], ratings: {}, collapsed: { requirements: false, products: false } };
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return {
      projectName: typeof parsed.projectName === "string" ? parsed.projectName : "",
      requirements: Array.isArray(parsed.requirements) ? parsed.requirements : [],
      products: Array.isArray(parsed.products) ? parsed.products : [],
      ratings: parsed.ratings && typeof parsed.ratings === "object" ? parsed.ratings : {},
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
          <div>
            <h3>${escapeHtml(req.title)}</h3>
            <p class="meta">${escapeHtml(req.description)}</p>
            <p class="meta">Kategorie: ${escapeHtml(req.category)} | Gewicht: ${weight.toFixed(1)}</p>
            ${req.note ? `<p class="meta">Notiz: ${escapeHtml(req.note)}</p>` : ""}
          </div>
          <div class="item-actions">
            <span class="pill ${req.type}">${labelType(req.type)}</span>
            <span class="pill ${req.priority}">${labelPriority(req.priority)}</span>
            <button class="icon-btn" type="button" data-edit-req="${req.id}" aria-label="Anforderung bearbeiten">✏️</button>
            <button class="icon-btn danger" type="button" data-remove-req="${req.id}" aria-label="Anforderung löschen">🗑️</button>
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
        <div>
          <h3>${escapeHtml(prd.name)}</h3>
          <p class="meta">Hersteller: ${escapeHtml(prd.vendor)}</p>
          <p class="meta">${escapeHtml(prd.summary)}</p>
          ${prd.price ? `<p class="meta">Preis: ${escapeHtml(prd.price)}</p>` : ""}
          ${prd.note ? `<p class="meta">Notiz: ${escapeHtml(prd.note)}</p>` : ""}
        </div>
        <div class="item-actions">
          <button class="icon-btn" type="button" data-edit-prd="${prd.id}" aria-label="Produkt bearbeiten">✏️</button>
          <button class="icon-btn danger" type="button" data-remove-prd="${prd.id}" aria-label="Produkt löschen">🗑️</button>
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

  let html = "<table><thead><tr><th>Anforderung</th>";
  for (const prd of state.products) {
    html += `<th>${escapeHtml(prd.name)}</th>`;
  }
  html += "</tr></thead><tbody>";

  for (const req of state.requirements) {
    html += `<tr><td><strong>${escapeHtml(req.title)}</strong><br><span class='meta'>${labelType(req.type)} | ${labelPriority(req.priority)}</span></td>`;
    for (const prd of state.products) {
      const key = ratingKey(req.id, prd.id);
      const selected = state.ratings[key] || "na";
      html += `<td>
        <select data-matrix="${key}">
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
}

function renderResults() {
  if (!state.requirements.length || !state.products.length) {
    resultsContent.innerHTML = "<p class='meta'>Auswertung erscheint automatisch, sobald Daten vorhanden sind.</p>";
    return;
  }

  const evaluation = evaluateProducts();
  const winnerId = evaluation.ranking[0]?.id;

  const cards = evaluation.ranking
    .map((item, idx) => {
      const excluded = item.failedCritical.length > 0;
      return `
        <article class="score-card ${winnerId === item.id && !excluded ? "winner" : ""}">
          <h3>${idx + 1}. ${escapeHtml(item.name)}</h3>
          <p class="meta">Anforderungs-Punkte: <strong>${item.points.toFixed(2)}</strong> / ${evaluation.maxPoints.toFixed(2)}</p>
          <p class="meta">Erfüllung: <strong>${item.percent.toFixed(1)}%</strong></p>
          <p class="meta">Preis: <strong>${item.priceRaw || "k. A."}</strong></p>
          <p class="${excluded ? "status-bad" : "status-ok"}">
            ${excluded ? "Ausgeschlossen (zwingende Anforderung nicht erfüllt)" : "Zulässig"}
          </p>
        </article>
      `;
    })
    .join("");

  const qualified = evaluation.ranking.filter((item) => !item.excluded);
  const chartRows = qualified.length
    ? qualified
        .map((item) => {
          const finalWidth = Math.max(0, Math.min(100, item.finalScore));
          const functionalWidth = Math.max(0, Math.min(100, item.percent));
          const priceWidth = Math.max(0, Math.min(100, item.priceScore));
          return `
            <div class="chart-row">
              <div class="chart-label">${escapeHtml(item.name)}</div>
              <div class="chart-bars">
                <div class="bar final" style="width:${finalWidth}%">Gesamt ${finalWidth.toFixed(1)}%</div>
                <div class="bar functional" style="width:${functionalWidth}%">Anforderung ${functionalWidth.toFixed(1)}%</div>
                <div class="bar price" style="width:${priceWidth}%">Preis ${priceWidth.toFixed(1)}%</div>
              </div>
            </div>
          `;
        })
        .join("")
    : "<p class='meta'>Keine zulässigen Produkte für die Preis-Gesamtauswertung vorhanden.</p>";

  const detailsRows = evaluation.ranking
    .map((item, idx) => {
      const failed = item.failedCritical.length ? item.failedCritical.map((r) => escapeHtml(r)).join(", ") : "Keine";
      return `
        <tr>
          <td>${idx + 1}</td>
          <td>${escapeHtml(item.name)}</td>
          <td>${item.points.toFixed(2)}</td>
          <td>${item.percent.toFixed(1)}%</td>
          <td>${item.priceScore.toFixed(1)}%</td>
          <td>${item.finalScore.toFixed(1)}%</td>
          <td>${item.failedCritical.length ? `<span class='status-bad'>${failed}</span>` : `<span class='status-ok'>Keine</span>`}</td>
        </tr>
      `;
    })
    .join("");

  const winner = evaluation.ranking.find((i) => i.id === winnerId);
  const winnerText = winner
    ? `<p><strong>Bestes Produkt:</strong> ${escapeHtml(winner.name)} (${winner.finalScore.toFixed(1)}% Gesamt)</p>`
    : "<p>Kein Gewinner vorhanden.</p>";

  resultsContent.innerHTML = `
    <div class="result-grid">${cards}</div>
    <div class="price-weight-box">
      <label>
        Preis-Relevanz in der Gesamtauswertung: <strong><span id="priceWeightValue">${evaluation.priceWeight}%</span></strong>
        <input id="priceWeightSlider" type="range" min="0" max="100" step="5" value="${evaluation.priceWeight}" />
      </label>
      <p class="meta">0% = nur Anforderungserfüllung, 100% = nur Preisvergleich.</p>
    </div>
    ${winnerText}
    <div class="beautiful-chart" id="beautifulChart">
      <h3>Grafische Gesamtauswertung (inkl. Preisfaktor)</h3>
      ${chartRows}
    </div>
    <table>
      <thead>
        <tr>
          <th>Ranking</th>
          <th>Produkt</th>
          <th>Punkte</th>
          <th>Anforderungen</th>
          <th>Preis-Score</th>
          <th>Gesamt-Score</th>
          <th>Zwingende nicht erfüllt</th>
        </tr>
      </thead>
      <tbody>${detailsRows}</tbody>
    </table>
  `;

  const priceWeightSlider = document.getElementById("priceWeightSlider");
  priceWeightSlider?.addEventListener("input", () => {
    state.priceWeight = Number(priceWeightSlider.value);
    persistAndRender();
  });
}

function evaluateProducts() {
  const maxPoints = state.requirements.reduce((sum, req) => sum + getRequirementWeight(req), 0);
  const priceWeight = Number.isFinite(state.priceWeight) ? state.priceWeight : 30;

  const ranked = state.products.map((prd) => {
    let points = 0;
    const failedCritical = [];

    state.requirements.forEach((req) => {
      const key = ratingKey(req.id, prd.id);
      const rating = state.ratings[key] || "na";
      const factor = RATING_FACTOR[rating] ?? 0;
      const reqWeight = getRequirementWeight(req);

      points += reqWeight * factor;

      if (req.priority === "critical" && rating !== "full") {
        failedCritical.push(req.title);
      }
    });

    const excluded = failedCritical.length > 0;
    const percent = maxPoints > 0 ? (points / maxPoints) * 100 : 0;

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
        item.priceScore = ((maxPrice - item.priceValue) / (maxPrice - minPrice)) * 100;
      }
      item.finalScore = item.percent * ((100 - priceWeight) / 100) + item.priceScore * (priceWeight / 100);
    });
  } else {
    ranked.forEach((item) => {
      item.priceScore = 50;
      item.finalScore = item.percent;
    });
  }

  ranked.sort((a, b) => {
    if (a.excluded !== b.excluded) return a.excluded ? 1 : -1;
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    return b.points - a.points;
  });

  return { maxPoints, ranking: ranked, priceWeight };
}

function buildPdfReportNode() {
  const wrapper = document.createElement("div");
  const evaluation = evaluateProducts();
  const date = new Date().toLocaleDateString("de-DE");
  const topProducts = evaluation.ranking.filter((item) => !item.excluded).slice(0, 2);
  const chartRows = topProducts
    .map(
      (item) => `
      <div style="margin-bottom:10px;">
        <div style="font-weight:600;margin-bottom:4px;">${escapeHtml(item.name)}</div>
        <div style="height:24px;background:#dbeafe;border-radius:8px;width:${Math.max(1, Math.min(100, item.finalScore))}%;padding:3px 8px;color:#1e3a8a;">Gesamt ${item.finalScore.toFixed(1)}%</div>
      </div>`
    )
    .join("");

  wrapper.style.padding = "16px";
  wrapper.style.fontFamily = "Inter, Arial, sans-serif";
  wrapper.style.color = "#1f2937";
  wrapper.innerHTML = `
    <h1 style="margin-bottom:4px;">${escapeHtml(getProjectName())}</h1>
    <p style="margin-top:0;color:#6b7280;">Evaluation Report – ${date}</p>

    <h2>Top 2 Produkte</h2>
    <ul>
      ${topProducts.map((item) => `<li><strong>${escapeHtml(item.name)}</strong> – Gesamt ${item.finalScore.toFixed(1)}%</li>`).join("") || "<li>Keine zulässigen Produkte vorhanden.</li>"}
    </ul>

    <h2>Anforderungen (nur Titel)</h2>
    <ul>
      ${state.requirements.map((req) => `<li>${escapeHtml(req.title)}</li>`).join("")}
    </ul>

    <h2>Grafische Auswertung</h2>
    ${chartRows || "<p>Keine Grafik verfügbar.</p>"}
  `;

  return wrapper;
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
  const requiredHeaders = ["name", "vendor", "summary"];
  ensureHeaders(rows.headers, requiredHeaders, "Produkte");

  const rowsWithoutEmpty = rows.data.filter((entry) => Object.values(entry).some((value) => value.trim() !== ""));
  const imported = rowsWithoutEmpty.map((entry, idx) => {
    if (!entry.name.trim() || !entry.vendor.trim() || !entry.summary.trim()) {
      throw new Error(`Produkte CSV: Pflichtfeld leer in Zeile ${idx + 2}.`);
    }

    return {
      id: makeId("prd"),
      name: entry.name.trim(),
      vendor: entry.vendor.trim(),
      summary: entry.summary.trim(),
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
  rows.push(["meta", "project", "version", "2"]);
  rows.push(["meta", "project", "exportedAt", new Date().toISOString()]);
  rows.push(["meta", "project", "projectName", getProjectName()]);
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
    if (!prd.name || !prd.vendor || !prd.summary) {
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
  if (!Number.isFinite(state.priceWeight)) state.priceWeight = 30;
  render();
  if (!state.projectName && typeof projectDialog.showModal === "function" && !projectDialog.open) {
    projectDialog.showModal();
  }
}

function openHelperDialog(type, mode) {
  const config = csvAssistantConfig[type];
  const showPrompt = mode === "prompt";
  helperDialogTitle.textContent = showPrompt ? `${config.label}: ChatGPT Prompt` : `${config.label}: Info`;
  helperDialogText.textContent = showPrompt ? "Kopiere den Prompt und füge darunter deinen Fließtext ein." : config.info;
  helperDialogPrompt.hidden = !showPrompt;
  helperDialogPrompt.textContent = showPrompt ? config.prompt : "";
  helperDialog.showModal();
}

function setFormEditingState(kind, isEditing) {
  const form = kind === "requirement" ? requirementForm : productForm;
  const submitBtn = form.querySelector("button[type='submit']");
  submitBtn.textContent = isEditing ? "Änderung speichern" : kind === "requirement" ? "Anforderung hinzufügen" : "Produkt hinzufügen";
}

initializeProjectPicker();
