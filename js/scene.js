/* Hourline 3D scene. One WebGL canvas behind the page: the logo with its ring,
   a building that is built by scrolling, and the Proton orb.
   Classic script (works from file://). Needs window.THREE (r158). */
(function () {
  "use strict";
  var THREE = window.THREE;

  var FH = 3.2, LEVELS = 6, TOP = FH * LEVELS, GAP = 3.4, EDGE = 1.5;
  var XS = [-8, -4, 0, 4, 8], ZS = [-6, 0, 6], ZERO = [0, 0, 0];
  var CRANE = { x: 13.5, z: -9.5, h: 27, rot: -2.527 };
  var ATTACH_D = 34;            // distance of the logo and the orb from the camera
  var FOV = 32;
  var SPIN_TOTAL = Math.PI * 2 * 5;

  function mulberry(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function ease(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function xsAt(lv) { return lv >= 4 ? XS.slice(0, 4) : XS; }
  function maxXAt(lv) { return lv >= 4 ? 4 : 8; }

  /* ---------- geometry builders ---------- */

  function Lines() { this.p = []; this.l = []; this.o = []; this.d = []; this.t = []; }
  Lines.prototype.seg = function (ax, ay, az, bx, by, bz, m) {
    m = m || {};
    var o = m.out || ZERO, lv = m.level || 0, d = m.delay || 0, t = m.tint || 0;
    this.p.push(ax, ay, az, bx, by, bz);
    this.l.push(lv, lv);
    this.o.push(o[0], o[1], o[2], o[0], o[1], o[2]);
    this.d.push(d, d);
    this.t.push(t, t);
  };
  Lines.prototype.loop = function (pts, m) {
    for (var i = 0; i < pts.length; i++) {
      var a = pts[i], b = pts[(i + 1) % pts.length];
      this.seg(a[0], a[1], a[2], b[0], b[1], b[2], m);
    }
  };
  Lines.prototype.rectY = function (x0, z0, x1, z1, y, m) {
    this.loop([[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]], m);
  };
  Lines.prototype.box = function (x0, y0, z0, x1, y1, z1, m) {
    this.rectY(x0, z0, x1, z1, y0, m);
    this.rectY(x0, z0, x1, z1, y1, m);
    this.seg(x0, y0, z0, x0, y1, z0, m);
    this.seg(x1, y0, z0, x1, y1, z0, m);
    this.seg(x1, y0, z1, x1, y1, z1, m);
    this.seg(x0, y0, z1, x0, y1, z1, m);
  };

  function Faces() { this.p = []; this.l = []; this.o = []; this.d = []; this.t = []; }
  Faces.prototype.vert = function (v, m) {
    var o = m.out || ZERO;
    this.p.push(v[0], v[1], v[2]);
    this.l.push(m.level || 0);
    this.o.push(o[0], o[1], o[2]);
    this.d.push(m.delay || 0);
    this.t.push(m.tint || 0);
  };
  Faces.prototype.quad = function (a, b, c, d, m) {
    m = m || {};
    this.vert(a, m); this.vert(b, m); this.vert(c, m);
    this.vert(a, m); this.vert(c, m); this.vert(d, m);
  };
  Faces.prototype.tri = function (a, b, c, m) {
    m = m || {};
    this.vert(a, m); this.vert(b, m); this.vert(c, m);
  };
  Faces.prototype.rectY = function (x0, z0, x1, z1, y, m) {
    this.quad([x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1], m);
  };
  Faces.prototype.box = function (x0, y0, z0, x1, y1, z1, m) {
    this.rectY(x0, z0, x1, z1, y0, m);
    this.rectY(x0, z0, x1, z1, y1, m);
    this.quad([x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], m);
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], m);
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], m);
    this.quad([x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], m);
  };

  Lines.prototype.geometry = Faces.prototype.geometry = function () {
    var g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute("aLevel", new THREE.Float32BufferAttribute(this.l, 1));
    g.setAttribute("aOut", new THREE.Float32BufferAttribute(this.o, 3));
    g.setAttribute("aDelay", new THREE.Float32BufferAttribute(this.d, 1));
    g.setAttribute("aTint", new THREE.Float32BufferAttribute(this.t, 1));
    return g;
  };

  // Merges cylinders and spheres into one lit mesh (the logo frame, the orb cage).
  function TubeSet() { this.pos = []; this.nor = []; }
  TubeSet.prototype.add = function (geo, matrix) {
    var g = geo.index ? geo.toNonIndexed() : geo;
    g.applyMatrix4(matrix);
    var p = g.attributes.position.array, n = g.attributes.normal.array, i;
    for (i = 0; i < p.length; i++) { this.pos.push(p[i]); this.nor.push(n[i]); }
    g.dispose(); geo.dispose();
  };
  TubeSet.prototype.tube = function (a, b, r, seg) {
    var dir = new THREE.Vector3().subVectors(b, a), len = dir.length();
    if (len < 1e-5) return;
    var q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    var m = new THREE.Matrix4().compose(new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1));
    this.add(new THREE.CylinderGeometry(r, r, len, seg || 8, 1, true), m);
  };
  TubeSet.prototype.ball = function (p, r) {
    this.add(new THREE.SphereGeometry(r, 10, 8), new THREE.Matrix4().makeTranslation(p.x, p.y, p.z));
  };
  TubeSet.prototype.geometry = function () {
    var g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(this.nor, 3));
    return g;
  };

  function glowTexture(stops) {
    var c = document.createElement("canvas");
    c.width = c.height = 128;
    var ctx = c.getContext("2d");
    var g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    stops.forEach(function (s) { g.addColorStop(s[0], s[1]); });
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }

  /* ---------- shaders ---------- */

  var BUILD_VERT = [
    "attribute float aLevel; attribute vec3 aOut; attribute float aDelay; attribute float aTint;",
    "uniform float uExplode; uniform float uGap; uniform float uFly; uniform float uFlyDist; uniform float uSpread; uniform float uGhost;",
    "varying float vY; varying float vT; varying float vTint; varying float vLevel; varying vec3 vW; varying float vSeed;",
    "void main() {",
    "  float t = clamp(uFly * (1.0 + uSpread) - aDelay * uSpread, 0.0, 1.0);",
    "  float e = 1.0 - pow(1.0 - t, 3.0);",
    "  if (uGhost > 0.0) e = 1.0;",
    "  vec3 p = position + aOut * (1.0 - e) * uFlyDist;",
    "  vec4 wp = modelMatrix * vec4(p, 1.0);",
    "  vY = wp.y; vT = t; vTint = aTint; vLevel = aLevel; vSeed = aDelay;",
    "  wp.y += aLevel * uExplode * uGap;",
    "  vW = wp.xyz;",
    "  gl_Position = projectionMatrix * viewMatrix * wp;",
    "}"
  ].join("\n");

  // The line model. Above the scan line it is either hidden or shown as a faint ghost of the design.
  var BUILD_FRAG = [
    "uniform vec3 uColor; uniform vec3 uAccent; uniform float uOpacity; uniform float uReveal;",
    "uniform float uEdge; uniform float uFocus; uniform float uTintBase; uniform float uGhost; uniform float uBuilt;",
    "varying float vY; varying float vT; varying float vTint; varying float vLevel;",
    "void main() {",
    "  float below = 1.0 - step(uReveal, vY);",
    "  float built = below * vT;",
    "  if (uGhost <= 0.0 && built < 0.002) discard;",
    "  float edge = below * (1.0 - smoothstep(0.0, uEdge, uReveal - vY));",
    "  float tint = max(max(vTint, uTintBase), edge);",
    "  vec3 c = mix(uColor, uAccent, tint);",
    "  float focus = uFocus < -50.0 ? 1.0 : (abs(vLevel - uFocus) < 0.5 ? 1.0 : 0.08);",
    "  float a = uOpacity * focus * mix(uGhost, uBuilt * (1.0 + edge * 1.2), built);",
    "  gl_FragColor = vec4(c, clamp(a, 0.0, 1.0));",
    "}"
  ].join("\n");

  // What has been built: lit concrete, glass that reflects the sky and lights up, and the ground.
  var SOLID_FRAG = [
    "uniform vec3 uColor; uniform vec3 uAccent; uniform float uOpacity; uniform float uReveal; uniform float uEdge; uniform float uFocus;",
    "uniform vec3 uSun; uniform float uGlass; uniform float uLights; uniform float uGroundR;",
    "varying float vY; varying float vT; varying float vLevel; varying vec3 vW; varying float vSeed;",
    "void main() {",
    "  if (vY > uReveal || vT < 0.002) discard;",
    "  vec3 n = normalize(cross(dFdx(vW), dFdy(vW)));",
    "  vec3 v = normalize(cameraPosition - vW);",
    "  if (dot(n, v) < 0.0) n = -n;",
    "  vec3 L = normalize(uSun);",
    "  float dif = max(dot(n, L), 0.0);",
    "  vec3 col; float a = 1.0;",
    "  if (uGlass > 0.5) {",
    "    float fr = pow(1.0 - max(dot(n, v), 0.0), 3.0);",
    "    vec3 r = reflect(-v, n);",
    "    vec3 sky = mix(vec3(0.05, 0.07, 0.11), vec3(0.17, 0.23, 0.36), clamp(r.y * 0.6 + 0.45, 0.0, 1.0));",
    "    float rnd = fract(sin(vSeed * 91.7 + vLevel * 13.1) * 4375.5);",
    "    float lit = step(1.0 - uLights * 0.46, rnd);",
    "    float sp = pow(max(dot(r, L), 0.0), 48.0);",
    "    vec3 warm = mix(vec3(1.0, 0.76, 0.46), vec3(1.0, 0.9, 0.72), fract(rnd * 7.3));",
    "    col = uColor * (0.5 + 0.5 * dif) + sky * (0.3 + fr * 1.1) + vec3(0.9, 0.95, 1.0) * sp * 0.7 + warm * lit * (0.7 + 0.25 * fract(rnd * 3.1));",
    "    a = mix(0.86, 1.0, max(fr, lit));",
    "  } else {",
    "    float hemi = 0.5 + 0.5 * n.y;",
    "    col = uColor * (mix(vec3(0.17, 0.16, 0.16), vec3(0.34, 0.38, 0.46), hemi) + vec3(0.92, 0.95, 1.0) * dif * 0.78);",
    "    if (uGroundR > 0.0) {",
    "      a *= 1.0 - smoothstep(uGroundR * 0.5, uGroundR, length(vW.xz));",
    "      vec2 q = max(abs(vW.xz) - vec2(8.5, 6.5), 0.0);",
    "      col += vec3(1.0, 0.7, 0.38) * exp(-length(q) * 0.4) * 0.2 * uLights;",
    "    }",
    "  }",
    "  float edge = 1.0 - smoothstep(0.0, uEdge, uReveal - vY);",
    "  col = mix(col, uAccent, edge * 0.85);",
    "  float focus = uFocus < -50.0 ? 1.0 : (abs(vLevel - uFocus) < 0.5 ? 1.0 : 0.08);",
    "  gl_FragColor = vec4(col, a * uOpacity * focus * vT);",
    "}"
  ].join("\n");

  var GRID_VERT = [
    "attribute float aMajor; varying float vMajor; varying vec3 vP;",
    "void main() { vMajor = aMajor; vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }"
  ].join("\n");
  var GRID_FRAG = [
    "uniform vec3 uColor; uniform float uOpacity; uniform float uRadius; varying float vMajor; varying vec3 vP;",
    "void main() {",
    "  float f = 1.0 - smoothstep(uRadius * 0.2, uRadius, length(vP.xz));",
    "  gl_FragColor = vec4(uColor, uOpacity * f * mix(0.4, 1.0, vMajor));",
    "}"
  ].join("\n");

  var PULSE_VERT = [
    "attribute float aAlpha; uniform float uSize; uniform float uPx; varying float vA;",
    "void main() { vA = aAlpha; vec4 mv = modelViewMatrix * vec4(position, 1.0);",
    "  gl_PointSize = max(1.0, uSize * uPx / -mv.z); gl_Position = projectionMatrix * mv; }"
  ].join("\n");
  var PULSE_FRAG = [
    "uniform vec3 uColor; uniform float uOpacity; varying float vA;",
    "void main() { float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard;",
    "  gl_FragColor = vec4(uColor, smoothstep(0.5, 0.05, d) * uOpacity * vA); }"
  ].join("\n");

  var RING_VERT = [
    "attribute float aR; attribute float aA; attribute float aY; attribute float aS; attribute float aSeed;",
    "uniform float uTime; uniform float uRadius; uniform float uBurst; uniform vec2 uMouse; uniform float uAspect; uniform float uPx;",
    "varying float vF; varying float vSeed;",
    "void main() {",
    "  float ang = aA + uTime * 0.2 / (aR * sqrt(aR));",
    "  float rr = aR * uRadius * (1.0 + uBurst * (0.5 + aSeed * 1.5));",
    "  vec3 p = vec3(cos(ang) * rr, aY * uRadius * (1.0 + uBurst * 8.0), sin(ang) * rr);",
    "  vec4 mv = modelViewMatrix * vec4(p, 1.0);",
    "  vec4 clip = projectionMatrix * mv;",
    "  vec2 d = clip.xy / clip.w - uMouse;",
    "  d.x *= uAspect;",
    "  float len = max(length(d), 0.0001);",
    "  float f = 1.0 - smoothstep(0.0, 0.36, len);",
    "  f = f * f;",
    "  vec2 dir = d / len;",
    "  dir.x /= uAspect;",
    "  clip.xy += dir * f * 0.17 * clip.w;",
    "  vF = f; vSeed = aSeed;",
    "  gl_PointSize = max(1.0, aS * uPx / -mv.z * (1.0 + f * 1.8));",
    "  gl_Position = clip;",
    "}"
  ].join("\n");
  var RING_FRAG = [
    "uniform vec3 uColor; uniform vec3 uAccent; uniform float uOpacity; uniform float uTime;",
    "varying float vF; varying float vSeed;",
    "void main() {",
    "  float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard;",
    "  float a = smoothstep(0.5, 0.12, d);",
    "  float tw = 0.62 + 0.38 * sin(uTime * (0.8 + vSeed * 2.0) + vSeed * 40.0);",
    "  gl_FragColor = vec4(mix(uColor, uAccent, vF), a * uOpacity * tw * (0.6 + vF * 0.4));",
    "}"
  ].join("\n");

  var CORE_VERT = [
    "varying vec3 vN; varying vec3 vV;",
    "void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);",
    "  gl_Position = projectionMatrix * mv; }"
  ].join("\n");
  var CORE_FRAG = [
    "uniform float uTime; varying vec3 vN; varying vec3 vV;",
    "void main() {",
    "  vec3 n = normalize(vN);",
    "  float fr = pow(1.0 - max(dot(n, vV), 0.0), 2.4);",
    "  vec3 rim = mix(vec3(0.16, 0.42, 1.0), vec3(1.0, 0.2, 0.82), smoothstep(-0.7, 0.7, n.x + n.y * 0.6 + sin(uTime * 0.4) * 0.3));",
    "  vec3 h = normalize(normalize(vec3(-0.45, 0.75, 0.55)) + vV);",
    "  float sp = pow(max(dot(n, h), 0.0), 70.0);",
    "  float sheen = pow(max(dot(n, normalize(vec3(0.5, -0.3, 0.8))), 0.0), 5.0) * 0.1;",
    "  vec3 c = vec3(0.03, 0.018, 0.065) + rim * fr * 0.85 + vec3(0.85, 0.9, 1.0) * sp * 0.7 + vec3(0.3, 0.2, 0.7) * sheen;",
    "  gl_FragColor = vec4(c, 1.0);",
    "}"
  ].join("\n");

  var EYE_VERT = [
    "attribute vec3 aCol; attribute float aPh; varying vec3 vCol; varying float vPh;",
    "void main() { vCol = aCol; vPh = aPh; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }"
  ].join("\n");
  var EYE_FRAG = [
    "uniform float uTime; uniform float uOpacity; uniform float uBoost; varying vec3 vCol; varying float vPh;",
    "void main() { float b = 0.78 + 0.3 * sin(uTime * 2.2 + vPh); gl_FragColor = vec4(vCol * b * (1.0 + uBoost), uOpacity); }"
  ].join("\n");

  /* ---------- scene ---------- */

  function create(canvas, opts) {
    var renderer;
    try {
      THREE.ColorManagement.enabled = false;
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, powerPreference: "low-power" });
    } catch (err) { return null; }
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    renderer.useLegacyLights = true;
    renderer.setClearColor(0x000000, 0);

    var reduce = !!opts.reduceMotion;
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(FOV, 1, 0.5, 600);
    scene.add(camera);
    var world = new THREE.Group();
    scene.add(world);

    var U = {
      line: new THREE.Color(opts.line || "#e9edf3"),
      accent: new THREE.Color(opts.accent || "#ff6a3c"),
      explode: { value: 0 },
      lights: { value: 0 }
    };
    var W = 1, H = 1, aspect = 1, px = 1;
    var G = {};

    function makeMat(o) {
      return new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: U.line }, uAccent: { value: U.accent },
          uOpacity: { value: o.opacity }, uReveal: { value: 1000 }, uEdge: { value: EDGE },
          uFocus: { value: -100 }, uTintBase: { value: o.tint || 0 },
          uExplode: U.explode, uGap: { value: GAP },
          uFly: { value: 1 }, uFlyDist: { value: o.flyDist || 0 }, uSpread: { value: o.spread || 4 },
          uGhost: { value: 0 }, uBuilt: { value: 1 }
        },
        vertexShader: BUILD_VERT, fragmentShader: BUILD_FRAG,
        transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide
      });
    }
    function makeSolid(o) {
      return new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: new THREE.Color(o.color) }, uAccent: { value: U.accent },
          uOpacity: { value: 1 }, uReveal: { value: 1000 }, uEdge: { value: EDGE }, uFocus: { value: -100 },
          uExplode: U.explode, uGap: { value: GAP }, uFly: { value: 1 }, uFlyDist: { value: o.flyDist || 0 }, uSpread: { value: o.spread || 4 },
          uGhost: { value: 0 }, uSun: { value: new THREE.Vector3(-0.55, 0.75, 0.5) }, uGlass: { value: o.glass ? 1 : 0 },
          uLights: U.lights, uGroundR: { value: o.groundR || 0 }
        },
        vertexShader: BUILD_VERT, fragmentShader: SOLID_FRAG, transparent: true, depthTest: true, depthWrite: !o.glass,
        side: THREE.DoubleSide, extensions: { derivatives: true }
      });
    }
    // ghostable: the group belongs to the design model, so its lines can show as a ghost before it is built.
    function reg(name, mode, minY, maxY, ghostable) {
      G[name] = { objs: [], mats: [], mode: mode, minY: minY, maxY: maxY, dim: 1, dimTar: 1, ghostable: !!ghostable };
      return G[name];
    }
    function addLines(g, builder, o) {
      var m = makeMat(o), obj = new THREE.LineSegments(builder.geometry(), m);
      obj.frustumCulled = false; obj.renderOrder = 2;
      g.objs.push(obj); g.mats.push({ m: m, base: o.opacity, keep: o.keep === undefined ? 1 : o.keep, obj: obj });
      (o.parent || world).add(obj);
      return obj;
    }
    function addFaces(g, builder, o) {
      var m = makeMat(o), obj = new THREE.Mesh(builder.geometry(), m);
      obj.frustumCulled = false; obj.renderOrder = 1;
      g.objs.push(obj); g.mats.push({ m: m, base: o.opacity, keep: o.keep === undefined ? 1 : o.keep, obj: obj });
      (o.parent || world).add(obj);
      return obj;
    }

    function addSolid(g, builder, o) {
      var m = makeSolid(o), obj = new THREE.Mesh(builder.geometry(), m);
      obj.frustumCulled = false; obj.renderOrder = o.glass ? -1 : (o.groundR ? -3 : -2);
      g.objs.push(obj); g.mats.push({ m: m, base: 1, solid: true, obj: obj });
      (o.parent || world).add(obj);
      return obj;
    }

    /* ground grid */
    var gridMat = (function () {
      var p = [], mj = [], S = 96, i;
      for (i = -S; i <= S; i += 4) {
        var major = i % 16 === 0 ? 1 : 0;
        p.push(-S, 0, i, S, 0, i, i, 0, -S, i, 0, S);
        mj.push(major, major, major, major);
      }
      var g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
      g.setAttribute("aMajor", new THREE.Float32BufferAttribute(mj, 1));
      var m = new THREE.ShaderMaterial({
        uniforms: { uColor: { value: U.line }, uOpacity: { value: 0 }, uRadius: { value: 90 } },
        vertexShader: GRID_VERT, fragmentShader: GRID_FRAG, transparent: true, depthTest: false, depthWrite: false
      });
      var obj = new THREE.LineSegments(g, m);
      obj.renderOrder = 0;
      world.add(obj);
      m.userData.obj = obj;
      return m;
    })();

    /* neighbouring buildings behind the site */
    (function () {
      var r = mulberry(11), L = new Lines(), F = new Faces(), placed = [], n = 0, guard = 0;
      while (n < 15 && guard++ < 500) {
        var a = 1.95 + r() * 3.0, d = 38 + r() * 34;
        var cx = Math.sin(a) * d, cz = Math.cos(a) * d;
        var w = 8 + r() * 10, dp = 8 + r() * 10, h = (3 + Math.floor(r() * 8)) * FH;
        if (Math.hypot(cx - CRANE.x, cz - CRANE.z) < 18) continue;
        var clash = placed.some(function (b) { return Math.hypot(cx - b[0], cz - b[1]) < 16; });
        if (clash) continue;
        placed.push([cx, cz]);
        L.box(cx - w / 2, 0, cz - dp / 2, cx + w / 2, h, cz + dp / 2);
        for (var y = FH * 2; y < h - 0.1; y += FH * 2) L.rectY(cx - w / 2, cz - dp / 2, cx + w / 2, cz + dp / 2, y);
        F.box(cx - w / 2, 0, cz - dp / 2, cx + w / 2, h, cz + dp / 2);
        n++;
      }
      var g = reg("context", "reveal", 0, 11 * FH);
      addFaces(g, F, { opacity: 0.022 });
      addLines(g, L, { opacity: 0.26 });
    })();

    /* foundation */
    (function () {
      var L = new Lines(), F = new Faces(), S = new Faces(), m = { level: -1 };
      XS.forEach(function (x) {
        ZS.forEach(function (z) {
          L.box(x - 0.9, -1, z - 0.9, x + 0.9, 0, z + 0.9, m);
          L.seg(x - 0.4, -1, z, x - 0.4, -5.5, z, m);
          L.seg(x + 0.4, -1, z, x + 0.4, -5.5, z, m);
          L.seg(x - 0.4, -5.5, z, x + 0.4, -5.5, z, m);
          S.box(x - 0.9, -1, z - 0.9, x + 0.9, -0.36, z + 0.9, m);
          S.box(x - 0.62, -5.5, z - 0.22, x - 0.18, -1, z + 0.22, m);
          S.box(x + 0.18, -5.5, z - 0.22, x + 0.62, -1, z + 0.22, m);
        });
      });
      ZS.forEach(function (z) { L.seg(-8, -0.5, z, 8, -0.5, z, m); });
      XS.forEach(function (x) { L.seg(x, -0.5, -6, x, -0.5, 6, m); });
      L.rectY(-8.6, -6.6, 8.6, 6.6, 0, m);
      L.rectY(-8.6, -6.6, 8.6, 6.6, -0.35, m);
      F.rectY(-8.6, -6.6, 8.6, 6.6, 0, m);
      S.box(-8.6, -0.35, -6.6, 8.6, 0, 6.6, m);
      var g = reg("found", "reveal", -5.6, 0.1, true);
      addSolid(g, S, { color: 0x7f8388 });
      addFaces(g, F, { opacity: 0.05, keep: 0 });
      addLines(g, L, { opacity: 0.8, keep: 0.3 });
    })();

    /* the profit floor: an accent slab with section hatching at +0.00 */
    (function () {
      var L = new Lines(), F = new Faces(), m = { tint: 1 };
      var x0 = -8.6, x1 = 8.6, z0 = -6.6, z1 = 6.6, y = 0.06, c;
      F.rectY(x0, z0, x1, z1, y, m);
      L.rectY(x0, z0, x1, z1, y, m);
      L.rectY(x0 - 0.5, z0 - 0.5, x1 + 0.5, z1 + 0.5, y, m);
      for (c = x0 + z0 + 1.6; c < x1 + z1; c += 1.6) {
        var xa = Math.max(x0, c - z1), xb = Math.min(x1, c - z0);
        L.seg(xa, y, c - xa, xb, y, c - xb, m);
      }
      var g = reg("floor", "fade", 0, 0);
      addFaces(g, F, { opacity: 0.16 });
      addLines(g, L, { opacity: 0.6 });
    })();

    /* structure: columns, beams and the core */
    (function () {
      var L = new Lines(), S = new Faces(), C = new Faces(), lv;
      for (lv = 0; lv < LEVELS; lv++) {
        var y0 = lv * FH, y1 = y0 + FH, xs = xsAt(lv), m = { level: lv };
        xs.forEach(function (x) {
          ZS.forEach(function (z) { L.seg(x, y0, z, x, y1, z, m); S.box(x - 0.24, y0, z - 0.24, x + 0.24, y1 - 0.28, z + 0.24, m); });
        });
        ZS.forEach(function (z) {
          L.seg(xs[0], y1, z, xs[xs.length - 1], y1, z, m);
          S.box(xs[0], y1 - 0.75, z - 0.16, xs[xs.length - 1], y1 - 0.28, z + 0.16, m);
        });
        xs.forEach(function (x) {
          L.seg(x, y1, -6, x, y1, 6, m);
          S.box(x - 0.16, y1 - 0.75, -6, x + 0.16, y1 - 0.28, 6, m);
        });
        L.box(-2, y0, -6, 2, y1, -2.5, m);
        L.seg(-2, y0, -2.5, 2, y1, -2.5, m);
        L.seg(2, y0, -2.5, -2, y1, -2.5, m);
        C.box(-2, y0, -6, 2, y1 - 0.28, -2.5, m);
      }
      var g = reg("struct", "reveal", 0, TOP, true);
      addSolid(g, S, { color: 0x9a9fa5 });
      addSolid(g, C, { color: 0x7d8288 });
      addLines(g, L, { opacity: 0.85, keep: 0.1 });
    })();

    /* floor plates, sliding in from the sides */
    (function () {
      var L = new Lines(), F = new Faces(), S = new Faces(), i;
      for (i = 1; i <= LEVELS; i++) {
        var y = i * FH, mx = i <= 4 ? 8 : 4;
        var m = { level: i, out: [i % 2 ? 1 : -1, 0, 0], delay: (i - 1) / (LEVELS - 1) };
        F.rectY(-8.25, -6.25, mx + 0.25, 6.25, y, m);
        L.rectY(-8.25, -6.25, mx + 0.25, 6.25, y, m);
        L.rectY(-8.25, -6.25, mx + 0.25, 6.25, y - 0.28, m);
        S.box(-8.25, y - 0.28, -6.25, mx + 0.25, y, 6.25, m);
      }
      var g = reg("slabs", "fly", 0, TOP, true);
      addSolid(g, S, { color: 0xb1b6bb, flyDist: 16, spread: 3 });
      addFaces(g, F, { opacity: 0.07, flyDist: 16, spread: 3, keep: 0 });
      addLines(g, L, { opacity: 0.55, flyDist: 16, spread: 3, keep: 0.22 });
    })();

    /* work blocks on the plates: a logged day drawn as a floor plan */
    (function () {
      var r = mulberry(23), L = new Lines(), F = new Faces(), i;
      for (i = 1; i <= 5; i++) {
        var y = i * FH + 0.03, end = (i <= 3 ? 8 : 4) - 0.7;
        [[0.9, 2.5], [3.5, 5.2]].forEach(function (lane) {
          var x = -7.4;
          while (x < end - 1.2) {
            var len = Math.min(1.6 + r() * 3.4, end - x), roll = r();
            var m = { level: i, out: [0, 1, 0], delay: clamp((i - 1) / 5 + r() * 0.18, 0, 1), tint: roll < 0.2 ? 1 : (roll < 0.5 ? 0.42 : 0) };
            F.box(x, y, lane[0], x + len, y + 0.42, lane[1], m);
            L.box(x, y, lane[0], x + len, y + 0.42, lane[1], m);
            x += len + 0.5;
          }
        });
      }
      var g = reg("blocks", "fly", 0, TOP);
      addFaces(g, F, { opacity: 0.4, flyDist: 6, spread: 3 });
      addLines(g, L, { opacity: 0.85, flyDist: 6, spread: 3 });
    })();

    /* scaffolding on the east face */
    (function () {
      var L = new Lines(), xa = 8.8, xb = 10, top = 12.8, z, y, k = 0;
      for (z = -6; z <= 6.01; z += 2) {
        L.seg(xa, 0, z, xa, top + 1, z);
        L.seg(xb, 0, z, xb, top + 1, z);
        for (y = 2; y <= top + 0.01; y += 2.16) L.seg(xa, y, z, xb, y, z);
      }
      for (y = 2; y <= top + 0.01; y += 2.16) {
        L.seg(xa, y, -6, xa, y, 6);
        L.seg(xb, y, -6, xb, y, 6);
        L.seg(xb, y + 1, -6, xb, y + 1, 6);
      }
      for (z = -6; z < 5.9; z += 2) {
        for (y = 0; y < top - 0.1; y += 2.16) {
          if ((k++ + Math.round(y)) % 2 === 0) L.seg(xb, y, z, xb, y + 2.16, z + 2);
        }
      }
      addLines(reg("scaffold", "reveal", 0, top + 1), L, { opacity: 0.4 });
    })();

    /* tower crane */
    var jib = new THREE.Group(), loadObj, cableGeo;
    (function () {
      var g = reg("crane", "reveal", 0, CRANE.h + 6.5), o = { opacity: 0.95, tint: 1 };
      var mast = new THREE.Group();
      mast.position.set(CRANE.x, 0, CRANE.z);
      world.add(mast);
      var L = new Lines(), s = 0.8, y, i, c = [[-s, -s], [s, -s], [s, s], [-s, s]];
      c.forEach(function (p) { L.seg(p[0], 0, p[1], p[0], CRANE.h, p[1]); });
      for (y = 0, i = 0; y < CRANE.h - 0.1; y += 1.8, i++) {
        var y1 = Math.min(y + 1.8, CRANE.h);
        L.rectY(-s, -s, s, s, y1);
        for (var f = 0; f < 4; f++) {
          var a = c[f], b = c[(f + 1) % 4];
          if (i % 2 === 0) L.seg(a[0], y, a[1], b[0], y1, b[1]); else L.seg(b[0], y, b[1], a[0], y1, a[1]);
        }
      }
      L.seg(-2.6, 0, -2.6, 2.6, 0, 2.6); L.seg(-2.6, 0, 2.6, 2.6, 0, -2.6);
      L.rectY(-2.6, -2.6, 2.6, 2.6, 0);
      addLines(g, L, { opacity: o.opacity, tint: 1, parent: mast });

      jib.position.set(0, CRANE.h, 0);
      mast.add(jib);
      var J = new Lines(), LEN = 22, x;
      J.seg(0, 0, -0.7, LEN, 0, -0.7); J.seg(0, 0, 0.7, LEN, 0, 0.7);
      J.seg(0, 1.5, 0, LEN, 0.35, 0);
      J.seg(LEN, 0, -0.7, LEN, 0, 0.7); J.seg(LEN, 0, -0.7, LEN, 0.35, 0); J.seg(LEN, 0, 0.7, LEN, 0.35, 0);
      for (x = 0, i = 0; x < LEN - 0.1; x += 2, i++) {
        var ty = 1.5 - (1.15 * (x + 1)) / LEN;
        J.seg(x, 0, -0.7, x + 1, ty, 0); J.seg(x + 1, ty, 0, x + 2, 0, -0.7);
        J.seg(x, 0, 0.7, x + 1, ty, 0); J.seg(x + 1, ty, 0, x + 2, 0, 0.7);
        J.seg(x, 0, -0.7, x, 0, 0.7);
      }
      J.seg(0, 0, -0.7, -7.5, 0, -0.7); J.seg(0, 0, 0.7, -7.5, 0, 0.7); J.seg(-7.5, 0, -0.7, -7.5, 0, 0.7);
      J.box(-7.5, -1.7, -0.8, -5.2, 0, 0.8);
      J.seg(-0.8, 0, 0, 0, 5.6, 0); J.seg(0.8, 0, 0, 0, 5.6, 0);
      J.seg(0, 5.6, 0, LEN * 0.62, 0.75, 0); J.seg(0, 5.6, 0, -7, 0, 0);
      J.box(0.9, -1.9, 0.9, 2.5, -0.1, 2.3);
      addLines(g, J, { opacity: o.opacity, tint: 1, parent: jib });

      var B = new Lines();
      B.box(-1, -0.14, -1, 1, 0.14, 1);
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (p) { B.seg(p[0], 0.14, p[1], 0, 1.7, 0); });
      loadObj = addLines(g, B, { opacity: o.opacity, tint: 1, parent: jib });

      var C = new Lines();
      C.seg(12, 0, 0, 12, -10, 0);
      var cable = addLines(g, C, { opacity: o.opacity, tint: 1, parent: jib });
      cableGeo = cable.geometry;
    })();

    /* services: risers and runs through every floor */
    var servicePaths = [];
    (function () {
      var L = new Lines(), lv;
      [[-6, 2, TOP], [2, 2, TOP], [6, 2, 12.8]].forEach(function (rs) {
        for (lv = 0; lv * FH < rs[2] - 0.1; lv++) L.seg(rs[0], lv * FH, rs[1], rs[0], (lv + 1) * FH, rs[1], { level: lv });
        servicePaths.push([[rs[0], 0, rs[1]], [rs[0], rs[2], rs[1]]]);
      });
      for (lv = 0; lv < LEVELS; lv++) {
        var y = lv * FH + 2.7, mx = maxXAt(lv) - 0.6, m = { level: lv };
        L.seg(-7.4, y, 2, mx, y, 2, m);
        servicePaths.push([[-6, y, 2], [mx, y, 2]]);
        [-6, -2, 2, 6].forEach(function (x) {
          if (x > mx) return;
          var zs = Math.abs(x) <= 2 ? -2 : -5.4;
          L.seg(x, y, zs, x, y, 5.4, m);
          servicePaths.push([[x, y, 2], [x, y, x % 4 === 0 ? 5.4 : zs]]);
        });
      }
      addLines(reg("services", "reveal", 0, TOP), L, { opacity: 0.85, tint: 1 });
    })();

    function Pulses(paths, n, seed, size) {
      var r = mulberry(seed), i;
      this.paths = paths; this.items = [];
      for (i = 0; i < n; i++) this.items.push({ p: Math.floor(r() * paths.length), ph: r(), sp: 1.6 + r() * 2.2 });
      this.pos = new Float32Array(n * 3); this.alpha = new Float32Array(n);
      var g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
      g.setAttribute("aAlpha", new THREE.BufferAttribute(this.alpha, 1));
      this.mat = new THREE.ShaderMaterial({
        uniforms: { uColor: { value: U.accent }, uOpacity: { value: 0 }, uSize: { value: size }, uPx: { value: 1 } },
        vertexShader: PULSE_VERT, fragmentShader: PULSE_FRAG, transparent: true, depthTest: false, depthWrite: false
      });
      this.obj = new THREE.Points(g, this.mat);
      this.obj.frustumCulled = false; this.obj.renderOrder = 3;
      world.add(this.obj);
    }
    Pulses.prototype.update = function (t) {
      for (var i = 0; i < this.items.length; i++) {
        var it = this.items[i], path = this.paths[it.p], a = path[0], b = path[1];
        var len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) || 1;
        var u = (it.ph + t * it.sp / len) % 1;
        this.pos[i * 3] = a[0] + (b[0] - a[0]) * u;
        this.pos[i * 3 + 1] = a[1] + (b[1] - a[1]) * u;
        this.pos[i * 3 + 2] = a[2] + (b[2] - a[2]) * u;
        this.alpha[i] = Math.sin(u * Math.PI);
      }
      this.obj.geometry.attributes.position.needsUpdate = true;
      this.obj.geometry.attributes.aAlpha.needsUpdate = true;
    };
    var pulses = new Pulses(servicePaths, 44, 5, 0.55);

    /* envelope: curtain-wall panels that fly in, lowest floors first */
    (function () {
      var r = mulberry(31), L = new Lines(), F = new Faces(), GL = new Faces(), lv, k;
      function panel(a, b, out, lvl) {
        // a, b: bottom corners (x, z) of one bay on the frame line
        var y0 = lvl * FH + 0.14, y1 = (lvl + 1) * FH - 0.1, off = 0.16;
        var ax = a[0] + out[0] * off, az = a[1] + out[2] * off, bx = b[0] + out[0] * off, bz = b[1] + out[2] * off;
        var dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz), ux = dx / len, uz = dz / len, ins = 0.12;
        ax += ux * ins; az += uz * ins; bx -= ux * ins; bz -= uz * ins;
        var m = { level: lvl, out: out, delay: clamp((lvl + r() * 0.85) / (LEVELS - 0.1), 0, 1) };
        F.quad([ax, y0, az], [bx, y0, bz], [bx, y1, bz], [ax, y1, az], m);
        GL.quad([ax, y0, az], [bx, y0, bz], [bx, y1, bz], [ax, y1, az], m);
        L.loop([[ax, y0, az], [bx, y0, bz], [bx, y1, bz], [ax, y1, az]], m);
        var mxx = (ax + bx) / 2, mz = (az + bz) / 2;
        L.seg(mxx, y0, mz, mxx, y1, mz, m);
        L.seg(ax, y0 + 0.95, az, bx, y0 + 0.95, bz, m);
      }
      for (lv = 0; lv < LEVELS; lv++) {
        var xs = xsAt(lv), mx = maxXAt(lv);
        for (k = 0; k < xs.length - 1; k++) {
          panel([xs[k], 6], [xs[k + 1], 6], [0, 0, 1], lv);
          panel([xs[k], -6], [xs[k + 1], -6], [0, 0, -1], lv);
        }
        for (k = 0; k < ZS.length - 1; k++) {
          panel([-8, ZS[k]], [-8, ZS[k + 1]], [-1, 0, 0], lv);
          panel([mx, ZS[k]], [mx, ZS[k + 1]], [1, 0, 0], lv);
        }
      }
      var g = reg("facade", "fly", 0, TOP, true);
      addSolid(g, GL, { color: 0x0c1826, glass: true, flyDist: 10, spread: 4 });
      addFaces(g, F, { opacity: 0.085, flyDist: 10, spread: 4, keep: 0 });
      addLines(g, L, { opacity: 0.5, flyDist: 10, spread: 4, keep: 0.3 });
    })();

    /* roof */
    (function () {
      var L = new Lines(), S = new Faces(), m = { level: 6 }, t4 = { level: 4 };
      L.box(-8.35, TOP, -6.35, 4.35, TOP + 0.9, 6.35, m);
      L.box(-6.2, TOP, -1.2, -3.4, TOP + 1.6, 1.6, m);
      L.box(0.4, TOP, 2.2, 2.8, TOP + 1.1, 4.6, m);
      L.box(-2, TOP, -6, 2, TOP + 2.4, -2.5, m);
      L.seg(-2, TOP + 2.4, -4.2, -2, TOP + 5.4, -4.2, m);
      L.loop([[4.35, 13.8, -6.3], [8.3, 13.8, -6.3], [8.3, 13.8, 6.3], [4.35, 13.8, 6.3]], t4);
      [[8.3, -6.3], [8.3, 0], [8.3, 6.3], [6.3, -6.3], [6.3, 6.3]].forEach(function (p) { L.seg(p[0], 12.8, p[1], p[0], 13.8, p[1], t4); });
      S.box(-8.35, TOP, -6.35, 4.35, TOP + 0.9, -6.15, m);
      S.box(-8.35, TOP, 6.15, 4.35, TOP + 0.9, 6.35, m);
      S.box(-8.35, TOP, -6.35, -8.15, TOP + 0.9, 6.35, m);
      S.box(4.15, TOP, -6.35, 4.35, TOP + 0.9, 6.35, m);
      S.box(-6.2, TOP, -1.2, -3.4, TOP + 1.6, 1.6, m);
      S.box(0.4, TOP, 2.2, 2.8, TOP + 1.1, 4.6, m);
      S.box(-2, TOP, -6, 2, TOP + 2.4, -2.5, m);
      S.box(8.12, 12.8, -6.3, 8.3, 13.8, 6.3, t4);
      S.box(4.35, 12.8, -6.3, 8.3, 13.8, -6.12, t4);
      S.box(4.35, 12.8, 6.12, 8.3, 13.8, 6.3, t4);
      var g = reg("roof", "reveal", 12.8, TOP + 5.5, true);
      addSolid(g, S, { color: 0x8c9197 });
      addLines(g, L, { opacity: 0.75, keep: 0.3 });
    })();

    /* the finished site: ground, paths and trees */
    (function () {
      var r = mulberry(61), GR = new Faces(), P = new Faces(), T = new Faces();
      GR.rectY(-48, -48, 48, 48, 0.02);
      P.rectY(-3, 6.6, 3, 21, 0.05);
      P.rectY(-13, 12.4, 13, 13.6, 0.05);
      var ico = new THREE.IcosahedronGeometry(1, 0).toNonIndexed().attributes.position.array;
      [[-13, 9.5], [-15.5, 2], [-13, -8], [13, 10.5], [16.5, 3.5], [-6.5, 16], [7.5, 16.5], [-17.5, 14], [18.5, 15]].forEach(function (p) {
        var h = 4.6 + r() * 2.6, rad = h * 0.34, cy = h * 0.66, i;
        P.box(p[0] - 0.14, 0, p[1] - 0.14, p[0] + 0.14, h * 0.45, p[1] + 0.14);
        for (i = 0; i < ico.length; i += 9) {
          T.tri([p[0] + ico[i] * rad, cy + ico[i + 1] * rad * 1.2, p[1] + ico[i + 2] * rad],
            [p[0] + ico[i + 3] * rad, cy + ico[i + 4] * rad * 1.2, p[1] + ico[i + 5] * rad],
            [p[0] + ico[i + 6] * rad, cy + ico[i + 7] * rad * 1.2, p[1] + ico[i + 8] * rad]);
        }
      });
      var g = reg("land", "reveal", 0, 9.5);
      addSolid(g, GR, { color: 0x15191a, groundR: 46 });
      addSolid(g, P, { color: 0x3c4046 });
      addSolid(g, T, { color: 0x2a5741 });
    })();

    /* dimension lines */
    (function () {
      var L = new Lines(), x = -10.8, z = 6.8, i;
      L.seg(x, 0, z, x, TOP, z);
      for (i = 0; i <= LEVELS; i++) {
        var y = i * FH;
        L.seg(x - 0.5, y, z, x + 0.5, y, z);
        L.seg(x - 0.3, y - 0.3, z, x + 0.3, y + 0.3, z);
        L.seg(x + 0.9, y, z, -8.5, y, 6.3);
      }
      L.seg(-8, 0, 8.8, 8, 0, 8.8);
      XS.forEach(function (gx) { L.seg(gx, 0, 8.3, gx, 0, 9.3); L.seg(gx - 0.25, 0, 9.05, gx + 0.25, 0, 8.55); });
      addLines(reg("dims", "fade", 0, TOP), L, { opacity: 0.5 });
    })();

    /* Proton's light on the roof */
    var beacon = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture([[0, "rgba(255,255,255,1)"], [0.18, "rgba(255,90,215,0.95)"], [0.5, "rgba(70,150,255,0.4)"], [1, "rgba(60,120,255,0)"]]),
      transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending
    }));
    beacon.renderOrder = 4;
    world.add(beacon);

    /* ---------- logo with its ring (attached to the camera) ---------- */

    var logoGroup = new THREE.Group(), logoSpin = new THREE.Group(), logoMat, ringMat, ringTilt = new THREE.Group();
    camera.add(logoGroup);
    logoGroup.add(logoSpin);
    (function () {
      // The logo is a flat line drawing: one closed outline with no depth, no faces and no shading.
      // Thin round strokes keep the line the same weight at every angle of the opening spin.
      var s = 6 / 99, rad = 0.05, T = new TubeSet();
      function P(pt) { return new THREE.Vector3((pt[0] - 91.5) * s, (67.5 - pt[1]) * s, 0); }
      var outline = [[42, 57], [80, 18], [101, 18], [101, 117], [120, 117], [141, 96], [141, 58], [122, 58], [62, 117], [42, 97]];
      outline.forEach(function (a, i) {
        T.tube(P(a), P(outline[(i + 1) % outline.length]), rad, 10);
        T.ball(P(a), rad);
      });
      logoMat = new THREE.MeshBasicMaterial({ color: 0xf4f6fa, transparent: true });
      logoSpin.add(new THREE.Mesh(T.geometry(), logoMat));

      var r = mulberry(77), N = 3000, aR = new Float32Array(N), aA = new Float32Array(N), aY = new Float32Array(N),
        aS = new Float32Array(N), aSeed = new Float32Array(N), i;
      for (i = 0; i < N; i++) {
        var band = r();
        aR[i] = band < 0.58 ? 1.22 + Math.pow(r(), 0.8) * 0.4 : (band < 0.94 ? 1.72 + r() * 0.36 : 2.14 + r() * 0.3);
        aA[i] = r() * Math.PI * 2;
        aY[i] = (r() + r() + r() - 1.5) * 0.03;
        aS[i] = 0.045 + Math.pow(r(), 4) * 0.2;
        aSeed[i] = r();
      }
      var g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(N * 3), 3));
      g.setAttribute("aR", new THREE.BufferAttribute(aR, 1));
      g.setAttribute("aA", new THREE.BufferAttribute(aA, 1));
      g.setAttribute("aY", new THREE.BufferAttribute(aY, 1));
      g.setAttribute("aS", new THREE.BufferAttribute(aS, 1));
      g.setAttribute("aSeed", new THREE.BufferAttribute(aSeed, 1));
      ringMat = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 }, uRadius: { value: 4.7 }, uBurst: { value: 0 }, uMouse: { value: new THREE.Vector2(9, 9) },
          uAspect: { value: 1 }, uPx: { value: 1 }, uOpacity: { value: 0 }, uColor: { value: U.line }, uAccent: { value: U.accent }
        },
        vertexShader: RING_VERT, fragmentShader: RING_FRAG, transparent: true, depthWrite: false
      });
      var pts = new THREE.Points(g, ringMat);
      pts.frustumCulled = false;
      ringTilt.rotation.set(0.3, 0, 0.17);
      ringTilt.add(pts);
      logoGroup.add(ringTilt);
    })();

    /* ---------- Proton orb (attached to the camera) ---------- */

    var proton = new THREE.Group(), eye = new THREE.Group(), eyeRings = [], cage, orbitA, orbitB, bits = [],
      coreMat, eyeMat, eyeGlow, look = { x: 0, y: 0 };
    camera.add(proton);
    (function () {
      var R = 3.2, r = mulberry(9);
      coreMat = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 } }, vertexShader: CORE_VERT, fragmentShader: CORE_FRAG });
      proton.add(new THREE.Mesh(new THREE.SphereGeometry(R, 56, 36), coreMat));

      eyeMat = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uOpacity: { value: 1 }, uBoost: { value: 0 } },
        vertexShader: EYE_VERT, fragmentShader: EYE_FRAG, transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide
      });
      var cyan = new THREE.Color(0x35d8ff), magenta = new THREE.Color(0xff45d4), tmp = new THREE.Color(), RS = R + 0.08;
      [{ rad: 0.92, n: 2, w: 0.2 }, { rad: 1.42, n: 3, w: 0.21 }, { rad: 1.94, n: 4, w: 0.22 }].forEach(function (ring, k) {
        var pos = [], col = [], ph = [];
        function put(x, y, c, p) {
          pos.push(x, y, Math.sqrt(Math.max(0.01, RS * RS - x * x - y * y)));
          col.push(c.r, c.g, c.b); ph.push(p);
        }
        for (var side = 0; side < 6; side++) {
          var a0 = side * Math.PI / 3 + Math.PI / 6, a1 = a0 + Math.PI / 3;
          var ax = Math.cos(a0) * ring.rad, ay = Math.sin(a0) * ring.rad, bx = Math.cos(a1) * ring.rad, by = Math.sin(a1) * ring.rad;
          for (var j = 0; j < ring.n; j++) {
            var u0 = (j + 0.1 + r() * 0.1) / ring.n, u1 = (j + 0.9 - r() * 0.12) / ring.n, steps = 3, phase = r() * 6.28;
            var mxp = ax + (bx - ax) * (u0 + u1) / 2, myp = ay + (by - ay) * (u0 + u1) / 2;
            tmp.copy(cyan).lerp(magenta, 0.5 + 0.5 * Math.sin(Math.atan2(myp, mxp) + k * 1.15 + 2.4));
            var c = tmp.clone(), si = 1 - ring.w / (2 * ring.rad), so = 1 + ring.w / (2 * ring.rad);
            for (var q = 0; q < steps; q++) {
              var ua = u0 + (u1 - u0) * q / steps, ub = u0 + (u1 - u0) * (q + 1) / steps;
              var xa = ax + (bx - ax) * ua, ya = ay + (by - ay) * ua, xb = ax + (bx - ax) * ub, yb = ay + (by - ay) * ub;
              put(xa * si, ya * si, c, phase); put(xb * si, yb * si, c, phase); put(xb * so, yb * so, c, phase);
              put(xa * si, ya * si, c, phase); put(xb * so, yb * so, c, phase); put(xa * so, ya * so, c, phase);
            }
          }
        }
        var g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute("aCol", new THREE.Float32BufferAttribute(col, 3));
        g.setAttribute("aPh", new THREE.Float32BufferAttribute(ph, 1));
        var mesh = new THREE.Mesh(g, eyeMat);
        mesh.userData.speed = (k % 2 ? -1 : 1) * (0.1 + k * 0.045);
        eyeRings.push(mesh);
        eye.add(mesh);
      });
      eyeGlow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTexture([[0, "rgba(120,110,255,0.55)"], [0.3, "rgba(255,70,215,0.42)"], [0.62, "rgba(50,150,255,0.16)"], [1, "rgba(40,100,255,0)"]]),
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
      }));
      eyeGlow.position.set(0, 0, R + 0.25);
      eyeGlow.scale.setScalar(6.6);
      eye.add(eyeGlow);
      proton.add(eye);

      var dark = new THREE.MeshStandardMaterial({ color: 0x2a1d4a, metalness: 0.72, roughness: 0.26, emissive: 0x100822 });
      var T = new TubeSet(), edges = new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(4.5, 1)), ep = edges.attributes.position.array, i;
      for (i = 0; i < ep.length; i += 6) {
        T.tube(new THREE.Vector3(ep[i], ep[i + 1], ep[i + 2]), new THREE.Vector3(ep[i + 3], ep[i + 4], ep[i + 5]), 0.05, 5);
      }
      cage = new THREE.Mesh(T.geometry(), dark);
      proton.add(cage);

      var ringMatP = new THREE.MeshStandardMaterial({ color: 0x3a2466, metalness: 0.75, roughness: 0.22, emissive: 0x220a3c });
      orbitA = new THREE.Mesh(new THREE.TorusGeometry(5.7, 0.085, 8, 120), ringMatP);
      orbitB = new THREE.Mesh(new THREE.TorusGeometry(5.25, 0.07, 8, 120), ringMatP);
      proton.add(orbitA); proton.add(orbitB);

      var edgeMat = new THREE.LineBasicMaterial({ color: 0xff5ad6, transparent: true, opacity: 0.7 });
      for (i = 0; i < 7; i++) {
        var geo = i % 3 === 2 ? new THREE.OctahedronGeometry(0.42) : new THREE.BoxGeometry(0.62, 0.62, 0.62);
        var bit = new THREE.Group();
        bit.add(new THREE.Mesh(geo, dark));
        bit.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMat));
        bit.userData = { a: i * 0.9 + r() * 0.5, rad: 7.2 + r() * 2.2, y: (r() - 0.5) * 8, sp: 0.05 + r() * 0.07, rx: r() * 2, ry: r() * 2 };
        bits.push(bit);
        proton.add(bit);
      }
    })();

    var ambient = new THREE.AmbientLight(0xb9c0d6, 0.5);
    var keyLight = new THREE.DirectionalLight(0xffffff, 1.0);
    var lightM = new THREE.PointLight(0xff3fd0, 0, 0), lightC = new THREE.PointLight(0x38d6ff, 0, 0);
    keyLight.position.set(6, 10, 14);
    lightM.position.set(-11, 6, -22);
    lightC.position.set(13, -6, -24);
    camera.add(ambient); camera.add(keyLight); camera.add(lightM); camera.add(lightC);
    camera.add(keyLight.target);
    keyLight.target.position.set(0, 0, -ATTACH_D);

    /* ---------- named points the page can pin labels to ---------- */

    var ANCHORS = {
      s_ground: [8.6, 0, 6.6, 0], s_frame: [4, 17.6, 6, 0], s_crane: [CRANE.x, CRANE.h + 5.6, CRANE.z, 0],
      e_found: [-8.6, -2.6, 6.6, -1], e_l0: [8, 1.6, -6, 0], e_l1: [-8, 4.8, 6, 1], e_l2: [8, 8, -6, 2],
      e_l3: [-8, 11.2, 6, 3], e_l4: [4, 14.4, -6, 4], e_l5: [-8, 17.6, 6, 5], e_roof: [4.3, TOP + 1, -6.3, 6]
    };
    var pv = new THREE.Vector3();
    function project(name, out) {
      var a = ANCHORS[name];
      if (!a) return null;
      pv.set(a[0], a[1] + a[3] * U.explode.value * GAP, a[2]).project(camera);
      out.x = (pv.x * 0.5 + 0.5) * W;
      out.y = (-pv.y * 0.5 + 0.5) * H;
      out.ok = pv.z < 1;
      return out;
    }

    /* ---------- frame loop ---------- */

    var cur = {}, inited = false, last = 0, t0 = -1, raf = 0, running = false, blank = false;
    var mouse = { x: 0, y: 0 }, fast = { x: 9, y: 9 }, mouseT = { x: 0, y: 0 }, hasPointer = false;
    var attach = { visH: 1, visW: 1, narrow: false, pX: 0, pY: 0, pS: 1 };
    var logoBox = { cy: 0.36, h: 0.5 };
    var focusLevel = -100, gaze = { on: false, x: 0, y: 0 };

    function onPointer(e) {
      mouseT.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouseT.y = -((e.clientY / window.innerHeight) * 2 - 1);
      if (!hasPointer) { hasPointer = true; fast.x = mouseT.x; fast.y = mouseT.y; }
    }
    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("pointerdown", onPointer, { passive: true });

    function resize() {
      W = canvas.clientWidth || window.innerWidth || 1280;
      H = canvas.clientHeight || window.innerHeight || 800;
      aspect = W / H;
      var dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      renderer.setPixelRatio(dpr);
      renderer.setSize(W, H, false);
      camera.aspect = aspect;
      px = (H * dpr * 0.5) / Math.tan((FOV * Math.PI) / 360);
      var visH = 2 * ATTACH_D * Math.tan((FOV * Math.PI) / 360), visW = visH * aspect, narrow = W < 900;
      attach.visH = visH; attach.visW = visW; attach.narrow = narrow;
      attach.pS = narrow ? clamp(aspect * 1.05, 0.5, 0.8) : clamp(aspect / 1.9, 0.62, 1);
      attach.pX = narrow ? 0 : visW * 0.235;
      attach.pY = narrow ? visH * 0.235 : visH * 0.02;
      ringMat.uniforms.uAspect.value = aspect;
      ringMat.uniforms.uPx.value = px;
      pulses.mat.uniforms.uPx.value = px;
    }

    // Each group has a line model and, for the building itself, solid parts.
    // v is how far it is built. The lines can also show as a ghost of the design before that.
    function applyGroup(name, v, extra) {
      var g = G[name], dim = g.dim * cur.world * (extra === undefined ? 1 : extra), i;
      var ghost = g.ghostable ? cur.ghost : 0, real = cur.real;
      var lineOn = dim > 0.004 && (v > 0.004 || ghost > 0.004), solidOn = dim > 0.004 && v > 0.004 && real > 0.004;
      var fadeIn = ghost > 0.004 ? 1 : Math.min(1, v / 0.1);
      for (i = 0; i < g.mats.length; i++) {
        var e = g.mats[i], u = e.m.uniforms, on = e.solid ? solidOn : lineOn;
        e.obj.visible = on;
        if (!on) continue;
        if (g.mode === "fly") { u.uFly.value = v; u.uReveal.value = 1000; }
        else if (g.mode === "fade") { u.uReveal.value = 1000; }
        else { u.uReveal.value = g.minY - 0.3 + (g.maxY - g.minY + EDGE + 0.6) * v; }
        if (e.solid) { u.uOpacity.value = real * dim; continue; }
        u.uGhost.value = ghost;
        u.uBuilt.value = 1 + (e.keep - 1) * real;
        u.uOpacity.value = e.base * dim * (g.mode === "fade" ? v : (g.mode === "fly" ? 1 : fadeIn));
      }
    }

    function step(now) {
      var t = now * 0.001, dt = last ? Math.max(0, Math.min(0.05, t - last)) : 0.016, key;
      last = t;
      if (t0 < 0) t0 = t;
      var tar = opts.getState();
      var k = reduce || !inited ? 1 : 1 - Math.exp(-dt * 4.6);
      for (key in tar) {
        // never let one bad number (a zero-size window, say) poison the scene for good
        if (!isFinite(tar[key])) continue;
        if (cur[key] === undefined || k === 1 || !isFinite(cur[key])) cur[key] = tar[key];
        else cur[key] += (tar[key] - cur[key]) * k;
      }
      inited = true;

      var km = reduce ? 1 : 1 - Math.exp(-dt * 5), kf = reduce ? 1 : 1 - Math.exp(-dt * 11);
      mouse.x += (mouseT.x - mouse.x) * km; mouse.y += (mouseT.y - mouse.y) * km;
      if (hasPointer) { fast.x += (mouseT.x - fast.x) * kf; fast.y += (mouseT.y - fast.y) * kf; }

      if (cur.world < 0.004 && cur.logo < 0.004 && cur.proton < 0.004) {
        if (!blank) { renderer.clear(); blank = true; }
        if (opts.onFrame) opts.onFrame(cur, api);
        return;
      }
      blank = false;

      /* camera */
      var az = cur.az + (reduce ? 0 : Math.sin(t * 0.17) * cur.sway) + mouse.x * 0.05;
      var el = cur.el + mouse.y * 0.02, d = cur.dist;
      camera.position.set(cur.tx + d * Math.cos(el) * Math.sin(az), cur.ty + d * Math.sin(el), cur.tz + d * Math.cos(el) * Math.cos(az));
      camera.lookAt(cur.tx, cur.ty, cur.tz);
      camera.setViewOffset(W, H, -cur.ox * W, -cur.oy * H, W, H);
      camera.updateMatrixWorld();

      /* building */
      var worldOn = cur.world > 0.004;
      world.visible = worldOn;
      if (worldOn) {
        U.explode.value = cur.explode;
        gridMat.uniforms.uOpacity.value = 0.2 * cur.grid * cur.world;
        gridMat.userData.obj.visible = cur.grid > 0.004;
        for (key in G) {
          var g = G[key];
          g.dim += (g.dimTar - g.dim) * (reduce ? 1 : 1 - Math.exp(-dt * 6));
          // the finished ground covers the foundation
          applyGroup(key, cur[key], key === "found" ? 1 - cur.land : 1);
        }
        U.lights.value = cur.lights;
        G.slabs.mats.forEach(function (m) { m.m.uniforms.uFocus.value = focusLevel; });
        G.blocks.mats.forEach(function (m) { m.m.uniforms.uFocus.value = focusLevel; });

        if (cur.crane > 0.004) {
          var ct = reduce ? 0 : t;
          jib.rotation.y = CRANE.rot + Math.sin(ct * 0.21) * 0.6;
          var r = 12 + Math.sin(ct * 0.3) * 4.5, yl = -13.5 + Math.sin(ct * 0.38 + 1) * 5;
          loadObj.position.set(r, yl, 0);
          var cp = cableGeo.attributes.position.array;
          cp[0] = r; cp[1] = 0; cp[2] = 0; cp[3] = r; cp[4] = yl + 1.7; cp[5] = 0;
          cableGeo.attributes.position.needsUpdate = true;
        }
        var pOn = cur.services > 0.5 && cur.explode < 0.05;
        pulses.obj.visible = pOn;
        if (pOn) {
          pulses.mat.uniforms.uOpacity.value = (cur.services - 0.5) * 2 * G.services.dim * cur.world;
          pulses.update(reduce ? 0.37 : t);
        }
        var bOn = cur.beacon > 0.01;
        beacon.visible = bOn;
        if (bOn) {
          beacon.position.set(-2, TOP + 5.6 + 6 * cur.explode * GAP, -4.2);
          beacon.scale.setScalar(4.4 * (1 + (reduce ? 0 : Math.sin(t * 2.1) * 0.12)));
          beacon.material.opacity = cur.beacon * cur.world * G.roof.dim;
        }
      }

      /* logo and ring */
      var lv = cur.logo, lOn = lv > 0.004, it = t - t0;
      logoGroup.visible = lOn;
      if (lOn) {
        var settle = reduce ? 0 : 1 - Math.exp(-it * 0.9);
        var spin = reduce ? 0 : SPIN_TOTAL * Math.exp(-it * 1.45);
        logoSpin.rotation.y = -spin + Math.sin(t * 0.55) * 0.16 * settle + mouse.x * 0.28;
        logoSpin.rotation.x = Math.sin(t * 0.41) * 0.04 * settle - mouse.y * 0.14;
        var pop = reduce ? 1 : 1 - 0.4 * Math.exp(-it * 2.4);
        // Fit the logo and its ring into the free space above the hero text.
        var fit = clamp(Math.min((logoBox.h * attach.visH * 0.9) / 7.4, (attach.visW * (attach.narrow ? 1.5 : 0.94)) / 23.5), 0.3, 1.3);
        logoGroup.position.set(0, (0.5 - logoBox.cy) * attach.visH, -ATTACH_D);
        logoGroup.scale.setScalar(fit * (0.5 + 0.5 * ease(lv)) * pop);
        logoMat.opacity = ease(lv);
        ringTilt.rotation.y = reduce ? 0 : t * 0.04;
        var ru = ringMat.uniforms;
        ru.uTime.value = reduce ? 4 : t;
        ru.uBurst.value = (1 - lv) * 1.5 + (reduce ? 0 : 1.7 * Math.exp(-it * 1.7));
        ru.uOpacity.value = lv * (reduce ? 1 : 1 - Math.exp(-it * 1.5));
        ru.uMouse.value.set(fast.x, fast.y);
      }

      /* Proton */
      var pvv = cur.proton, pOrb = pvv > 0.01;
      proton.visible = pOrb;
      lightM.intensity = 2.4 * pvv; lightC.intensity = 2.0 * pvv;
      if (pOrb) {
        // The orb crosses from one side to the other and dips a little on the way.
        var side = attach.narrow ? 0 : cur.pside, cross = 1 - Math.min(1, Math.abs(side));
        proton.position.set(attach.pX * side, attach.pY - cross * attach.visH * 0.05, -ATTACH_D);
        proton.scale.setScalar(attach.pS * ease(pvv) * (1 - cross * 0.14));
        proton.updateMatrixWorld();
        proton.getWorldPosition(pv).project(camera);
        // It looks at the card beside it, not at the pointer.
        var gx = gaze.on ? gaze.x : pv.x, gy = gaze.on ? gaze.y : pv.y;
        var lx = clamp((gx - pv.x) * 0.9, -0.85, 0.85), ly = clamp((gy - pv.y) * 0.75, -0.62, 0.62);
        if (!reduce) { lx += Math.sin(t * 0.5) * 0.07; ly += Math.cos(t * 0.37) * 0.05; }
        var kl = reduce ? 1 : 1 - Math.exp(-dt * 4);
        look.x += (lx - look.x) * kl; look.y += (ly - look.y) * kl;
        eye.rotation.set(-look.y, look.x, 0);
        var pt = reduce ? 0 : t;
        cage.rotation.set(pt * 0.06 - look.y * 0.3, pt * 0.09 + look.x * 0.35, pt * 0.02);
        orbitA.rotation.set(1.22 + Math.sin(pt * 0.3) * 0.08 - look.y * 0.15, look.x * 0.2, 0.38 + pt * 0.05);
        orbitB.rotation.set(1.0 - look.y * 0.1, 0.5 + pt * 0.07, -0.55);
        eyeRings.forEach(function (m) { m.rotation.z = pt * m.userData.speed; });
        eyeMat.uniforms.uTime.value = pt; eyeMat.uniforms.uBoost.value = 0.12;
        eyeGlow.material.opacity = 0.88;
        coreMat.uniforms.uTime.value = pt;
        bits.forEach(function (b) {
          var ud = b.userData, a = ud.a + pt * ud.sp;
          b.position.set(Math.cos(a) * ud.rad - look.x * 1.2, ud.y + Math.sin(pt * 0.6 + ud.a) * 0.4 - look.y * 0.9, Math.sin(a) * ud.rad * 0.55);
          b.rotation.set(ud.rx + pt * 0.3, ud.ry + pt * 0.22, 0);
        });
      }

      renderer.render(scene, camera);
      if (opts.onFrame) opts.onFrame(cur, api);
    }

    function loop(now) { if (!running) return; raf = requestAnimationFrame(loop); step(now); }

    var api = {
      start: function () { if (running) return; running = true; resize(); raf = requestAnimationFrame(loop); },
      stop: function () { running = false; cancelAnimationFrame(raf); },
      resize: resize,
      frame: function (ms) { resize(); step(ms === undefined ? performance.now() : ms); },
      project: project,
      setLogoBox: function (cy, h) { if (isFinite(cy) && isFinite(h)) { logoBox.cy = cy; logoBox.h = h; } },
      // where the orb should look, in screen units from -1 to 1; call with no arguments to look ahead
      setGaze: function (x, y) { gaze.on = x !== undefined && x !== null; if (gaze.on) { gaze.x = x; gaze.y = y; } },
      setFocus: function (dims, level) {
        for (var key in G) G[key].dimTar = dims && dims[key] !== undefined ? dims[key] : (dims ? dims.rest : 1);
        focusLevel = level === undefined || level === null ? -100 : level;
      },
      state: function () { return cur; }
    };

    canvas.addEventListener("webglcontextlost", function (e) { e.preventDefault(); api.stop(); });
    canvas.addEventListener("webglcontextrestored", function () { api.start(); });
    window.addEventListener("resize", resize);
    return api;
  }

  window.HourlineScene = { create: create };
})();
