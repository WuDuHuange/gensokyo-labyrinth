/**
 * 擦弹系统 (Graze System)
 * 
 * 处理擦弹判定、MP 回复和视觉反馈
 */

import { BULLET_CONFIG } from './BulletManager.js';

export const GRAZE_CONFIG = {
  MP_GAIN: 5,              // 单次擦弹 MP 获取
  COMBO_BONUS: 0.5,        // 连续擦弹额外 MP 加成（每次 +0.5）
  COMBO_TIMEOUT: 1000,     // 连击超时时间 (ms)
  MAX_COMBO_BONUS: 5,      // 最大连击加成
  
  // 视觉效果
  FLASH_DURATION: 100,     // 闪光持续时间
  PARTICLE_COUNT: 3,       // 粒子数量
  
  // 音效
  GRAZE_SOUND: 'sfx_graze'
};

export default class GrazeSystem {
  constructor(scene) {
    this.scene = scene;
    
    // 玩家引用
    this.player = null;
    
    // 弹幕管理器引用
    this.bulletManager = null;
    
    // 连击计数
    this.comboCount = 0;
    this.comboTimer = 0;
    
    // 累计擦弹数
    this.totalGraze = 0;
    
    // 本局擦弹数
    this.sessionGraze = 0;
    
    // 粒子发射器
    this.particles = null;
  }
  
  /**
   * 初始化
   */
  init(player, bulletManager) {
    this.player = player;
    this.bulletManager = bulletManager;
    
    // 创建粒子效果（如果资源存在）
    try {
      if (this.scene.textures.exists('particle_graze')) {
        this.particles = this.scene.add.particles(0, 0, 'particle_graze', {
          speed: { min: 50, max: 100 },
          scale: { start: 0.5, end: 0 },
          alpha: { start: 1, end: 0 },
          lifespan: 300,
          blendMode: 'ADD',
          emitting: false
        });
        this.particles.setDepth(20);
      }
    } catch (e) {
      // 粒子资源不存在，忽略
    }
  }
  
  /**
   * 每帧更新
   * @param {number} realDelta - 实际 delta (ms)
   */
  update(realDelta) {
    if (!this.player || !this.bulletManager) return;
    
    // 更新连击计时器
    if (this.comboCount > 0) {
      this.comboTimer -= realDelta;
      if (this.comboTimer <= 0) {
        this.resetCombo();
      }
    }
    
    // 检测擦弹
    const { hit, grazed } = this.bulletManager.checkPlayerCollision(this.player);
    
    // 处理擦弹
    for (const bullet of grazed) {
      this.onGraze(bullet);
    }
    
    // 处理命中（返回给调用者处理）
    return { hit, grazed };
  }
  
  /**
   * 处理擦弹事件
   */
  onGraze(bullet) {
    // 增加连击
    this.comboCount++;
    this.comboTimer = GRAZE_CONFIG.COMBO_TIMEOUT;
    
    // 计算 MP 获取（包含连击加成）
    const comboBonus = Math.min(
      this.comboCount * GRAZE_CONFIG.COMBO_BONUS,
      GRAZE_CONFIG.MAX_COMBO_BONUS
    );
    const mpGain = GRAZE_CONFIG.MP_GAIN + comboBonus;
    
    // 恢复 MP
    if (this.player.mp !== undefined) {
      this.player.mp = Math.min(this.player.maxMp, this.player.mp + mpGain);
    }
    
    // 统计
    this.totalGraze++;
    this.sessionGraze++;
    
    // 视觉效果
    this.showGrazeEffect(bullet.x, bullet.y);
    
    // 音效
    this.playGrazeSound();
    
    // 发送事件
    if (this.scene.events) {
      this.scene.events.emit('graze', {
        x: bullet.x,
        y: bullet.y,
        mpGain: mpGain,
        combo: this.comboCount,
        total: this.totalGraze
      });
    }
  }
  
  /**
   * 显示擦弹视觉效果
   */
  showGrazeEffect(x, y) {
    // 闪光效果
    try {
      const flash = this.scene.add.circle(x, y, 15, 0xffffff, 0.8);
      flash.setDepth(25);
      flash.setBlendMode(Phaser.BlendModes.ADD);
      
      this.scene.tweens.add({
        targets: flash,
        alpha: 0,
        scale: 2,
        duration: GRAZE_CONFIG.FLASH_DURATION,
        onComplete: () => flash.destroy()
      });
    } catch (e) {}
    
    // 粒子效果
    if (this.particles) {
      this.particles.emitParticleAt(x, y, GRAZE_CONFIG.PARTICLE_COUNT);
    }
    
    // 连击文字（连击数 > 1 时显示）
    if (this.comboCount > 1) {
      try {
        const comboText = this.scene.add.text(x, y - 20, `${this.comboCount} Graze!`, {
          fontSize: '12px',
          fontFamily: 'Arial',
          color: '#00ffff',
          stroke: '#000000',
          strokeThickness: 2
        });
        comboText.setOrigin(0.5);
        comboText.setDepth(26);
        
        this.scene.tweens.add({
          targets: comboText,
          y: y - 40,
          alpha: 0,
          duration: 500,
          onComplete: () => comboText.destroy()
        });
      } catch (e) {}
    }
  }
  
  /**
   * 播放擦弹音效
   */
  playGrazeSound() {
    try {
      if (this.scene.sound && this.scene.sound.get) {
        // 音高随连击数略微提升
        const pitch = 1.0 + Math.min(this.comboCount * 0.05, 0.5);
        this.scene.sound.play(GRAZE_CONFIG.GRAZE_SOUND, { 
          volume: 0.3,
          rate: pitch
        });
      }
    } catch (e) {
      // 音效不存在，忽略
    }
  }
  
  /**
   * 重置连击
   */
  resetCombo() {
    if (this.comboCount > 5) {
      // 显示最终连击数
      try {
        if (this.scene.events) {
          this.scene.events.emit('showMessage', `擦弹连击 ×${this.comboCount}！`);
        }
      } catch (e) {}
    }
    this.comboCount = 0;
    this.comboTimer = 0;
  }
  
  /**
   * 获取当前连击数
   */
  getComboCount() {
    return this.comboCount;
  }
  
  /**
   * 获取累计擦弹数
   */
  getTotalGraze() {
    return this.totalGraze;
  }
  
  /**
   * 获取本局擦弹数
   */
  getSessionGraze() {
    return this.sessionGraze;
  }
  
  /**
   * 重置本局统计
   */
  resetSession() {
    this.sessionGraze = 0;
    this.comboCount = 0;
    this.comboTimer = 0;
  }
  
  /**
   * 销毁
   */
  destroy() {
    if (this.particles) {
      this.particles.destroy();
    }
    this.player = null;
    this.bulletManager = null;
  }
}
