/**
 * 决死时刻系统 (Last Gasp System)
 * 
 * 当玩家被弹幕命中时，给予短暂的反应窗口
 * 成功使用符卡可以清除所有弹幕并避免伤害
 */

export const LAST_GASP_CONFIG = {
  REACTION_WINDOW: 500,     // 反应窗口 (ms)
  FULL_MP_COST: true,       // 是否消耗全部 MP
  MIN_MP_COST: 30,          // 最小 MP 消耗
  INVINCIBILITY_FRAMES: 60, // 成功后无敌帧数
  
  // 视觉效果
  OVERLAY_COLOR: 0xff0000,
  OVERLAY_ALPHA: 0.3,
  SLOW_MO_SCALE: 0.1
};

export default class LastGaspSystem {
  constructor(scene) {
    this.scene = scene;
    
    // 玩家引用
    this.player = null;
    
    // 时间管理器引用
    this.timeManager = null;
    
    // 弹幕管理器引用
    this.bulletManager = null;
    
    // 当前决死状态
    this.isActive = false;
    this.timer = 0;
    this.pendingBullet = null; // 触发决死的弹幕
    
    // 视觉元素
    this.overlay = null;
    this.promptText = null;
    
    // 回调
    this.onSuccess = null;
    this.onFail = null;
    
    // 无敌帧计数
    this.invincibilityFrames = 0;
  }
  
  /**
   * 初始化
   */
  init(player, timeManager, bulletManager) {
    this.player = player;
    this.timeManager = timeManager;
    this.bulletManager = bulletManager;
  }
  
  /**
   * 触发决死时刻
   * @param {Bullet} bullet - 命中的弹幕
   * @returns {boolean} 是否成功触发
   */
  trigger(bullet) {
    if (this.isActive) return false; // 已在决死状态
    if (this.invincibilityFrames > 0) return false; // 无敌帧中
    
    // 检查是否有足够 MP
    const minMp = LAST_GASP_CONFIG.MIN_MP_COST;
    if (this.player.mp < minMp) {
      // MP 不足，无法触发决死
      return false;
    }
    
    this.isActive = true;
    this.timer = LAST_GASP_CONFIG.REACTION_WINDOW;
    this.pendingBullet = bullet;
    
    // 通知时间管理器进入决死状态
    if (this.timeManager) {
      this.timeManager.triggerLastGasp((success) => {
        if (success) {
          this.executeSuccess();
        } else {
          this.executeFail();
        }
      });
    }
    
    // 显示视觉效果
    this.showOverlay();
    
    // 发送事件
    if (this.scene.events) {
      this.scene.events.emit('lastGaspStart', {
        timeRemaining: this.timer,
        bulletDamage: bullet ? bullet.damage : 0
      });
    }
    
    return true;
  }
  
  /**
   * 每帧更新
   * @param {number} realDelta - 实际 delta (ms)，不受时间缩放影响
   */
  update(realDelta) {
    // 更新无敌帧
    if (this.invincibilityFrames > 0) {
      this.invincibilityFrames--;
      
      // 闪烁效果
      if (this.player && this.player.sprite) {
        this.player.sprite.setAlpha(this.invincibilityFrames % 6 < 3 ? 0.5 : 1);
        if (this.invincibilityFrames === 0) {
          this.player.sprite.setAlpha(1);
        }
      }
    }
    
    if (!this.isActive) return;
    
    // 决死计时（使用实际时间，不受时间缩放影响）
    this.timer -= realDelta;
    
    // 更新提示文字
    this.updatePrompt();
    
    // 超时检查
    if (this.timer <= 0) {
      this.executeFail();
    }
  }
  
  /**
   * 尝试使用符卡闪避
   * @returns {boolean} 是否成功
   */
  tryDodge() {
    if (!this.isActive) return false;
    
    // 检查 MP
    const mpCost = LAST_GASP_CONFIG.FULL_MP_COST ? this.player.mp : LAST_GASP_CONFIG.MIN_MP_COST;
    if (this.player.mp < LAST_GASP_CONFIG.MIN_MP_COST) {
      return false;
    }
    
    // 消耗 MP
    this.player.mp -= mpCost;
    
    // 通知时间管理器成功闪避
    if (this.timeManager) {
      this.timeManager.lastGaspSuccess();
    }
    
    return true;
  }
  
