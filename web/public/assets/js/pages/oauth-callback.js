/**
 * oauth-callback.js — OAuth授权回调页逻辑
 * ==========================================
 * 处理 Github OAuth 回调 code + state，展示授权结果
 */

(function() {
  'use strict';

  const params    = new URLSearchParams(window.location.search);
  const code      = params.get('code');
  const state     = params.get('state');
  const isRegister = state && state.startsWith('register_');

  const titleEl       = document.getElementById('status-title');
  const descEl        = document.getElementById('status-desc');
  const progressEl    = document.getElementById('progress');
  const loaderEl      = document.getElementById('loader');
  const loadingState  = document.getElementById('loading-state');
  const successState  = document.getElementById('success-state');
  const successTitle  = document.getElementById('success-title');
  const successDesc   = document.getElementById('success-desc');
  const successIcon   = document.getElementById('success-icon');
  const userInfo      = document.getElementById('user-info');

  /* ===== Simulate Progress ===== */
  setTimeout(() => { progressEl.style.width = '30%'; }, 100);
  setTimeout(() => { progressEl.style.width = '60%'; }, 800);
  setTimeout(() => { progressEl.style.width = '90%'; }, 1500);

  /* ===== No Code → Error ===== */
  if (!code) {
    titleEl.textContent = '授权失败';
    descEl.textContent  = '未获取到授权码，请返回重试';
    progressEl.style.background = 'linear-gradient(90deg,#ef4444,#f87171)';
    setTimeout(() => { progressEl.style.width = '100%'; }, 200);
    loaderEl.style.display = 'none';
    // Terminal typewriter update
    const term = document.getElementById('terminal-cmd');
    if (term && window.typeWriter) {
      window.typeWriter(term, ' ai4s-swarm auth --failed');
    }
    return;
  }

  /* ===== Simulate Success ===== */
  setTimeout(() => {
    progressEl.style.width = '100%';

    loadingState.style.display = 'none';
    successState.style.display  = 'block';
    successIcon.classList.add('show');
    userInfo.classList.add('show');

    if (isRegister) {
      successTitle.textContent = '注册成功';
      successDesc.textContent  = 'Github 账号已绑定，正在进入工作台...';
    } else {
      successTitle.textContent = '登录成功';
      successDesc.textContent  = '欢迎回来，正在进入工作台...';
    }

    // Terminal typewriter update
    const term = document.getElementById('terminal-cmd');
    if (term && window.typeWriter) {
      window.typeWriter(term, ' ai4s-swarm auth --success');
    }

    // Auto redirect
    setTimeout(() => {
      window.location.href = 'auth.html';
    }, 3000);

  }, 2000);

  /* ===== Debug: log OAuth params ===== */
  console.log('Github OAuth callback:', { code: code ? code.substring(0,8)+'...' : null, state });

})();
