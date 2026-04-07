// Anforderungs- und Produktevaluation (Frontend-only)
// Datenhaltung: sessionStorage (nur aktuelle Browser-Sitzung)

const STORAGE_KEY = "evaluation_app_state_v1";

const PRIORITY_POINTS = {
  critical: 5, // gleichzeitig Ausschlusskriterium
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
const downloadRequirementsTemplateBtn = document.getElementById("downloadRequirementsTemplateBtn");
const uploadRequirementsCsvBtn = document.getElementById("uploadRequirementsCsvBtn");
const requirementsCsvInput = document.getElementById("requirementsCsvInput");
const requirementsInfoBtn = document.getElementById("requirementsInfoBtn");
const requirementsPromptBtn = document.getElementById("requirementsPromptBtn");
const downloadProductsTemplateBtn = document.getElementById("downloadProductsTemplateBtn");
const uploadProductsCsvBtn = document.getElementById("uploadProductsCsvBtn");
const productsCsvInput = document.getElementById("productsCsvInput");
const productsInfoBtn = document.getElementById("productsInfoBtn");
const productsPromptBtn = document.getElementById("productsPromptBtn");
const helperDialog = document.getElementById("helperDialog");
const helperDialogTitle = document.getElementById("helperDialogTitle");
const helperDialogText = document.getElementById("helperDialogText");
const helperDialogPrompt = document.getElementById("helperDialogPrompt");
const helperDialogCloseBtn = document.getElementById("helperDialogCloseBtn");

const csvAssistantConfig = {
  requirements: {
    label: "Anforderungen",
    info:
      "1) Klicke auf 🤖 und kopiere den Prompt. 2) Füge den Prompt in ein Sprachmodell deiner Wahl ein (z. B. ChatGPT). 3) Gehe in dein Dokument und kopiere die betrieblichen Anforderungen inklusive Untertitel der Thematiken aus dem Standarddokument (Kapitel 3) unter den Prompt. 4) Achte darauf: Erst Prompt, danach der kopierte Anforderungs-Abschnitt. 5) Sende die Anfrage ab. 6) Lade die erzeugte Datei herunter und importiere sie hier über 'Anforderungen Upload'. 7) Prüfe anschließend die einzelnen Anforderungen.",
    prompt:
      "Erstelle eine CSV-Datei zum Download (kein Fließtext). Nutze exakt die Spalten: title,category,description,type,priority,note. type nur must/nice, priority nur critical/high/medium/low. Unten findest du die betrieblichen Anforderungen. Kategorisiere jede Anforderung selbstständig als Must-have oder Nice-to-have und ordne die Wichtigkeit eigenständig als zwingend (critical), hoch (high), mittel (medium) oder niedrig (low) ein.",
  },
  products: {
    label: "Produkte",
    info: "1) CSV-Template herunterladen. 2) Inhalte in CSV eintragen (Spalten unverändert lassen). 3) Datei über 'CSV hochladen' importieren.",
    prompt:
      "Erstelle eine CSV-Datei zum Download (kein Fließtext). Nutze exakt die Spalten: name,vendor,summary,price,note.",
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
  state.requirements = [];
  state.products = [];
  state.ratings = {};
  render();
});

createProjectBtn.addEventListener("click", () => {
  state.requirements = [];
  state.products = [];
  state.ratings = {};
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
    state.requirements = importedState.requirements;
    state.products = importedState.products;
    state.ratings = importedState.ratings;
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
  downloadCsvFile(`evaluation-projekt-${new Date().toISOString().slice(0, 10)}.csv`, buildProjectCsvRows());
});

exportPdfBtn.addEventListener("click", () => {
  if (typeof window.html2pdf === "undefined") {
    window.alert("PDF-Bibliothek konnte nicht geladen werden.");
    return;
  }

  const report = buildPdfReportNode();
  const opt = {
    margin: [12, 10, 12, 10],
    filename: `evaluation-report-${new Date().toISOString().slice(0, 10)}.pdf`,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    pagebreak: { mode: ["avoid-all", "css", "legacy"] },
  };

  window.html2pdf().set(opt).from(report).save();
});

downloadRequirementsTemplateBtn.addEventListener("click", () => {
  const headers = ["title", "category", "description", "type", "priority", "note"];
  const exampleRow = ["ISO 27001 Compliance", "Sicherheit", "Nachweisbare Zertifizierung", "must", "critical", "Pflicht bei Ausschreibungen"];
  downloadCsvFile("anforderungen-template.csv", [headers, exampleRow]);
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

downloadProductsTemplateBtn.addEventListener("click", () => {
  const headers = ["name", "vendor", "summary", "price", "note"];
  const exampleRow = ["Produkt A", "Firma XY", "Cloud-Lösung für X", "49 € / Monat", "Pilot verfügbar"];
  downloadCsvFile("produkte-template.csv", [headers, exampleRow]);
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

function loadState() {
  const fallback = { requirements: [], products: [], ratings: {} };
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return {
      requirements: Array.isArray(parsed.requirements) ? parsed.requirements : [],
      products: Array.isArray(parsed.products) ? parsed.products : [],
      ratings: parsed.ratings && typeof parsed.ratings === "object" ? parsed.ratings : {},
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
  renderRequirements();
  renderProducts();
  renderMatrix();
  renderResults();
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
          <p class="meta">Punkte: <strong>${item.points.toFixed(2)}</strong> / ${evaluation.maxPoints.toFixed(2)}</p>
          <p class="meta">Erfüllung: <strong>${item.percent.toFixed(1)}%</strong></p>
          <p class="${excluded ? "status-bad" : "status-ok"}">
            ${excluded ? "Ausgeschlossen (zwingende Anforderung nicht erfüllt)" : "Zulässig"}
          </p>
        </article>
      `;
    })
    .join("");

  const detailsRows = evaluation.ranking
    .map((item, idx) => {
      const failed = item.failedCritical.length
        ? item.failedCritical.map((r) => escapeHtml(r)).join(", ")
        : "Keine";
      return `
        <tr>
          <td>${idx + 1}</td>
          <td>${escapeHtml(item.name)}</td>
          <td>${item.points.toFixed(2)}</td>
          <td>${item.percent.toFixed(1)}%</td>
          <td>${item.failedCritical.length ? `<span class='status-bad'>${failed}</span>` : `<span class='status-ok'>Keine</span>`}</td>
        </tr>
      `;
    })
    .join("");

  const winner = evaluation.ranking.find((i) => i.id === winnerId);
  const winnerText = winner
    ? `<p><strong>Bestes Produkt:</strong> ${escapeHtml(winner.name)} (${winner.percent.toFixed(1)}%)</p>`
    : "<p>Kein Gewinner vorhanden.</p>";

  resultsContent.innerHTML = `
    <div class="result-grid">${cards}</div>
    ${winnerText}
    <table>
      <thead>
        <tr>
          <th>Ranking</th>
          <th>Produkt</th>
          <th>Gesamtpunkte</th>
          <th>Erfüllung</th>
          <th>Zwingende nicht erfüllt</th>
        </tr>
      </thead>
      <tbody>${detailsRows}</tbody>
    </table>
  `;
}

function evaluateProducts() {
  const maxPoints = state.requirements.reduce((sum, req) => sum + getRequirementWeight(req), 0);

  const ranking = state.products.map((prd) => {
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
    };
  });

  ranking.sort((a, b) => {
    if (a.excluded !== b.excluded) return a.excluded ? 1 : -1;
    if (b.points !== a.points) return b.points - a.points;
    return b.percent - a.percent;
  });

  return { maxPoints, ranking };
}

function buildPdfReportNode() {
  const wrapper = document.createElement("div");
  const evaluation = evaluateProducts();
  const date = new Date().toLocaleDateString("de-DE");

  wrapper.style.padding = "16px";
  wrapper.style.fontFamily = "Inter, Arial, sans-serif";
  wrapper.style.color = "#1f2937";
  wrapper.innerHTML = `
    <h1 style="margin-bottom:4px;">Anforderungs- und Produktevaluation</h1>
    <p style="margin-top:0;color:#6b7280;">Datum: ${date}</p>
    <h2>Zusammenfassung</h2>
    <p>Anforderungen: ${state.requirements.length} | Produkte: ${state.products.length}</p>

    <h2>Anforderungen</h2>
    <ul>
      ${state.requirements
        .map(
          (req) =>
            `<li><strong>${escapeHtml(req.title)}</strong> (${labelType(req.type)}, ${labelPriority(req.priority)}, Gewicht ${getRequirementWeight(req).toFixed(1)})<br>${escapeHtml(req.description)}</li>`
        )
        .join("")}
    </ul>

    <h2>Produkte</h2>
    <ul>
      ${state.products
        .map((prd) => `<li><strong>${escapeHtml(prd.name)}</strong> – ${escapeHtml(prd.vendor)}<br>${escapeHtml(prd.summary)}</li>`)
        .join("")}
    </ul>

    <h2>Bewertungsmatrix</h2>
    ${buildMatrixTableForPdf()}

    <h2>Punktebewertung / Ranking</h2>
    ${buildRankingTableForPdf(evaluation)}

    <h2>Hinweise zu zwingenden Anforderungen</h2>
    <ul>
      ${evaluation.ranking
        .map((item) =>
          item.failedCritical.length
            ? `<li><strong>${escapeHtml(item.name)}:</strong> ${item.failedCritical.map((entry) => escapeHtml(entry)).join(", ")}</li>`
            : `<li><strong>${escapeHtml(item.name)}:</strong> keine offenen zwingenden Anforderungen</li>`
        )
        .join("")}
    </ul>
  `;

  return wrapper;
}

function buildMatrixTableForPdf() {
  if (!state.requirements.length || !state.products.length) return "<p>Keine Daten verfügbar.</p>";
  let html = "<table style='width:100%;border-collapse:collapse;font-size:11px'><thead><tr><th style='border:1px solid #cbd5e1;padding:4px'>Anforderung</th>";
  state.products.forEach((prd) => {
    html += `<th style='border:1px solid #cbd5e1;padding:4px'>${escapeHtml(prd.name)}</th>`;
  });
  html += "</tr></thead><tbody>";
  state.requirements.forEach((req) => {
    html += `<tr><td style='border:1px solid #cbd5e1;padding:4px'>${escapeHtml(req.title)}</td>`;
    state.products.forEach((prd) => {
      const rating = state.ratings[ratingKey(req.id, prd.id)] || "na";
      html += `<td style='border:1px solid #cbd5e1;padding:4px'>${RATING_LABELS[rating]}</td>`;
    });
    html += "</tr>";
  });
  html += "</tbody></table>";
  return html;
}

function buildRankingTableForPdf(evaluation) {
  let html = "<table style='width:100%;border-collapse:collapse;font-size:11px'><thead><tr>";
  html += "<th style='border:1px solid #cbd5e1;padding:4px'>Rang</th><th style='border:1px solid #cbd5e1;padding:4px'>Produkt</th><th style='border:1px solid #cbd5e1;padding:4px'>Punkte</th><th style='border:1px solid #cbd5e1;padding:4px'>Erfüllung</th><th style='border:1px solid #cbd5e1;padding:4px'>Status</th>";
  html += "</tr></thead><tbody>";

  evaluation.ranking.forEach((item, idx) => {
    html += `<tr>
      <td style='border:1px solid #cbd5e1;padding:4px'>${idx + 1}</td>
      <td style='border:1px solid #cbd5e1;padding:4px'>${escapeHtml(item.name)}</td>
      <td style='border:1px solid #cbd5e1;padding:4px'>${item.points.toFixed(2)} / ${evaluation.maxPoints.toFixed(2)}</td>
      <td style='border:1px solid #cbd5e1;padding:4px'>${item.percent.toFixed(1)}%</td>
      <td style='border:1px solid #cbd5e1;padding:4px'>${item.excluded ? "Ausgeschlossen" : "Zulässig"}</td>
    </tr>`;
  });

  html += "</tbody></table>";
  return html;
}

function getRequirementWeight(req) {
  return PRIORITY_POINTS[req.priority] * TYPE_FACTOR[req.type];
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
  rows.push(["meta", "project", "version", "1"]);
  rows.push(["meta", "project", "exportedAt", new Date().toISOString()]);

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

  rows.data.forEach((entry, idx) => {
    const section = (entry.section || "").trim().toLowerCase();
    const id = (entry.id || "").trim();
    const field = (entry.field || "").trim().toLowerCase();
    const value = (entry.value || "").trim();
    const rowNo = idx + 2;

    if (section === "meta") return;

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

  return { requirements, products, ratings: filteredRatings };
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
  render();
  if (typeof projectDialog.showModal === "function" && !projectDialog.open) {
    projectDialog.showModal();
  }
}

function openHelperDialog(type, mode) {
  const config = csvAssistantConfig[type];
  const showPrompt = mode === "prompt";
  const promptHelpText =
    type === "requirements"
      ? "Kopiere den Prompt, füge ihn in ein Sprachmodell ein und ergänze darunter die betrieblichen Anforderungen aus deinem Dokument."
      : "Kopiere diesen Prompt in ChatGPT und lasse dir eine CSV-Datei erstellen.";
  helperDialogTitle.textContent = showPrompt ? `${config.label}: ChatGPT Prompt` : `${config.label}: Info`;
  helperDialogText.textContent = showPrompt ? promptHelpText : config.info;
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
