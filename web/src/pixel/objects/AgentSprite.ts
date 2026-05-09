// ============================================================
// AgentSprite — Swarm 办公室中的智能体角色视觉表现
// ============================================================
// 继承 Phaser.GameObjects.Container，包含阴影、精灵体、名字标签、
// 状态圆点和动作气泡等子对象。由 WorldScene 在 update() 中驱动。
// ============================================================

import Phaser from "phaser";

type AgentVisualState =
  | "idle"
  | "working"
  | "stuck"
  | "offline"
  | "celebrate"
  | "moving";
type FacingDirection = "left" | "right" | "up" | "down";

/** 状态圆点颜色映射 */
const STATUS_DOT_COLORS: Record<AgentVisualState, number> = {
  idle: 0x4ade80, // 绿色
  working: 0x60a5fa, // 蓝色
  stuck: 0xfbbf24, // 黄色
  offline: 0x6b7280, // 灰色
  celebrate: 0xfbbf24, // 黄色（庆祝用同色）
  moving: 0x60a5fa, // 蓝色
};

/** 容器整体缩放（让角色在 32px tile 世界中大小合适） */
const CONTAINER_SCALE = 0.35;

/** 移动速度：像素/秒 */
const DEFAULT_MOVE_SPEED = 120;

/** 到达目标的距离阈值（像素） */
const ARRIVAL_THRESHOLD = 2;

export class AgentSprite extends Phaser.GameObjects.Container {
  // ── 子对象引用 ──────────────────────────────────────────
  private shadow: Phaser.GameObjects.Ellipse;
  private bodySprite: Phaser.GameObjects.Sprite;
  private nameLabel: Phaser.GameObjects.Text;
  private nameBg: Phaser.GameObjects.Graphics;
  private statusDot: Phaser.GameObjects.Arc;
  private bubbleContainer: Phaser.GameObjects.Container;
  private bubbleBg: Phaser.GameObjects.Graphics;
  private bubbleText: Phaser.GameObjects.Text;

  // ── 状态字段 ────────────────────────────────────────────
  private _agentId: string;
  private _agentName: string;
  private _visualState: AgentVisualState = "idle";
  private _facing: FacingDirection = "down";
  private _targetPosition: { x: number; y: number } | null = null;
  private _moveSpeed: number = DEFAULT_MOVE_SPEED;
  private _spriteKey: string;

  // ── Tween 引用（销毁时需要清理） ────────────────────────
  private breathingTween: Phaser.Tweens.Tween | null = null;
  private celebrateTween: Phaser.Tweens.Tween | null = null;
  private bubbleFadeTween: Phaser.Tweens.Tween | null = null;
  private stuckTween: Phaser.Tweens.Tween | null = null;

  constructor(
    scene: Phaser.Scene,
    agentId: string,
    agentName: string,
    x: number,
    y: number,
    spriteKey?: string
  ) {
    super(scene, x, y);

    this._agentId = agentId;
    this._agentName = agentName;
    this._spriteKey = spriteKey ?? "character-default";

    // ── 1. 阴影 ────────────────────────────────────────────
    this.shadow = scene.add.ellipse(
      0,
      8, // 稍微偏下，位于角色脚底
      50,
      16, // 宽 50px，高 16px
      0x000000, // 黑色
      0.2 // alpha 0.2
    );

    // ── 2. 角色精灵体 ──────────────────────────────────────
    this.bodySprite = scene.add.sprite(0, 0, this._spriteKey);
    this.bodySprite.setOrigin(0.5, 0.85); // 脚底对齐
    this.bodySprite.setScale(1);

    // ── 3. 名字标签背景 ────────────────────────────────────
    this.nameBg = scene.add.graphics();

    // ── 4. 名字标签 ────────────────────────────────────────
    const estimatedTextWidth = agentName.length * 6 + 12;
    this.nameLabel = scene.add.text(
      0,
      -this.bodySprite.displayHeight * 0.85 - 10,
      agentName,
      {
        fontFamily: '"Press Start 2P", "Courier New", monospace',
        fontSize: "10px",
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 2,
        align: "center",
      }
    );
    this.nameLabel.setOrigin(0.5, 0.5);

    // 绘制名字背景
    this.drawNameBg(estimatedTextWidth, 14);

    // ── 5. 状态小圆点 ──────────────────────────────────────
    const nameLabelWidth = this.nameLabel.width;
    this.statusDot = scene.add.circle(
      -nameLabelWidth / 2 - 6,
      this.nameLabel.y,
      3,
      STATUS_DOT_COLORS.idle
    );

    // ── 6. 动作气泡容器 ────────────────────────────────────
    this.bubbleContainer = scene.add.container(0, 0);
    this.bubbleContainer.setVisible(false);

    this.bubbleBg = scene.add.graphics();
    this.bubbleText = scene.add.text(0, 0, "", {
      fontFamily: '"Press Start 2P", "Courier New", monospace',
      fontSize: "10px",
      color: "#ffffff",
      align: "center",
    });
    this.bubbleText.setOrigin(0.5, 0.5);

    this.bubbleContainer.add([this.bubbleBg, this.bubbleText]);

    // ── 组装 Container ─────────────────────────────────────
    this.add([
      this.shadow,
      this.bodySprite,
      this.nameBg,
      this.nameLabel,
      this.statusDot,
      this.bubbleContainer,
    ]);

    // ── 整体缩放 ──────────────────────────────────────────
    this.setScale(CONTAINER_SCALE);

    // 将容器添加到场景（注意：不播放动画，等外部调用 setVisualState）
    scene.add.existing(this as unknown as Phaser.GameObjects.GameObject);
  }

