/**
 * 屏幕效果管理器
 * 
 * 处理各种视觉效果：滤镜、闪烁、晕影、残影等
 */

export default class ScreenEffects {
  constructor(scene) {
    this.scene = scene;
    
    // 效果图层
    this.vignetteGraphic = null;
    this.overlayGraphic = null;
    
    // 当前效果状态
    this.currentSaturation = 1.0;
    this.currentVignette = 0;
    
    // 残影系统
    this.afterImages = [];
    this.afterImagePool = [];
  }
  
  /**
   * 初始化
   */
  init() {
    // 创建晕影图层
    this.createVignette();
    
    // 创建亮度覆盖层（用于行动状态）
    this.createBrightnessOverlay();
    
    // 监听时间效果事件
    if (this.scene.events) {
      this.scene.events.on('timeEffects', this.handleTimeEffects, this);
    }
  }

  /**
   * 创建亮度覆盖层
   */
  createBrightnessOverlay() {
    const width = this.scene.cameras.main.width;
    const height = this.scene.cameras.main.height;
    
    this.brightnessOverlay = this.scene.add.rectangle(
      width / 2,
      height / 2,
      width,
      height,
      0xffffff,
      0
    );
    this.brightnessOverlay.setScrollFactor(0);
    this.brightnessOverlay.setDepth(899);
    this.brightnessOverlay.setBlendMode(Phaser.BlendModes.ADD);
    this.currentBrightness = 0;
  }

  /**
   * 设置画面亮度（0 = 正常，0.2 = 较亮）
   */
  setBrightness(value) {
    this.currentBrightness = value;
    if (this.brightnessOverlay) {
      this.brightnessOverlay.setAlpha(value);
    }
  }
  
  /**
   * 创建晕影效果图层
   */
  createVignette() {
    const width = this.scene.cameras.main.width;
    const height = this.scene.cameras.main.height;
    
    this.vignetteGraphic = this.scene.add.graphics();
    this.vignetteGraphic.setScrollFactor(0);
    this.vignetteGraphic.setDepth(900);
    this.vignetteGraphic.setAlpha(0);
    
    // 绘制径向渐变晕影
    this.drawVignette(0.3);
  }
  
  /**
   * 绘制晕影
   */
  drawVignette(intensity) {
    if (!this.vignetteGraphic) return;
    
    const width = this.scene.cameras.main.width;
    const height = this.scene.cameras.main.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.sqrt(centerX * centerX + centerY * centerY);
    
    this.vignetteGraphic.clear();
    
    // 多层渐变模拟
    const layers = 10;
    for (let i = layers; i > 0; i--) {
      const ratio = i / layers;
      const alpha = (1 - ratio) * intensity * 0.8;
      const radius = maxRadius * (0.5 + ratio * 0.5);
      
      this.vignetteGraphic.fillStyle(0x000000, alpha);
      this.vignetteGraphic.fillCircle(centerX, centerY, radius);
    }
  }
  
  /**
   * 设置晕影强度
   */
  setVignette(intensity) {
    this.currentVignette = intensity;
    if (this.vignetteGraphic) {
      this.vignetteGraphic.setAlpha(intensity);
    }
  }
  
  /**
   * 处理时间效果事件
   */
  handleTimeEffects(data) {
    switch (data.type) {
      case 'idle':
        this.transitionToIdle(data);
        break;
      case 'action':
        this.transitionToAction(data);
        break;
      case 'killFreeze':
        this.applyKillFreeze(data);
        break;
      case 'lastGasp':
        this.applyLastGasp(data);
        break;
      case 'snipe':
        this.applySnipeEffect(data);
        break;
    }
  }
  
  /**
   * 过渡到静止状态效果
   */
  transitionToIdle(data) {
    // 增加晕影
    this.scene.tweens.add({
      targets: this,
      currentVignette: data.vignette || 0.3,
      duration: 300,
      onUpdate: () => {
        this.setVignette(this.currentVignette);
      }
    });
    
    // 降低亮度（变暗）
    this.scene.tweens.add({
      targets: this,
      currentBrightness: 0,
      duration: 300,
      onUpdate: () => {
        this.setBrightness(this.currentBrightness);
      }
    });
  }
  
  /**
   * 过渡到行动状态效果
   */
  transitionToAction(data) {
    // 移除晕影
    this.scene.tweens.add({
      targets: this,
      currentVignette: 0,
      duration: 100,
      onUpdate: () => {
        this.setVignette(this.currentVignette);
      }
    });
    
    // 增加亮度（变亮）
    this.scene.tweens.add({
      targets: this,
      currentBrightness: 0.15,
      duration: 100,
      onUpdate: () => {
        this.setBrightness(this.currentBrightness);
      }
    });
  }
  
  /**
   * 应用 Kill Freeze 效果
   */
  applyKillFreeze(data) {
    // 屏幕闪白
    this.scene.cameras.main.flash(200, 255, 255, 255);
    
    // 可选：反色效果（需要 WebGL pipeline）
    if (data.invert) {
      this.pulseInvert(1000);
    }
  }
  
