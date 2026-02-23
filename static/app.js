// Single-service deployment: same-origin API
const API_BASE = "";

const state = {
  view: "list",
  page: 1,
  q: "",
  sort: "title",
  dir: "asc",
  pageSize: 10,
  totalPages: 1,
  totalFiltered: 0,
  editingId: null,
};

const els = {
  // views
  viewList: document.getElementById("view-list"),
  viewForm: document.getElementById("view-form"),
  viewStats: document.getElementById("view-stats"),

  tabs: Array.from(document.querySelectorAll(".tab-btn")),

  flash: document.getElementById("flash"),

  // list controls
  q: document.getElementById("q"),
  sort: document.getElementById("sort"),
  dir: document.getElementById("dir"),
  pageSize: document.getElementById("pageSize"),
  apply: document.getElementById("apply"),
  reset: document.getElementById("reset"),
  newMovie: document.getElementById("newMovie"),

  cards: document.getElementById("cards"),
  listMeta: document.getElementById("listMeta"),
  prevPage: document.getElementById("prevPage"),
  nextPage: document.getElementById("nextPage"),
  pageInfo: document.getElementById("pageInfo"),

  // form
  movieForm: document.getElementById("movieForm"),
  movieId: document.getElementById("movieId"),
  title: document.getElementById("title"),
  director: document.getElementById("director"),
  year: document.getElementById("year"),
  rating: document.getElementById("rating"),
  imageUrl: document.getElementById("image_url"),
  saveBtn: document.getElementById("saveBtn"),
  clearBtn: document.getElementById("clearBtn"),
  cancelEdit: document.getElementById("cancelEdit"),
  formTitle: document.getElementById("formTitle"),
  formSubtitle: document.getElementById("formSubtitle"),

  // stats
  statTotal: document.getElementById("statTotal"),
  statPageSize: document.getElementById("statPageSize"),
  statAvg: document.getElementById("statAvg"),
  statTop: document.getElementById("statTop"),
  statTopCount: document.getElementById("statTopCount"),
  refreshStats: document.getElementById("refreshStats"),
};

function setCookie(name, value, days = 365) {
  const maxAge = days * 24 * 60 * 60;
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(
    value
  )}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
}

function getCookie(name) {
  const key = `${encodeURIComponent(name)}=`;
  const parts = document.cookie.split(";").map((s) => s.trim());
  for (const p of parts) {
    if (p.startsWith(key)) return decodeURIComponent(p.slice(key.length));
  }
  return null;
}

function showFlash(message, kind = "info") {
  els.flash.hidden = false;
  els.flash.className = `flash flash-${kind}`;
  els.flash.textContent = message;
  window.clearTimeout(showFlash._t);
  showFlash._t = window.setTimeout(() => {
    els.flash.hidden = true;
  }, 3500);
}

function setView(view) {
  state.view = view;

  els.viewList.hidden = view !== "list";
  els.viewForm.hidden = view !== "form";
  els.viewStats.hidden = view !== "stats";

  for (const b of els.tabs) {
    const active = b.dataset.view === view;
    b.setAttribute("aria-current", active ? "page" : "false");
  }

  if (view === "list") {
    loadMovies().catch((err) =>
      showFlash(err.message || "Failed to load movies", "error")
    );
  } else if (view === "stats") {
    loadStats().catch((err) =>
      showFlash(err.message || "Failed to load stats", "error")
    );
  }
}

function clearErrors() {
  const ids = ["title", "director", "year", "rating", "image_url"];
  for (const id of ids) {
    const el = document.getElementById(`err-${id}`);
    if (el) el.textContent = "";
  }
}

