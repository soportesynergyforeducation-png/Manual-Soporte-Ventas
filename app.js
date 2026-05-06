const state = {
  catalog: [],
  docs: new Map(),
  selectedCategory: "todas",
  selectedRole: "soporte",
  query: "",
  activeId: null,
  toastTimer: null
};

const els = {
  searchInput: document.querySelector("#searchInput"),
  activeRole: document.querySelector("#activeRole"),
  resultTitle: document.querySelector("#resultTitle"),
  resultSummary: document.querySelector("#resultSummary"),
  categoryList: document.querySelector("#categoryList"),
  results: document.querySelector("#results"),
  reader: document.querySelector("#reader"),
  clearButton: document.querySelector("#clearButton"),
  roleRail: document.querySelector("#roleRail"),
  visibleCount: document.querySelector("#visibleCount"),
  categoryCount: document.querySelector("#categoryCount"),
  themeToggle: document.querySelector("#themeToggle"),
  toast: document.querySelector("#toast")
};

const roleLabels = {
  admin: "Vista de admin",
  soporte: "Vista de soporte",
  ventas: "Vista de ventas"
};

async function init() {
  const response = await fetch("/manual/catalogo.json");
  state.catalog = await response.json();

  await Promise.all(
    state.catalog.map(async (item) => {
      const text = await fetch(`/manual/${item.archivo}`).then((r) => r.text());
      state.docs.set(item.id, text);
    })
  );

  bindEvents();
  render();
}

function bindEvents() {
  initTheme();

  els.searchInput.addEventListener("input", (event) => {
    state.query = normalizeSearch(event.target.value);
    state.activeId = null;
    renderResults();
  });

  els.clearButton.addEventListener("click", () => {
    state.query = "";
    state.selectedCategory = "todas";
    state.activeId = null;
    els.searchInput.value = "";
    render();
  });

  els.roleRail.querySelectorAll("[data-role]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedRole = button.dataset.role;
      state.activeId = null;
      syncRoleButtons();
      render();
    });
  });
}

function initTheme() {
  const savedTheme = localStorage.getItem("manualTheme") || "dark";
  setTheme(savedTheme);

  els.themeToggle?.addEventListener("click", () => {
    const nextTheme = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
  });
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("manualTheme", theme);
  if (!els.themeToggle) return;
  const isLight = theme === "light";
  els.themeToggle.textContent = isLight ? "Tema oscuro" : "Tema claro";
  els.themeToggle.setAttribute("aria-pressed", String(isLight));
}

function syncRoleButtons() {
  els.roleRail.querySelectorAll("[data-role]").forEach((button) => {
    button.classList.toggle("active", button.dataset.role === state.selectedRole);
  });
}

function permitted(item) {
  return item.audiencia.includes(state.selectedRole);
}

function normalizedText(item) {
  return normalizeSearch([item.titulo, item.categoria, item.palabrasClave.join(" "), state.docs.get(item.id) || ""].join(" "));
}

function normalizeSearch(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function visibleItems() {
  return state.catalog.filter((item) => {
    if (!permitted(item)) return false;
    if (state.selectedCategory !== "todas" && item.categoriaId !== state.selectedCategory) return false;
    if (state.query && !normalizedText(item).includes(state.query)) return false;
    return true;
  });
}

function roleItems() {
  return state.catalog.filter(permitted);
}

function render() {
  syncRoleButtons();
  els.activeRole.textContent = roleLabels[state.selectedRole];
  renderCategories();
  renderResults();
}

function renderCategories() {
  const items = roleItems();
  const counts = items.reduce((acc, item) => {
    acc[item.categoriaId] = acc[item.categoriaId] || { label: item.categoria, count: 0 };
    acc[item.categoriaId].count += 1;
    return acc;
  }, {});

  els.categoryCount.textContent = Object.keys(counts).length;

  const buttons = [
    categoryButton("todas", "Todas", items.length),
    ...Object.entries(counts)
      .sort(([, a], [, b]) => b.count - a.count)
      .map(([id, info]) => categoryButton(id, info.label, info.count))
  ];

  els.categoryList.innerHTML = buttons.join("");
  els.categoryList.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedCategory = button.dataset.category;
      state.activeId = null;
      render();
    });
  });
}

function categoryButton(id, label, count) {
  const active = state.selectedCategory === id ? " active" : "";
  return `
    <button class="categoryButton${active}" type="button" data-category="${id}">
      <span class="categoryName">${escapeHtml(label)}</span>
      <span class="categoryCount">${count}</span>
    </button>
  `;
}

