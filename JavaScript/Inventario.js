// ====== Keys (mismas que tu app) ======
const USERS_KEY = "pos_users";
const SESSION_KEY = "pos_session";
const BUSINESSES_KEY = "pos_businesses";
const SALES_KEY = "pos_sales_v1";

// ====== Helpers base ======
function getUsers() {
  try { return JSON.parse(localStorage.getItem(USERS_KEY)) || []; } catch { return []; }
}
function getSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { return null; }
}
function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}
function getBusinesses() {
  try { return JSON.parse(localStorage.getItem(BUSINESSES_KEY)) || []; } catch { return []; }
}
function getBusinessByOwner(userId) {
  return getBusinesses().find(b => b.ownerUserId === userId) || null;
}

// ====== Auth guard ======
function requireAuthAndBizOrRedirect() {
  const session = getSession();
  if (!session?.userId) {
    window.location.href = "Index.html";
    return null;
  }

  const user = getUsers().find(u => u.id === session.userId);
  if (!user) {
    clearSession();
    window.location.href = "Index.html";
    return null;
  }

  const biz = getBusinessByOwner(session.userId);
  if (!biz) {
    window.location.href = "Index.html";
    return null;
  }

  return { user, biz };
}

// ====== Products storage (por empresa) ======
function getAllProducts() {
  try { return JSON.parse(localStorage.getItem(PRODUCTS_KEY)) || []; } catch { return []; }
}
function saveAllProducts(all) {
  localStorage.setItem(PRODUCTS_KEY, JSON.stringify(all));
}
function getProductsForBiz(bizId) {
  return getAllProducts().filter(p => p.bizId === bizId);
}
function upsertProduct(product) {
  const all = getAllProducts();
  const idx = all.findIndex(p => p.id === product.id);
  if (idx >= 0) all[idx] = product;
  else all.push(product);
  saveAllProducts(all);
}
function deleteProduct(productId) {
  const all = getAllProducts().filter(p => p.id !== productId);
  saveAllProducts(all);
}
function deleteAllForBiz(bizId) {
  const all = getAllProducts().filter(p => p.bizId !== bizId);
  saveAllProducts(all);
}

// ====== UI helpers ======
function money(n) {
  const v = Number(n || 0);
  return v.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}
function showError(el, msg) {
  el.textContent = msg;
  el.classList.remove("d-none");
}
function hideError(el) {
  el.textContent = "";
  el.classList.add("d-none");
}
function safeText(s) {
  return String(s ?? "");
}

// ====== DOM ======
const bizMini = document.getElementById("bizMini");
const searchInput = document.getElementById("searchInput");
const countLabel = document.getElementById("countLabel");
const tbody = document.getElementById("productsTbody");
const emptyState = document.getElementById("emptyState");

const formTitle = document.getElementById("formTitle");
const formError = document.getElementById("formError");
const btnResetForm = document.getElementById("btnResetForm");
const btnSaveProduct = document.getElementById("btnSaveProduct");
const btnDeleteProduct = document.getElementById("btnDeleteProduct");

const pName = document.getElementById("pName");
const pSku = document.getElementById("pSku");
const pCategory = document.getElementById("pCategory");
const pPrice = document.getElementById("pPrice");
const pStock = document.getElementById("pStock");
const pUnit = document.getElementById("pUnit");

const btnSeedDemo = document.getElementById("btnSeedDemo");
const btnClearAll = document.getElementById("btnClearAll");
const btnLogoutInv = document.getElementById("btnLogoutInv");

// ====== State ======
let ctx = null; // {user, biz}
let editingId = null;
let currentList = [];

// ====== Render ======
function renderTable(list) {
  tbody.innerHTML = list.map(p => `
    <tr>
      <td>
        <div class="fw-semibold">${safeText(p.name)}</div>
        <div class="text-secondary small">${safeText(p.unit || "")}</div>
      </td>
      <td class="text-secondary">${safeText(p.sku || "")}</td>
      <td class="text-secondary">${safeText(p.category || "")}</td>
      <td class="text-end">${money(p.price)}</td>
      <td class="text-end">${Number(p.stock || 0)}</td>
      <td class="text-end">
        <button class="btn btn-outline-light btn-sm" data-edit="${p.id}">Editar</button>
      </td>
    </tr>
  `).join("");

  const count = list.length;
  countLabel.textContent = `${count} producto${count === 1 ? "" : "s"}`;

  emptyState.classList.toggle("d-none", count !== 0);

  // bind edit
  tbody.querySelectorAll("[data-edit]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-edit");
      const item = currentList.find(x => x.id === id);
      if (item) loadIntoForm(item);
    });
  });
}

function refresh() {
  const q = (searchInput.value || "").trim().toLowerCase();
  const list = getProductsForBiz(ctx.biz.id);

  currentList = q
    ? list.filter(p =>
        (p.name || "").toLowerCase().includes(q) ||
        (p.sku || "").toLowerCase().includes(q)
      )
    : list;

  renderTable(currentList);
}