function renderCards(movies) {
  els.cards.innerHTML = "";

  if (!movies || movies.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent =
      "No movies found. Try adjusting search or add a new movie.";
    els.cards.appendChild(empty);
    return;
  }

  for (const m of movies) {
    const card = document.createElement("div");
    card.className = "card";

    const img = document.createElement("img");
    img.className = "poster";
    img.alt = `${m.title} poster`;
    img.src =
      m.image_url || "https://via.placeholder.com/120x180?text=No+Image";
    img.onerror = () => {
      img.onerror = null;
      img.src = "https://via.placeholder.com/120x180?text=No+Image";
    };

    const body = document.createElement("div");
    body.className = "card-body";

    const title = document.createElement("div");
    title.className = "card-title";
    title.textContent = m.title;

    const meta = document.createElement("div");
    meta.className = "card-meta";
    meta.textContent = `${m.director} • ${m.year} • Rating ${m.rating}`;

    const actions = document.createElement("div");
    actions.className = "card-actions";

    const editBtn = document.createElement("button");
    editBtn.className = "btn btn-ghost";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => beginEdit(m));

    const delBtn = document.createElement("button");
    delBtn.className = "btn btn-danger";
    delBtn.textContent = "Delete";
    delBtn.addEventListener("click", () => confirmDelete(m));

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);

    body.appendChild(title);
    body.appendChild(meta);
    body.appendChild(actions);

    card.appendChild(img);
    card.appendChild(body);

    els.cards.appendChild(card);
  }
}

async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      msg = data.message || msg;
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}

async function apiSend(path, method, bodyObj) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: bodyObj ? JSON.stringify(bodyObj) : null,
  });

  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    let data = null;
    try {
      data = await res.json();
      msg = data.message || msg;
    } catch {}
    const err = new Error(msg);
    err.data = data;
    err.status = res.status;
    throw err;
  }

  if (res.status === 204) return null;
  return res.json();
}

function buildQuery() {
  const params = new URLSearchParams();
  params.set("page", String(state.page));
  params.set("pageSize", String(state.pageSize));
  if (state.q) params.set("q", state.q);
  params.set("sort", state.sort);
  params.set("dir", state.dir);
  return params.toString();
}

async function loadMovies() {
  els.listMeta.textContent = "Loading…";

  const qs = buildQuery();
  const data = await apiGet(`/api/movies?${qs}`);

  state.totalPages = data.totalPages || 1;
  state.totalFiltered = data.totalFiltered || 0;

  renderCards(data.movies);

  els.pageInfo.textContent = `Page ${data.page} of ${state.totalPages}`;
  els.listMeta.textContent = `${state.totalFiltered} record(s) match • Page size ${state.pageSize}`;

  els.prevPage.disabled = state.page <= 1;
  els.nextPage.disabled = state.page >= state.totalPages;
}

function resetControls() {
  state.page = 1;
  state.q = "";
  state.sort = "title";
  state.dir = "asc";

  els.q.value = "";
  els.sort.value = "title";
  els.dir.value = "asc";

  showFlash("Filters reset.", "info");
  loadMovies().catch((err) =>
    showFlash(err.message || "Failed to load movies", "error")
  );
}

function syncControlsToState() {
  els.q.value = state.q;
  els.sort.value = state.sort;
  els.dir.value = state.dir;
  els.pageSize.value = String(state.pageSize);
}

function beginAdd() {
  state.editingId = null;
  els.movieId.value = "";
  els.title.value = "";
  els.director.value = "";
  els.year.value = "";
  els.rating.value = "";
  els.imageUrl.value = "";
  clearErrors();

  els.formTitle.textContent = "Add Movie";
  els.formSubtitle.textContent = "Create a new record in the SQL database.";
  els.cancelEdit.hidden = true;

  setView("form");
}

function beginEdit(m) {
  state.editingId = m.id;
  els.movieId.value = String(m.id);
  els.title.value = m.title || "";
  els.director.value = m.director || "";
  els.year.value = String(m.year ?? "");
  els.rating.value = String(m.rating ?? "");
  els.imageUrl.value = m.image_url || "";
  clearErrors();

  els.formTitle.textContent = "Edit Movie";
  els.formSubtitle.textContent = `Editing ID ${m.id}`;
  els.cancelEdit.hidden = false;

  setView("form");
}