function renderResults() {
  const items = visibleItems();
  const roleVisible = roleItems();

  els.visibleCount.textContent = items.length;
  els.resultTitle.textContent = `${items.length} artículo${items.length === 1 ? "" : "s"} disponible${items.length === 1 ? "" : "s"}`;
  els.resultSummary.textContent = summaryText(items.length, roleVisible.length);

  if (!items.length) {
    els.results.innerHTML = `<div class="noResults">No encontramos artículos con esos filtros. Prueba otra palabra o cambia de perfil.</div>`;
    els.reader.className = "readerPanel emptyOpen";
    els.reader.innerHTML = `
      <div class="emptyState">
        <div class="emptyFrame">
          <p class="miniLabel">Sin resultados</p>
          <strong>La combinación actual no arrojó artículos.</strong>
        </div>
      </div>
    `;
    return;
  }

  els.results.innerHTML = items.map(resultCard).join("");
  els.results.querySelectorAll("[data-id]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeId = button.dataset.id;
      renderResults();
    });
  });

  const activeItem = items.find((item) => item.id === state.activeId);
  if (activeItem) {
    renderArticle(activeItem);
  } else {
    renderDashboard(items);
  }
}

function summaryText(visible, totalRole) {
  if (state.query) {
    return `La búsqueda encontró ${visible} artículo${visible === 1 ? "" : "s"} dentro de ${totalRole} visibles para este perfil.`;
  }

  if (state.selectedCategory !== "todas") {
    return `Estas viendo una categoría específica con ${visible} artículo${visible === 1 ? "" : "s"} disponibles.`;
  }

  return `Tienes ${totalRole} artículo${totalRole === 1 ? "" : "s"} visibles para este perfil.`;
}

function resultCard(item) {
  const snippet = articlePreview(item, 180);
  const active = item.id === state.activeId ? " active" : "";
  return `
    <button class="resultCard${active}" type="button" data-id="${item.id}">
      <h3>${escapeHtml(item.titulo)}</h3>
      <div class="metaRow">
        <span class="pill pillAccent">${escapeHtml(item.categoria)}</span>
        <span class="pill">${item.imagenes.length} imagen${item.imagenes.length === 1 ? "" : "es"}</span>
        <span class="pill">Preview</span>
      </div>
      <p class="resultSnippet">${escapeHtml(snippet || "Artículo del manual operativo.")}</p>
    </button>
  `;
}

function renderDashboard(items) {
  els.reader.className = "readerPanel dashboardOpen";
  const chapters = items.reduce((acc, item) => {
    if (!acc.has(item.categoriaId)) {
      acc.set(item.categoriaId, { label: item.categoria, items: [] });
    }
    acc.get(item.categoriaId).items.push(item);
    return acc;
  }, new Map());

  els.reader.innerHTML = `
    <section class="dashboardView">
      <div class="dashboardHeader">
        <div>
          <p class="miniLabel">Dashboard operativo</p>
          <h2 class="dashboardTitle">${state.query ? "Resultados por capítulo" : "Manual por capítulos"}</h2>
        </div>
        <div class="dashboardStat">
          <strong>${items.length}</strong>
          <span>artículos</span>
        </div>
      </div>
      <div class="chapterGrid">
        ${[...chapters.values()].map(chapterCard).join("")}
      </div>
    </section>
  `;

  els.reader.querySelectorAll("[data-id]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeId = button.dataset.id;
      renderResults();
    });
  });
}

function chapterCard(chapter) {
  return `
    <article class="chapterCard">
      <div class="chapterTop">
        <span class="miniLabel">${escapeHtml(chapter.label)}</span>
        <strong>${chapter.items.length}</strong>
      </div>
      <div class="chapterItems">
        ${chapter.items.slice(0, 4).map(dashboardArticleButton).join("")}
      </div>
    </article>
  `;
}

function dashboardArticleButton(item) {
  return `
    <button class="dashboardArticle" type="button" data-id="${item.id}">
      <span>${escapeHtml(item.titulo)}</span>
      <small>${escapeHtml(articlePreview(item, 105))}</small>
    </button>
  `;
}

function articlePreview(item, limit) {
  return plainArticleText(state.docs.get(item.id) || "").slice(0, limit);
}

function plainArticleText(text) {
  return text
    .replace(/!\[[^\]]*\]\([^\)]*\)/g, "")
    .replace(/[#*_`>|-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function renderArticle(item) {
  if (!item) return;
  els.reader.className = "readerPanel articleOpen";
  const markdown = state.docs.get(item.id) || "";
  const basePath = `/manual/${item.archivo.split("/").slice(0, -1).join("/")}/`;
  els.reader.innerHTML = `
    <header class="readerHeader">
      <div class="readerTop">
        <div>
          <p class="miniLabel">${escapeHtml(item.categoria)}</p>
          <h2 class="articleTitle">${escapeHtml(item.titulo)}</h2>
        </div>
        <div class="readerActions">
          <button class="copyButton" type="button" id="copyArticleButton">
            <span class="copyButtonDot"></span>
            Copiar texto
          </button>
          <button class="jumpMatchButton" type="button" id="jumpMatchButton">
            Ir a coincidencia
          </button>
        </div>
      </div>
      <div class="articleMeta">
        <span class="pill pillAccent">${item.audiencia.map(escapeHtml).join(" · ")}</span>
        <span class="pill">${escapeHtml(item.categoria)}</span>
        <span class="pill">${item.imagenes.length} apoyo visual</span>
      </div>
      <div class="metaLine">Origen: ${escapeHtml(item.origen)}</div>
    </header>
    <div class="markdown">${renderMarkdown(markdown, basePath)}</div>
  `;

  document.querySelector("#copyArticleButton")?.addEventListener("click", async () => {
    await copyText(markdown);
  });

  prepareArticleMatch();
}

function prepareArticleMatch() {
  const button = document.querySelector("#jumpMatchButton");
  if (!button) return;

  const query = state.query;
  const matches = query ? findTextMatches(els.reader.querySelector(".markdown"), query) : [];
  if (!matches.length) {
    button.hidden = true;
    return;
  }

  button.hidden = false;
  button.textContent = matches.length === 1 ? "Ir a coincidencia" : `Coincidencia 1 de ${matches.length}`;
  let currentIndex = 0;
  button.addEventListener("click", () => {
    const match = matches[currentIndex];
    matches.forEach((item) => item.classList.remove("activeMatch", "matchPulse"));
    match.classList.add("activeMatch");
    match.classList.add("matchPulse");
    match.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => match.classList.remove("matchPulse"), 1600);
    currentIndex = (currentIndex + 1) % matches.length;
    button.textContent = matches.length === 1 ? "Ir a coincidencia" : `Coincidencia ${currentIndex + 1} de ${matches.length}`;
  });
}