  // ============================================================
  // 公开属性
  // ============================================================

  get agentId(): string {
    return this._agentId;
  }

  get agentName(): string {
    return this._agentName;
  }

  get visualState(): AgentVisualState {
    return this._visualState;
  }

  get facing(): FacingDirection {
    return this._facing;
  }

  get spriteKey(): string {
    return this._spriteKey;
  }

  get isMoving(): boolean {
    return this._targetPosition !== null;
  }

  // ============================================================
  // 核心方法：setVisualState
  // ============================================================

  /**
   * 设置视觉状态并切换对应动画。
   * 内部会清理上一个状态的 tween，再启动新状态的视觉效果。
   */
  setVisualState(state: AgentVisualState): void {
    if (this._visualState === state) return;

    const previousState = this._visualState;
    this._visualState = state;

    // 清理上一个状态的视觉效果
    this.clearStateEffects(previousState);

    // 重置通用属性
    this.bodySprite.setAlpha(1);
    this.bodySprite.clearTint();
    this.bodySprite.setScale(1);

    // 更新状态圆点颜色
    this.statusDot.setFillStyle(STATUS_DOT_COLORS[state]);

    // 根据状态切换动画和特效
    switch (state) {
      case "idle":
        this.playAnimation("idle-down");
        this.startBreathingTween();
        break;

      case "working":
        this.playAnimation("work-down");
        break;

      case "stuck":
        this.playAnimation("idle-left");
        this.startStuckTween();
        break;

      case "offline":
        this.playAnimation("idle-down");
        this.bodySprite.setAlpha(0.4);
        this.bodySprite.setTint(0x888888);
        break;

      case "celebrate":
        this.playAnimation("idle-up");
        this.startCelebrateTween();
        break;

      case "moving":
        this.playAnimation(`walk-${this._facing}`);
        break;
    }
  }

  // ============================================================
  // 核心方法：moveTo
  // ============================================================

  /**
   * 设置移动目标位置。update() 中会逐帧向目标移动。
   * 根据 dx/dy 自动计算朝向并播放行走动画。
   *
   * Note: Named `navigateTo` to avoid conflict with
   * Container.moveTo(child, index) inherited method.
   */
  navigateTo(targetX: number, targetY: number): void {
    const dx = targetX - this.x;
    const dy = targetY - this.y;

    // 根据位移方向计算朝向（取分量较大的轴）
    if (Math.abs(dx) > Math.abs(dy)) {
      this._facing = dx < 0 ? "left" : "right";
    } else {
      this._facing = dy < 0 ? "up" : "down";
    }

    this._targetPosition = { x: targetX, y: targetY };

    // 设置精灵翻转（右走时翻转左走动画）
    this.bodySprite.setFlipX(this._facing === "right");

    this.setVisualState("moving");
  }

  // ============================================================
  // 核心方法：update（由 WorldScene 调用）
  // ============================================================

