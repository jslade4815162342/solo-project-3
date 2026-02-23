// Single-service deployment: same-origin API
const API_BASE = "";

let state = {
  page: 1,
  pageSize: 10,
  sort: "title",
  dir: "asc",
  q: ""
};

const views = {
  list: document.getElementById("view-list"),
  form: document.getElementById("view-form"),
  stats: document.getElementById("view-stats")
};

const flash = document.getElementById("flash");

function showFlash(message, type = "ok") {
  flash.textContent = message;
  flash.className = `flash ${type}`;
  flash.hidden = false;
  setTimeout(() => (flash.hidden = true), 3000);
}

function switchView(name) {
  Object.values(views).forEach(v => v.hidden = true);
  views[name].hidden = false;
}

document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    switchView(btn.dataset.view);
  });
});

async function loadMovies() {
  const params = new URLSearchParams({
    page: state.page,
    pageSize: state.pageSize,
    sort: state.sort,
    dir: state.dir,
    q: state.q
  });

  const res = await fetch(`${API_BASE}/api/movies?${params}`);
  const data = await res.json();

  const cards = document.getElementById("cards");
  cards.innerHTML = "";

  if (data.movies.length === 0) {
    cards.innerHTML = `<div class="muted">No movies found.</div>`;
    return;
  }

  data.movies.forEach(m => {
    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `
      <img src="${m.image_url}" alt="${m.title}" onerror="this.src='https://via.placeholder.com/120x180?text=No+Image'">
      <div class="card-body">
        <h3>${m.title}</h3>
        <div class="muted">${m.director} • ${m.year}</div>
        <div>Rating: ${m.rating}</div>
        <div class="card-actions">
          <button class="btn btn-ghost" onclick="editMovie(${m.id})">Edit</button>
          <button class="btn btn-danger" onclick="deleteMovie(${m.id})">Delete</button>
        </div>
      </div>
    `;
    cards.appendChild(div);
  });

  document.getElementById("pageInfo").textContent =
    `Page ${data.page} of ${data.totalPages}`;

  document.getElementById("listMeta").textContent =
    `${data.totalFiltered} results`;
}

async function deleteMovie(id) {
  if (!confirm("Are you sure you want to delete this movie?")) return;

  await fetch(`${API_BASE}/api/movies/${id}`, { method: "DELETE" });
  showFlash("Movie deleted.");
  loadMovies();
}

async function editMovie(id) {
  const res = await fetch(`${API_BASE}/api/movies/${id}`);
  const m = await res.json();

  switchView("form");

  document.getElementById("movieId").value = m.id;
  document.getElementById("title").value = m.title;
  document.getElementById("director").value = m.director;
  document.getElementById("year").value = m.year;
  document.getElementById("rating").value = m.rating;
  document.getElementById("image_url").value = m.image_url;
}

document.getElementById("movieForm").addEventListener("submit", async e => {
  e.preventDefault();

  const id = document.getElementById("movieId").value;

  const payload = {
    title: document.getElementById("title").value,
    director: document.getElementById("director").value,
    year: document.getElementById("year").value,
    rating: document.getElementById("rating").value,
    image_url: document.getElementById("image_url").value
  };

  const method = id ? "PUT" : "POST";
  const url = id
    ? `${API_BASE}/api/movies/${id}`
    : `${API_BASE}/api/movies`;

  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const err = await res.json();
    showFlash("Error saving movie.", "danger");
    return;
  }

  showFlash("Movie saved.");
  switchView("list");
  e.target.reset();
  loadMovies();
});

document.getElementById("apply").addEventListener("click", () => {
  state.q = document.getElementById("q").value;
  state.sort = document.getElementById("sort").value;
  state.dir = document.getElementById("dir").value;
  state.pageSize = document.getElementById("pageSize").value;
  state.page = 1;
  loadMovies();
});

document.getElementById("prevPage").addEventListener("click", () => {
  if (state.page > 1) {
    state.page--;
    loadMovies();
  }
});

document.getElementById("nextPage").addEventListener("click", () => {
  state.page++;
  loadMovies();
});

async function loadStats() {
  const res = await fetch(`${API_BASE}/api/stats?pageSize=${state.pageSize}`);
  const data = await res.json();

  document.getElementById("statTotal").textContent = data.totalRecords;
  document.getElementById("statPageSize").textContent = data.currentPageSize;
  document.getElementById("statAvg").textContent = data.averageRating;
  document.getElementById("statTop").textContent =
    data.topDirector || "—";
  document.getElementById("statTopCount").textContent =
    data.topDirectorCount ? `Count: ${data.topDirectorCount}` : "";
}

document.getElementById("refreshStats").addEventListener("click", loadStats);

loadMovies();
