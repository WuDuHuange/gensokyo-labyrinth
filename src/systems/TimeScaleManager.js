/**
 * 全局时间缩放管理器 (Superhot Engine)
 * 
 * 核心理念: 时间只在玩家行动时流逝
 */
import AudioManager from './AudioManager.js';

export const TimeState = {
  IDLE: 'idle',           // 静止状态 - 时间极慢
  ACTION: 'action',       // 行动状态 - 正常时间流速
  KILL_FREEZE: 'killFreeze', // 击杀定格
  LAST_GASP: 'lastGasp',  // 决死时刻 - 完全暂停
  SNIPE: 'snipe'          // 原地狙击 - 正常流速但玩家不动
};

export const TIME_CONFIG = {
  IDLE_SCALE: 0.05,           // 静止时时间流速 (5%)
  ACTION_SCALE: 1.0,          // 行动时时间流速 (100%)
  KILL_FREEZE_SCALE: 0.001,   // 击杀定格流速
  LAST_GASP_SCALE: 0.0,       // 决死时刻完全暂停
  SNIPE_SCALE: 1.0,           // 狙击模式流速
  
  MOVE_DURATION: 200,         // 移动补间时长 (ms)
  KILL_FREEZE_DURATION: 1000, // 击杀定格实际时长 (ms)
  LAST_GASP_WINDOW: 500,      // 决死反应窗口 (ms)
  
  TRANSITION_SPEED: 0.15      // 状态切换插值速度
};

export default class TimeScaleManager {
  constructor(scene) {
    this.scene = scene;
    
    // 当前状态
    this.state = TimeState.IDLE;
    
    // 当前时间缩放值
    this.currentScale = TIME_CONFIG.IDLE_SCALE;
    
    // 目标时间缩放值（用于平滑过渡）
    this.targetScale = TIME_CONFIG.IDLE_SCALE;
    
    // 是否正在执行玩家动作
    this.isPlayerActing = false;
    
    // Kill Freeze 计时器
    this.killFreezeTimer = 0;
    
    // Last Gasp 计时器
    this.lastGaspTimer = 0;
    this.lastGaspCallback = null;
    
    // 监听器回调列表
    this.listeners = [];
    
    // 音频效果状态
    this.audioEffectsEnabled = true;

    // BGM 低通滤波节点
    this.musicFilter = null;
  }
  
  /**
   * 初始化（在场景 create 中调用）
   */
  init() {
    // 设置初始状态
    this.setState(TimeState.IDLE);
  }
  
  /**
   * 每帧更新
   * @param {number} realDelta - 实际经过的时间 (ms)
   */
  update(realDelta) {
    // 处理 Kill Freeze 状态
    if (this.state === TimeState.KILL_FREEZE) {
      this.killFreezeTimer -= realDelta;
      if (this.killFreezeTimer <= 0) {
        this.setState(TimeState.IDLE);
      }
    }
    
    // 处理 Last Gasp 状态
    if (this.state === TimeState.LAST_GASP) {
      this.lastGaspTimer -= realDelta;
      if (this.lastGaspTimer <= 0) {
        // 超时，执行回调（通常是受伤）
        if (this.lastGaspCallback) {
          this.lastGaspCallback(false); // false = 没有成功闪避
        }
        this.lastGaspCallback = null;
        this.setState(TimeState.IDLE);
      }
    }
    
    // 平滑过渡时间缩放
    const diff = this.targetScale - this.currentScale;
    if (Math.abs(diff) > 0.001) {
      this.currentScale += diff * TIME_CONFIG.TRANSITION_SPEED;
    } else {
      this.currentScale = this.targetScale;
    }
    
    // 更新音乐播放速率（时间越慢音乐越慢且更低沉）
    this.updateMusicRate();

    // 通知监听器
    this.notifyListeners();
  }
  
  /**
   * 获取经过缩放的 delta 时间
   * @param {number} realDelta - 实际 delta (ms)
   * @returns {number} 缩放后的 delta
   */
  getScaledDelta(realDelta) {
    return realDelta * this.currentScale;
  }
  