  /**
   * 每帧更新。如果有移动目标，以 _moveSpeed 像素/秒向目标移动。
   * 到达后自动切换为 idle 状态。
   */
  update(_time: number, delta: number): void {
    if (this._targetPosition === null) return;

    const deltaSeconds = delta / 1000;
    const dx = this._targetPosition.x - this.x;
    const dy = this._targetPosition.y - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance <= ARRIVAL_THRESHOLD) {
      // 到达目标
      this.x = this._targetPosition.x;
      this.y = this._targetPosition.y;
      this._targetPosition = null;
      this.bodySprite.setFlipX(false);
      this.setVisualState("idle");
      return;
    }

    // 逐帧移动
    const moveDistance = this._moveSpeed * deltaSeconds;
    const ratio = Math.min(moveDistance / distance, 1);

    this.x += dx * ratio;
    this.y += dy * ratio;
  }

  // ============================================================
  // 动作气泡
  // ============================================================

  /**
   * 在角色头顶显示动作气泡，带圆角矩形背景。
   * 3 秒后自动淡出消失。
   */
  showActionBubble(text: string): void {
    // 清理之前可能的淡出 tween
    if (this.bubbleFadeTween) {
      this.bubbleFadeTween.stop();
      this.bubbleFadeTween = null;
    }

    // 设置文字
    this.bubbleText.setText(text);

    // 绘制气泡背景
    const padding = 8;
    const bgWidth = this.bubbleText.width + padding * 2;
    const bgHeight = this.bubbleText.height + padding * 2;
    const cornerRadius = 4;

    this.bubbleBg.clear();
    this.bubbleBg.fillStyle(0x1e1e3a, 0.9);
    this.bubbleBg.lineStyle(1, 0xffa27a, 0.3);
    this.bubbleBg.fillRoundedRect(
      -bgWidth / 2,
      -bgHeight / 2,
      bgWidth,
      bgHeight,
      cornerRadius
    );
    this.bubbleBg.strokeRoundedRect(
      -bgWidth / 2,
      -bgHeight / 2,
      bgWidth,
      bgHeight,
      cornerRadius
    );

    // 气泡位置：角色头顶 30px（考虑缩放前的坐标）
    const bubbleY = -this.bodySprite.displayHeight * 0.85 - 30;
    this.bubbleContainer.setPosition(0, bubbleY);
    this.bubbleContainer.setAlpha(1);
    this.bubbleContainer.setVisible(true);

    // 3 秒后淡出
    this.bubbleFadeTween = this.scene.tweens.add({
      targets: this.bubbleContainer,
      alpha: 0,
      delay: 3000,
      duration: 500,
      ease: "Power1",
      onComplete: () => {
        this.bubbleContainer.setVisible(false);
        this.bubbleContainer.setAlpha(1);
        this.bubbleFadeTween = null;
      },
    });
  }

  /**
   * 立即隐藏动作气泡。
   */
  clearActionBubble(): void {
    if (this.bubbleFadeTween) {
      this.bubbleFadeTween.stop();
      this.bubbleFadeTween = null;
    }
    this.bubbleContainer.setVisible(false);
    this.bubbleContainer.setAlpha(1);
  }

  // ============================================================
  // 名字与精灵切换
  // ============================================================

  /**
   * 更新角色名字标签。
   *
   * Note: Overrides Container.setName to also update the visual label.
   * Returns this for chaining (matching the base class signature).
   */
  override setName(name: string): this {
    this._agentName = name;
    this.nameLabel.setText(name);

    // 重绘名字背景和状态圆点位置
    const textWidth = this.nameLabel.width;
    this.drawNameBg(textWidth + 12, 14);
    this.statusDot.setPosition(-textWidth / 2 - 6, this.nameLabel.y);
    return this;
  }

  /**
   * 切换精灵图纹理。
   */
  setSpriteKey(key: string): void {
    if (this._spriteKey === key) return;
    this._spriteKey = key;
    this.bodySprite.setTexture(key);

    // 重新应用当前状态动画
    const currentState = this._visualState;
    this._visualState = "idle"; // 重置以强制刷新
    this.setVisualState(currentState);
  }

  // ============================================================
  // 销毁
  // ============================================================

  /**
   * 清理所有 tween 和子对象，然后销毁容器。
   */
  override destroy(fromScene?: boolean): void {
    this.stopAllTweens();
    super.destroy(fromScene);
  }

  // ============================================================
  // 内部方法：动画播放
  // ============================================================

  /**
   * 播放指定动画（带 spriteKey 前缀）。
   * 如果动画不存在则静默跳过。
   */
  private playAnimation(animKey: string): void {
    const fullKey = `${this._spriteKey}-${animKey}`;

    // 检查动画是否存在
    const anim = this.scene.anims.get(fullKey);
    if (!anim) {
      // 动画未注册，尝试播放单帧作为 fallback
      this.bodySprite.stop();
      return;
    }

    // 避免重复播放同一动画（Phaser 内部会重启）
    if (
      this.bodySprite.anims.isPlaying &&
      this.bodySprite.anims.getName() === fullKey
    ) {
      return;
    }

    this.bodySprite.play(fullKey);
  }

  // ============================================================
  // 内部方法：视觉效果
  // ============================================================

  /**
   * idle 状态的呼吸缩放动画。
   */
  private startBreathingTween(): void {
    this.stopBreathingTween();

    this.breathingTween = this.scene.tweens.add({
      targets: this.bodySprite,
      scaleY: 1.02,
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  /**
   * stuck 状态的问号效果（轻微上下浮动）。
   */
  private startStuckTween(): void {
    this.stopStuckTween();

    this.stuckTween = this.scene.tweens.add({
      targets: this.bodySprite,
      y: -3,
      duration: 400,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  /**
   * celebrate 状态的弹跳效果，2 秒后自动回到 idle。
   */
  private startCelebrateTween(): void {
    this.stopCelebrateTween();

    this.celebrateTween = this.scene.tweens.add({
      targets: this.bodySprite,
      scaleX: 1.15,
      scaleY: 1.15,
      duration: 200,
      yoyo: true,
      repeat: 4, // 弹跳 4 次
      ease: "Back.easeOut",
      onComplete: () => {
        this.bodySprite.setScale(1);
        this.setVisualState("idle");
      },
    });
  }

  // ============================================================
  // 内部方法：清理
  // ============================================================

  /**
   * 清理指定状态的视觉效果（tween、tint、alpha 等）。
   */
  private clearStateEffects(previousState: AgentVisualState): void {
    switch (previousState) {
      case "idle":
        this.stopBreathingTween();
        this.bodySprite.setScale(1);
        break;

      case "stuck":
        this.stopStuckTween();
        this.bodySprite.setY(0);
        break;

      case "celebrate":
        this.stopCelebrateTween();
        this.bodySprite.setScale(1);
        break;

      case "offline":
        // offline 的 alpha/tint 已在 setVisualState 开头重置
        break;

      case "moving":
        this.bodySprite.setFlipX(false);
        this._targetPosition = null;
        break;

      case "working":
        // 无额外效果需要清理
        break;
    }
  }

  /**
   * 绘制名字标签的半透明背景。
   */
  private drawNameBg(width: number, height: number): void {
    this.nameBg.clear();
    this.nameBg.fillStyle(0x000000, 0.4);
    this.nameBg.fillRoundedRect(
      -width / 2,
      this.nameLabel.y - height / 2,
      width,
      height,
      3
    );
  }

  private stopBreathingTween(): void {
    if (this.breathingTween) {
      this.breathingTween.stop();
      this.breathingTween = null;
    }
  }

  private stopCelebrateTween(): void {
    if (this.celebrateTween) {
      this.celebrateTween.stop();
      this.celebrateTween = null;
    }
  }

  private stopStuckTween(): void {
    if (this.stuckTween) {
      this.stuckTween.stop();
      this.stuckTween = null;
    }
  }

  private stopAllTweens(): void {
    this.stopBreathingTween();
    this.stopCelebrateTween();
    this.stopStuckTween();

    if (this.bubbleFadeTween) {
      this.bubbleFadeTween.stop();
      this.bubbleFadeTween = null;
    }

    // 停止 bodySprite 上所有正在运行的 scene tween
    this.scene.tweens.killTweensOf(this.bodySprite);
    this.scene.tweens.killTweensOf(this.bubbleContainer);
  }
}
