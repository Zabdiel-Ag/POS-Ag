// ================================
// Inventario.js (MVP PRO)
// Conectado al POS por businessId + pos_products_v1
// SKU único: Auto/Manual + regenerar
// Innovación: "Bajo stock" + migración automática
// ================================

const SESSION_KEY = "pos_session";
const USERS_KEY = "pos_users";
const BUSINESSES_KEY = "pos_businesses";
const PRODUCTS_KEY = "pos_products_v1"; // MISMA KEY que POS usa

// ===== Utils storage =====
function jget(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
function jset(key, value) { localStorage.setItem(key, JSON.stringify(value)); }

function getSession() { return jget(SESSION_KEY, null); }
function clearSession() { localStorage.removeItem(SESSION_KEY); }
function getUsers() { return jget(USERS_KEY, []); }
function getBusinesses() { return jget(BUSINESSES_KEY, []); }

function getAllProducts() { return jget(PRODUCTS_KEY, []); }
function saveAllProducts(all) { jset(PRODUCTS_KEY, all); }

// ===== Auth / business =====
function requireBizOrRedirect() {
  const s = getSession();
  if (!s?.userId) { window.location.href = "Index.html"; return null; }

  const u = getUsers().find(x => x.id === s.userId);
  if (!u) { clearSession(); window.location.href = "Index.html"; return null; }

  const biz = getBusinesses().find(b => b.ownerUserId === s.userId);
  if (!biz) { window.location.href = "Index.html"; return null; }

  return { user: u, biz };
}

// ===== Formatting =====
function money(n) {
  return Number(n || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}
function clampNumber(n, min, max) {
  const x = Number(n);
  if (Number.isNaN(x)) return min;
  return Math.min(max, Math.max(min, x));
}

// ===== DOM =====
const bizMini = document.getElementById("bizMini");

const searchInput = document.getElementById("searchInput");
const btnLogoutInv = document.getElementById("btnLogoutInv");

const formTitle = document.getElementById("formTitle");
const formError = document.getElementById("formError");

const pName = document.getElementById("pName");
const pSku = document.getElementById("pSku");
const pCategory = document.getElementById("pCategory");
const pPrice = document.getElementById("pPrice");
const pStock = document.getElementById("pStock");
const pUnit = document.getElementById("pUnit");

const skuManual = document.getElementById("skuManual");
const btnGenSku = document.getElementById("btnGenSku");

const btnSaveProduct = document.getElementById("btnSaveProduct");
const btnDeleteProduct = document.getElementById("btnDeleteProduct");
const btnResetForm = document.getElementById("btnResetForm");

const btnSeedDemo = document.getElementById("btnSeedDemo");
const btnClearAll = document.getElementById("btnClearAll");

const productsTbody = document.getElementById("productsTbody");
const countLabel = document.getElementById("countLabel");
const emptyState = document.getElementById("emptyState");

// ===== State =====
let ctx = null;             // { user, biz }
let editingId = null;       // producto actual en edición (id)
let currentQuery = "";      // búsqueda
const LOW_STOCK = 5;        // umbral de stock bajo (innovación)

// ===== MIGRACIÓN: bizId -> businessId (por si guardaste antes) =====
function migrateBizIdToBusinessId() {
  const all = getAllProducts();
  let changed = false;

  for (const p of all) {
    if (p && p.bizId && !p.businessId) {
      p.businessId = p.bizId;
      delete p.bizId;
      changed = true;
    }
  }
  if (changed) saveAllProducts(all);
}

// ===== Data helpers =====
function getProductsForBiz(businessId) {
  return getAllProducts().filter(p => p.businessId === businessId);
}

function upsertProduct(product) {
  const all = getAllProducts();
  const i = all.findIndex(p => p.id === product.id);
  if (i >= 0) all[i] = product;
  else all.push(product);
  saveAllProducts(all);
}

function removeProduct(productId) {
  const all = getAllProducts();
  const next = all.filter(p => p.id !== productId);
  saveAllProducts(next);
}

function clearProductsForBiz(businessId) {
  const all = getAllProducts();
  const next = all.filter(p => p.businessId !== businessId);
  saveAllProducts(next);
}

// ===== SKU generation =====
function normalizeSkuBase(s) {
  return String(s || "")
    .toUpperCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 18);
}

function generateSku({ name, category }, businessId, excludeId = null) {
  const baseRaw = `${name || "PROD"}-${category || "GEN"}`;
  const base = normalizeSkuBase(baseRaw) || "PROD-GEN";

  const existing = getProductsForBiz(businessId)
    .filter(p => p.id !== excludeId)
    .map(p => String(p.sku || "").toUpperCase());

  if (!existing.includes(base)) return base;

  let n = 2;
  while (n < 1000) {
    const candidate = `${base}-${String(n).padStart(2, "0")}`;
    if (!existing.includes(candidate)) return candidate;
    n++;
  }
  return `${base}-${Date.now().toString().slice(-4)}`;
}

function setSkuModeManual(isManual) {
  if (!pSku) return;
  pSku.disabled = !isManual;
  pSku.placeholder = isManual ? "Escribe el SKU..." : "SKU automático";

  if (!isManual && ctx) {
    // al pasar a auto, genera
    pSku.value = generateSku(
      { name: pName?.value, category: pCategory?.value },
      ctx.biz.id,
      editingId
    );
  }
}

function refreshAutoSkuIfNeeded() {
  if (!ctx || !pSku || !skuManual) return;
  if (!skuManual.checked) {
    pSku.value = generateSku(
      { name: pName?.value, category: pCategory?.value },
      ctx.biz.id,
      editingId
    );
  }
}

// ===== UI helpers =====
function showFormError(msg) {
  if (!formError) return;
  formError.textContent = msg;
  formError.classList.remove("d-none");
}
function hideFormError() {
  if (!formError) return;
  formError.textContent = "";
  formError.classList.add("d-none");
}

function resetForm() {
  editingId = null;
  hideFormError();

  if (formTitle) formTitle.textContent = "Agregar producto";

  if (pName) pName.value = "";
  if (pCategory) pCategory.value = "";
  if (pPrice) pPrice.value = "";
  if (pStock) pStock.value = "";
  if (pUnit) pUnit.value = "";

  // SKU vuelve a auto por defecto
  if (skuManual) skuManual.checked = false;
  setSkuModeManual(false);

  // genera SKU "placeholder" (si hay ctx)
  if (ctx && pSku) {
    pSku.value = generateSku({ name: "", category: "" }, ctx.biz.id, null);
  }

  if (btnDeleteProduct) btnDeleteProduct.classList.add("d-none");
}

function loadForm(product) {
  editingId = product.id;
  hideFormError();

  if (formTitle) formTitle.textContent = "Editar producto";
  if (pName) pName.value = product.name || "";
  if (pCategory) pCategory.value = product.category || "";
  if (pPrice) pPrice.value = String(product.price ?? "");
  if (pStock) pStock.value = String(product.stock ?? "");
  if (pUnit) pUnit.value = product.unit || "";

  // SKU: por defecto manual OFF (auto), pero si ya existe SKU, lo mostramos
  if (pSku) pSku.value = product.sku || "";
  if (skuManual) skuManual.checked = true; // al editar, lo dejamos manual para que no te lo cambie solo
  setSkuModeManual(true);

  if (btnDeleteProduct) btnDeleteProduct.classList.remove("d-none");
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, m => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[m]));
}

