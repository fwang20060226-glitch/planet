// Colors and surface positions sampled from road2.glb, including all four textures.
AFRAME.registerComponent('street-point-cloud', {
  init: function () { this.active = false; this.disposed = false; },
  prepare: function () {
    if (this.loading) return this.loading;
    this.loading = this.loadCloud().catch(error => { this.loading = null; throw error; });
    return this.loading;
  },
  loadCloud: async function () {
    const response = await fetch('road2-points.bin');
    if (!response.ok) throw new Error('Point cloud HTTP ' + response.status);
    const buffer = await response.arrayBuffer();
    const view = new DataView(buffer);
    if (buffer.byteLength < 8 || view.getUint32(0, false) !== 0x50434431) throw new Error('Invalid point cloud');
    const count = view.getUint32(4, true);
    if (buffer.byteLength !== 8 + count * 15) throw new Error('Incomplete point cloud');
    if (this.disposed) throw new Error('Point cloud removed');
    const THREE = AFRAME.THREE;
    const positions = new Float32Array(count * 3), colors = new Float32Array(count * 3);
    const linear = value => { const c = value / 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    for (let i = 0; i < count; i++) {
      const offset = 8 + i * 15;
      for (let axis = 0; axis < 3; axis++) {
        positions[i * 3 + axis] = view.getFloat32(offset + axis * 4, true);
        colors[i * 3 + axis] = linear(view.getUint8(offset + 12 + axis));
      }
    }
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.geometry.computeBoundingSphere();
    this.material = new THREE.PointsMaterial({size: 0.02, vertexColors: true, sizeAttenuation: true, toneMapped: false, fog: true});
    // Crisp circular dots with depth testing; no glow or extra palette tint.
    this.material.onBeforeCompile = shader => {
      shader.fragmentShader = shader.fragmentShader.replace('void main() {',
        'void main() { if (distance(gl_PointCoord, vec2(0.5)) > 0.5) discard;');
    };
    this.material.customProgramCacheKey = () => 'scanned-street-round-points-v1';
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.visible = false;
    this.el.setObject3D('street-points', this.points);
  },
  activate: async function () {
    await this.prepare();
    if (this.disposed) return;
    const mesh = this.el.getObject3D('mesh');
    if (!mesh) throw new Error('Street model is not ready');
    this.points.visible = true;
    mesh.visible = false;
    this.active = true;
  },
  remove: function () {
    this.disposed = true;
    const mesh = this.el.getObject3D('mesh');
    if (mesh) mesh.visible = true;
    this.el.removeObject3D('street-points');
    this.geometry?.dispose(); this.material?.dispose();
  }
});

AFRAME.registerComponent('side-view-guide', {
  init: function () {
    const T = AFRAME.THREE;
    this.player = new T.Vector3(); this.forward = new T.Vector3();
    this.direction = new T.Vector3(); this.right = new T.Vector3();
    this.up = new T.Vector3(0, 1, 0);
    this.sidePosition = new T.Vector3(-4.5, 0.45, 12);
    this.streetFocus = new T.Vector3(-4.5, 0.45, 1);
    this.onSecondStage = () => { this.active = true; };
    this.el.sceneEl.addEventListener('stage-two-start', this.onSecondStage);
  },
  showGuide: function () {
    this.prompted = true;
    const trail = document.querySelector('#road-particle-trail')?.components['road-particles'];
    this.message = trail?.message;
    if (this.message) this.message.textContent = 'Why not try a different angle?\nFollow the golden marker to the side of the street.\nClick and drag the mouse to look around.';
    this.marker = document.createElement('a-entity');
    this.marker.setAttribute('position', '-4.5 -1.25 12');
    // A bright floor ring and downward arrow mark a tested walkable viewpoint.
    const ring = document.createElement('a-ring');
    ring.setAttribute('rotation', '-90 0 0');
    ring.setAttribute('radius-inner', '0.65'); ring.setAttribute('radius-outer', '0.9');
    ring.setAttribute('material', 'shader: flat; color: #FFDC45; side: double; fog: false; depthTest: false');
    ring.setAttribute('animation', 'property: scale; from: 1 1 1; to: 1.3 1.3 1.3; dur: 1100; dir: alternate; loop: true');
    this.marker.appendChild(ring);
    const beam = document.createElement('a-cylinder');
    beam.setAttribute('radius', '0.22');
    beam.setAttribute('height', '3.2');
    beam.setAttribute('position', '0 1.6 0');
    beam.setAttribute('material', 'shader: flat; color: #FFD44F; transparent: true; opacity: 0.28; side: double; fog: false; depthWrite: false');
    beam.setAttribute('animation', 'property: material.opacity; from: 0.18; to: 0.38; dur: 1400; dir: alternate; loop: true');
    this.marker.appendChild(beam);
    const pointer = document.createElement('a-cone');
    pointer.setAttribute('radius-bottom', '0'); pointer.setAttribute('radius-top', '0.4');
    pointer.setAttribute('height', '0.85'); pointer.setAttribute('position', '0 2.1 0');
    pointer.setAttribute('material', 'shader: flat; color: #FFF2AD; fog: false; depthTest: false');
    pointer.setAttribute('animation', 'property: position; from: 0 1.9 0; to: 0 2.45 0; dur: 1100; dir: alternate; loop: true');
    this.marker.appendChild(pointer); this.el.sceneEl.appendChild(this.marker);
    this.hud = document.createElement('div');
    this.hud.style.cssText = 'position:fixed;bottom:8%;left:50%;transform:translateX(-50%);z-index:1001;pointer-events:none;text-align:center;color:#FFE69A;background:rgba(16,33,66,.94);border:1px solid #D8AD50;border-radius:16px;padding:12px 24px;font:18px Arial;box-shadow:0 4px 20px #0008';
    this.arrow = document.createElement('div'); this.arrow.textContent = '↑';
    this.arrow.style.cssText = 'font-size:72px;line-height:1.1;transform-origin:center;text-shadow:0 0 14px rgba(255,214,74,.6);';
    this.label = document.createElement('div'); this.label.textContent = 'SIDE VIEW';
    this.hud.append(this.arrow, this.label); document.body.appendChild(this.hud);
  },
  tick: function () {
    if (!this.active || this.completed) return;
    const camera = document.querySelector('#camera')?.object3D;
    if (!camera) return;
    camera.updateWorldMatrix(true, false); camera.getWorldPosition(this.player);
    // Original particle-route endpoint is X=9; trigger in its final half-unit.
    if (!this.prompted) {
      if (this.player.x < 8.5) return;
      this.showGuide();
    }
    if (!this.atSide && Math.hypot(this.player.x - this.sidePosition.x, this.player.z - this.sidePosition.z) < 0.65) {
      this.atSide = true;
      this.marker.setAttribute('visible', false);
      if (this.message) this.message.textContent = 'Why not try a different angle?\nTurn toward the street and take in the whole view.\nClick and drag the mouse to look around.';
      this.label.textContent = 'LOOK ACROSS THE STREET';
    }
    this.direction.copy(this.atSide ? this.streetFocus : this.sidePosition).sub(this.player);
    this.direction.y = 0; this.direction.normalize();
    this.forward.set(0, 0, -1).transformDirection(camera.matrixWorld); this.forward.y = 0; this.forward.normalize();
    this.right.crossVectors(this.forward, this.up).normalize();
    const angle = Math.atan2(this.direction.dot(this.right), this.direction.dot(this.forward));
    this.arrow.style.transform = 'rotate(' + angle * 180 / Math.PI + 'deg)';
    if (this.atSide && Math.abs(angle) < 0.25) {
      this.completed = true; this.hud.remove();
      if (this.message) this.message.textContent = 'Why not try a different angle?\nTake a moment to look around.\nClick and drag the mouse to change your view.';
      this.el.sceneEl.emit('side-view-reached');
    }
  },
  remove: function () {
    this.el.sceneEl.removeEventListener('stage-two-start', this.onSecondStage);
    this.marker?.remove(); this.hud?.remove();
  }
});