  /**
   * 应用决死时刻效果
   */
  applyLastGasp(data) {
    // 红色覆盖由 LastGaspSystem 处理
    // 这里可以添加额外效果
    
    // 屏幕边缘红色脉冲
    this.pulseRedEdge();
  }
  
  /**
   * 应用狙击模式效果
   */
  applySnipeEffect(data) {
    // 聚焦效果：轻微晕影 + 中心清晰 + 正常亮度
    this.setVignette(0.2);
    
    // 狙击模式时也增加亮度
    this.scene.tweens.add({
      targets: this,
      currentBrightness: 0.12,
      duration: 100,
      onUpdate: () => {
        this.setBrightness(this.currentBrightness);
      }
    });
  }
  
  /**
   * 短暂明亮闪烁
   */
  flashBright(duration) {
    try {
      const flash = this.scene.add.rectangle(
        this.scene.cameras.main.width / 2,
        this.scene.cameras.main.height / 2,
        this.scene.cameras.main.width,
        this.scene.cameras.main.height,
        0xffffff,
        0.3
      );
      flash.setScrollFactor(0);
      flash.setDepth(950);
      flash.setBlendMode(Phaser.BlendModes.ADD);
      
      this.scene.tweens.add({
        targets: flash,
        alpha: 0,
        duration: duration,
        onComplete: () => flash.destroy()
      });
    } catch (e) {}
  }
  
  /**
   * 反色脉冲效果
   */
  pulseInvert(duration) {
    // 简化实现：快速明暗交替
    try {
      const overlay = this.scene.add.rectangle(
        this.scene.cameras.main.width / 2,
        this.scene.cameras.main.height / 2,
        this.scene.cameras.main.width,
        this.scene.cameras.main.height,
        0xffffff,
        0.5
      );
      overlay.setScrollFactor(0);
      overlay.setDepth(950);
      overlay.setBlendMode(Phaser.BlendModes.DIFFERENCE);
      
      this.scene.tweens.add({
        targets: overlay,
        alpha: 0,
        duration: duration,
        onComplete: () => overlay.destroy()
      });
    } catch (e) {}
  }
  
  /**
   * 红色边缘脉冲
   */
  pulseRedEdge() {
    try {
      const border = this.scene.add.graphics();
      border.setScrollFactor(0);
      border.setDepth(960);
      
      const width = this.scene.cameras.main.width;
      const height = this.scene.cameras.main.height;
      const thickness = 30;
      
      border.lineStyle(thickness, 0xff0000, 0.5);
      border.strokeRect(thickness/2, thickness/2, width - thickness, height - thickness);
      
      this.scene.tweens.add({
        targets: border,
        alpha: { from: 0.8, to: 0 },
        duration: 500,
        yoyo: true,
        repeat: 2,
        onComplete: () => border.destroy()
      });
    } catch (e) {}
  }
  
  /**
   * 创建残影
   */
  createAfterImage(sprite, alpha = 0.5, duration = 200) {
    try {
      const afterImage = this.scene.add.sprite(sprite.x, sprite.y, sprite.texture.key);
      afterImage.setScale(sprite.scaleX, sprite.scaleY);
      afterImage.setRotation(sprite.rotation);
      afterImage.setAlpha(alpha);
      afterImage.setTint(0x8888ff);
      afterImage.setDepth(sprite.depth - 1);
      
      this.scene.tweens.add({
        targets: afterImage,
        alpha: 0,
        scale: afterImage.scale * 0.8,
        duration: duration,
        onComplete: () => afterImage.destroy()
      });
      
      this.afterImages.push(afterImage);
    } catch (e) {}
  }
  
  /**
   * 显示伤害数字
   */
  showDamageNumber(x, y, damage, isCrit = false, isHeal = false) {
    try {
      const color = isHeal ? '#00ff00' : (isCrit ? '#ffff00' : '#ffffff');
      const prefix = isHeal ? '+' : '-';
      const fontSize = isCrit ? '18px' : '14px';
      
      const text = this.scene.add.text(x, y, `${prefix}${damage}`, {
        fontSize: fontSize,
        fontFamily: 'Arial',
        color: color,
        stroke: '#000000',
        strokeThickness: 3
      });
      text.setOrigin(0.5);
      text.setDepth(100);
      
      this.scene.tweens.add({
        targets: text,
        y: y - 30,
        alpha: 0,
        duration: 800,
        ease: 'Quad.easeOut',
        onComplete: () => text.destroy()
      });
    } catch (e) {}
  }
  
  /**
   * 每帧更新
   */
  update(delta) {
    // 清理已销毁的残影
    this.afterImages = this.afterImages.filter(img => img.active);
  }
  
  /**
   * 销毁
   */
  destroy() {
    if (this.vignetteGraphic) {
      this.vignetteGraphic.destroy();
    }
    if (this.overlayGraphic) {
      this.overlayGraphic.destroy();
    }
    for (const img of this.afterImages) {
      try { img.destroy(); } catch (e) {}
    }
    this.afterImages = [];
    
    if (this.scene.events) {
      this.scene.events.off('timeEffects', this.handleTimeEffects, this);
    }
  }
}
