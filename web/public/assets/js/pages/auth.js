/**
 * auth.js — 认证页业务逻辑
 * =========================
 * 登录/注册 Tab 切换 + 表单验证 + Github OAuth + 密码可见性
 */

(function () {
  "use strict";

  /* ===== Tab Switching ===== */
  const tabs = document.getElementById("tabs");
  const indicator = document.getElementById("indicator");
  const loginPanel = document.getElementById("login-panel");
  const regPanel = document.getElementById("register-panel");
  const tabBtns = tabs.querySelectorAll(".tab-btn");

  function setIndicator(btn) {
    const r = btn.getBoundingClientRect();
    const tr = tabs.getBoundingClientRect();
    indicator.style.left = r.left - tr.left + "px";
    indicator.style.width = r.width + "px";
  }

  function switchTo(target) {
    tabBtns.forEach(b =>
      b.classList.toggle("active", b.dataset.target === target)
    );
    const activeBtn = tabs.querySelector(".tab-btn.active");
    setIndicator(activeBtn);

    if (target === "login") {
      loginPanel.classList.remove("hidden");
      regPanel.classList.add("hidden");
    } else {
      loginPanel.classList.add("hidden");
      regPanel.classList.remove("hidden");
    }

    // Register only: subtle water shimmer + stardust trail
    // Login and register share the same node brightness and ambiance
    var webglCanvas = document.getElementById("canvas-bg");
    if (webglCanvas) {
      webglCanvas.style.transition = "opacity 2s cubic-bezier(0.4,0,0.2,1)";
      webglCanvas.style.opacity = target === "register" ? "0.35" : "0";
    }
    if (window.__nodeNetwork) {
      window.__nodeNetwork.showTrail = target === "register";
    }

    // Panel title transition
    var panelTitle = document.getElementById("panel-title");
    var panelSubtitle = document.getElementById("panel-subtitle");
    if (panelTitle) {
      panelTitle.style.opacity = "0";
      panelTitle.style.transform = "translateY(-6px)";
      setTimeout(function () {
        panelTitle.textContent = target === "login" ? "欢迎雅临" : "缘起于此";
        panelTitle.style.opacity = "1";
        panelTitle.style.transform = "translateY(0)";
      }, 200);
    }
    if (panelSubtitle) {
      panelSubtitle.style.opacity = "0";
      setTimeout(function () {
        panelSubtitle.textContent =
          target === "login"
            ? "以智能体之力，重构科学数据之维"
            : "开启智能体驱动的科学数据新时代";
        panelSubtitle.style.opacity = "1";
      }, 250);
    }

    // Update terminal with typewriter effect
    const term = document.getElementById("terminal-cmd");
    if (term && window.typeWriter) {
      const cmd =
        target === "login"
          ? " ai4s-swarm auth --login"
          : " ai4s-swarm auth --register";
      window.typeWriter(term, cmd);
    }
  }

  tabBtns.forEach(btn => {
    btn.addEventListener("click", () => switchTo(btn.dataset.target));
  });

  // Footer links
  document.getElementById("to-register").addEventListener("click", e => {
    e.preventDefault();
    switchTo("register");
  });
  document.getElementById("to-login").addEventListener("click", e => {
    e.preventDefault();
    switchTo("login");
  });

  // Init indicator
  setTimeout(() => {
    const activeBtn = tabs.querySelector(".tab-btn.active");
    if (activeBtn) setIndicator(activeBtn);
  }, 100);

  window.addEventListener("resize", () => {
    const activeBtn = tabs.querySelector(".tab-btn.active");
    if (activeBtn) setIndicator(activeBtn);
  });

  /* ===== Password Visibility Toggle ===== */
  function setupEye(eyeId, inputId) {
    const eye = document.getElementById(eyeId);
    const input = document.getElementById(inputId);
    if (!eye || !input) return;

    eye.addEventListener("click", () => {
      const isHidden = input.type === "password";
      input.type = isHidden ? "text" : "password";
      eye.textContent = isHidden ? "◐" : "◉";
    });
  }

  setupEye("login-eye", "login-password");
  setupEye("reg-eye", "reg-password");
  setupEye("confirm-eye", "reg-confirm");

  /* ===== Form Validation ===== */
  function showError(groupId, show) {
    const group = document.getElementById(groupId);
    if (group) group.classList.toggle("error", show);
  }

  function clearAllErrors() {
    [
      "lg-email-group",
      "lg-pass-group",
      "rg-name-group",
      "rg-email-group",
      "rg-pass-group",
      "rg-confirm-group",
    ].forEach(id => showError(id, false));
  }

  function setLoading(btnId, loading) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.classList.toggle("loading", loading);
    btn.disabled = loading;
  }

  /* ===== SHA-256 Helper ===== */
  async function sha256(text) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  }

  /* ===== Login Submit ===== */
  document.getElementById("login-btn").addEventListener("click", async () => {
    clearAllErrors();
    const email = document.getElementById("login-email").value.trim();
    const pass = document.getElementById("login-password").value;
    let hasErr = false;

    if (!email) {
      showError("lg-email-group", true);
      hasErr = true;
    }
    if (!pass) {
      showError("lg-pass-group", true);
      hasErr = true;
    }
    if (hasErr) return;

    setLoading("login-btn", true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account: email, password: pass }),
      });
      if (res.ok) {
        const json = await res.json();
        const data = json.data || json;
        if (data.token) {
          localStorage.setItem("token", data.token);
        }
        window.location.href = "/";
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error?.message || "登录失败，请检查邮箱和密码");
      }
    } catch (e) {
      alert("网络错误，请确认后端已启动");
    } finally {
      setLoading("login-btn", false);
    }
  });

  /* ===== Register Submit ===== */
  document
    .getElementById("register-btn")
    .addEventListener("click", async () => {
      clearAllErrors();
      const name = document.getElementById("reg-name").value.trim();
      const email = document.getElementById("reg-email").value.trim();
      const pass = document.getElementById("reg-password").value;
      const confirm = document.getElementById("reg-confirm").value;
      let hasErr = false;

      if (!name) {
        showError("rg-name-group", true);
        hasErr = true;
      }
      if (!email || !email.includes("@")) {
        showError("rg-email-group", true);
        hasErr = true;
      }
      if (!pass || pass.length < 6) {
        showError("rg-pass-group", true);
        hasErr = true;
      }
      if (pass !== confirm) {
        showError("rg-confirm-group", true);
        hasErr = true;
      }
      if (hasErr) return;

      setLoading("register-btn", true);
      try {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password: pass }),
        });
        if (res.ok) {
          const json = await res.json();
          const data = json.data || json;
          if (data.token) {
            localStorage.setItem("token", data.token);
          }
          window.location.href = "/";
        } else {
          const err = await res.json().catch(() => ({}));
          alert(err.error?.message || "注册失败");
        }
      } catch (e) {
        alert("网络错误，请确认后端已启动");
      } finally {
        setLoading("register-btn", false);
      }
    });

  /* ===== Clear error on input ===== */
  [
    "login-email",
    "login-password",
    "reg-name",
    "reg-email",
    "reg-password",
    "reg-confirm",
  ].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("input", () => {
      const g = el.closest(".form-group");
      if (g) g.classList.remove("error");
    });
  });

  /* ===== Enter key submit ===== */
  document.getElementById("login-password").addEventListener("keydown", e => {
    if (e.key === "Enter") document.getElementById("login-btn").click();
  });
  document.getElementById("reg-confirm").addEventListener("keydown", e => {
    if (e.key === "Enter") document.getElementById("register-btn").click();
  });

  /* ===== Github OAuth ===== */
  const GITHUB_CLIENT_ID_KEY = "ai4s_github_client_id";

  function getGithubOAuthUrl(mode) {
    let clientId = localStorage.getItem(GITHUB_CLIENT_ID_KEY);

    if (!clientId) {
      const msg =
        "请输入你的 Github OAuth App Client ID：\n\n" +
        "获取方式：\n" +
        "1. 访问 https://github.com/settings/applications/new\n" +
        "2. Authorization callback URL 填入当前页面所在目录的 oauth-callback.html\n" +
        "3. 复制生成的 Client ID";
      const id = prompt(msg);
      if (id) {
        localStorage.setItem(GITHUB_CLIENT_ID_KEY, id.trim());
        return getGithubOAuthUrl(mode);
      }
      return null;
    }

    // Build redirect URI: same directory + oauth-callback.html
    const path = window.location.pathname;
    const basePath = path.substring(0, path.lastIndexOf("/") + 1);
    const redirectUri =
      window.location.origin + basePath + "oauth-callback.html";

    const url = new URL("https://github.com/login/oauth/authorize");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", "read:user user:email");
    url.searchParams.set("state", mode + "_" + btoa(Date.now().toString()));
    return url.toString();
  }

  document.getElementById("oauth-btn").addEventListener("click", () => {
    const url = getGithubOAuthUrl("login");
    if (url) window.location.href = url;
  });

  document.getElementById("oauth-btn2").addEventListener("click", () => {
    const url = getGithubOAuthUrl("register");
    if (url) window.location.href = url;
  });
})();
