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

requirementForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(requirementForm);

  state.requirements.push({
    id: makeId("req"),
    title: data.get("title").toString().trim(),
    description: data.get("description").toString().trim(),
    category: data.get("category").toString().trim(),
    type: data.get("type").toString(),
    priority: data.get("priority").toString(),
    note: data.get("note").toString().trim(),
  });

  requirementForm.reset();
  persistAndRender();
});

productForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(productForm);

  state.products.push({
    id: makeId("prd"),
    name: data.get("name").toString().trim(),
    vendor: data.get("vendor").toString().trim(),
    summary: data.get("summary").toString().trim(),
    price: data.get("price").toString().trim(),
    note: data.get("note").toString().trim(),
  });

  productForm.reset();
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
          <div>
            <span class="pill ${req.type}">${labelType(req.type)}</span>
            <span class="pill ${req.priority}">${labelPriority(req.priority)}</span>
            <button class="btn btn-danger" data-remove-req="${req.id}">Löschen</button>
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
        <button class="btn btn-danger" data-remove-prd="${prd.id}">Löschen</button>
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

render();