function renderList() {
  if (!ctx || !productsTbody) return;

  const all = getProductsForBiz(ctx.biz.id);

  // búsqueda
  const q = String(currentQuery || "").trim().toLowerCase();
  const filtered = !q ? all : all.filter(p => {
    const name = String(p.name || "").toLowerCase();
    const sku = String(p.sku || "").toLowerCase();
    return name.includes(q) || sku.includes(q);
  });

  // contador / empty
  if (countLabel) countLabel.textContent = `${filtered.length} producto(s)`;
  if (emptyState) emptyState.classList.toggle("d-none", filtered.length !== 0);

  // ordenar (innovación simple): bajo stock arriba, luego alfabético
  filtered.sort((a, b) => {
    const alow = Number(a.stock ?? 0) <= LOW_STOCK ? 0 : 1;
    const blow = Number(b.stock ?? 0) <= LOW_STOCK ? 0 : 1;
    if (alow !== blow) return alow - blow;
    return String(a.name || "").localeCompare(String(b.name || ""), "es");
  });

  productsTbody.innerHTML = filtered.map(p => {
    const low = Number(p.stock ?? 0) <= LOW_STOCK;
    const badge = low ? `<span class="badge bg-warning text-dark ms-2">Bajo stock</span>` : "";

    return `
      <tr>
        <td>
          <div class="fw-semibold">${escapeHtml(p.name)}${badge}</div>
          <div class="text-secondary small">${escapeHtml(p.category || "—")}</div>
        </td>
        <td class="text-secondary">${escapeHtml(p.sku || "—")}</td>
        <td class="text-secondary">${escapeHtml(p.unit || "—")}</td>
        <td class="text-end">${money(p.price)}</td>
        <td class="text-end">${Number(p.stock ?? 0)}</td>
        <td class="text-end">
          <button class="btn btn-outline-light btn-sm" data-edit="${p.id}">Editar</button>
        </td>
      </tr>
    `;
  }).join("");

  // wire edit buttons
  productsTbody.querySelectorAll("[data-edit]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-edit");
      const prod = getProductsForBiz(ctx.biz.id).find(x => x.id === id);
      if (!prod) return;
      loadForm(prod);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
}