// ====== Form ======
function resetForm() {
  editingId = null;
  formTitle.textContent = "Agregar producto";
  btnDeleteProduct.classList.add("d-none");
  btnSaveProduct.textContent = "Guardar";

  pName.value = "";
  pSku.value = "";
  pCategory.value = "";
  pPrice.value = "";
  pStock.value = "";
  pUnit.value = "";

  hideError(formError);
}

function loadIntoForm(p) {
  editingId = p.id;
  formTitle.textContent = "Editar producto";
  btnDeleteProduct.classList.remove("d-none");
  btnSaveProduct.textContent = "Actualizar";

  pName.value = p.name || "";
  pSku.value = p.sku || "";
  pCategory.value = p.category || "";
  pPrice.value = p.price ?? "";
  pStock.value = p.stock ?? "";
  pUnit.value = p.unit || "";

  hideError(formError);
}

function validateForm() {
  const name = (pName.value || "").trim();
  const sku = (pSku.value || "").trim();
  const category = (pCategory.value || "").trim();
  const unit = (pUnit.value || "").trim();

  const price = Number(pPrice.value);
  const stock = Number(pStock.value);

  if (name.length < 2) return { ok: false, msg: "Pon un nombre de producto (mínimo 2 letras)." };
  if (!Number.isFinite(price) || price < 0) return { ok: false, msg: "Precio inválido." };
  if (!Number.isFinite(stock) || stock < 0) return { ok: false, msg: "Stock inválido." };

  return { ok: true, data: { name, sku, category, unit, price, stock } };
}

// ====== Events ======
btnResetForm.addEventListener("click", resetForm);

btnSaveProduct.addEventListener("click", () => {
  hideError(formError);
  const v = validateForm();
  if (!v.ok) return showError(formError, v.msg);

  const now = new Date().toISOString();
  const base = v.data;

  // si SKU existe dentro de la misma empresa, evita duplicados (opcional pero útil)
  const skuLower = (base.sku || "").toLowerCase();
  if (skuLower) {
    const existing = getProductsForBiz(ctx.biz.id).find(p => (p.sku || "").toLowerCase() === skuLower);
    if (existing && existing.id !== editingId) {
      return showError(formError, "Ese SKU ya existe en tu inventario.");
    }
  }

  const product = {
    id: editingId || crypto.randomUUID(),
    bizId: ctx.biz.id,
    name: base.name,
    sku: base.sku,
    category: base.category,
    unit: base.unit,
    price: base.price,
    stock: Math.floor(base.stock),
    updatedAt: now,
    createdAt: editingId ? (getProductsForBiz(ctx.biz.id).find(p => p.id === editingId)?.createdAt || now) : now
  };

  upsertProduct(product);
  resetForm();
  refresh();
});

btnDeleteProduct.addEventListener("click", () => {
  if (!editingId) return;
  const ok = confirm("¿Eliminar este producto?");
  if (!ok) return;

  deleteProduct(editingId);
  resetForm();
  refresh();
});

searchInput.addEventListener("input", refresh);

btnSeedDemo.addEventListener("click", () => {
  const list = getProductsForBiz(ctx.biz.id);
  if (list.length > 0) {
    const ok = confirm("Ya tienes productos. ¿Quieres agregar demo de todos modos?");
    if (!ok) return;
  }

  const now = new Date().toISOString();
  const demo = [
    { name: "Coca 600ml", sku: "COCA-600", category: "Bebidas", unit: "pieza", price: 22, stock: 30 },
    { name: "Agua 1L", sku: "AGUA-1L", category: "Bebidas", unit: "pieza", price: 15, stock: 40 },
    { name: "Papas clásicas", sku: "PAP-CL", category: "Snacks", unit: "pieza", price: 18, stock: 25 },
    { name: "Chocolate", sku: "CHO-01", category: "Dulces", unit: "pieza", price: 20, stock: 12 },
  ].map(x => ({
    id: crypto.randomUUID(),
    bizId: ctx.biz.id,
    ...x,
    createdAt: now,
    updatedAt: now
  }));

  demo.forEach(upsertProduct);
  refresh();
});

btnClearAll.addEventListener("click", () => {
  const ok = confirm("¿Borrar TODOS los productos de esta empresa? Esta acción no se puede deshacer.");
  if (!ok) return;

  deleteAllForBiz(ctx.biz.id);
  resetForm();
  refresh();
});

btnLogoutInv.addEventListener("click", () => {
  clearSession();
  window.location.href = "Index.html";
});

// ====== INIT ======
(function init() {
  ctx = requireAuthAndBizOrRedirect();
  if (!ctx) return;

  bizMini.textContent = `${ctx.biz.name} — @${ctx.biz.handle}`;
  resetForm();
  refresh();
})();
