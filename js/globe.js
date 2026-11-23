/* A slowly spinning globe drawn on a 2D canvas: country outlines, a few places spread over
   the world, and routes that run along the surface from one place to the next.
   It sits over the home page in the websites section. Needs window.SITE_WORLD (js/world.js). */
(function () {
  "use strict";

  // Sample offices and project places: [latitude, longitude]. The first one is the head office.
  var PLACES = [
    [38.0, 23.7], [40.7, -74.0], [-23.5, -46.6], [6.5, 3.4], [-33.9, 18.4],
    [25.2, 55.3], [19.1, 72.9], [35.7, 139.7], [-33.9, 151.2]
  ];
  // Routes between places, by index.
  var ROUTES = [[0, 1], [0, 3], [0, 5], [5, 6], [6, 7], [7, 8], [3, 4], [1, 2], [2, 3]];
  var DEG = Math.PI / 180;

  function unit(lat, lon) {
    var c = Math.cos(lat * DEG);
    return [c * Math.sin(lon * DEG), Math.sin(lat * DEG), c * Math.cos(lon * DEG)];
  }

  function create(canvas) {
    var ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // Border lines as flat arrays of unit vectors.
    var lines = (window.SITE_WORLD || []).map(function (line) {
      var v = new Float32Array((line.length / 2) * 3), i, u;
      for (i = 0; i < line.length; i += 2) {
        u = unit(line[i + 1] / 10, line[i] / 10);
        v[(i / 2) * 3] = u[0]; v[(i / 2) * 3 + 1] = u[1]; v[(i / 2) * 3 + 2] = u[2];
      }
      return v;
    });
    var places = PLACES.map(function (p) { return unit(p[0], p[1]); });
    // A route follows the great circle between its two places, so it hugs the curve of the Earth.
    var routes = ROUTES.map(function (r, i) {
      var A = places[r[0]], B = places[r[1]], dot = A[0] * B[0] + A[1] * B[1] + A[2] * B[2];
      var ang = Math.acos(Math.max(-1, Math.min(1, dot)));
      return { A: A, B: B, ang: ang, sin: Math.sin(ang) || 1, phase: (i * 0.29) % 1, speed: 0.055 + (i % 3) * 0.008 };
    });
    var RP = [0, 0, 0];
    // The point a fraction u of the way along a route, lifted a hair above the surface.
    function routePoint(r, u) {
      var a = Math.sin((1 - u) * r.ang) / r.sin, b = Math.sin(u * r.ang) / r.sin;
      RP[0] = (r.A[0] * a + r.B[0] * b) * 1.006; RP[1] = (r.A[1] * a + r.B[1] * b) * 1.006; RP[2] = (r.A[2] * a + r.B[2] * b) * 1.006;
    }
    var size = 0, tiltC = Math.cos(0.34), tiltS = Math.sin(0.34), X = 0, Y = 0, Z = 0;

    function resize() {
      var w = canvas.clientWidth, dpr = Math.min(window.devicePixelRatio || 1, 2);
      var px = Math.min(900, Math.max(200, Math.round(w * dpr * 1.6)));
      if (px !== size) { size = px; canvas.width = canvas.height = px; }
    }
    // Turn the globe, then tilt its north pole toward the viewer. Leaves the result in X, Y, Z.
    function turn(x, y, z, cs, sn, scale) {
      var xr = x * cs - z * sn, zr = x * sn + z * cs;
      X = xr * scale; Y = (y * tiltC - zr * tiltS) * scale; Z = y * tiltS + zr * tiltC;
    }

    function draw(t) {
      if (!size) resize();
      // the surface moves west to east, like the Earth seen from space
      var c = size / 2, R = size * 0.464, rot = 0.55 - t * 0.085, cs = Math.cos(rot), sn = Math.sin(rot), i, k, v, pen;
      ctx.clearRect(0, 0, size, size);
      ctx.lineCap = "round"; ctx.lineJoin = "round";

      // the sphere
      var g = ctx.createRadialGradient(c - R * 0.3, c - R * 0.35, R * 0.05, c, c, R);
      g.addColorStop(0, "#202226"); g.addColorStop(0.75, "#17181b"); g.addColorStop(1, "#111214");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(c, c, R, 0, 6.2832); ctx.fill();

      // country outlines, front side only
      ctx.beginPath();
      for (i = 0; i < lines.length; i++) {
        v = lines[i]; pen = false;
        for (k = 0; k < v.length; k += 3) {
          turn(v[k], v[k + 1], v[k + 2], cs, sn, R);
          if (Z > 0.01) {
            if (pen) ctx.lineTo(c + X, c - Y); else { ctx.moveTo(c + X, c - Y); pen = true; }
          } else {
            pen = false;
          }
        }
      }
      ctx.strokeStyle = "rgba(226,230,238,0.62)";
      ctx.lineWidth = Math.max(0.8, size / 640);
      ctx.stroke();

      // darken toward the edge so the globe reads as a ball, then a thin rim
      var shade = ctx.createRadialGradient(c, c, R * 0.55, c, c, R);
      shade.addColorStop(0, "rgba(16,16,18,0)"); shade.addColorStop(1, "rgba(16,16,18,0.72)");
      ctx.fillStyle = shade;
      ctx.beginPath(); ctx.arc(c, c, R, 0, 6.2832); ctx.fill();
      ctx.strokeStyle = "rgba(200,206,216,0.3)"; ctx.lineWidth = Math.max(1, size / 520);
      ctx.beginPath(); ctx.arc(c, c, R, 0, 6.2832); ctx.stroke();

      // routes: a faint dashed line on the surface, and a slow bright stroke travelling along it.
      // The stroke is redrawn from its exact position every frame, so it glides instead of stepping.
      var lw = Math.max(1, size / 460), dash = [size / 110, size / 80];
      for (i = 0; i < routes.length; i++) {
        var r = routes[i], N = 36, drawing = false;
        ctx.beginPath();
        for (k = 0; k <= N; k++) {
          routePoint(r, k / N);
          turn(RP[0], RP[1], RP[2], cs, sn, R);
          if (Z > 0.02) {
            if (drawing) ctx.lineTo(c + X, c - Y); else { ctx.moveTo(c + X, c - Y); drawing = true; }
          } else {
            drawing = false;
          }
        }
        ctx.setLineDash(dash);
        ctx.strokeStyle = "rgba(110,165,255,0.34)";
        ctx.lineWidth = lw;
        ctx.stroke();
        ctx.setLineDash([]);

        var head = (t * r.speed + r.phase) % 1.32, u1 = Math.min(1, head), u0 = Math.max(0, head - 0.32), M = 22;
        if (u1 - u0 > 0.002) {
          var px0 = 0, py0 = 0, pz0 = -1;
          for (k = 0; k <= M; k++) {
            routePoint(r, u0 + (u1 - u0) * (k / M));
            turn(RP[0], RP[1], RP[2], cs, sn, R);
            if (k > 0 && pz0 > 0.02 && Z > 0.02) {
              var f = k / M;
              ctx.strokeStyle = "rgba(150,195,255," + (f * f * 0.95).toFixed(3) + ")";
              ctx.lineWidth = lw * (1 + f * 1.6);
              ctx.beginPath(); ctx.moveTo(px0, py0); ctx.lineTo(c + X, c - Y); ctx.stroke();
            }
            px0 = c + X; py0 = c - Y; pz0 = Z;
          }
          if (head < 1 && pz0 > 0.02) {
            ctx.fillStyle = "#dbe9ff";
            ctx.beginPath(); ctx.arc(px0, py0, lw * 1.9, 0, 6.2832); ctx.fill();
          }
        }
      }

      // places
      for (i = 0; i < places.length; i++) {
        turn(places[i][0], places[i][1], places[i][2], cs, sn, R);
        if (Z <= 0.04) continue;
        var x = c + X, y = c - Y, r0 = size / (i === 0 ? 78 : 120), pulse = (t * 0.35 + i * 0.21) % 1;
        ctx.strokeStyle = (i === 0 ? "rgba(255,255,255," : "rgba(110,165,255,") + ((1 - pulse) * 0.7 * Z).toFixed(2) + ")";
        ctx.lineWidth = Math.max(1, size / 500);
        ctx.beginPath(); ctx.arc(x, y, r0 * (1 + pulse * 3), 0, 6.2832); ctx.stroke();
        ctx.fillStyle = i === 0 ? "#ffffff" : "#6fa5ff";
        ctx.beginPath(); ctx.arc(x, y, r0, 0, 6.2832); ctx.fill();
      }
    }

    return { draw: draw, resize: resize };
  }

  window.SiteGlobe = { create: create };
})();
