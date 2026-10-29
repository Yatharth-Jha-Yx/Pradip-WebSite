/* <art-bg> — interactive three.js backgrounds in the artist's two vocabularies.
   mode="grain" (default): woodgrain emboss — the cursor presses into the block.
   mode="stage": wireframe set flats & trusses drifting in studio dark — the cursor is the light. */
(function () {
  const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
  class ArtBg extends HTMLElement {
    connectedCallback() {
      if (this._init) return; this._init = true;
      Object.assign(this.style, { position: 'absolute', inset: '0', display: 'block', pointerEvents: 'none', overflow: 'hidden' });
      import(THREE_URL).then((THREE) => this._start(THREE)).catch(() => {});
    }
    _setup(THREE) {
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      Object.assign(renderer.domElement.style, { position: 'absolute', inset: '0', width: '100%', height: '100%' });
      this.appendChild(renderer.domElement);
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 500);
      const resize = () => {
        const w = this.clientWidth || 2, h = this.clientHeight || 2;
        renderer.setSize(w, h, false);
        camera.aspect = w / h; camera.updateProjectionMatrix();
      };
      resize();
      const ro = new ResizeObserver(resize); ro.observe(this);
      const vis = { on: true };
      const io = new IntersectionObserver((en) => { vis.on = en[0].isIntersecting; });
      io.observe(this);
      const ndc = { x: 0, y: 0, in: false };
      const onMove = (e) => {
        const r = this.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) { ndc.in = false; return; }
        ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
        ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
        ndc.in = true;
      };
      window.addEventListener('pointermove', onMove, { passive: true });
      this._cleanup = () => { if (this._raf) cancelAnimationFrame(this._raf); ro.disconnect(); io.disconnect(); window.removeEventListener('pointermove', onMove); renderer.dispose(); };
      return { renderer, scene, camera, vis, ndc };
    }
    _start(THREE) {
      if (!this.isConnected) return;
      const mode = this.getAttribute('mode') || 'grain';
      if (mode === 'stage') this._stage(THREE); else this._grain(THREE);
    }

    /* ---- GRAIN: the printmaker's block ---- */
    _grain(THREE) {
      const ink = this.getAttribute('ink') || '#191410';
      const accent = this.getAttribute('accent') || '#BF3B1B';
      const baseOpacity = parseFloat(this.getAttribute('opacity') || '0.16');
      const { renderer, scene, camera, vis, ndc } = this._setup(THREE);
      camera.position.set(0, 0, 100);
      const group = new THREE.Group();
      group.rotation.x = -0.55; group.position.y = -6;
      scene.add(group);
      const W = 190, H = 130, LINES = 64, PTS = 110;
      const cInk = new THREE.Color(ink), cAcc = new THREE.Color(accent);
      const knots = [{ x: -52, y: 18, r: 26 }, { x: 38, y: -22, r: 32 }, { x: 8, y: 34, r: 20 }];
      const lines = [];
      for (let i = 0; i < LINES; i++) {
        const y0 = -H / 2 + (H * i) / (LINES - 1);
        const pos = new Float32Array(PTS * 3), col = new Float32Array(PTS * 3);
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
        const accLine = i % 9 === 4;
        const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: baseOpacity * (accLine ? 1.5 : 0.55 + 0.45 * Math.sin(i * 1.7) ** 2) });
        group.add(new THREE.Line(geo, mat));
        group.children[group.children.length - 1].geometry = geo;
        lines.push({ y0, pos, col, geo, accLine });
      }
      const ray = new THREE.Raycaster();
      const planeN = new THREE.Vector3(0, 0, 1).applyQuaternion(group.quaternion);
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(planeN, group.position);
      const v2 = new THREE.Vector2(), hit = new THREE.Vector3(), local = new THREE.Vector3();
      let mx = 9999, my = 9999;
      const tmp = new THREE.Color();
      const tick = (t) => {
        this._raf = requestAnimationFrame(tick);
        if (!vis.on || !this.isConnected) return;
        const tt = t * 0.00035;
        let tx = 9999, ty = 9999;
        if (ndc.in) {
          v2.set(ndc.x, ndc.y); ray.setFromCamera(v2, camera);
          if (ray.ray.intersectPlane(plane, hit)) {
            local.copy(hit).sub(group.position).applyQuaternion(group.quaternion.clone().invert());
            tx = local.x; ty = local.y;
          }
        }
        if (tx < 9000) { mx += (tx - mx) * 0.08; my += (ty - my) * 0.08; } else { my += (9999 - my) * 0.02; }
        for (const L of lines) {
          const { y0, pos, col, geo, accLine } = L;
          for (let j = 0; j < PTS; j++) {
            const x = -W / 2 + (W * j) / (PTS - 1);
            let y = y0, z = 0;
            z += Math.sin(x * 0.055 + tt * 2 + Math.sin(y0 * 0.09) * 2.4) * 3.2;
            z += Math.sin(x * 0.14 - tt * 1.3 + y0 * 0.2) * 1.1;
            for (const k of knots) {
              const dx = x - k.x, dy = y0 - k.y, d = Math.hypot(dx, dy);
              const f = Math.exp(-(d * d) / (k.r * k.r));
              y += (dy / (d + 0.001)) * f * 10;
              z += f * Math.sin(d * 0.5 - tt * 3) * 2.2;
            }
            let glow = 0;
            if (my < 9000) {
              const dx = x - mx, dy = y - my, d2 = dx * dx + dy * dy;
              const f = Math.exp(-d2 / 420);
              z += f * 9; y += (dy / (Math.sqrt(d2) + 0.001)) * f * 4; glow = f;
            }
            const o = j * 3;
            pos[o] = x; pos[o + 1] = y; pos[o + 2] = z;
            tmp.copy(accLine ? cAcc : cInk).lerp(cAcc, glow * (accLine ? 0.2 : 0.9));
            col[o] = tmp.r; col[o + 1] = tmp.g; col[o + 2] = tmp.b;
          }
          geo.attributes.position.needsUpdate = true;
          geo.attributes.color.needsUpdate = true;
        }
        group.rotation.z = Math.sin(tt * 0.7) * 0.015;
        renderer.render(scene, camera);
      };
      this._raf = requestAnimationFrame(tick);
    }

    /* ---- STAGE: the art director's studio floor ---- */
    _stage(THREE) {
      const ink = this.getAttribute('ink') || '#EFE7D4';
      const accent = this.getAttribute('accent') || '#D9A521';
      const baseOpacity = parseFloat(this.getAttribute('opacity') || '0.20');
      const { renderer, scene, camera, vis, ndc } = this._setup(THREE);
      camera.position.set(0, 2, 70);
      const cInk = new THREE.Color(ink), cAcc = new THREE.Color(accent);
      const flats = [];
      const mkFlat = (w, h, door) => {
        const p = [];
        const seg = (a, b) => p.push(a.x, a.y, 0, b.x, b.y, 0);
        const c = (x, y) => ({ x, y });
        seg(c(-w / 2, -h / 2), c(w / 2, -h / 2)); seg(c(w / 2, -h / 2), c(w / 2, h / 2));
        seg(c(w / 2, h / 2), c(-w / 2, h / 2)); seg(c(-w / 2, h / 2), c(-w / 2, -h / 2));
        seg(c(-w / 2, -h / 2), c(w / 2, h / 2)); // cross-brace
        if (door) { const dw = w * 0.32, dh = h * 0.62;
          seg(c(-dw / 2, -h / 2), c(-dw / 2, -h / 2 + dh)); seg(c(dw / 2, -h / 2), c(dw / 2, -h / 2 + dh));
          seg(c(-dw / 2, -h / 2 + dh), c(dw / 2, -h / 2 + dh)); }
        // jack brace (the triangular support behind every flat)
        p.push(w / 2, -h / 2, 0, w / 2, -h / 2, -h * 0.45, w / 2, -h / 2, -h * 0.45, w / 2, h * 0.15, 0);
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(p), 3));
        return geo;
      };
      for (let i = 0; i < 30; i++) {
        const w = 9 + Math.random() * 16, h = 8 + Math.random() * 12;
        const geo = mkFlat(w, h, Math.random() < 0.35);
        const acc = i % 7 === 3;
        const mat = new THREE.LineBasicMaterial({ color: acc ? cAcc : cInk, transparent: true, opacity: 0 });
        const m = new THREE.LineSegments(geo, mat);
        m.userData.acc = acc;
        m.position.set((Math.random() * 2 - 1) * 85, -14 + h / 2 + Math.random() * 26, -95 + Math.random() * 100);
        m.rotation.y = (Math.random() * 2 - 1) * 0.8;
        scene.add(m);
        flats.push({ m, base: baseOpacity * (0.4 + Math.random() * 0.6) * (acc ? 1.6 : 1), speed: 1.6 + Math.random() * 2.4, rs: (Math.random() * 2 - 1) * 0.05 });
      }
      // stage floor grid
      const grid = new THREE.GridHelper(320, 34, cInk, cInk);
      grid.material.transparent = true; grid.material.opacity = baseOpacity * 0.35;
      grid.position.y = -14; scene.add(grid);
      const v3 = new THREE.Vector3();
      const tick = (t) => {
        this._raf = requestAnimationFrame(tick);
        if (!vis.on || !this.isConnected) return;
        const dt = 0.016, tt = t * 0.001;
        camera.position.x += ((ndc.in ? ndc.x * 7 : 0) - camera.position.x) * 0.04;
        camera.position.y += ((ndc.in ? 2 + ndc.y * 4 : 2) - camera.position.y) * 0.04;
        camera.lookAt(0, 0, -30);
        for (const f of flats) {
          f.m.position.z += f.speed * dt;
          f.m.rotation.y += f.rs * dt;
          if (f.m.position.z > 45) { f.m.position.z = -110; f.m.position.x = (Math.random() * 2 - 1) * 85; }
          // depth fade + cursor "spotlight": flats near the pointer ray glow
          const depth = 1 - Math.min(1, Math.abs(f.m.position.z + 40) / 90);
          let spot = 0;
          if (ndc.in) {
            v3.copy(f.m.position).project(camera);
            const dx = v3.x - ndc.x, dy = v3.y - ndc.y;
            spot = Math.exp(-(dx * dx + dy * dy) / 0.12);
          }
          f.m.material.opacity = f.base * (0.25 + 0.75 * depth) + spot * 0.5;
          f.m.material.color.copy(f.m.userData.acc ? cAcc : cInk).lerp(cAcc, spot * 0.85);
        }
        grid.rotation.y = Math.sin(tt * 0.05) * 0.03;
        renderer.render(scene, camera);
      };
      this._raf = requestAnimationFrame(tick);
    }
    disconnectedCallback() { if (this._cleanup) this._cleanup(); this._init = false; }
  }
  if (!customElements.get('art-bg')) customElements.define('art-bg', ArtBg);
})();
