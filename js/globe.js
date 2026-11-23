/* A small spinning dotted globe drawn on a 2D canvas, with office points and arcs that
   launch from one point to another. It sits over the home page in the websites section. */
(function () {
  "use strict";

  // Land as longitude ranges for each 5-degree band of latitude, from 90N down to 90S.
  // Approximate on purpose: it only has to read as the continents on a dotted globe.
  var LAND = [
    [], [[-65, -20], [15, 25], [95, 105]], [[-120, -75], [-70, -18], [12, 25], [55, 68], [95, 112]],
    [[-162, -140], [-125, -75], [-55, -20], [18, 30], [52, 150]], [[-165, -62], [-52, -22], [-23, -14], [12, 180]],
    [[-165, -95], [-78, -64], [-50, -41], [-22, -14], [5, 178]], [[-162, -153], [-136, -95], [-78, -60], [-7, -2], [8, 142], [155, 164]],
    [[-130, -56], [-10, 2], [5, 142], [155, 160]], [[-125, -60], [-2, 142]],
    [[-124, -68], [-9, 3], [8, 28], [32, 49], [52, 132], [140, 145]],
    [[-123, -75], [-9, 0], [14, 17], [20, 24], [26, 49], [53, 122], [126, 129], [137, 141]],
    [[-118, -78], [-9, 32], [35, 122], [130, 135]], [[-115, -97], [-83, -80], [-13, 34], [35, 122]],
    [[-110, -97], [-84, -76], [-17, 37], [39, 59], [68, 90], [92, 117]],
    [[-105, -88], [-74, -69], [-17, 38], [42, 55], [73, 86], [94, 108], [120, 123]],
    [[-92, -83], [-17, 51], [75, 80], [98, 109], [121, 125]], [[-84, -60], [-13, 48], [79, 81], [99, 103], [124, 126]],
    [[-78, -50], [9, 46], [97, 104], [109, 118]], [[-81, -36], [9, 42], [100, 105], [110, 117], [120, 123], [131, 150]],
    [[-80, -35], [13, 40], [106, 114], [138, 150]], [[-77, -37], [12, 40], [48, 50], [130, 137], [142, 145]],
    [[-73, -39], [12, 38], [44, 50], [122, 146]], [[-70, -41], [14, 35], [43, 48], [114, 150]],
    [[-71, -48], [16, 33], [114, 153]], [[-72, -53], [18, 30], [116, 124], [135, 152]],
    [[-73, -57], [140, 150], [174, 178]], [[-74, -63], [145, 148], [168, 174]], [[-75, -66], [167, 170]], [[-73, -66]],
    [], [[-62, -57]], [[-68, -60], [40, 160]], [[-100, -60], [-30, 170]], [[-150, -60], [-35, 165]], [[-180, 180]], [[-180, 180]]
  ];
  // Sample offices and project places: [latitude, longitude]. The first one is the head office.
  var PLACES = [
    [33.9, 35.5], [25.2, 55.3], [30.0, 31.2], [41.0, 29.0], [48.9, 2.3], [51.5, -0.1], [6.5, 3.4], [5.3, -4.0],
    [-4.3, 15.3], [-1.3, 36.8], [24.7, 46.7], [19.1, 72.9], [1.35, 103.8], [40.7, -74.0], [-23.5, -46.6], [35.7, 139.7],
    [-33.9, 18.4], [34.1, -118.2], [19.4, -99.1], [43.7, -79.4], [-12.0, -77.0], [-34.6, -58.4], [-33.9, 151.2],
    [31.2, 121.5], [-6.2, 106.8], [55.8, 37.6], [59.3, 18.1], [21.3, -157.9], [-36.8, 174.8], [49.3, -123.1]
  ];
  var ARCS = [
    [0, 1], [0, 2], [0, 3], [0, 4], [0, 7], [0, 8], [0, 10], [0, 25], [4, 5], [5, 13], [4, 26], [7, 6], [8, 9], [9, 16],
    [1, 11], [11, 12], [12, 24], [12, 23], [23, 15], [15, 27], [27, 17], [17, 18], [18, 20], [20, 21], [21, 14], [14, 6],
    [13, 19], [19, 29], [29, 15], [17, 13], [22, 24], [22, 28], [28, 27], [16, 14], [2, 10], [3, 25], [22, 15]
  ];
  var DEG = Math.PI / 180;

  function unit(lat, lon) {
    var c = Math.cos(lat * DEG);
    return [c * Math.sin(lon * DEG), Math.sin(lat * DEG), c * Math.cos(lon * DEG)];
  }
  function isLand(lat, lon) {
    var band = LAND[Math.min(35, Math.max(0, Math.floor((90 - lat) / 5)))], i;
    for (i = 0; i < band.length; i++) if (lon >= band[i][0] && lon <= band[i][1]) return true;
    return false;
  }

  function create(canvas) {
    var ctx = canvas.getContext("2d");
    if (!ctx) return null;
    var dots = [], lat, lon, step;
    for (lat = -86; lat <= 86; lat += 2.4) {
      step = 2.4 / Math.max(0.12, Math.cos(lat * DEG));
      for (lon = -180; lon < 180; lon += step) if (isLand(lat, lon)) dots.push(unit(lat, lon));
    }
    var places = PLACES.map(function (p) { return unit(p[0], p[1]); });
    var arcs = ARCS.map(function (a, i) {
      var A = places[a[0]], B = places[a[1]], dot = A[0] * B[0] + A[1] * B[1] + A[2] * B[2];
      var ang = Math.acos(Math.max(-1, Math.min(1, dot)));
      return { A: A, B: B, ang: ang, lift: 0.08 + ang * 0.18, phase: (i * 0.37) % 1.5, speed: 0.2 + (i % 5) * 0.03 };
    });
    var size = 0, tiltC = Math.cos(0.36), tiltS = Math.sin(0.36), out = [0, 0, 0];

    function resize() {
      var w = canvas.clientWidth, dpr = Math.min(window.devicePixelRatio || 1, 2);
      var px = Math.min(900, Math.max(200, Math.round(w * dpr * 1.6)));
      if (px !== size) { size = px; canvas.width = canvas.height = px; }
    }
    // Turn the globe, then tilt its north pole toward the viewer.
    function turn(v, cs, sn, scale) {
      var x = v[0] * cs - v[2] * sn, z = v[0] * sn + v[2] * cs, y = v[1];
      out[0] = x * scale; out[1] = (y * tiltC - z * tiltS) * scale; out[2] = y * tiltS + z * tiltC;
      return out;
    }
    function arcPoint(arc, u) {
      var s = Math.sin(arc.ang) || 1, a = Math.sin((1 - u) * arc.ang) / s, b = Math.sin(u * arc.ang) / s;
      var k = 1 + arc.lift * Math.sin(Math.PI * u);
      return [(arc.A[0] * a + arc.B[0] * b) * k, (arc.A[1] * a + arc.B[1] * b) * k, (arc.A[2] * a + arc.B[2] * b) * k];
    }

    function draw(t) {
      if (!size) resize();
      // the surface moves west to east, like the Earth seen from space
      var c = size / 2, R = size * 0.464, rot = 0.9 - t * 0.2, cs = Math.cos(rot), sn = Math.sin(rot), i, p;
      ctx.clearRect(0, 0, size, size);

      // cover the still globe in the capture, then draw the sphere
      ctx.fillStyle = "#101010";
      ctx.beginPath(); ctx.arc(c, c, size * 0.5, 0, 6.2832); ctx.fill();
      var g = ctx.createRadialGradient(c - R * 0.35, c - R * 0.4, R * 0.1, c, c, R);
      g.addColorStop(0, "#22252b"); g.addColorStop(0.7, "#15171b"); g.addColorStop(1, "#0d0e10");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(c, c, R, 0, 6.2832); ctx.fill();
      ctx.strokeStyle = "rgba(140,170,255,.28)"; ctx.lineWidth = Math.max(1, size / 420);
      ctx.stroke();

      // land
      var ds = Math.max(1.4, size / 240);
      for (i = 0; i < dots.length; i++) {
        p = turn(dots[i], cs, sn, R);
        if (p[2] <= 0.02) continue;
        ctx.fillStyle = "rgba(232,238,248," + (0.26 + p[2] * 0.7).toFixed(2) + ")";
        ctx.fillRect(c + p[0] - ds / 2, c - p[1] - ds / 2, ds, ds);
      }

      // arcs: a faint standing line, and a bright stroke that launches from one point to the other
      ctx.lineCap = "round";
      for (i = 0; i < arcs.length; i++) {
        var arc = arcs[i], N = 26, k, head = ((t * arc.speed + arc.phase) % 1.5), prev = null;
        for (k = 0; k <= N; k++) {
          var u = k / N, q = turn(arcPoint(arc, u), cs, sn, R), cur = [c + q[0], c - q[1], q[2]];
          if (prev && prev[2] > -0.08 && cur[2] > -0.08) {
            var d = head - u, glow = d > 0 && d < 0.38 ? 1 - d / 0.38 : 0;
            ctx.strokeStyle = "rgba(110,165,255," + (0.22 + glow * 0.75).toFixed(2) + ")";
            ctx.lineWidth = Math.max(1, size / 420) * (1 + glow * 1.8);
            ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.lineTo(cur[0], cur[1]); ctx.stroke();
          }
          prev = cur;
        }
        // the bright head of the stroke
        if (head < 1) {
          var hq = turn(arcPoint(arc, head), cs, sn, R);
          if (hq[2] > -0.05) { ctx.fillStyle = "#cfe0ff"; ctx.beginPath(); ctx.arc(c + hq[0], c - hq[1], Math.max(1.6, size / 190), 0, 6.2832); ctx.fill(); }
        }
      }

      // places
      for (i = 0; i < places.length; i++) {
        p = turn(places[i], cs, sn, R);
        if (p[2] <= 0.04) continue;
        var x = c + p[0], y = c - p[1], r0 = size / (i === 0 ? 70 : 115), pulse = (t * 0.6 + i * 0.21) % 1;
        ctx.strokeStyle = (i === 0 ? "rgba(255,255,255," : "rgba(92,150,255,") + ((1 - pulse) * 0.7 * p[2]).toFixed(2) + ")";
        ctx.lineWidth = Math.max(1, size / 500);
        ctx.beginPath(); ctx.arc(x, y, r0 * (1 + pulse * 3.2), 0, 6.2832); ctx.stroke();
        ctx.fillStyle = i === 0 ? "#ffffff" : "#6fa0ff";
        ctx.beginPath(); ctx.arc(x, y, r0, 0, 6.2832); ctx.fill();
      }
    }

    return { draw: draw, resize: resize };
  }

  window.HourlineGlobe = { create: create };
})();
