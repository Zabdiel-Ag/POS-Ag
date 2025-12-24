// Keys (mismas que tu app.js)
const USERS_KEY = "pos_users";
const SESSION_KEY = "pos_session";
const BUSINESSES_KEY = "pos_businesses";

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

function requireAuthOrRedirect() {
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
    // si no hay empresa, regresa al wizard (Index)
    window.location.href = "Index.html";
    return null;
  }

  return { user, biz };
}

function initialsFromName(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] || "B";
  const b = parts[1]?.[0] || "";
  return (a + b).toUpperCase();
}

function renderBusiness(biz) {
  // Right panel
  const bizNameRight = document.getElementById("bizNameRight");
  const bizCategoryRight = document.getElementById("bizCategoryRight");
  const bizHandleRight = document.getElementById("bizHandleRight");
  const bizLogoImg = document.getElementById("bizLogoImg");
  const bizLogoFallback = document.getElementById("bizLogoFallback");

  if (bizNameRight) bizNameRight.textContent = biz.name;
  if (bizCategoryRight) bizCategoryRight.textContent = biz.category;
  if (bizHandleRight) bizHandleRight.textContent = "@" + biz.handle;

  // Mini label
  const bizMiniLabel = document.getElementById("bizMiniLabel");
  if (bizMiniLabel) bizMiniLabel.textContent = "@" + biz.handle;

  // Feed header
  const bizNameFeed = document.getElementById("bizNameFeed");
  const bizHandleFeed = document.getElementById("bizHandleFeed");
  const bizCategoryFeed = document.getElementById("bizCategoryFeed");
  const bizAvatar = document.getElementById("bizAvatar");

  if (bizNameFeed) bizNameFeed.textContent = biz.name;
  if (bizHandleFeed) bizHandleFeed.textContent = "@" + biz.handle;
  if (bizCategoryFeed) bizCategoryFeed.textContent = biz.category;

  if (biz.logoDataUrl) {
    if (bizLogoImg) {
      bizLogoImg.src = biz.logoDataUrl;
      bizLogoImg.classList.remove("d-none");
    }
    if (bizLogoFallback) bizLogoFallback.classList.add("d-none");

    if (bizAvatar) {
      bizAvatar.style.backgroundImage = `url(${biz.logoDataUrl})`;
      bizAvatar.style.backgroundSize = "cover";
      bizAvatar.style.backgroundPosition = "center";
      bizAvatar.textContent = "";
    }
  } else {
    if (bizLogoImg) bizLogoImg.classList.add("d-none");
    if (bizLogoFallback) {
      bizLogoFallback.classList.remove("d-none");
      bizLogoFallback.textContent = "🏪";
    }
    if (bizAvatar) {
      bizAvatar.style.backgroundImage = "";
      bizAvatar.textContent = initialsFromName(biz.name);
    }
  }
}

function renderTeamDemo() {
  const teamList = document.getElementById("teamList");
  if (!teamList) return;

  const demo = [
    { name: "Mariana", info: "Rol: Cajero" },
    { name: "Luis", info: "Rol: Inventario" },
    { name: "Andrea", info: "Rol: Admin" },
    { name: "Héctor", info: "Rol: Ventas" },
  ];

  teamList.innerHTML = demo.map(x => `
    <div class="suggest">
      <div class="suggest-left">
        <div class="suggest-avatar">${initialsFromName(x.name)}</div>
        <div>
          <div class="fw-semibold">${x.name}</div>
          <div class="small2">${x.info}</div>
        </div>
      </div>
      <button class="btn btn-link btn-sm link-light" style="text-decoration:none;">Conectar</button>
    </div>
  `).join("");
}

function setupNav() {
  const buttons = document.querySelectorAll(".nav-item");

  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      buttons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const screen = btn.getAttribute("data-screen");
      console.log("Nav:", screen);

      if (screen === "pos") {
        window.location.href = "Pos.html";
      }
    });
  });
}


function setupLogout() {
  const doLogout = () => {
    clearSession();
    window.location.href = "Index.html";
  };
  document.getElementById("btnLogoutDash")?.addEventListener("click", doLogout);
  document.getElementById("btnLogoutDashMobile")?.addEventListener("click", doLogout);
}


function setupEditBiz() {
  // Por ahora, “Cambiar” te regresa a Index para editar (luego hacemos modal real)
  document.getElementById("btnEditBiz")?.addEventListener("click", () => {
    window.location.href = "Index.html";
  });
}

// INIT
(function init() {
  const data = requireAuthOrRedirect();
  if (!data) return;

  renderBusiness(data.biz);
  renderTeamDemo();
  setupNav();
  setupLogout();
  setupEditBiz();
})();

(function setupBottomNav() {
  const items = document.querySelectorAll(".bottom-nav .bn-item");
  if (!items.length) return;

  items.forEach(a => {
    a.addEventListener("click", () => {
      items.forEach(x => x.classList.remove("active"));
      a.classList.add("active");
    });
  });
})();