// ===== Validation =====
function validateProductInput() {
  const name = (pName?.value || "").trim();
  const category = (pCategory?.value || "").trim();
  const unit = (pUnit?.value || "").trim();

  const price = clampNumber(pPrice?.value, 0, 1e9);
  const stock = Math.floor(clampNumber(pStock?.value, 0, 1e9));

  if (name.length < 2) return { ok: false, msg: "Pon un nombre válido (mínimo 2 letras)." };
  if (!Number.isFinite(price) || price <= 0) return { ok: false, msg: "Precio inválido." };
  if (!Number.isFinite(stock) || stock < 0) return { ok: false, msg: "Stock inválido." };

  // SKU
  let sku = (pSku?.value || "").trim();

  if (!skuManual?.checked) {
    // auto: generar siempre (para garantizar unicidad)
    sku = generateSku({ name, category }, ctx.biz.id, editingId);
    if (pSku) pSku.value = sku;
  } else {
    // manual: si lo deja vacío, lo generamos
    if (!sku) {
      sku = generateSku({ name, category }, ctx.biz.id, editingId);
      if (pSku) pSku.value = sku;
    }
  }

  // unicidad SKU dentro de la empresa
  const exists = getProductsForBiz(ctx.biz.id)
    .some(p => p.id !== editingId && String(p.sku || "").toUpperCase() === sku.toUpperCase());

  if (exists) return { ok: false, msg: "Ese SKU ya existe. Regenera (↻) o cambia a manual y escribe otro." };

  return {
    ok: true,
    value: { name, sku, category, unit, price, stock }
  };
}

// ===== Events =====
function wireEvents() {
  // logout simple (luego lo haces con modal)
  btnLogoutInv?.addEventListener("click", () => {
    clearSession();
    window.location.href = "Index.html";
  });

  // buscar
  searchInput?.addEventListener("input", (e) => {
    currentQuery = e.target.value || "";
    renderList();
  });

  // SKU events
  skuManual?.addEventListener("change", (e) => setSkuModeManual(e.target.checked));
  btnGenSku?.addEventListener("click", () => {
    if (!ctx || !pSku) return;
    if (skuManual?.checked) return;
    pSku.value = generateSku({ name: pName?.value, category: pCategory?.value }, ctx.biz.id, editingId);
  });

  pName?.addEventListener("input", refreshAutoSkuIfNeeded);
  pCategory?.addEventListener("input", refreshAutoSkuIfNeeded);

  // reset
  btnResetForm?.addEventListener("click", () => resetForm());

  // save
  btnSaveProduct?.addEventListener("click", () => {
    hideFormError();
    if (!ctx) return;

    const v = validateProductInput();
    if (!v.ok) return showFormError(v.msg);

    const now = new Date().toISOString();

    const existing = editingId ? getProductsForBiz(ctx.biz.id).find(p => p.id === editingId) : null;

    const product = {
      id: editingId || crypto.randomUUID(),
      businessId: ctx.biz.id, // ✅ CLAVE para conectar con POS
      name: v.value.name,
      sku: v.value.sku,
      category: v.value.category,
      unit: v.value.unit,
      price: v.value.price,
      stock: v.value.stock,
      createdAt: existing?.createdAt || now,
      updatedAt: now
    };

    upsertProduct(product);
    resetForm();
    renderList();
  });

  // delete
  btnDeleteProduct?.addEventListener("click", () => {
    if (!ctx || !editingId) return;
    const prod = getProductsForBiz(ctx.biz.id).find(p => p.id === editingId);
    if (!prod) return;

    if (!confirm(`¿Eliminar "${prod.name}"?`)) return;

    removeProduct(editingId);
    resetForm();
    renderList();
  });

  // demo
  btnSeedDemo?.addEventListener("click", () => {
    if (!ctx) return;

    const demo = [
      { name: "Coca 600ml", category: "Bebidas", unit: "pieza", price: 20, stock: 24 },
      { name: "Sabritas", category: "Botanas", unit: "pieza", price: 18, stock: 8 },
      { name: "Agua 1L", category: "Bebidas", unit: "pieza", price: 15, stock: 4 }, // bajo stock
      { name: "Pan Blanco", category: "Panadería", unit: "pieza", price: 35, stock: 12 }
    ];

    for (const d of demo) {
      const sku = generateSku({ name: d.name, category: d.category }, ctx.biz.id, null);
      upsertProduct({
        id: crypto.randomUUID(),
        businessId: ctx.biz.id,
        name: d.name,
        sku,
        category: d.category,
        unit: d.unit,
        price: d.price,
        stock: d.stock,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    renderList();
  });

  // borrar todo empresa
  btnClearAll?.addEventListener("click", () => {
    if (!ctx) return;
    if (!confirm("¿Borrar todos los productos de esta empresa?")) return;

    clearProductsForBiz(ctx.biz.id);
    resetForm();
    renderList();
  });
}

// ===== INIT =====
(function init() {
  ctx = requireBizOrRedirect();
  if (!ctx) return;

  // migra estructuras viejas
  migrateBizIdToBusinessId();

  // header
  if (bizMini) bizMini.textContent = `${ctx.biz.name} — @${ctx.biz.handle}`;

  // estado inicial SKU
  resetForm();

  // events + render
  wireEvents();
  renderList();
})();
