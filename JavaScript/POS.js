// ===== Keys (mismas del proyecto) =====
const USERS_KEY = "pos_users";
const SESSION_KEY = "pos_session";
const BUSINESSES_KEY = "pos_businesses";
const PRODUCTS_KEY = "pos_products_v1";
const SALES_KEY = "pos_sales_v1";

// ===== Helpers storage =====
function jget(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function jset(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getSession() { return jget(SESSION_KEY, null); }
function clearSession() { localStorage.removeItem(SESSION_KEY); }

function getUsers() { return jget(USERS_KEY, []); }
function getBusinesses() { return jget(BUSINESSES_KEY, []); }

function getBusinessByOwner(userId) {
  return getBusinesses().find(b => b.ownerUserId === userId) || null;
}

function requireAuth() {
  const session = getSession();
  if (!session?.userId) { window.location.href = "Index.html"; return null; }

  const user = getUsers().find(u => u.id === session.userId);
  if (!user) { clearSession(); window.location.href = "Index.html"; return null; }

  const biz = getBusinessByOwner(session.userId);
  if (!biz) { window.location.href = "Index.html"; return null; }

  return { user, biz };
}

// ===== Data models =====
function getAllProducts() { return jget(PRODUCTS_KEY, []); }
function saveAllProducts(all) { jset(PRODUCTS_KEY, all); }
function getProductsByBiz(businessId) { return getAllProducts().filter(p => p.businessId === businessId); }

function getAllSales() { return jget(SALES_KEY, []); }
function saveAllSales(all) { jset(SALES_KEY, all); }
function getSalesByBiz(businessId) { return getAllSales().filter(s => s.businessId === businessId); }

function money(n) {
  const x = Number(n || 0);
  return x.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

function todayISODate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function isToday(isoString) {
  return String(isoString || "").slice(0, 10) === todayISODate();
}

// ===== State =====
let ctx = null; // {user,biz}
let products = [];
let sales = [];
let cart = []; // {productId,name,price,qty}

// ===== DOM =====
const bizLabel = document.getElementById("bizLabel");
const todayTotalChip = document.getElementById("todayTotalChip");

const productSearch = document.getElementById("productSearch");
const productList = document.getElementById("productList");
const salesList = document.getElementById("salesList");

const posSearch = document.getElementById("posSearch");
const cartList = document.getElementById("cartList");

const subtotalLabel = document.getElementById("subtotalLabel");
const totalLabel = document.getElementById("totalLabel");
const discountInput = document.getElementById("discountInput");
const paymentMethod = document.getElementById("paymentMethod");
const posMsg = document.getElementById("posMsg");

const btnClearCart = document.getElementById("btnClearCart");
const btnCheckout = document.getElementById("btnCheckout");

// ===== Modal producto (solo si existe en el HTML) =====
const productModalEl = document.getElementById("productModal");
const productModal = (productModalEl && window.bootstrap?.Modal)
  ? bootstrap.Modal.getOrCreateInstance(productModalEl)
  : null;

const productModalTitle = document.getElementById("productModalTitle");
const btnOpenProductModal = document.getElementById("btnOpenProductModal");
const btnSaveProduct = document.getElementById("btnSaveProduct");

const prodId = document.getElementById("prodId");
const prodName = document.getElementById("prodName");
const prodPrice = document.getElementById("prodPrice");
const prodStock = document.getElementById("prodStock");
const prodSku = document.getElementById("prodSku");
const prodError = document.getElementById("prodError");

// ===== UI helpers =====
function showError(el, msg) {
  if (!el) return;
  el.textContent = msg;
  el.classList.remove("d-none");
}
function hideError(el) {
  if (!el) return;
  el.textContent = "";
  el.classList.add("d-none");
}

function setPosMsg(msg, isOk = false) {
  if (!posMsg) return;
  posMsg.textContent = msg;
  posMsg.classList.remove("d-none");
  posMsg.classList.toggle("alert-danger", !isOk);
  posMsg.classList.toggle("alert-success", isOk);
}
function clearPosMsg() {
  if (!posMsg) return;
  posMsg.textContent = "";
  posMsg.classList.add("d-none");
  posMsg.classList.remove("alert-success");
  posMsg.classList.add("alert-danger");
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ===== Render =====
function renderBiz() {
  if (bizLabel) bizLabel.textContent = `${ctx.biz.name}  •  @${ctx.biz.handle}`;
}

function renderProducts(filterText = "") {
  const q = filterText.trim().toLowerCase();
  const list = products
    .filter(p => !q || p.name.toLowerCase().includes(q) || (p.sku || "").toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name));

  if (!productList) return;
  productList.innerHTML = "";

  if (list.length === 0) {
    productList.innerHTML = `<div class="muted small">No hay productos todavía.</div>`;
    return;
  }

  for (const p of list) {
    const el = document.createElement("div");
    el.className = "item";
    el.innerHTML = `
      <div>
        <div class="item-title">${escapeHtml(p.name)}</div>
        <div class="item-sub">${money(p.price)} • Stock: ${Number(p.stock)} ${p.sku ? "• " + escapeHtml(p.sku) : ""}</div>
      </div>
      <div class="d-flex align-items-center gap-2">
        <button class="btn btn-soft btn-sm" data-act="add" data-id="${p.id}">+ Carrito</button>
        <button class="btn btn-soft btn-sm" data-act="edit" data-id="${p.id}">Editar</button>
        <button class="btn btn-outline-danger btn-sm" data-act="del" data-id="${p.id}">X</button>
      </div>
    `;
    productList.appendChild(el);
  }
}

function renderCart() {
  if (!cartList) return;
  cartList.innerHTML = "";

  if (cart.length === 0) {
    cartList.innerHTML = `<div class="muted small">Carrito vacío. Busca un producto y agrégalo.</div>`;
    updateTotals();
    return;
  }

  for (const item of cart) {
    const el = document.createElement("div");
    el.className = "item";
    el.innerHTML = `
      <div>
        <div class="item-title">${escapeHtml(item.name)}</div>
        <div class="item-sub">${money(item.price)} c/u</div>
      </div>

      <div class="d-flex align-items-center gap-2">
        <button class="btn btn-soft btn-sm" data-act="dec" data-id="${item.productId}">-</button>
        <span class="badge badge-soft">${item.qty}</span>
        <button class="btn btn-soft btn-sm" data-act="inc" data-id="${item.productId}">+</button>
        <button class="btn btn-outline-danger btn-sm" data-act="rm" data-id="${item.productId}">Quitar</button>
      </div>
    `;
    cartList.appendChild(el);
  }

  updateTotals();
}

function renderSales() {
  if (!salesList) return;

  const recent = [...sales]
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, 8);

  if (recent.length === 0) {
    salesList.innerHTML = `<div class="muted">Aún no hay ventas.</div>`;
    renderTodayTotal();
    return;
  }

  salesList.innerHTML = recent.map(s => {
    const when = new Date(s.createdAt);
    const hh = String(when.getHours()).padStart(2, "0");
    const mm = String(when.getMinutes()).padStart(2, "0");
    return `
      <div class="item">
        <div>
          <div class="item-title">${money(s.total)} <span class="muted">(${escapeHtml(s.method)})</span></div>
          <div class="item-sub">${when.toLocaleDateString("es-MX")} ${hh}:${mm} • ${s.items.reduce((a, x) => a + Number(x.qty || 0), 0)} artículos</div>
        </div>
        <span class="chip">${isToday(s.createdAt) ? "Hoy" : "—"}</span>
      </div>
    `;
  }).join("");

  renderTodayTotal();
}

function renderTodayTotal() {
  if (!todayTotalChip) return;

  const now = new Date();
  const totalToday = sales
    .filter(s => {
      const d = new Date(s.createdAt);
      return d.getFullYear() === now.getFullYear()
        && d.getMonth() === now.getMonth()
        && d.getDate() === now.getDate();
    })
    .reduce((acc, s) => acc + Number(s.total || 0), 0);

  todayTotalChip.textContent = `${money(totalToday)} hoy`;
}

function updateTotals() {
  const subtotal = cart.reduce((acc, it) => acc + (Number(it.price) * Number(it.qty)), 0);
  const discount = Math.max(0, Number(discountInput?.value || 0));
  const total = Math.max(0, subtotal - discount);

  if (subtotalLabel) subtotalLabel.textContent = money(subtotal);
  if (totalLabel) totalLabel.textContent = money(total);
}

// ===== Actions: Products =====
function openNewProduct() {
  // si no tienes modal en el HTML, no hacemos nada
  if (!productModal) return setPosMsg("Falta el modal de producto en el HTML.", false);

  hideError(prodError);
  if (prodId) prodId.value = "";
  if (prodName) prodName.value = "";
  if (prodPrice) prodPrice.value = "";
  if (prodStock) prodStock.value = "";
  if (prodSku) prodSku.value = "";
  if (productModalTitle) productModalTitle.textContent = "Nuevo producto";
  productModal.show();
}

function openEditProduct(id) {
  if (!productModal) return setPosMsg("Falta el modal de producto en el HTML.", false);

  hideError(prodError);
  const p = products.find(x => x.id === id);
  if (!p) return;

  prodId.value = p.id;
  prodName.value = p.name;
  prodPrice.value = p.price;
  prodStock.value = p.stock;
  prodSku.value = p.sku || "";

  if (productModalTitle) productModalTitle.textContent = "Editar producto";
  productModal.show();
}

function saveProductFromModal() {
  hideError(prodError);

  const id = (prodId?.value || "").trim();
  const name = (prodName?.value || "").trim();
  const price = Number(prodPrice?.value || 0);
  const stock = Number(prodStock?.value || 0);
  const sku = (prodSku?.value || "").trim();

  if (name.length < 2) return showError(prodError, "Nombre inválido.");
  if (!(price >= 0)) return showError(prodError, "Precio inválido.");
  if (!(stock >= 0)) return showError(prodError, "Stock inválido.");

  const all = getAllProducts();

  if (!id) {
    all.push({
      id: crypto.randomUUID(),
      businessId: ctx.biz.id,
      name,
      price,
      stock,
      sku,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  } else {
    const idx = all.findIndex(x => x.id === id && x.businessId === ctx.biz.id);
    if (idx === -1) return showError(prodError, "No se encontró ese producto.");
    all[idx] = { ...all[idx], name, price, stock, sku, updatedAt: new Date().toISOString() };
  }

  saveAllProducts(all);
  products = getProductsByBiz(ctx.biz.id);
  renderProducts(productSearch?.value || "");
  productModal?.hide();
}

function deleteProduct(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;

  const ok = confirm(`Eliminar "${p.name}"?`);
  if (!ok) return;

  cart = cart.filter(x => x.productId !== id);

  const all = getAllProducts().filter(x => !(x.id === id && x.businessId === ctx.biz.id));
  saveAllProducts(all);

  products = getProductsByBiz(ctx.biz.id);
  renderProducts(productSearch?.value || "");
  renderCart();
}

// ===== Actions: Cart =====
function addToCart(productId) {
  const p = products.find(x => x.id === productId);
  if (!p) return;

  if (Number(p.stock) <= 0) return setPosMsg("No hay stock de ese producto.");

  const item = cart.find(x => x.productId === productId);
  const currentQty = item ? item.qty : 0;

  if (currentQty + 1 > Number(p.stock)) return setPosMsg("No puedes agregar más, excede el stock.");

  clearPosMsg();
  if (!item) cart.push({ productId: p.id, name: p.name, price: p.price, qty: 1 });
  else item.qty += 1;

  renderCart();
}

function incCart(productId) {
  const item = cart.find(x => x.productId === productId);
  if (!item) return;

  const p = products.find(x => x.id === productId);
  if (!p) return;

  if (item.qty + 1 > Number(p.stock)) return setPosMsg("No puedes agregar más, excede el stock.");

  clearPosMsg();
  item.qty += 1;
  renderCart();
}

function decCart(productId) {
  const item = cart.find(x => x.productId === productId);
  if (!item) return;

  clearPosMsg();
  item.qty -= 1;
  if (item.qty <= 0) cart = cart.filter(x => x.productId !== productId);
  renderCart();
}

function removeFromCart(productId) {
  clearPosMsg();
  cart = cart.filter(x => x.productId !== productId);
  renderCart();
}

function clearCart() {
  clearPosMsg();
  cart = [];
  renderCart();
}

// ===== Checkout =====
function checkout() {
  clearPosMsg();

  if (cart.length === 0) return setPosMsg("Carrito vacío.");

  const subtotal = cart.reduce((acc, it) => acc + (Number(it.price) * Number(it.qty)), 0);
  const discount = Math.max(0, Number(discountInput?.value || 0));
  const total = Math.max(0, subtotal - discount);

  if (total <= 0) return setPosMsg("El total debe ser mayor a 0.");

  // validar stock
  for (const it of cart) {
    const p = products.find(x => x.id === it.productId);
    if (!p) return setPosMsg("Un producto ya no existe.");
    if (Number(it.qty) > Number(p.stock)) return setPosMsg(`Stock insuficiente: ${p.name}`);
  }

  // descontar stock
  const allProducts = getAllProducts();
  for (const it of cart) {
    const idx = allProducts.findIndex(x => x.id === it.productId && x.businessId === ctx.biz.id);
    if (idx !== -1) {
      allProducts[idx].stock = Math.max(0, Number(allProducts[idx].stock) - Number(it.qty));
      allProducts[idx].updatedAt = new Date().toISOString();
    }
  }
  saveAllProducts(allProducts);

  // registrar venta
  const sale = {
    id: crypto.randomUUID(),
    businessId: ctx.biz.id,
    createdAt: new Date().toISOString(),
    items: cart.map(item => ({
      productId: item.productId,
      name: item.name,
      price: item.price,
      qty: item.qty
    })),
    subtotal,
    discount,
    total,
    method: paymentMethod?.value || "Efectivo"
  };

  const allSales = getAllSales();
  allSales.push(sale);
  saveAllSales(allSales);

  // refrescar data
  products = getProductsByBiz(ctx.biz.id);
  sales = getSalesByBiz(ctx.biz.id);

  // limpiar
  cart = [];
  if (discountInput) discountInput.value = "0";

  renderProducts(productSearch?.value || "");
  renderCart();
  renderSales();

  setPosMsg(`Venta registrada: ${money(total)}`, true);
  setTimeout(() => clearPosMsg(), 1800);
}

// ===== Logout modal wiring (POS) =====
function wireLogout() {
  const btnLogout = document.getElementById("btnLogoutDash"); 
  const btnLogoutMobile = document.getElementById("btnLogoutDashMobile"); 
  const logoutModalEl = document.getElementById("logoutModal");
  const confirmBtn = document.getElementById("confirmLogout");

  // Si no hay botón, no hacemos nada
  if (!btnLogout && !btnLogoutMobile) return;

  // Si no hay modal, fallback: confirm normal
  if (!logoutModalEl || !window.bootstrap?.Modal) {
    const fallback = () => {
      if (confirm("¿Seguro que deseas cerrar sesión?")) {
        clearSession();
        window.location.href = "Index.html";
      }
    };
    btnLogout?.addEventListener("click", fallback);
    btnLogoutMobile?.addEventListener("click", fallback);
    return;
  }

  const logoutModal = bootstrap.Modal.getOrCreateInstance(logoutModalEl);

  btnLogout?.addEventListener("click", () => logoutModal.show());
  btnLogoutMobile?.addEventListener("click", () => logoutModal.show());

  confirmBtn?.addEventListener("click", () => {
    clearSession();
    window.location.href = "Index.html";
  });
}

// ===== Events wiring =====
function wireEvents() {
  // Productos
  btnOpenProductModal?.addEventListener("click", openNewProduct);
  btnSaveProduct?.addEventListener("click", saveProductFromModal);

  productSearch?.addEventListener("input", () => renderProducts(productSearch.value));

  productList?.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    const id = btn.getAttribute("data-id");
    const act = btn.getAttribute("data-act");
    if (!id || !act) return;

    if (act === "add") addToCart(id);
    if (act === "edit") openEditProduct(id);
    if (act === "del") deleteProduct(id);
  });

  // Buscar en caja (Enter)
  posSearch?.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const q = (posSearch.value || "").trim().toLowerCase();
    if (!q) return;

    const first = products.find(p =>
      p.name.toLowerCase().includes(q) || (p.sku || "").toLowerCase().includes(q)
    );
    if (!first) return setPosMsg("No encontré ese producto.");

    addToCart(first.id);
    posSearch.value = "";
  });

  // Carrito
  cartList?.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    const id = btn.getAttribute("data-id");
    const act = btn.getAttribute("data-act");
    if (!id || !act) return;

    if (act === "inc") incCart(id);
    if (act === "dec") decCart(id);
    if (act === "rm") removeFromCart(id);
  });

  discountInput?.addEventListener("input", updateTotals);

  btnClearCart?.addEventListener("click", clearCart);
  btnCheckout?.addEventListener("click", checkout);

  // Logout (modal)
  wireLogout();
}

// ===== Init =====
document.addEventListener("DOMContentLoaded", () => {
  ctx = requireAuth();
  if (!ctx) return;

  renderBiz();

  products = getProductsByBiz(ctx.biz.id);
  sales = getSalesByBiz(ctx.biz.id);

  renderProducts("");
  renderCart();
  renderSales();

  wireEvents();
});
