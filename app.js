(() => {
  const STORAGE_KEY = "lunch-picker-data-v1";
  const DEFAULT_TYPES = ["中式", "日式", "西式", "泰式", "火鍋", "鐵板燒", "速食", "自助餐", "粥"];
  const AMENITIES = [
    { key: "aircon", label: "冷氣", icon: "❄" },
    { key: "drink", label: "飲料", icon: "◉" },
    { key: "soup", label: "湯", icon: "♨" },
    { key: "parking", label: "汽車停車", icon: "P" },
  ];
  const state = loadState();
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  let toastTimer;
  let selectedFilterTypes = new Set();
  let filterAmenities = Object.fromEntries(AMENITIES.map(({ key }) => [key, null]));
  let formTypes = new Set();
  let formAmenities = Object.fromEntries(AMENITIES.map(({ key }) => [key, false]));
  let lastResults = [];

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { types: [...DEFAULT_TYPES], restaurants: [] };
      const parsed = JSON.parse(raw);
      const types = Array.isArray(parsed.types) ? parsed.types.filter((item) => typeof item === "string" && item.trim()) : [...DEFAULT_TYPES];
      const restaurants = Array.isArray(parsed.restaurants) ? parsed.restaurants.filter(isRestaurant).map(normalizeRestaurant) : [];
      return { types: [...new Set([...DEFAULT_TYPES, ...types])], restaurants };
    } catch {
      return { types: [...DEFAULT_TYPES], restaurants: [] };
    }
  }

  function isRestaurant(item) {
    return item && typeof item === "object" && typeof item.name === "string" && item.name.trim();
  }

  function normalizeRestaurant(item) {
    const amenities = {};
    for (const { key } of AMENITIES) amenities[key] = Boolean(item.amenities?.[key]);
    return {
      id: String(item.id || makeId()),
      name: item.name.trim(),
      types: Array.isArray(item.types) ? item.types.filter((type) => typeof type === "string") : [],
      price: item.price === "" || item.price === null || item.price === undefined ? null : Number(item.price),
      amenities,
    };
  }

  function makeId() {
    return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    renderCounts();
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  }

  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2300);
  }

  function renderCounts() {
    $("#restaurantCount").textContent = state.restaurants.length;
    $("#navCount").textContent = state.restaurants.length;
  }

  function renderTypes() {
    $("#filterTypes").innerHTML = state.types.map((type) => `<button type="button" class="chip${selectedFilterTypes.has(type) ? " selected" : ""}" data-filter-type="${escapeHtml(type)}" aria-pressed="${selectedFilterTypes.has(type)}">${escapeHtml(type)}</button>`).join("");
    $("#formTypes").innerHTML = state.types.map((type) => `<button type="button" class="chip${formTypes.has(type) ? " selected" : ""}" data-form-type="${escapeHtml(type)}" aria-pressed="${formTypes.has(type)}">${escapeHtml(type)}</button>`).join("");
  }

  function renderFilterAmenities() {
    $("#filterAmenities").innerHTML = AMENITIES.map(({ key, label, icon }) => {
      const value = filterAmenities[key];
      const stateText = value === null ? "不限" : value ? "要有" : "不要";
      return `<button type="button" class="filter-amenity${value !== null ? " active" : ""}" data-filter-amenity="${key}" aria-label="${label}：${stateText}，點擊切換" aria-pressed="${value !== null}"><span class="amenity-name"><span class="amenity-icon">${icon}</span>${label}</span><span class="filter-state">${stateText}</span></button>`;
    }).join("");
  }

  function renderFormAmenities() {
    $("#formAmenities").innerHTML = AMENITIES.map(({ key, label, icon }) => {
      const value = formAmenities[key];
      return `<button type="button" class="form-amenity ${value ? "yes" : "no"}" data-form-amenity="${key}" aria-pressed="${value}"><span>${icon}　${label}</span><span class="amenity-value">${value ? "有" : "沒有"}</span></button>`;
    }).join("");
  }

  function renderRestaurants() {
    const list = $("#restaurantList");
    const empty = $("#emptyState");
    $("#restaurantCount").textContent = state.restaurants.length;
    $("#navCount").textContent = state.restaurants.length;
    empty.hidden = state.restaurants.length !== 0;
    list.hidden = state.restaurants.length === 0;
    list.innerHTML = state.restaurants.map((restaurant) => {
      const tags = restaurant.types.map((type) => `<span class="mini-tag">${escapeHtml(type)}</span>`).join("");
      const amenities = AMENITIES.filter(({ key }) => restaurant.amenities[key]).map(({ label }) => label).join(" · ");
      const price = restaurant.price === null || !Number.isFinite(restaurant.price) ? "價格未填" : `約 NT$${restaurant.price.toLocaleString("zh-TW")}/人`;
      return `<article class="restaurant-card"><div class="restaurant-emoji" aria-hidden="true">${iconFor(restaurant.types)}</div><div class="restaurant-info"><h3>${escapeHtml(restaurant.name)}</h3><div class="restaurant-meta">${tags || "<span class=\"mini-tag\">未分類</span>"}<span>${price}</span>${amenities ? `<span>· ${escapeHtml(amenities)}</span>` : ""}</div></div><div class="card-actions"><button type="button" class="card-action" data-edit="${escapeHtml(restaurant.id)}" aria-label="編輯${escapeHtml(restaurant.name)}" title="編輯">✎</button><button type="button" class="card-action" data-delete="${escapeHtml(restaurant.id)}" aria-label="刪除${escapeHtml(restaurant.name)}" title="刪除">×</button></div></article>`;
    }).join("");
  }

  function iconFor(types) {
    const first = types[0] || "";
    if (/火鍋|粥/.test(first)) return "🍲";
    if (/日式|壽司/.test(first)) return "🍣";
    if (/西式|鐵板燒/.test(first)) return "🥘";
    if (/速食/.test(first)) return "🍔";
    if (/自助餐/.test(first)) return "🍱";
    if (/泰式/.test(first)) return "🍛";
    return "🍜";
  }

  function openRestaurantForm(restaurant = null) {
    $("#restaurantForm").reset();
    $("#restaurantId").value = restaurant?.id || "";
    $("#nameInput").value = restaurant?.name || "";
    $("#priceInput").value = restaurant?.price ?? "";
    $("#formTitle").textContent = restaurant ? "編輯餐廳" : "新增餐廳";
    $("#formEyebrow").textContent = restaurant ? "EDIT A PLACE" : "ADD A PLACE";
    formTypes = new Set(restaurant?.types || []);
    formAmenities = Object.fromEntries(AMENITIES.map(({ key }) => [key, Boolean(restaurant?.amenities[key])]));
    renderTypes();
    renderFormAmenities();
    $("#customTypeInput").value = "";
    $("#restaurantDialog").showModal();
    setTimeout(() => $("#nameInput").focus(), 40);
  }

  function shuffle(items) {
    const array = [...items];
    for (let i = array.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  function matchesFilters(restaurant) {
    if (selectedFilterTypes.size && !restaurant.types.some((type) => selectedFilterTypes.has(type))) return false;
    const rawBudget = $("#budgetInput").value;
    if (rawBudget !== "" && (restaurant.price === null || restaurant.price > Number(rawBudget))) return false;
    return AMENITIES.every(({ key }) => filterAmenities[key] === null || restaurant.amenities[key] === filterAmenities[key]);
  }

  function draw() {
    const section = $("#resultsSection");
    const list = $("#resultList");
    section.hidden = false;
    if (!state.restaurants.length) {
      lastResults = [];
      $("#resultCount").textContent = "";
      list.innerHTML = `<div class="empty-results">口袋名單裡還沒有餐廳，<br />先到「我的餐廳」新增幾家吧。</div>`;
      section.scrollIntoView({ behavior: "smooth", block: "nearest" });
      return;
    }
    const matching = state.restaurants.filter(matchesFilters);
    lastResults = shuffle(matching).slice(0, 3);
    $("#resultCount").textContent = `找到 ${matching.length} 家符合條件${matching.length < 3 ? "，以下列出全部符合的餐廳" : "，隨機選出三家"}`;
    if (!lastResults.length) {
      list.innerHTML = `<div class="empty-results">目前沒有符合的餐廳，<br />試試清除部分條件或新增口袋餐廳。</div>`;
    } else {
      list.innerHTML = lastResults.map((restaurant, index) => {
        const typeTags = restaurant.types.filter((type) => !selectedFilterTypes.size || selectedFilterTypes.has(type)).slice(0, 2).map((type) => `<span class="mini-tag">${escapeHtml(type)}</span>`).join("");
        const amenities = AMENITIES.filter(({ key }) => restaurant.amenities[key]).map(({ label }) => label).slice(0, 2).join(" · ");
        const price = restaurant.price === null ? "價格未填" : `NT$${restaurant.price.toLocaleString("zh-TW")}/人`;
        return `<article class="result-card"><div class="result-number">0${index + 1}</div><div class="result-info"><h3>${escapeHtml(restaurant.name)}</h3><div class="result-meta">${typeTags}${amenities ? `<span class="mini-tag">${escapeHtml(amenities)}</span>` : ""}</div></div><div class="result-price">${price}</div></article>`;
      }).join("");
    }
    section.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function switchView(id) {
    $$(".view").forEach((view) => view.classList.toggle("active", view.id === id));
    $$(".nav-item").forEach((item) => {
      const active = item.dataset.view === id;
      item.classList.toggle("active", active);
      if (active) item.setAttribute("aria-current", "page");
      else item.removeAttribute("aria-current");
    });
    if (id === "restaurantsView") renderRestaurants();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  $("#restaurantForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const name = $("#nameInput").value.trim();
    if (!name) return;
    const rawPrice = $("#priceInput").value;
    const restaurant = normalizeRestaurant({
      id: $("#restaurantId").value || makeId(),
      name,
      types: [...formTypes],
      price: rawPrice === "" ? null : Number(rawPrice),
      amenities: formAmenities,
    });
    const existingIndex = state.restaurants.findIndex((item) => item.id === restaurant.id);
    if (existingIndex >= 0) state.restaurants[existingIndex] = restaurant;
    else state.restaurants.unshift(restaurant);
    persist();
    renderRestaurants();
    renderTypes();
    $("#restaurantDialog").close();
    showToast(existingIndex >= 0 ? "餐廳資料已更新" : "已加入口袋餐廳");
  });

  $("#restaurantList").addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-edit]");
    const deleteButton = event.target.closest("[data-delete]");
    if (editButton) {
      const restaurant = state.restaurants.find((item) => item.id === editButton.dataset.edit);
      if (restaurant) openRestaurantForm(restaurant);
    }
    if (deleteButton) {
      const restaurant = state.restaurants.find((item) => item.id === deleteButton.dataset.delete);
      if (!restaurant) return;
      if (window.confirm(`確定要刪除「${restaurant.name}」嗎？`)) {
        state.restaurants = state.restaurants.filter((item) => item.id !== restaurant.id);
        persist();
        renderRestaurants();
        showToast("餐廳已刪除");
      }
    }
  });

  $("#filterTypes").addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter-type]");
    if (!button) return;
    const type = button.dataset.filterType;
    selectedFilterTypes.has(type) ? selectedFilterTypes.delete(type) : selectedFilterTypes.add(type);
    renderTypes();
  });
  $("#formTypes").addEventListener("click", (event) => {
    const button = event.target.closest("[data-form-type]");
    if (!button) return;
    const type = button.dataset.formType;
    formTypes.has(type) ? formTypes.delete(type) : formTypes.add(type);
    renderTypes();
  });
  $("#filterAmenities").addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter-amenity]");
    if (!button) return;
    const key = button.dataset.filterAmenity;
    const current = filterAmenities[key];
    filterAmenities[key] = current === null ? true : current === true ? false : null;
    renderFilterAmenities();
  });
  $("#formAmenities").addEventListener("click", (event) => {
    const button = event.target.closest("[data-form-amenity]");
    if (!button) return;
    const key = button.dataset.formAmenity;
    formAmenities[key] = !formAmenities[key];
    renderFormAmenities();
  });

  $("#addTypeButton").addEventListener("click", () => {
    const input = $("#customTypeInput");
    const type = input.value.trim();
    if (!type) return input.focus();
    if (state.types.some((item) => item.toLocaleLowerCase() === type.toLocaleLowerCase())) {
      showToast("這個餐點類型已經存在");
      return input.select();
    }
    state.types.push(type);
    formTypes.add(type);
    persist();
    renderTypes();
    input.value = "";
    input.focus();
  });
  $("#customTypeInput").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      $("#addTypeButton").click();
    }
  });

  $("#clearFilters").addEventListener("click", () => {
    selectedFilterTypes.clear();
    filterAmenities = Object.fromEntries(AMENITIES.map(({ key }) => [key, null]));
    $("#budgetInput").value = "";
    renderTypes();
    renderFilterAmenities();
  });
  $("#drawButton").addEventListener("click", draw);
  $("#rerollButton").addEventListener("click", draw);
  $("#addRestaurantButton").addEventListener("click", () => openRestaurantForm());
  $("#emptyAddButton").addEventListener("click", () => openRestaurantForm());
  $$(".nav-item").forEach((item) => item.addEventListener("click", () => switchView(item.dataset.view)));
  $$('[data-close]').forEach((button) => button.addEventListener("click", () => button.closest("dialog").close()));

  $("#backupButton").addEventListener("click", () => $("#backupDialog").showModal());
  $("#exportButton").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), ...state }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `午餐餐廳備份-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showToast("備份檔已匯出");
  });
  $("#importButton").addEventListener("click", () => $("#importFile").click());
  $("#importFile").addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (!Array.isArray(parsed.types) || !Array.isArray(parsed.restaurants) || !parsed.restaurants.every(isRestaurant)) throw new Error("invalid");
      if (!window.confirm(`匯入 ${parsed.restaurants.length} 家餐廳與類型？目前裝置上的資料會由備份內容取代。`)) return;
      state.types = [...new Set([...DEFAULT_TYPES, ...parsed.types.filter((type) => typeof type === "string" && type.trim())])];
      state.restaurants = parsed.restaurants.map(normalizeRestaurant);
      persist();
      renderTypes();
      renderRestaurants();
      $("#backupDialog").close();
      showToast("餐廳資料已匯入");
    } catch {
      showToast("無法讀取這個備份檔，請確認檔案格式");
    } finally {
      event.target.value = "";
    }
  });

  renderTypes();
  renderFilterAmenities();
  renderFormAmenities();
  renderRestaurants();
  renderCounts();
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  }
})();
