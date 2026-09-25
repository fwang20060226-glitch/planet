// Preserve A-Frame's movement behavior, but integrate long frames in small steps.
AFRAME.registerComponent('steady-walk', {
  dependencies: ['wasd-controls'],
  init: function () {
    const movement = this.el.components['wasd-controls'];
    this.movement = movement; this.originalTick = movement.tick;
    const original = this.originalTick;
    movement.tick = function (time, delta) {
      if (!this.data.enabled) { this.velocity.set(0, 0, 0); return; }
      let remaining = Math.min(Math.max(delta || 0, 0), 250);
      while (remaining > 0) { const step = Math.min(remaining, 50); original.call(this, time, step); remaining -= step; }
    };
    this.onKey = event => {
      if (!['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.code)) return;
      if (event.type === 'keyup') { delete movement.keys[event.code]; return; }
      if (!movement.data.enabled || event.ctrlKey || event.metaKey || event.altKey || event.target?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName || '')) return;
      movement.keys[event.code] = true;
      event.preventDefault();
    };
    this.clearKeys = () => { movement.keys = {}; movement.velocity.set(0,0,0); };
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKey);
    window.addEventListener('blur', this.clearKeys);
  },
  remove: function () {
    this.movement.tick = this.originalTick;
    window.removeEventListener('keydown', this.onKey); window.removeEventListener('keyup', this.onKey);
    window.removeEventListener('blur', this.clearKeys);
  }
});

// Soft synthesized footsteps; Reverie by Scott Buckley (CC BY 4.0).
AFRAME.registerComponent('walk-audio', {
  init: function () {
    this.position = new AFRAME.THREE.Vector3(); this.previous = new AFRAME.THREE.Vector3();
    this.distance = 0; this.stride = 0.75; this.hasPosition = false; this.muted = false;
    this.unlock = () => {
      try {
        if (!this.context) this.createAudio();
        if (!document.hidden) { this.context.resume().catch(() => {}); this.playMusic(); }
      } catch (error) { console.warn('Audio unavailable:', error.message); }
    };
    this.visibility = () => { this.hasPosition = false; if (document.hidden) { this.music?.pause(); this.context?.suspend().catch(() => {}); } else if (this.context) this.unlock(); };
    this.onThird = () => { this.musicActive = true; this.unlock(); };
    window.addEventListener('pointerdown', this.unlock); window.addEventListener('keydown', this.unlock);
    document.addEventListener('visibilitychange', this.visibility);
    this.el.addEventListener('stage-three-start', this.onThird);
    this.button = document.createElement('button'); this.button.textContent = 'Sound: on';
    this.button.setAttribute('aria-label', 'Mute footsteps and music');
    this.button.style.cssText='position:fixed;bottom:18px;right:85px;z-index:1200;border:1px solid #d9b65e;border-radius:8px;padding:8px 12px;background:#102142e8;color:#fff0c2;cursor:pointer;font:14px Arial';
    this.button.onclick = () => {
      this.unlock(); this.muted = !this.muted;
      if(this.context) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.55,this.context.currentTime,0.08);
      this.button.textContent = this.muted ? 'Sound: off' : 'Sound: on';
      this.button.setAttribute('aria-label',this.muted ? 'Enable footsteps and music' : 'Mute footsteps and music');this.button.blur();
    };
    document.body.appendChild(this.button);
  },
  createAudio: function () {
    this.context = new (window.AudioContext || window.webkitAudioContext)();
    const c=this.context;this.master=c.createGain();this.master.gain.value=this.muted?0:0.55;this.master.connect(c.destination);
    this.noise=c.createBuffer(1,Math.floor(c.sampleRate),c.sampleRate);
    const samples=this.noise.getChannelData(0);for(let i=0;i<samples.length;i++)samples[i]=Math.random()*2-1;
    this.music = new Audio('sb_reverie.mp3'); this.music.loop = true; this.music.preload = 'auto';
    this.musicGain = c.createGain(); this.musicGain.gain.value = 0;
    this.musicSource = c.createMediaElementSource(this.music);
    this.musicSource.connect(this.musicGain); this.musicGain.connect(this.master);
    this.music.addEventListener('playing', () => {
      if (this.musicFadedIn) return;
      this.musicFadedIn = true;
      this.musicGain.gain.setValueAtTime(0, c.currentTime);
      this.musicGain.gain.linearRampToValueAtTime(0.3, c.currentTime + 5);
    });
    this.music.addEventListener('error', () => console.warn('Reverie could not be loaded; walking remains available.'));
  },
  step: function () {
    const c = this.context, t = c.currentTime;
    const strength = 0.85 + Math.random() * 0.3;
    // Soft heel contact followed by a quieter sole brushing the pavement.
    // Filtered noise avoids the pitched, drum-like knock of an oscillator.
    const layers = [
      {delay: 0, duration: 0.23, frequency: 140 + Math.random() * 60, volume: 0.018},
      {delay: 0.05, duration: 0.26, frequency: 380 + Math.random() * 140, volume: 0.012}
    ];
    for (const layer of layers) {
      const source = c.createBufferSource(), filter = c.createBiquadFilter(), gain = c.createGain();
      const start = t + layer.delay;
      source.buffer = this.noise;
      source.playbackRate.value = 0.9 + Math.random() * 0.2;
      filter.type = 'lowpass'; filter.Q.value = 0.55; filter.frequency.value = layer.frequency;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(layer.volume * strength, start + 0.045);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + layer.duration - 0.02);
      gain.gain.linearRampToValueAtTime(0, start + layer.duration);
      source.connect(filter); filter.connect(gain); gain.connect(this.master);
      source.start(start, Math.random() * 0.6); source.stop(start + layer.duration);
      source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
    }
  },
  playMusic: function () {
    if (!this.musicActive || !this.music || document.hidden || !this.music.paused || this.musicPending) return;
    this.musicPending = true;
    this.music.play().catch(() => {
      // If autoplay was blocked, the next click or key retries without blocking movement.
    }).finally(() => { this.musicPending = false; });
  },
  tick: function () {
    const camera=document.querySelector('#camera');if(!camera)return;
    camera.object3D.updateWorldMatrix(true,false);camera.object3D.getWorldPosition(this.position);
    const travelled=this.hasPosition?Math.hypot(this.position.x-this.previous.x,this.position.z-this.previous.z):0;
    this.previous.copy(this.position);this.hasPosition=true;
    const walking=travelled<=1&&camera.getAttribute('wasd-controls').enabled;
    if(!walking)this.distance=0;
    if(!this.context||this.context.state!=='running')return;
    if(walking&&travelled>.001){this.distance+=travelled;if(this.distance>=this.stride){this.distance%=this.stride;this.stride=0.68+Math.random()*0.14;if(!this.muted)this.step();}}

  },
  remove: function () {
    window.removeEventListener('pointerdown',this.unlock);window.removeEventListener('keydown',this.unlock);
    document.removeEventListener('visibilitychange',this.visibility);this.el.removeEventListener('stage-three-start',this.onThird);
    this.music?.pause(); this.music?.removeAttribute('src'); this.music?.load();
    this.musicSource?.disconnect(); this.musicGain?.disconnect();
    this.button?.remove();this.context?.close();
  }
});