function findTextMatches(root, query) {
  if (!root || !query) return [];
  const matches = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];

  while (walker.nextNode()) {
    nodes.push(walker.currentNode);
  }

  for (const node of nodes) {
    if (matches.length >= 60 || !node.isConnected) break;
    const index = normalizeSearch(node.nodeValue).indexOf(query);
    if (index === -1 || !node.nodeValue.trim()) continue;

    const matchLength = Math.min(query.length, node.nodeValue.length - index);
    const matchNode = node.splitText(index);
    matchNode.splitText(matchLength);

    const marker = document.createElement("mark");
    marker.className = "searchMatch";
    matchNode.parentNode.insertBefore(marker, matchNode);
    marker.appendChild(matchNode);
    matches.push(marker);
  }

  return matches;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast("Texto copiado al portapapeles.");
  } catch (error) {
    showToast("No se pudo copiar el texto.");
  }
}

function showToast(message) {
  clearTimeout(state.toastTimer);
  els.toast.textContent = message;
  els.toast.classList.add("show");
  state.toastTimer = window.setTimeout(() => {
    els.toast.classList.remove("show");
  }, 2200);
}

function renderMarkdown(markdown, basePath) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const html = [];
  let listMode = null;
  let table = [];

  const closeList = () => {
    if (listMode) {
      html.push(`</${listMode}>`);
      listMode = null;
    }
  };

  const flushTable = () => {
    if (!table.length) return;
    const [head, , ...rows] = table;
    html.push("<table><thead><tr>");
    splitTable(head).forEach((cell) => html.push(`<th>${inline(cell, basePath)}</th>`));
    html.push("</tr></thead><tbody>");
    rows.forEach((row) => {
      html.push("<tr>");
      splitTable(row).forEach((cell) => html.push(`<td>${inline(cell, basePath)}</td>`));
      html.push("</tr>");
    });
    html.push("</tbody></table>");
    table = [];
  };

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const line = rawLine.trim();

    if (line.includes("|") && /^\|?[\s\-:|]+\|?$/.test(lines[index + 1]?.trim() || "")) {
      closeList();
      table.push(line);
      continue;
    }

    if (table.length) {
      if (line.includes("|")) {
        table.push(line);
        continue;
      }
      flushTable();
    }

    if (!line) {
      closeList();
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      closeList();
      html.push(`<h${heading[1].length}>${inline(heading[2], basePath)}</h${heading[1].length}>`);
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      if (listMode !== "ul") {
        closeList();
        listMode = "ul";
        html.push("<ul>");
      }
      html.push(`<li>${inline(line.replace(/^[-*]\s+/, ""), basePath)}</li>`);
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      if (listMode !== "ol") {
        closeList();
        listMode = "ol";
        html.push("<ol>");
      }
      html.push(`<li>${inline(line.replace(/^\d+\.\s+/, ""), basePath)}</li>`);
      continue;
    }

    if (line.startsWith(">")) {
      closeList();
      html.push(`<blockquote>${inline(line.replace(/^>\s?/, ""), basePath)}</blockquote>`);
      continue;
    }

    closeList();
    html.push(`<p>${inline(line, basePath)}</p>`);
  }

  flushTable();
  closeList();
  return html.join("");
}

function splitTable(line) {
  return line.replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
}

function inline(text, basePath) {
  return escapeHtml(text)
    .replace(/!\[([^\]]*)\]\(([^\)]+)\)/g, (_, alt, src) => {
      const resolved = new URL(src, new URL(basePath, window.location.href)).href;
      return `<img src="${resolved}" alt="${escapeHtml(alt)}" loading="lazy">`;
    })
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

init().catch((error) => {
  els.reader.innerHTML = `
    <div class="emptyState">
      <div class="emptyFrame">
        <p class="miniLabel">Error</p>
        <strong>${escapeHtml(error.message)}</strong>
      </div>
    </div>
  `;
});