  /**
   * 执行成功闪避
   */
  executeSuccess() {
    this.isActive = false;
    
    // 清除所有弹幕
    if (this.bulletManager) {
      this.bulletManager.clearAll();
    }
    
    // 设置无敌帧
    this.invincibilityFrames = LAST_GASP_CONFIG.INVINCIBILITY_FRAMES;
    
    // 隐藏覆盖层
    this.hideOverlay();
    
    // 视觉效果：全屏闪白
    try {
      if (this.scene.cameras && this.scene.cameras.main) {
        this.scene.cameras.main.flash(200, 255, 255, 255);
      }
    } catch (e) {}
    
    // 播放音效
    try {
      if (this.scene.sound) {
        this.scene.sound.play('sfx_bomb', { volume: 0.5 });
      }
    } catch (e) {}
    
    // 显示消息
    if (this.scene.events) {
      this.scene.events.emit('showMessage', '决死发动！全弹清除！');
      this.scene.events.emit('lastGaspSuccess');
    }
    
    // 回调
    if (this.onSuccess) {
      this.onSuccess();
    }
    
    this.pendingBullet = null;
  }
  
  /**
   * 执行闪避失败
   */
  executeFail() {
    this.isActive = false;
    
    // 隐藏覆盖层
    this.hideOverlay();
    
    // 对玩家造成伤害
    if (this.player && this.pendingBullet) {
      const damage = this.pendingBullet.damage || 10;
      this.player.takeDamage(damage);
      
      // 移除造成伤害的弹幕
      if (this.bulletManager) {
        this.bulletManager.recycleBullet(this.pendingBullet);
      }
    }
    
    // 视觉效果：屏幕震动
    try {
      if (this.scene.cameras && this.scene.cameras.main) {
        this.scene.cameras.main.shake(200, 0.01);
      }
    } catch (e) {}
    
    // 发送事件
    if (this.scene.events) {
      this.scene.events.emit('lastGaspFail');
    }
    
    // 回调
    if (this.onFail) {
      this.onFail();
    }
    
    this.pendingBullet = null;
  }
  
  /**
   * 显示决死覆盖层
   */
  showOverlay() {
    try {
      // 红色半透明覆盖
      this.overlay = this.scene.add.rectangle(
        this.scene.cameras.main.width / 2,
        this.scene.cameras.main.height / 2,
        this.scene.cameras.main.width,
        this.scene.cameras.main.height,
        LAST_GASP_CONFIG.OVERLAY_COLOR,
        LAST_GASP_CONFIG.OVERLAY_ALPHA
      );
      this.overlay.setScrollFactor(0);
      this.overlay.setDepth(1000);
      
      // 闪烁动画
      this.scene.tweens.add({
        targets: this.overlay,
        alpha: { from: LAST_GASP_CONFIG.OVERLAY_ALPHA, to: LAST_GASP_CONFIG.OVERLAY_ALPHA * 0.5 },
        duration: 100,
        yoyo: true,
        repeat: -1
      });
      
      // 提示文字
      this.promptText = this.scene.add.text(
        this.scene.cameras.main.width / 2,
        this.scene.cameras.main.height / 2,
        '决死时刻！\n按 Z/X/C 清弹！',
        {
          fontSize: '24px',
          fontFamily: 'Arial',
          color: '#ffffff',
          stroke: '#ff0000',
          strokeThickness: 4,
          align: 'center'
        }
      );
      this.promptText.setOrigin(0.5);
      this.promptText.setScrollFactor(0);
      this.promptText.setDepth(1001);
      
      // 脉冲动画
      this.scene.tweens.add({
        targets: this.promptText,
        scale: { from: 1, to: 1.1 },
        duration: 150,
        yoyo: true,
        repeat: -1
      });
    } catch (e) {
      console.error('Failed to show last gasp overlay:', e);
    }
  }
  
  /**
   * 更新提示文字
   */
  updatePrompt() {
    if (!this.promptText) return;
    
    const remaining = Math.ceil(this.timer / 100) / 10;
    this.promptText.setText(`决死时刻！\n按 Z/X/C 清弹！\n${remaining.toFixed(1)}s`);
  }
  
  /**
   * 隐藏决死覆盖层
   */
  hideOverlay() {
    try {
      if (this.overlay) {
        this.scene.tweens.killTweensOf(this.overlay);
        this.overlay.destroy();
        this.overlay = null;
      }
      if (this.promptText) {
        this.scene.tweens.killTweensOf(this.promptText);
        this.promptText.destroy();
        this.promptText = null;
      }
    } catch (e) {}
  }
  
  /**
   * 是否处于决死状态
   */
  isInLastGasp() {
    return this.isActive;
  }
  
  /**
   * 是否处于无敌帧
   */
  isInvincible() {
    return this.invincibilityFrames > 0;
  }
  
  /**
   * 销毁
   */
  destroy() {
    this.hideOverlay();
    this.player = null;
    this.timeManager = null;
    this.bulletManager = null;
  }
}
