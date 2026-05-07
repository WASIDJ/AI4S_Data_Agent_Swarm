/**
 * node-network.js — Knowledge Graph Particle Network
 * ===================================================
 * 知识图谱风格：节点 + 连线 + 标签 + 鼠标磁场吸引
 * 渐进显现：加载0.5s后连线才开始出现
 * 氛围优先：不抢夺表单注意力
 */

(function(global) {
  'use strict';

  const COLORS = ['#c8a06c','#d4b07a','#e0c08a','#c4956c','#b89060','#a08050','#d0b888'];
  const LABELS = [
    { name: 'MinerU', weight: 5 },
    { name: '智能体', weight: 3 },
    { name: '编排', weight: 3 },
    { name: '数据合成', weight: 3 },
    { name: '数据清洗', weight: 3 },
    { name: 'RAG', weight: 3 },
    { name: '向量库', weight: 3 },
    { name: '知识库', weight: 3 },
    { name: '推理链', weight: 3 },
    { name: '多模态', weight: 3 },
    { name: '检索', weight: 3 },
    { name: 'AIGC', weight: 3 },
    { name: 'DeepSeek', weight: 3 },
    { name: 'Kimi', weight: 3 },
    { name: 'Qwen', weight: 3 },
    { name: '数据标注', weight: 2 },
    { name: '特征工程', weight: 2 },
    { name: 'Embedding', weight: 2 },
    { name: '数据治理', weight: 2 },
    { name: '元数据', weight: 2 },
    { name: '数据血缘', weight: 2 },
    { name: '验证', weight: 2 },
    { name: '实体链接', weight: 2 },
    { name: '关系抽取', weight: 2 },
    { name: '数据湖', weight: 2 },
    { name: '数据仓库', weight: 2 },
    { name: '时序数据', weight: 2 },
    { name: 'ETL', weight: 2 },
    { name: 'Claude', weight: 2 },
    { name: 'Agent SDK', weight: 2 },
    { name: 'React', weight: 2 },
    { name: 'Node.js', weight: 2 },
    { name: 'GPT-4', weight: 1 },
    { name: 'Gemini', weight: 1 },
    { name: 'Llama', weight: 1 },
    { name: 'Mistral', weight: 1 },
    { name: 'GLM', weight: 1 },
    { name: 'Baichuan', weight: 1 },
    { name: 'Yi', weight: 1 },
    { name: 'LangChain', weight: 1 },
    { name: 'AutoGen', weight: 1 },
    { name: 'CrewAI', weight: 1 },
    { name: 'Dify', weight: 1 },
    { name: 'Ollama', weight: 1 },
    { name: 'vLLM', weight: 1 },
    { name: 'TensorRT', weight: 1 },
    { name: 'Triton', weight: 1 },
    { name: 'Ray', weight: 1 },
    { name: 'Celery', weight: 1 },
    { name: 'PyTorch', weight: 1 },
    { name: 'JAX', weight: 1 },
    { name: 'NumPy', weight: 1 },
    { name: 'Pandas', weight: 1 },
    { name: 'SciPy', weight: 1 },
    { name: 'Matplotlib', weight: 1 },
    { name: 'WandB', weight: 1 },
    { name: 'MLflow', weight: 1 },
    { name: 'ONNX', weight: 1 },
    { name: 'Stable Diffusion', weight: 1 },
    { name: 'Midjourney', weight: 1 },
    { name: 'LoRA', weight: 1 },
    { name: 'Fine-tune', weight: 1 },
    { name: 'RLHF', weight: 1 },
    { name: 'Sora', weight: 1 },
    { name: 'ControlNet', weight: 1 },
    { name: 'Kubernetes', weight: 1 },
    { name: 'Docker', weight: 1 },
    { name: 'Redis', weight: 1 },
    { name: 'PostgreSQL', weight: 1 },
    { name: 'Kafka', weight: 1 },
    { name: 'ElasticSearch', weight: 1 },
    { name: 'Prometheus', weight: 1 },
    { name: 'Grafana', weight: 1 },
    { name: 'MinIO', weight: 1 },
    { name: 'Neo4j', weight: 1 },
    { name: 'Milvus', weight: 1 },
    { name: 'Weaviate', weight: 1 },
    { name: 'Spark', weight: 1 },
    { name: 'Flink', weight: 1 },
    { name: 'Hadoop', weight: 1 },
    { name: 'Iceberg', weight: 1 },
    { name: 'Delta Lake', weight: 1 },
    { name: 'ClickHouse', weight: 1 },
    { name: 'Druid', weight: 1 },
    { name: 'Airflow', weight: 1 },
    { name: 'API网关', weight: 1 },
    { name: '鉴权', weight: 1 },
    { name: 'WebSocket', weight: 1 },
    { name: 'gRPC', weight: 1 },
    { name: 'REST', weight: 1 },
    { name: 'GraphQL', weight: 1 },
    { name: 'OAuth', weight: 1 },
    { name: 'JWT', weight: 1 },
    { name: 'CI/CD', weight: 1 },
    { name: 'GitOps', weight: 1 },
    { name: 'Terraform', weight: 1 },
    { name: 'Ansible', weight: 1 },
    { name: 'NLP', weight: 1 },
    { name: 'CV', weight: 1 },
    { name: 'ASR', weight: 1 },
    { name: 'TTS', weight: 1 },
    { name: 'OCR', weight: 1 },
    { name: 'NER', weight: 1 },
    { name: 'BERT', weight: 1 },
    { name: 'Transformer', weight: 1 },
    { name: 'Attention', weight: 1 },
    { name: 'MCP', weight: 1 },
    { name: 'Function Call', weight: 1 },
    { name: 'Tool Use', weight: 1 },
    { name: 'Code Interpreter', weight: 1 },
    { name: 'Sandbox', weight: 1 }
  ];

  const totalWeight = LABELS.reduce((sum, l) => sum + l.weight, 0);
  function pickLabel() {
    let r = Math.random() * totalWeight;
    for (const item of LABELS) {
      r -= item.weight;
      if (r <= 0) return item.name;
    }
    return LABELS[LABELS.length - 1].name;
  }

  /* ===== Node Class ===== */
  class Node {
    constructor(w, h) {
      this.w = w;
      this.h = h;
      this.resetAmbient();
    }

    resetAmbient() {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.min(this.w, this.h) * 0.42 + Math.random() * Math.min(this.w, this.h) * 0.14;
      this.x = this.w / 2 + Math.cos(angle) * dist;
      this.y = this.h / 2 + Math.sin(angle) * dist;
      this.vx = (Math.random() - 0.5) * 0.3;
      this.vy = (Math.random() - 0.5) * 0.3;
      this.radius = Math.random() * 1.4 + 0.8;
      this.color = COLORS[Math.floor(Math.random() * COLORS.length)];
      this.alpha = 0;
      this.targetAlpha = Math.random() * 0.32 + 0.22;
      this.pulsePhase = Math.random() * Math.PI * 2;
      this.pulseSpeed = Math.random() * 0.01 + 0.004;
      this.label = pickLabel();
      this.hasLabel = Math.random() < 0.30;
      this.birthProgress = 0;
      this.maxLife = Math.random() * 600 + 400;
      this.age = 0;
    }

    easeOutCubic(t) {
      return 1 - Math.pow(1 - t, 3);
    }

    update(mouse, mouseActive) {
      this.age++;
      this.pulsePhase += this.pulseSpeed;

      // Birth animation
      if (this.birthProgress < 1) {
        this.birthProgress += 0.014;
        this.alpha = this.targetAlpha * this.easeOutCubic(Math.min(this.birthProgress, 1));
      } else {
        this.alpha = this.targetAlpha + Math.sin(this.pulsePhase * 0.5) * 0.03;
        if (this.age > this.maxLife && Math.random() < 0.004) {
          this.resetAmbient();
        }
      }

      // Movement
      this.x += this.vx;
      this.y += this.vy;

      // Mouse magnetic attraction — gentle, like a soft field
      if (mouseActive) {
        const mdx = mouse.x - this.x;
        const mdy = mouse.y - this.y;
        const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
        const attractRadius = 180;
        if (mdist < attractRadius && mdist > 3) {
          const force = (1 - mdist / attractRadius) * 0.025;
          this.vx += (mdx / mdist) * force;
          this.vy += (mdy / mdist) * force;
        }
      }

      // Center gravity (soft boundary)
      const dx = this.x - this.w / 2;
      const dy = this.y - this.h / 2;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const maxDist = Math.max(this.w, this.h) * 0.55;
      if (dist > maxDist) {
        this.vx -= dx * 0.00005;
        this.vy -= dy * 0.00005;
      }

      // Random drift + damping — poetic, slow
      this.vx += (Math.random() - 0.5) * 0.005;
      this.vy += (Math.random() - 0.5) * 0.005;
      this.vx *= 0.998;
      this.vy *= 0.998;
    }

    draw(ctx, connAlphaScale) {
      const pulse = Math.sin(this.pulsePhase) * 0.25 + 0.75;
      const r = this.radius * pulse;
      const displayAlpha = Math.max(0, Math.min(1, this.alpha));
      if (displayAlpha < 0.01) return;

      // Glow — softer than main page
      ctx.shadowColor = this.color;
      ctx.shadowBlur = r * 4;
      ctx.beginPath();
      ctx.arc(this.x, this.y, r * 0.65, 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      ctx.globalAlpha = displayAlpha;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Halo — very subtle
      const haloR = r * 3.5;
      const grad = ctx.createRadialGradient(this.x, this.y, r * 0.5, this.x, this.y, haloR);
      grad.addColorStop(0, this.color + '15');
      grad.addColorStop(1, 'transparent');
      ctx.beginPath();
      ctx.arc(this.x, this.y, haloR, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.globalAlpha = 1;

      // Label — 30% nodes, only when not too dense
      if (this.hasLabel && displayAlpha > 0.18 && Math.sin(this.pulsePhase * 0.2) > 0.3) {
        ctx.font = '9px "SF Mono","Fira Code",monospace';
        ctx.fillStyle = 'rgba(200,175,140,' + (displayAlpha * 0.38 * connAlphaScale) + ')';
        ctx.textAlign = 'center';
        ctx.fillText(this.label, this.x, this.y - r - 8);
      }
    }
  }

  /* ===== System ===== */
  function NodeNetwork(canvas, options) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let W = 0, H = 0;
    const nodes = [];
    const COUNT = options.count || 65;
    const CONN_DIST = options.connDist || 150;
    let mouse = { x: -1000, y: -1000 };
    let mouseActive = false;
    let mouseLeaveTimer = null;

    // Progressive reveal: connections fade in after 0.5s
    const startTime = performance.now();

    function resize() {
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = W;
      canvas.height = H;
      for (const n of nodes) { n.w = W; n.h = H; }
    }

    function init() {
      resize();
      nodes.length = 0;
      for (let i = 0; i < COUNT; i++) {
        const n = new Node(W, H);
        n.birthProgress = Math.random() * 0.9 + 0.1;
        n.alpha = n.targetAlpha * n.easeOutCubic(n.birthProgress);
        nodes.push(n);
      }
    }

    function drawConnections(connAlphaScale) {
      const rhythm = Math.sin(Date.now() * 0.00018) * 0.5 + 0.5;

      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        if (a.alpha < 0.05) continue;

        // Mouse connection — appears when mouse active
        if (mouseActive) {
          const dxm = mouse.x - a.x;
          const dym = mouse.y - a.y;
          const distm = Math.sqrt(dxm * dxm + dym * dym);
          if (distm < 160) {
            const ma = (1 - distm / 160) * a.alpha * 0.14 * connAlphaScale;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.strokeStyle = a.color;
            ctx.globalAlpha = ma;
            ctx.lineWidth = 0.35;
            ctx.stroke();
          }
        }

        // Node-to-node — knowledge graph connections
        const connLimit = Math.floor(2 + rhythm * 3);
        let drawn = 0;
        for (let j = i + 1; j < nodes.length; j++) {
          if (drawn >= connLimit) break;
          const b = nodes[j];
          if (b.alpha < 0.05) continue;

          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CONN_DIST) {
            const linkAlpha = (1 - dist / CONN_DIST) * Math.min(a.alpha, b.alpha) * 0.14 * connAlphaScale;
            if (linkAlpha > 0.003) {
              ctx.beginPath();
              ctx.moveTo(a.x, a.y);
              ctx.lineTo(b.x, b.y);
              const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
              grad.addColorStop(0, a.color + '00');
              const hex = Math.floor(linkAlpha * 255).toString(16).padStart(2, '0');
              grad.addColorStop(0.5, a.color + hex);
              grad.addColorStop(1, b.color + '00');
              ctx.strokeStyle = grad;
              ctx.globalAlpha = linkAlpha;
              ctx.lineWidth = 0.3;
              ctx.stroke();
              drawn++;
            }
          }
        }
      }
      ctx.globalAlpha = 1;
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);

      // Progressive reveal: 0 to 1 over first 0.5s, then hold
      const elapsed = performance.now() - startTime;
      const connAlphaScale = Math.min(1, elapsed / 500);

      drawConnections(connAlphaScale);
      for (const n of nodes) n.draw(ctx, connAlphaScale);
    }

    function loop() {
      for (const n of nodes) n.update(mouse, mouseActive);
      draw();
      requestAnimationFrame(loop);
    }

    window.addEventListener('mousemove', e => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouseActive = true;
      if (mouseLeaveTimer) {
        clearTimeout(mouseLeaveTimer);
        mouseLeaveTimer = null;
      }
    });
    window.addEventListener('mouseleave', () => {
      mouseLeaveTimer = setTimeout(() => {
        mouseActive = false;
        mouse.x = -1000;
        mouse.y = -1000;
      }, 800); // linger effect: mouse lines stay for 0.8s after leave
    });
    window.addEventListener('resize', () => {
      resize();
      init();
    });

    init();
    loop();
  }

  // Expose
  global.NodeNetwork = NodeNetwork;

})(window);