  /**
   * 设置时间状态
   * @param {string} newState 
   */
  setState(newState) {
    const prevState = this.state;
    this.state = newState;
    
    switch (newState) {
      case TimeState.IDLE:
        this.targetScale = TIME_CONFIG.IDLE_SCALE;
        this.isPlayerActing = false;
        this.applyIdleEffects();
        break;
        
      case TimeState.ACTION:
        this.targetScale = TIME_CONFIG.ACTION_SCALE;
        this.isPlayerActing = true;
        this.applyActionEffects();
        break;
        
      case TimeState.KILL_FREEZE:
        this.targetScale = TIME_CONFIG.KILL_FREEZE_SCALE;
        this.currentScale = TIME_CONFIG.KILL_FREEZE_SCALE; // 立即应用
        this.killFreezeTimer = TIME_CONFIG.KILL_FREEZE_DURATION;
        this.applyKillFreezeEffects();
        break;
        
      case TimeState.LAST_GASP:
        this.targetScale = TIME_CONFIG.LAST_GASP_SCALE;
        this.currentScale = TIME_CONFIG.LAST_GASP_SCALE; // 立即应用
        this.lastGaspTimer = TIME_CONFIG.LAST_GASP_WINDOW;
        this.applyLastGaspEffects();
        break;
        
      case TimeState.SNIPE:
        this.targetScale = TIME_CONFIG.SNIPE_SCALE;
        this.isPlayerActing = false; // 玩家不移动
        this.applySnipeEffects();
        break;
    }
    
    // 触发状态变化事件
    if (this.scene && this.scene.events) {
      this.scene.events.emit('timeStateChanged', { from: prevState, to: newState });
    }
  }
  
  /**
   * 开始玩家行动（移动/攻击）
   */
  startAction() {
    if (this.state === TimeState.LAST_GASP) return; // 决死时刻不能行动
    this.setState(TimeState.ACTION);
  }
  
  /**
   * 结束玩家行动
   */
  endAction() {
    if (this.state === TimeState.ACTION) {
      this.setState(TimeState.IDLE);
    }
  }
  
  /**
   * 开始原地狙击模式
   */
  startSnipe() {
    if (this.state === TimeState.LAST_GASP) return;
    this.setState(TimeState.SNIPE);
  }
  
  /**
   * 结束狙击模式
   */
  endSnipe() {
    if (this.state === TimeState.SNIPE) {
      this.setState(TimeState.IDLE);
    }
  }
  
  /**
   * 触发 Kill Freeze（击杀 Boss 时）
   */
  triggerKillFreeze() {
    this.setState(TimeState.KILL_FREEZE);
  }
  
  /**
   * 触发决死时刻
   * @param {Function} callback - 回调函数，参数为是否成功闪避
   */
  triggerLastGasp(callback) {
    this.lastGaspCallback = callback;
    this.setState(TimeState.LAST_GASP);
  }
  
  /**
   * 决死时刻成功闪避（玩家按下符卡键）
   */
  lastGaspSuccess() {
    if (this.state !== TimeState.LAST_GASP) return;
    
    if (this.lastGaspCallback) {
      this.lastGaspCallback(true); // true = 成功闪避
    }
    this.lastGaspCallback = null;
    this.setState(TimeState.IDLE);
  }
  
  /**
   * 添加监听器
   * @param {Function} callback 
   */
  addListener(callback) {
    this.listeners.push(callback);
  }
  
  /**
   * 移除监听器
   * @param {Function} callback 
   */
  removeListener(callback) {
    const idx = this.listeners.indexOf(callback);
    if (idx !== -1) this.listeners.splice(idx, 1);
  }
  
  /**
   * 通知所有监听器
   */
  notifyListeners() {
    for (const cb of this.listeners) {
      try {
        cb(this.currentScale, this.state);
      } catch (e) {
        console.error('TimeScaleManager listener error:', e);
      }
    }
  }

  /**
   * 根据当前时间缩放调整 BGM 低通与音高（不再改变播放速度）
   */
  updateMusicRate() {
    const sound = AudioManager ? AudioManager.currentSound : null;
    if (!sound) return;

    // 计算目标低通频率：时间越慢，频率越低（典型 200~600Hz）
    const slowFreq = 400;
    const normalFreq = 22000;
    const t = Math.min(1, Math.max(0, this.currentScale));
    const targetFreq = slowFreq + (normalFreq - slowFreq) * t;

    // 优先使用场景的 AudioEffects 接口来设置低通频率（更安全）
    try {
      if (this.scene && this.scene.audioEffects && typeof this.scene.audioEffects.setLowpassFrequency === 'function') {
        this.scene.audioEffects.setLowpassFrequency(targetFreq);
      }
    } catch (e) {}

    // 仅下沉音高（detune），不改变播放速率
    try {
      // 已禁用 detune 调用：若启用可能被 Phaser/浏览器映射为 playbackRate 修改，
      // 导致音乐节奏变慢（我们只希望音色变闷）。保留这里作为注释记录。
      // const detune = Math.max(-1200, (this.currentScale - 1) * 1200);
      // sound.setDetune(detune);
    } catch (e) {}
  }
  
