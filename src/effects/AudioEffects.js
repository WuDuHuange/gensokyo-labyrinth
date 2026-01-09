/**
 * 音频效果管理器
 * 
 * 处理 BGM 滤波、心跳声、音效等
 */

export const AUDIO_EFFECTS_CONFIG = {
  // 低通滤波器
  LOWPASS_FREQUENCY_IDLE: 800,    // 静止时低通频率
  LOWPASS_FREQUENCY_ACTION: 20000, // 行动时低通频率（几乎不过滤）
  
  // 心跳
  HEARTBEAT_NORMAL_BPM: 60,
  HEARTBEAT_LOW_HP_BPM: 120,
  HEARTBEAT_VOLUME: 0.3,
  
  // 过渡时间
  FILTER_TRANSITION_MS: 200
};

export default class AudioEffects {
  constructor(scene) {
    this.scene = scene;
    
    // Web Audio API 节点
    this.audioContext = null;
    this.lowpassFilter = null;
    this.gainNode = null;
    
    // 心跳音效
    this.heartbeatSound = null;
    this.heartbeatTimer = null;
    this.heartbeatBPM = AUDIO_EFFECTS_CONFIG.HEARTBEAT_NORMAL_BPM;
    
    // 当前状态
    this.isFiltered = false;
    this.currentVolume = 1.0;
  }
  
  /**
   * 初始化
   */
  init() {
    // 尝试获取 Web Audio API 上下文
    try {
      if (this.scene.sound && this.scene.sound.context) {
        this.audioContext = this.scene.sound.context;
        this.setupAudioNodes();
      }
    } catch (e) {
      console.warn('Web Audio API not available for audio effects');
    }
    
    // 监听时间效果事件
    if (this.scene.events) {
      this.scene.events.on('timeEffects', this.handleTimeEffects, this);
    }
  }
  
  /**
   * 设置音频节点
   */
  setupAudioNodes() {
    if (!this.audioContext) return;
    
    try {
      // 创建低通滤波器
      this.lowpassFilter = this.audioContext.createBiquadFilter();
      this.lowpassFilter.type = 'lowpass';
      this.lowpassFilter.frequency.value = 20000; // 默认不过滤
      this.lowpassFilter.Q.value = 1;

      // 创建增益节点（作为备用回退）
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = 1.0;

      // 尝试将 Phaser Sound Manager 的输出接入我们的滤波器链。
      // Phaser 在 WebAudio 模式下通常暴露 `this.sound.context` 和 `this.sound.masterGainNode` 或 `this.sound.masterGain`.
      // 我们优先使用已存在的 masterGainNode（较新 Phaser 版本），否则尝试查找 manager.masterGainNode 或直接连接到 context.destination。
      const mgr = this.scene && this.scene.sound ? this.scene.sound : null;
      try {
        if (mgr && mgr.context) {
          // 寻找可能存在的 master gain 节点
          const master = mgr.masterGainNode || (mgr.manager && mgr.manager.masterGainNode) || null;
          if (master && typeof master.connect === 'function') {
            // 重新链接：master -> lowpass -> destination
            try { master.disconnect(); } catch (e) {}
            master.connect(this.lowpassFilter);
            this.lowpassFilter.connect(this.audioContext.destination);
            this._connectedMaster = master;
            return;
          }
        }
      } catch (e) {
        // 继续尝试其它安全方式
      }

      // 回退：直接把低通滤波器连接到 context.destination，Phaser 的声音仍然会走默认输出,
      // 但我们保留 setLowpassFrequency 的能力（在某些环境下需额外集成到 Phaser）
      try {
        this.lowpassFilter.connect(this.audioContext.destination);
      } catch (e) {}
    } catch (e) {
      console.warn('Failed to setup audio nodes:', e);
    }
  }
  
  /**
   * 处理时间效果事件
   */
  handleTimeEffects(data) {
    switch (data.type) {
      case 'idle':
        this.applyIdleEffects();
        break;
      case 'action':
        this.applyActionEffects();
        break;
      case 'lastGasp':
        this.applyLastGaspEffects();
        break;
    }
  }
  
  /**
   * 应用静止状态音效
   */
  applyIdleEffects() {
    // 应用低通滤波
    this.setLowpassFrequency(AUDIO_EFFECTS_CONFIG.LOWPASS_FREQUENCY_IDLE);
    
    // 降低音量
    this.setVolume(0.6);
    
    // 启动心跳
    this.startHeartbeat(AUDIO_EFFECTS_CONFIG.HEARTBEAT_NORMAL_BPM);
    
    this.isFiltered = true;
  }
  
  /**
   * 应用行动状态音效
   */
  applyActionEffects() {
    // 移除滤波
    this.setLowpassFrequency(AUDIO_EFFECTS_CONFIG.LOWPASS_FREQUENCY_ACTION);
    
    // 恢复音量
    this.setVolume(1.0);
    
    // 停止心跳
    this.stopHeartbeat();
    
    // 播放动作音效
    this.playActionSound();
    
    this.isFiltered = false;
  }
  
