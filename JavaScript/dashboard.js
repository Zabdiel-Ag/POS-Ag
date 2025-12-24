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

// INIT este cabron no moverle
(function init() {
  const data = requireAuthOrRedirect();
  if (!data) return;

  // esto es CLAVE para publicar posts
  window.__CTX__ = data;

  renderBusiness(data.biz);
  renderTeamDemo();
  setupNav();
  setupLogout();
  setupEditBiz();

  renderFeed(data);
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

// ====== POSTS (Marketing Feed) ======
const POSTS_KEY = "pos_posts";

// Lee posts
function getPosts() {
  try { return JSON.parse(localStorage.getItem(POSTS_KEY)) || []; }
  catch { return []; }
}

// Guarda posts
function savePosts(posts) {
  localStorage.setItem(POSTS_KEY, JSON.stringify(posts));
}

function showErr(el, msg){
  if(!el) return;
  el.textContent = msg;
  el.classList.remove("d-none");
}
function hideErr(el){
  if(!el) return;
  el.textContent = "";
  el.classList.add("d-none");
}
function fileToDataUrl(file){
  return new Promise((resolve, reject)=>{
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function timeAgo(iso){
  const d = new Date(iso);
  const s = Math.floor((Date.now() - d.getTime())/1000);
  if(s < 60) return `${s}s`;
  const m = Math.floor(s/60); if(m < 60) return `${m}m`;
  const h = Math.floor(m/60); if(h < 24) return `${h}h`;
  const days = Math.floor(h/24); return `${days}d`;
}

// Render del feed en #feed
function renderFeed(ctx){
  const feed = document.getElementById("feed");
  if(!feed) return;

  // Trae solo posts de esta empresa
  const posts = getPosts()
    .filter(p => p.businessId === ctx.biz.id)
    .sort((a,b)=> new Date(b.createdAt) - new Date(a.createdAt));

  // Si no hay posts, deja tu placeholder y ya
  const existingPlaceholder = feed.querySelector('[data-placeholder="true"]');
  if(posts.length === 0){
    if(!existingPlaceholder){
      // si quieres, aquí puedes agregar un placeholder automático
    }
    return;
  }

  // Limpia y pinta
  feed.innerHTML = posts.map(p => {
    const headerName = ctx.biz.name;
    const headerHandle = "@"+ctx.biz.handle;
    const label = p.type?.toUpperCase() || "POST";

    const mediaHtml = p.mediaType?.startsWith("video/")
      ? `<video src="${p.mediaDataUrl}" controls class="w-100" style="border-radius:16px; max-height:420px; object-fit:cover;"></video>`
      : `<img src="${p.mediaDataUrl}" alt="post" class="w-100" style="border-radius:16px; max-height:420px; object-fit:cover;">`;

    return `
      <article class="post cardx p-3">
        <div class="d-flex justify-content-between align-items-center">
          <div class="d-flex align-items-center gap-2">
            <div class="avatar">${(headerName||"E")[0].toUpperCase()}</div>
            <div>
              <div class="fw-semibold">${headerName}</div>
              <div class="small muted">${headerHandle} · ${timeAgo(p.createdAt)} · <span class="badge-soft px-2 py-1">${label}</span></div>
            </div>
          </div>
          <button class="btn btn-soft btn-sm" data-del-post="${p.id}">🗑</button>
        </div>

        <div class="mt-3">${mediaHtml}</div>

        ${p.caption ? `<div class="mt-3"><span class="fw-semibold">${headerHandle}</span> <span class="muted">${escapeHtml(p.caption)}</span></div>` : ""}

        <div class="d-flex gap-2 mt-3">
          <button class="btn btn-soft" data-like="${p.id}">❤</button>
          <button class="btn btn-soft" data-copy="${p.id}">↗</button>
          <div class="ms-auto chip">${p.type || "post"}</div>
        </div>
      </article>
    `;
  }).join("");

  // Eventos: borrar / copiar
  feed.querySelectorAll("[data-del-post]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const id = btn.getAttribute("data-del-post");
      const all = getPosts();
      const filtered = all.filter(x => x.id !== id);
      savePosts(filtered);
      renderFeed(ctx);
    });
  });

  feed.querySelectorAll("[data-copy]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const id = btn.getAttribute("data-copy");
      const p = getPosts().find(x=>x.id===id);
      if(!p) return;
      navigator.clipboard?.writeText(p.caption || "");
    });
  });
}