  // ========== 视觉/音频效果 ==========
  
  /**
   * 应用静止状态效果
   */
  applyIdleEffects() {
    if (!this.scene) return;
    
    // 视觉：轻微去饱和 + 晕影
    try {
      if (this.scene.cameras && this.scene.cameras.main) {
        // 使用 Phaser 的后处理（如果支持）
        // 这里通过设置相机色调来模拟
        // this.scene.cameras.main.setTint(0xccccdd);
      }
    } catch (e) {}
    
    // 音频：应用低通滤波效果（如果 AudioManager 支持）
    try {
      if (this.audioEffectsEnabled && this.scene.applyAudioFilter) {
        this.scene.applyAudioFilter('lowpass', { frequency: 800 });
      }
    } catch (e) {}
    
    // 发送效果事件供 UI 处理
    if (this.scene.events) {
      this.scene.events.emit('timeEffects', { 
        type: 'idle',
        saturation: 0.7,
        vignette: 0.3
      });
    }
  }
  
  /**
   * 应用行动状态效果
   */
  applyActionEffects() {
    if (!this.scene) return;
    
    // 视觉：饱和度恢复
    try {
      if (this.scene.cameras && this.scene.cameras.main) {
        // this.scene.cameras.main.clearTint();
      }
    } catch (e) {}
    
    // 音频：移除滤波器
    try {
      if (this.audioEffectsEnabled && this.scene.removeAudioFilter) {
        this.scene.removeAudioFilter();
      }
    } catch (e) {}
    
    // 播放行动音效
    try {
      if (this.scene.sound) {
        // this.scene.sound.play('sfx_whoosh', { volume: 0.3 });
      }
    } catch (e) {}
    
    if (this.scene.events) {
      this.scene.events.emit('timeEffects', {
        type: 'action',
        saturation: 1.2,
        vignette: 0
      });
    }
  }
  
  /**
   * 应用 Kill Freeze 效果
   */
  applyKillFreezeEffects() {
    if (!this.scene) return;
    
    // 视觉：屏幕闪白/反色
    try {
      if (this.scene.cameras && this.scene.cameras.main) {
        this.scene.cameras.main.flash(200, 255, 255, 255);
      }
    } catch (e) {}
    
    if (this.scene.events) {
      this.scene.events.emit('timeEffects', {
        type: 'killFreeze',
        invert: true
      });
    }
  }
  
  /**
   * 应用决死时刻效果
   */
  applyLastGaspEffects() {
    if (!this.scene) return;
    
    // 视觉：屏幕变红
    try {
      if (this.scene.cameras && this.scene.cameras.main) {
        this.scene.cameras.main.flash(100, 255, 0, 0, false);
      }
    } catch (e) {}
    
    if (this.scene.events) {
      this.scene.events.emit('timeEffects', {
        type: 'lastGasp',
        redOverlay: true
      });
      this.scene.events.emit('showMessage', '决死时刻！按符卡键清弹！');
    }
  }
  
  /**
   * 应用狙击模式效果
   */
  applySnipeEffects() {
    if (!this.scene) return;
    
    // 视觉：聚焦效果（可选的边缘模糊）
    if (this.scene.events) {
      this.scene.events.emit('timeEffects', {
        type: 'snipe',
        focus: true
      });
    }
  }
  
  /**
   * 获取当前时间缩放
   */
  getScale() {
    return this.currentScale;
  }
  
  /**
   * 获取当前状态
   */
  getState() {
    return this.state;
  }
  
  /**
   * 是否处于暂停/极慢状态
   */
  isSlowMotion() {
    return this.currentScale < 0.5;
  }
  
  /**
   * 销毁
   */
  destroy() {
    this.listeners = [];
    this.lastGaspCallback = null;
  }
}