  /**
   * 应用决死时刻音效
   */
  applyLastGaspEffects() {
    // 加速心跳
    this.startHeartbeat(AUDIO_EFFECTS_CONFIG.HEARTBEAT_LOW_HP_BPM);
    
    // 播放警告音
    this.playWarningSound();
  }
  
  /**
   * 设置低通滤波器频率
   */
  setLowpassFrequency(frequency) {
    if (!this.lowpassFilter) return;
    
    try {
      const now = this.audioContext.currentTime;
      this.lowpassFilter.frequency.linearRampToValueAtTime(
        frequency,
        now + AUDIO_EFFECTS_CONFIG.FILTER_TRANSITION_MS / 1000
      );
    } catch (e) {}
  }
  
  /**
   * 设置音量
   */
  setVolume(volume) {
    this.currentVolume = volume;
    
    if (this.gainNode) {
      try {
        const now = this.audioContext.currentTime;
        this.gainNode.gain.linearRampToValueAtTime(
          volume,
          now + AUDIO_EFFECTS_CONFIG.FILTER_TRANSITION_MS / 1000
        );
      } catch (e) {}
    }
    
    // 同时调整 Phaser 音量（如果滤波器不可用）
    try {
      if (this.scene.sound) {
        this.scene.sound.volume = volume;
      }
    } catch (e) {}
  }
  
  /**
   * 启动心跳音效
   */
  startHeartbeat(bpm) {
    this.stopHeartbeat();
    
    this.heartbeatBPM = bpm;
    const interval = 60000 / bpm;
    
    const playBeat = () => {
      try {
        if (this.scene.sound) {
          // 如果有心跳音效资源
          if (this.scene.sound.get('sfx_heartbeat')) {
            this.scene.sound.play('sfx_heartbeat', {
              volume: AUDIO_EFFECTS_CONFIG.HEARTBEAT_VOLUME
            });
          } else {
            // 使用合成的心跳声（低频脉冲）
            this.synthesizeHeartbeat();
          }
        }
      } catch (e) {}
    };
    
    playBeat();
    this.heartbeatTimer = setInterval(playBeat, interval);
  }
  
  /**
   * 停止心跳音效
   */
  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
  
  /**
   * 合成心跳声（如果没有音效资源）
   */
  synthesizeHeartbeat() {
    if (!this.audioContext) return;
    
    try {
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      
      osc.type = 'sine';
      osc.frequency.value = 60;
      
      gain.gain.setValueAtTime(0, this.audioContext.currentTime);
      gain.gain.linearRampToValueAtTime(0.2, this.audioContext.currentTime + 0.05);
      gain.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 0.15);
      
      osc.connect(gain);
      gain.connect(this.audioContext.destination);
      
      osc.start();
      osc.stop(this.audioContext.currentTime + 0.2);
    } catch (e) {}
  }
  
  /**
   * 播放动作音效（咔哒/破风声）
   */
  playActionSound() {
    try {
      if (this.scene.sound && this.scene.sound.get('sfx_whoosh')) {
        this.scene.sound.play('sfx_whoosh', { volume: 0.3 });
      }
    } catch (e) {}
  }
  
  /**
   * 播放警告音
   */
  playWarningSound() {
    try {
      if (this.scene.sound && this.scene.sound.get('sfx_warning')) {
        this.scene.sound.play('sfx_warning', { volume: 0.4 });
      }
    } catch (e) {}
  }
  
  /**
   * 播放擦弹音效
   */
  playGrazeSound() {
    try {
      if (this.scene.sound && this.scene.sound.get('sfx_graze')) {
        this.scene.sound.play('sfx_graze', { volume: 0.3 });
      }
    } catch (e) {}
  }
  
  /**
   * 根据玩家血量调整心跳速度
   */
  updateHeartbeatByHp(currentHp, maxHp) {
    const hpRatio = currentHp / maxHp;
    
    if (hpRatio <= 0.25) {
      this.heartbeatBPM = 140;
    } else if (hpRatio <= 0.5) {
      this.heartbeatBPM = 100;
    } else {
      this.heartbeatBPM = AUDIO_EFFECTS_CONFIG.HEARTBEAT_NORMAL_BPM;
    }
    
    // 如果心跳正在运行，更新频率
    if (this.heartbeatTimer) {
      this.startHeartbeat(this.heartbeatBPM);
    }
  }
  
  /**
   * 销毁
   */
  destroy() {
    this.stopHeartbeat();
    
    if (this.scene.events) {
      this.scene.events.off('timeEffects', this.handleTimeEffects, this);
    }
    
    // 断开音频节点
    try {
      if (this.lowpassFilter) {
        this.lowpassFilter.disconnect();
      }
      if (this.gainNode) {
        this.gainNode.disconnect();
      }
    } catch (e) {}
  }
}