async function submitForm(e) {
  e.preventDefault();
  clearErrors();

  const payload = {
    title: els.title.value.trim(),
    director: els.director.value.trim(),
    year: els.year.value,
    rating: els.rating.value,
    image_url: els.imageUrl.value.trim(),
  };

  try {
    if (state.editingId) {
      await apiSend(`/api/movies/${state.editingId}`, "PUT", payload);
      showFlash("Movie updated.", "success");
    } else {
      await apiSend(`/api/movies`, "POST", payload);
      showFlash("Movie added.", "success");
    }

    setView("list");
  } catch (err) {
    if (err.data && err.data.errors) {
      const errs = err.data.errors;
      for (const [k, v] of Object.entries(errs)) {
        const el = document.getElementById(`err-${k}`);
        if (el) el.textContent = v;
      }
      showFlash("Please fix the form errors.", "error");
      return;
    }
    showFlash(err.message || "Save failed.", "error");
  }
}

async function confirmDelete(m) {
  const ok = window.confirm(`Delete "${m.title}"? This cannot be undone.`);
  if (!ok) return;

  try {
    await apiSend(`/api/movies/${m.id}`, "DELETE");
    showFlash("Movie deleted.", "success");

    // If deleting the last item on the last page, step back a page if needed
    if (state.page > 1 && state.totalFiltered % state.pageSize === 1) {
      state.page -= 1;
    }

    await loadMovies();
  } catch (err) {
    showFlash(err.message || "Delete failed.", "error");
  }
}

async function loadStats() {
  els.statTotal.textContent = "—";
  els.statPageSize.textContent = "—";
  els.statAvg.textContent = "—";
  els.statTop.textContent = "—";
  els.statTopCount.textContent = "";

  const data = await apiGet(
    `/api/stats?pageSize=${encodeURIComponent(String(state.pageSize))}`
  );

  els.statTotal.textContent = String(data.totalRecords ?? "—");
  els.statPageSize.textContent = String(data.currentPageSize ?? state.pageSize);
  els.statAvg.textContent = String(data.averageRating ?? "—");

  if (data.topDirector) {
    els.statTop.textContent = data.topDirector;
    els.statTopCount.textContent = `${data.topDirectorCount} movie(s)`;
  } else {
    els.statTop.textContent = "—";
    els.statTopCount.textContent = "";
  }
}

// --- Wire up events ---
els.tabs.forEach((btn) => {
  btn.addEventListener("click", () => setView(btn.dataset.view));
});

els.apply.addEventListener("click", () => {
  state.page = 1;
  state.q = els.q.value.trim();
  state.sort = els.sort.value;
  state.dir = els.dir.value;
  loadMovies().catch((err) =>
    showFlash(err.message || "Failed to load movies", "error")
  );
});

els.reset.addEventListener("click", resetControls);

els.newMovie.addEventListener("click", beginAdd);

els.prevPage.addEventListener("click", () => {
  if (state.page > 1) {
    state.page -= 1;
    loadMovies().catch((err) =>
      showFlash(err.message || "Failed to load movies", "error")
    );
  }
});

els.nextPage.addEventListener("click", () => {
  if (state.page < state.totalPages) {
    state.page += 1;
    loadMovies().catch((err) =>
      showFlash(err.message || "Failed to load movies", "error")
    );
  }
});

els.pageSize.addEventListener("change", () => {
  const v = parseInt(els.pageSize.value, 10);
  state.pageSize = [5, 10, 20, 50].includes(v) ? v : 10;
  setCookie("pageSize", String(state.pageSize));
  state.page = 1;
  showFlash(`Page size set to ${state.pageSize} (saved).`, "success");
  loadMovies().catch((err) =>
    showFlash(err.message || "Failed to load movies", "error")
  );
});

els.movieForm.addEventListener("submit", submitForm);

els.clearBtn.addEventListener("click", () => {
  els.title.value = "";
  els.director.value = "";
  els.year.value = "";
  els.rating.value = "";
  els.imageUrl.value = "";
  clearErrors();
});

els.cancelEdit.addEventListener("click", () => {
  beginAdd();
});

els.refreshStats.addEventListener("click", () => {
  loadStats().catch((err) =>
    showFlash(err.message || "Failed to load stats", "error")
  );
});

// --- Init ---
(function init() {
  const saved = parseInt(getCookie("pageSize") || "10", 10);
  state.pageSize = [5, 10, 20, 50].includes(saved) ? saved : 10;

  syncControlsToState();
  setView("list");
})();