// Para evitar inyección al mostrar texto
function escapeHtml(str){
  return String(str||"")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

(function setupCreatePost(){
  const btnOpen = document.getElementById("btnOpenPost");
  const input = document.getElementById("postMedia");
  const caption = document.getElementById("postCaption");
  const type = document.getElementById("postType");
  const btnPublish = document.getElementById("btnPublishPost");
  const err = document.getElementById("postErr");

  const previewWrap = document.getElementById("postPreviewWrap");
  const img = document.getElementById("postPreviewImg");
  const vid = document.getElementById("postPreviewVideo");

  if(!btnOpen || !btnPublish) return;

  let mediaDataUrl = "";
  let mediaType = "";

  const modalEl = document.getElementById("postModal");
  const modal = new bootstrap.Modal(modalEl);

  btnOpen.addEventListener("click", ()=>{
    // reset
    hideErr(err);
    if(input) input.value = "";
    if(caption) caption.value = "";
    if(type) type.value = "promo";
    mediaDataUrl = "";
    mediaType = "";
    previewWrap?.classList.add("d-none");
    img?.classList.add("d-none");
    vid?.classList.add("d-none");
    modal.show();
  });

  input?.addEventListener("change", async (e)=>{
    hideErr(err);
    const file = e.target.files?.[0];
    if(!file) return;

    // límite MVP
    if(file.size > 12 * 1024 * 1024){
      showErr(err, "Archivo muy pesado. Usa máximo 12MB (por ahora).");
      input.value = "";
      return;
    }

    mediaType = file.type || "";
    mediaDataUrl = await fileToDataUrl(file);

    previewWrap?.classList.remove("d-none");

    if(mediaType.startsWith("video/")){
      vid.src = mediaDataUrl;
      vid.classList.remove("d-none");
      img.classList.add("d-none");
    } else {
      img.src = mediaDataUrl;
      img.classList.remove("d-none");
      vid.classList.add("d-none");
    }
  });

  btnPublish.addEventListener("click", ()=>{
    hideErr(err);

    // Necesitamos ctx (sesión + empresa)
    const ctx = window.__CTX__;
    if(!ctx?.biz?.id) return showErr(err, "No hay empresa activa.");

    if(!mediaDataUrl) return showErr(err, "Sube una foto o video para publicar.");

    const post = {
      id: crypto.randomUUID(),
      businessId: ctx.biz.id,
      createdAt: new Date().toISOString(),
      caption: (caption?.value || "").trim(),
      type: type?.value || "promo",
      mediaType,
      mediaDataUrl
    };

    const posts = getPosts();
    posts.push(post);
    savePosts(posts);

    modal.hide();
    renderFeed(ctx);
  });
})();

// ====== ABRIR MODAL desde Sidebar y BottomNav ======
document.addEventListener("DOMContentLoaded", () => {
  const modalEl = document.getElementById("postModal");
  if (!modalEl) return;

  // usa getOrCreateInstance para evitar bugs
  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);

  function openPostModal(e) {
    e?.preventDefault();

    // reset básico (para que no se quede un preview viejo)
    document.getElementById("postErr")?.classList.add("d-none");
    const input = document.getElementById("postMedia");
    const caption = document.getElementById("postCaption");
    const type = document.getElementById("postType");
    const previewWrap = document.getElementById("postPreviewWrap");
    const img = document.getElementById("postPreviewImg");
    const vid = document.getElementById("postPreviewVideo");

    if (input) input.value = "";
    if (caption) caption.value = "";
    if (type) type.value = "promo";
    previewWrap?.classList.add("d-none");
    img?.classList.add("d-none");
    vid?.classList.add("d-none");

    modal.show();
  }

  document.getElementById("btnCrear")?.addEventListener("click", openPostModal);
  document.getElementById("btnContenido")?.addEventListener("click", openPostModal);
  document.getElementById("btnContenidoMobile")?.addEventListener("click", openPostModal);
});


