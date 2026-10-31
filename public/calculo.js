/*
 * Calculo App — motor de cálculo local
 * Evalúa funciones (math.js), integra con Simpson compuesto y arma
 * la geometría 2D/3D. Sirve para graficar y para VERIFICAR lo que
 * responde Gemini.
 */
(function (root) {
  'use strict';
  const math = root.math;

  const FUNCIONES_OK = new Set([
    'sin', 'cos', 'tan', 'sec', 'csc', 'cot', 'asin', 'acos', 'atan',
    'sinh', 'cosh', 'tanh', 'sqrt', 'cbrt', 'exp', 'log', 'ln', 'log10',
    'abs', 'nthRoot', 'pow'
  ]);
  const CONSTANTES_OK = new Set(['x', 'e', 'pi', 'E', 'PI']);

  // ---------- Parseo ----------
  function compilar(expr) {
    if (expr === undefined || expr === null || String(expr).trim() === '') return null;
    let limpio = String(expr).trim()
      .replace(/\*\*/g, '^')
      .replace(/π/g, 'pi')
      .replace(/√/g, 'sqrt')
      .replace(/\bln\(/g, 'log(');
    const node = math.parse(limpio);

    node.traverse((n, path, parent) => {
      if (n.isSymbolNode) {
        const esFuncion = parent && parent.isFunctionNode && path === 'fn';
        if (esFuncion && !FUNCIONES_OK.has(n.name)) throw new Error(`Función no permitida: ${n.name}`);
        if (!esFuncion && !CONSTANTES_OK.has(n.name)) throw new Error(`Variable desconocida "${n.name}". Usa solo x.`);
      }
      if (n.isAssignmentNode || n.isFunctionAssignmentNode) throw new Error('Expresión no válida');
    });

    const code = node.compile();
    const fn = (x) => {
      try {
        const v = code.evaluate({ x });
        if (typeof v === 'number' && isFinite(v)) return v;
        if (v && typeof v.re === 'number' && Math.abs(v.im) < 1e-12) return v.re; // sqrt(-0.0000…)
        return NaN;
      } catch (_) { return NaN; }
    };
    let tex;
    try { tex = node.toTex({ parenthesis: 'auto', implicit: 'hide' }); } catch (_) { tex = limpio; }
    return { expr: limpio, fn, tex };
  }

  // ---------- Numérico ----------
  function simpson(fn, a, b, n = 10000) {
    if (n % 2) n++;
    const h = (b - a) / n;
    let s = fn(a) + fn(b);
    for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * fn(a + i * h);
    return (s * h) / 3;
  }

  function linspace(a, b, n) {
    const out = new Array(n);
    for (let i = 0; i < n; i++) out[i] = i === n - 1 ? b : a + (i * (b - a)) / (n - 1);
    return out;
  }

  function continuidad(fn, a, b, nombre = 'f') {
    const xs = linspace(a, b, 1201);
    const ys = xs.map(fn);
    const malos = xs.filter((_, i) => !isFinite(ys[i]));
    if (malos.length) {
      return { ok: false, mensaje: `${nombre}(x) no está definida en todo [${fmt(a)}, ${fmt(b)}] (falla cerca de x ≈ ${fmt(malos[0])}).` };
    }
    const rango = Math.max(...ys) - Math.min(...ys) || 1;
    for (let i = 1; i < ys.length; i++) {
      if (Math.abs(ys[i] - ys[i - 1]) > 0.25 * rango && Math.abs(ys[i] - ys[i - 1]) > 50 * (rango / 1200)) {
        return { ok: false, mensaje: `${nombre}(x) parece tener un salto cerca de x ≈ ${fmt(xs[i])}.` };
      }
    }
    return { ok: true, mensaje: `${nombre}(x) es continua en [${fmt(a)}, ${fmt(b)}].` };
  }

  // ---------- Formato ----------
  function fmt(n, dec = 4) {
    if (!isFinite(n)) return String(n);
    const r = Number(n.toFixed(dec));
    return Object.is(r, -0) ? '0' : String(r);
  }
  function texMenosC(c) {
    if (!c) return '';
    return c > 0 ? ` - ${fmt(c)}` : ` + ${fmt(-c)}`;
  }
  function envolver(tex) { return `\\left(${tex}\\right)`; }

  // ---------- Resolución ----------
  /**
   * p = { tipo:'area'|'volumen', f, g, a, b, eje:'x'|'y'|'yc'|'xc', c, metodo:'discos'|'arandelas'|'capas' }
   */
  function resolver(p) {
    const F = compilar(p.f);
    if (!F) throw new Error('Escribe la función f(x).');
    const G = compilar(p.g);
    const a = Number(p.a), b = Number(p.b);
    if (!isFinite(a) || !isFinite(b)) throw new Error('Los límites a y b deben ser números.');
    if (a >= b) throw new Error('Se necesita a < b.');

    const avisos = [];
    const cont = [continuidad(F.fn, a, b, 'f')];
    if (G) cont.push(continuidad(G.fn, a, b, 'g'));
    cont.filter(c => !c.ok).forEach(c => avisos.push(c.mensaje));
    if (cont.some(c => !c.ok)) throw new Error(avisos.join(' '));

    const f = F.fn, g = G ? G.fn : () => 0;
    const lim = `_{${p.aTex || fmt(a)}}^{${p.bTex || fmt(b)}}`;
    const res = { F, G, a, b, avisos, continuidad: cont.map(c => c.mensaje), diferencial: 'dx' };

    if (p.tipo === 'area') {
      const dif = (x) => f(x) - g(x);
      const neto = simpson(dif, a, b);
      const total = simpson((x) => Math.abs(dif(x)), a, b, 6000);
      res.metodo = G ? 'Área entre curvas' : 'Área bajo la curva';
      res.integrando = G ? `${envolver(F.tex)} - ${envolver(G.tex)}` : F.tex;
      res.integralTex = `A = \\int${lim} ${G ? `\\left[${res.integrando}\\right]` : res.integrando}\\,dx`;
      res.valor = total;
      res.neto = neto;
      if (Math.abs(total - Math.abs(neto)) > 1e-6 * Math.max(1, total)) {
        res.integralTex = `A = \\int${lim} \\left|${res.integrando}\\right|\\,dx`;
        avisos.push(`La función cambia de signo en [${fmt(a)}, ${fmt(b)}]: la integral neta da ${fmt(neto)}, pero el área geométrica total es ${fmt(total)}.`);
      }
      res.dimension = 2;
      return res;
    }

    // ----- Volumen -----
    const horizontal = p.eje === 'x' || p.eje === 'yc';
    const c = (p.eje === 'yc' || p.eje === 'xc') ? Number(p.c) || 0 : 0;
    res.c = c; res.horizontal = horizontal; res.dimension = 3;
    let metodo = p.metodo;

    if (horizontal) {
      if (metodo === 'capas') {
        metodo = G ? 'arandelas' : 'discos';
        avisos.push('Con eje horizontal e integrando en dx, las capas necesitarían dy; se usó el método de ' + (G ? 'arandelas.' : 'discos.'));
      }
      if (metodo === 'discos' && G) { metodo = 'arandelas'; avisos.push('Hay g(x), así que la región tiene hueco: se usó arandelas.'); }
      if (metodo === 'arandelas' && !G) { metodo = 'discos'; avisos.push('Sin g(x) no hay hueco: se usó discos.'); }

      const df = (x) => f(x) - c, dg = (x) => g(x) - c;
      if (metodo === 'discos') {
        res.integralTex = `V = \\pi\\int${lim} \\left[${F.tex}${texMenosC(c)}\\right]^2\\,dx`;
        res.radioTex = `R(x) = ${F.tex}${texMenosC(c)}`;
        res.valor = Math.PI * simpson((x) => df(x) ** 2, a, b);
      } else {
        const m = (a + b) / 2;
        const fueraEsF = Math.abs(df(m)) >= Math.abs(dg(m));
        const [Rt, rt] = fueraEsF ? [F.tex, G.tex] : [G.tex, F.tex];
        const xs = linspace(a, b, 400);
        if (xs.some(x => df(x) * dg(x) < -1e-12)) avisos.push('El eje de giro atraviesa la región; el volumen se calculó con el radio mayor en cada punto.');
        if (xs.some(x => (Math.abs(df(x)) >= Math.abs(dg(x))) !== fueraEsF && Math.abs(Math.abs(df(x)) - Math.abs(dg(x))) > 1e-9))
          avisos.push('Las curvas se cruzan: el radio exterior cambia dentro del intervalo.');
        res.radioTex = `R(x) = ${Rt}${texMenosC(c)},\\quad r(x) = ${rt}${texMenosC(c)}`;
        res.integralTex = `V = \\pi\\int${lim} \\left(\\left[${Rt}${texMenosC(c)}\\right]^2 - \\left[${rt}${texMenosC(c)}\\right]^2\\right)dx`;
        res.valor = Math.PI * simpson((x) => {
          const A = Math.abs(df(x)), B = Math.abs(dg(x));
          return Math.max(A, B) ** 2 - Math.min(A, B) ** 2;
        }, a, b);
      }
    } else {
      if (metodo !== 'capas') { avisos.push('Con eje vertical e integrando en dx se usan capas cilíndricas (discos/arandelas necesitarían despejar x en función de y).'); metodo = 'capas'; }
      let radioTex;
      if (a >= c) radioTex = c ? `\\left(x${texMenosC(c)}\\right)` : 'x';
      else if (b <= c) radioTex = `\\left(${fmt(c)} - x\\right)`;
      else { radioTex = `\\left|x${texMenosC(c)}\\right|`; avisos.push('El eje de giro está dentro de [a, b]: las capas de ambos lados se traslapan.'); }
      const h = G ? `\\left[${envolver(F.tex)} - ${envolver(G.tex)}\\right]` : envolver(F.tex);
      res.radioTex = `r(x) = ${radioTex.replace(/\\left|\\right/g, '')},\\quad h(x) = ${G ? `${F.tex} - ${envolver(G.tex)}` : F.tex}`;
      res.integralTex = `V = 2\\pi\\int${lim} ${radioTex}${h}\\,dx`;
      res.valor = 2 * Math.PI * simpson((x) => Math.abs(x - c) * Math.abs(f(x) - g(x)), a, b);
    }
    res.metodo = { discos: 'Discos', arandelas: 'Arandelas', capas: 'Capas cilíndricas' }[metodo];
    res.metodoClave = metodo;
    return res;
  }

  // ---------- Geometría ----------
  function region2D(res, n = 300) {
    const xs = linspace(res.a, res.b, n);
    const f = res.F.fn, g = res.G ? res.G.fn : () => 0;
    return { xs, yf: xs.map(f), yg: xs.map(g) };
  }

  function superficies3D(res, nx = 70, nt = 56) {
    const xs = linspace(res.a, res.b, nx);
    const ts = linspace(0, 2 * Math.PI, nt);
    const f = res.F.fn, g = res.G ? res.G.fn : null, c = res.c || 0;
    const capas = [];
    const malla = (perfil) => {
      const X = [], Y = [], Z = [];
      for (const t of ts) {
        const fx = [], fy = [], fz = [];
        for (const x of xs) {
          const v = perfil(x);
          if (res.horizontal) { const r = v - c; fx.push(x); fy.push(c + r * Math.cos(t)); fz.push(r * Math.sin(t)); }
          else { const r = x - c; fx.push(c + r * Math.cos(t)); fy.push(r * Math.sin(t)); fz.push(v); }
        }
        X.push(fx); Y.push(fy); Z.push(fz);
      }
      return { X, Y, Z };
    };
    capas.push({ nombre: 'f(x)', ...malla(f) });
    if (g) capas.push({ nombre: 'g(x)', ...malla(g) });
    else if (!res.horizontal) capas.push({ nombre: 'base', ...malla(() => 0) });
    return capas;
  }

  // ---------- Unidades ----------
  function unidades(u, dim) {
    const base = u === 'u' ? 'u' : u;
    return `${base}${dim === 2 ? '²' : '³'}`;
  }
  function conversiones(valor, u, dim) {
    if (dim !== 3) return [];
    if (u === 'cm') return [`${fmt(valor, 2)} mL`, `${fmt(valor / 1000, 3)} L`];
    if (u === 'm') return [`${fmt(valor * 1000, 1)} L`, `${fmt(valor * 264.172, 1)} gal`];
    return [];
  }

  const Calc = { compilar, simpson, linspace, continuidad, resolver, region2D, superficies3D, fmt, unidades, conversiones };
  root.Calc = Calc;
  if (typeof module !== 'undefined' && module.exports) module.exports = Calc;
})(typeof window !== 'undefined' ? window : globalThis);
