/**
 * landing.js — 欢迎页业务逻辑
 * ============================
 * 四幕式开场动画 + 卡片阶梯揭示 + 导航
 */

(function() {
  'use strict';

  /* ===== Scene States ===== */
  const S_INTRO       = 0;  // 0-3000ms: 星云诞生
  const S_CARD_REVEAL = 1;  // 3000-4500ms: 神殿凝结
  const S_TRANSITION  = 2;  // 4500-5500ms: 退避让位
  const S_AMBIENT     = 3;  // 5500ms+: 常态苏醒

  let state = S_INTRO;
  let startTime = performance.now();

  /* ===== Card Reveal Timeline ===== */
  function revealCard() {
    const card = document.getElementById('card');
    card.classList.add('revealed');

    const elements = [
      { id: 'el-brand', delay: 200 },
      { id: 'el-title', delay: 500 },
      { id: 'el-sub', delay: 800 },
      { id: 'el-tags', delay: 1100 },
      { id: 'el-btn', delay: 1400 },
    ];

    elements.forEach(({ id, delay }) => {
      setTimeout(() => {
        const el = document.getElementById(id);
        if (el) el.classList.add('show');
      }, delay);
    });

    // Title glint sweep
    setTimeout(() => {
      const glint = document.getElementById('title-glint');
      if (glint) glint.classList.add('sweep');
    }, 900);

    // Update terminal
    const term = document.getElementById('terminal-cmd');
    if (term) term.textContent = ' ai4s-swarm auth --login';
  }

  /* ===== Scene Timeline Loop ===== */
  function tick() {
    const elapsed = performance.now() - startTime;

    if (state === S_INTRO && elapsed > 3000) {
      state = S_CARD_REVEAL;
      revealCard();
    } else if (state === S_CARD_REVEAL && elapsed > 4500) {
      state = S_TRANSITION;
    } else if (state === S_TRANSITION && elapsed > 5500) {
      state = S_AMBIENT;
      document.getElementById('content').classList.add('interactive');
      const term = document.getElementById('terminal-cmd');
      if (term) term.textContent = ' ai4s-swarm';
    }
  }

  /* ===== Start ===== */
  function start() {
    startTime = performance.now();
    requestAnimationFrame(function loop() {
      tick();
      if (state < S_AMBIENT) requestAnimationFrame(loop);
    });
  }

  // Wait for DOM + fonts
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

})();
