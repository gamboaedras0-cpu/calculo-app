/* Calculo App — interfaz */
(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const { fmt } = Calc;

  const st = {
    modo: 'area', eje: 'x', metodo: 'discos',
    contexto: null, extra: null,
    res: null, gemini: null, grafica: '2d', peticion: 0
  };

  // ---------------- Tema ----------------
  const raiz = document.documentElement;
  try { const t = localStorage.getItem('tema'); if (t) raiz.dataset.theme = t; } catch (_) {}
  $('#tema').onclick = () => {
    const oscuro = getComputedStyle(raiz).getPropertyValue('--es-oscuro').trim() === '1';
    raiz.dataset.theme = oscuro ? 'light' : 'dark';
    try { localStorage.setItem('tema', raiz.dataset.theme); } catch (_) {}
    if (st.res) dibujar();
  };
  const css = (v) => getComputedStyle(raiz).getPropertyValue(v).trim();

  // ---------------- KaTeX ----------------
  const tex = (el, s, display = true) => {
    try { katex.render(s, el, { displayMode: display, throwOnError: false }); }
    catch (_) { el.textContent = s; }
  };
  const texEnLinea = (el) => {
    try {
      renderMathInElement(el, {
        delimiters: [{ left: '$$', right: '$$', display: true }, { left: '$', right: '$', display: false }, { left: '\\(', right: '\\)', display: false }],
        throwOnError: false
      });
    } catch (_) {}
  };
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------------- Pestañas ----------------
  $$('.tab').forEach((b) => (b.onclick = () => cambiarModo(b.dataset.modo)));
  function cambiarModo(modo) {
    st.modo = modo;
    $$('.tab').forEach((b) => b.classList.toggle('activa', b.dataset.modo === modo));
    $('#vista-calc').classList.toggle('oculto', modo === 'apps');
    $('#vista-apps').classList.toggle('oculto', modo !== 'apps');
    if (modo === 'apps') return;
    limpiarResultado();
    $('#solo-volumen').classList.toggle('oculto', modo !== 'volumen');
    $('#gtab-3d').classList.toggle('oculto', modo !== 'volumen');
    if (modo !== 'volumen') verGrafica('2d');
    $('#btn-calcular').textContent = modo === 'area' ? 'Calcular área con IA' : 'Calcular volumen con IA';
    pintarChips();
  }

  // ---------------- Controles segmentados ----------------
  function seg(id, clave, alCambiar) {
    $$(`#${id} button`).forEach((b) => (b.onclick = () => {
      if (b.disabled) return;
      st[clave] = b.dataset.v; marcarSeg(id, b.dataset.v); alCambiar && alCambiar();
    }));
  }
  function marcarSeg(id, v) { $$(`#${id} button`).forEach((b) => b.classList.toggle('on', b.dataset.v === v)); }
  seg('seg-eje', 'eje', () => { ajustarMetodos(true); });
  seg('seg-met', 'metodo', () => ajustarMetodos(false));

  function ajustarMetodos(autoElegir) {
    const horizontal = st.eje === 'x' || st.eje === 'yc';
    $('#campo-c').classList.toggle('oculto', !(st.eje === 'yc' || st.eje === 'xc'));
    const hayG = $('#in-g').value.trim() !== '';
    $$('#seg-met button').forEach((b) => {
      b.disabled = horizontal ? b.dataset.v === 'capas' : b.dataset.v !== 'capas';
    });
    if (autoElegir || $(`#seg-met button[data-v="${st.metodo}"]`).disabled) {
      st.metodo = horizontal ? (hayG ? 'arandelas' : 'discos') : 'capas';
    }
    marcarSeg('seg-met', st.metodo);
    const notas = {
      discos: 'Rebanadas perpendiculares al eje: cada una es un disco de radio R(x). Diferencial dx.',
      arandelas: 'Disco con hueco: radio exterior R(x) e interior r(x). Diferencial dx.',
      capas: 'Cilindros concéntricos paralelos al eje vertical: radio = distancia al eje, altura = f(x) − g(x). Diferencial dx.'
    };
    $('#nota-metodo').textContent = notas[st.metodo];
  }

  // ---------------- Vista previa LaTeX de entradas ----------------
  function previa(inp, out) {
    const v = inp.value.trim();
    if (!v) { out.innerHTML = ''; inp.classList.remove('error'); return; }
    try { const F = Calc.compilar(v); tex(out, `${inp.id === 'in-f' ? 'f' : 'g'}(x) = ${F.tex}`, false); inp.classList.remove('error'); }
    catch (e) { out.textContent = e.message; inp.classList.add('error'); }
  }
  ['f', 'g'].forEach((k) => {
    const inp = $(`#in-${k}`), out = $(`#prev-${k}`);
    inp.addEventListener('input', () => { previa(inp, out); if (st.contexto) quitarContexto(); });
    previa(inp, out);
  });
  $('#in-g').addEventListener('change', () => { if (st.modo === 'volumen') ajustarMetodos(st.eje === 'x' || st.eje === 'yc'); });

  // ---------------- Ejemplos ----------------
  function pintarChips() {
    const cont = $('#chips'); cont.innerHTML = '';
    (EJEMPLOS[st.modo] || []).forEach((ej) => {
      const b = document.createElement('button'); b.className = 'chip'; b.textContent = ej.t;
      b.onclick = () => { quitarContexto(); cargar({ unidad: 'u', ...ej, tipo: st.modo }); calcular(); };
      cont.appendChild(b);
    });
  }

  function cargar(p) {
    $('#in-f').value = p.f; $('#in-g').value = p.g || '';
    $('#in-a').value = p.a; $('#in-b').value = p.b;
    if (p.unidad) $('#in-u').value = p.unidad;
    if (p.c !== undefined) $('#in-c').value = p.c;
    previa($('#in-f'), $('#prev-f')); previa($('#in-g'), $('#prev-g'));
    if (p.tipo === 'volumen') {
      st.eje = p.eje || 'x'; marcarSeg('seg-eje', st.eje);
      st.metodo = p.metodo || 'discos'; ajustarMetodos(false);
    }
  }

  // ---------------- Contexto de plantilla ----------------
  function ponerContexto(pl) {
    st.contexto = pl.contexto; st.extra = pl.extra || null;
    const box = $('#contexto-caso');
    box.innerHTML = `<div class="ctx-cab"><span>${esc(pl.icono || '💡')} ${esc(pl.titulo)}</span><button title="Quitar caso">✕</button></div><p>${esc(pl.contexto)}</p>`;
    box.querySelector('button').onclick = quitarContexto;
    box.classList.remove('oculto');
  }
  function quitarContexto() { st.contexto = null; st.extra = null; $('#contexto-caso').classList.add('oculto'); }

  // ---------------- Lectura de entradas ----------------
  function leerLimite(id, nombre) {
    const s = $(id).value.trim();
    try { const v = math.evaluate(s.replace(/π/g, 'pi')); if (typeof v === 'number' && isFinite(v)) return v; } catch (_) {}
    throw new Error(`El límite ${nombre} no es un número válido.`);
  }
  function limiteTex(id) {
    try { return math.parse($(id).value.trim().replace(/π/g, 'pi')).toTex({ parenthesis: 'auto', implicit: 'hide' }); } catch (_) { return null; }
  }
  function leerParametros() {
    return {
      tipo: st.modo === 'volumen' ? 'volumen' : 'area',
      f: $('#in-f').value.trim(), g: $('#in-g').value.trim(),
      a: leerLimite('#in-a', 'a'), b: leerLimite('#in-b', 'b'),
      aTex: limiteTex('#in-a'), bTex: limiteTex('#in-b'),
      eje: st.eje, c: (st.eje === 'yc' || st.eje === 'xc') ? leerLimite('#in-c', 'c') : 0,
      metodo: st.metodo, unidad: $('#in-u').value
    };
  }

  // ---------------- Cálculo ----------------
  $('#btn-calcular').onclick = calcular;
  document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('.entradas input')) calcular(); });

  async function calcular() {
    let p, res;
    try { p = leerParametros(); res = Calc.resolver(p); }
    catch (e) { mostrarError(e.message); return; }

    st.res = res; st.p = p; st.gemini = null;
    if (res.metodoClave && res.metodoClave !== st.metodo) { st.metodo = res.metodoClave; marcarSeg('seg-met', st.metodo); }
    pintarResultado();
    dibujar();
    pasosLocales('cargando');

    const id = ++st.peticion;
    badge('cargando', 'Consultando a Gemini…');
    $('#btn-calcular').disabled = true;
    const ctrl = new AbortController();
    const reloj = setTimeout(() => ctrl.abort(), 65000);
    try {
      const r = await fetch('/api/resolver', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctrl.signal,
        body: JSON.stringify({ accion: 'resolver', ...p, contexto: st.contexto, referencia: { integral: res.integralTex, valor: Number(res.valor.toPrecision(10)) } })
      }).catch((err) => { throw new Error(err.name === 'AbortError' ? 'Gemini tardó demasiado en responder. Presiona Calcular de nuevo.' : 'Sin conexión con el servidor.'); });
      const data = await r.json().catch(() => ({ error: `Respuesta inválida del servidor (${r.status})` }));
      if (id !== st.peticion) return;
      if (!r.ok || data.error) throw new Error(data.error || `Error ${r.status}`);
      st.gemini = data;
      verificar();
      pintarPasos(data);
      dibujar();
    } catch (e) {
      if (id !== st.peticion) return;
      badge('local', 'Resultado local (sin IA)');
      pasosLocales('error', e.message);
    } finally {
      clearTimeout(reloj);
      if (id === st.peticion) $('#btn-calcular').disabled = false;
    }
  }

  function verificar() {
    const g = Number(st.gemini.resultado_decimal), l = st.res.valor;
    const err = Math.abs(g - l) / Math.max(1e-9, Math.abs(l));
    if (isFinite(g) && err < 0.005) badge('ok', `✓ Verificado · Gemini ${fmt(g)} ≈ Simpson ${fmt(l)}`);
    else badge('warn', `⚠ Gemini dio ${isFinite(g) ? fmt(g) : '—'}; la verificación numérica da ${fmt(l)}`);
  }

  function badge(tipo, texto) { const b = $('#badge'); b.className = `badge ${tipo}`; b.textContent = texto; }

  function pintarResultado() {
    const r = st.res, p = st.p;
    $('#res-etiqueta').textContent = r.dimension === 2 ? r.metodo : `Volumen · ${r.metodo}`;
    $('#res-num').textContent = fmt(r.valor);
    $('#res-u').textContent = Calc.unidades(p.unidad, r.dimension);
    const extras = Calc.conversiones(r.valor, p.unidad, r.dimension);
    if (st.extra) extras.push(st.extra(r.valor));
    if (r.dimension === 2 && r.neto !== undefined && Math.abs(r.neto - r.valor) > 1e-9) extras.push(`Integral neta = ${fmt(r.neto)}`);
    $('#res-extra').innerHTML = extras.map((x) => `<span>${esc(x)}</span>`).join('');
    tex($('#res-integral'), r.integralTex);
    $('#avisos').innerHTML = r.avisos.map((a) => `<li>${esc(a)}</li>`).join('');
  }

  function mostrarError(msg) {
    st.res = null;
    $('#res-num').textContent = '—'; $('#res-u').textContent = ''; $('#res-extra').innerHTML = '';
    $('#res-integral').innerHTML = '';
    $('#avisos').innerHTML = `<li class="err">${esc(msg)}</li>`;
    badge('warn', 'Revisa los datos');
    Plotly.purge('plot2d'); Plotly.purge('plot3d');
  }

  function limpiarResultado() {
    st.res = null; st.gemini = null;
    $('#res-etiqueta').textContent = st.modo === 'area' ? 'Área' : 'Volumen';
    $('#res-num').textContent = '—'; $('#res-u').textContent = ''; $('#res-extra').innerHTML = '';
    $('#res-integral').innerHTML = ''; $('#avisos').innerHTML = '';
    badge('', '—'); $('#modelo').textContent = '';
    $('#pasos-cuerpo').innerHTML = '<p class="vacio">Presiona <b>Calcular con IA</b> para ver el desarrollo completo generado por Gemini.</p>';
    Plotly.purge('plot2d'); Plotly.purge('plot3d');
  }

  // ---------------- Pasos ----------------
  function tarjeta(n, titulo, html, latex) {
    const d = document.createElement('article'); d.className = 'paso';
    d.innerHTML = `<div class="num">${n}</div><div class="cont"><h3>${esc(titulo)}</h3><div class="exp">${html || ''}</div><div class="eq"></div></div>`;
    if (latex) tex(d.querySelector('.eq'), latex); else d.querySelector('.eq').remove();
    texEnLinea(d.querySelector('.exp'));
    return d;
  }

  function pasosLocales(estado, error) {
    const r = st.res, cont = $('#pasos-cuerpo'); cont.innerHTML = '';
    $('#modelo').textContent = '';
    if (estado === 'cargando') {
      cont.innerHTML = '<div class="cargando"><span class="spin"></span>Gemini está resolviendo la integral paso a paso…</div>';
    } else {
      cont.innerHTML = `<div class="error-ia"><div><b>No se pudo consultar a Gemini:</b> ${esc(error)}<br><small>Se muestra el planteamiento y el resultado del motor numérico local.</small></div><button class="reintentar">↻ Reintentar con IA</button></div>`;
      cont.querySelector('.reintentar').onclick = calcular;
    }
    let n = 1;
    cont.appendChild(tarjeta(n++, 'Continuidad', esc(r.continuidad.join(' '))));
    if (r.dimension === 3) cont.appendChild(tarjeta(n++, `Método: ${r.metodo} · diferencial ${r.diferencial}`, '', r.radioTex));
    cont.appendChild(tarjeta(n++, 'Planteamiento de la integral', '', r.integralTex));
    cont.appendChild(tarjeta(n++, 'Resultado numérico (Simpson, n = 10 000)', '', `${r.dimension === 2 ? 'A' : 'V'} \\approx ${fmt(r.valor)}\\ \\text{${Calc.unidades(st.p.unidad, r.dimension)}}`));
  }

  function pintarPasos(d) {
    const cont = $('#pasos-cuerpo'); cont.innerHTML = '';
    $('#modelo').textContent = d.modelo ? `Generado por ${d.modelo}` : '';
    const resumen = document.createElement('div'); resumen.className = 'resumen-ia';
    resumen.innerHTML = `<div><small>Método</small><b>${esc(d.metodo)}</b></div><div><small>Diferencial</small><b>${esc(d.diferencial)}</b></div><div class="ancho"><small>Continuidad</small><span>${esc(d.continuidad)}</span></div>`;
    texEnLinea(resumen); cont.appendChild(resumen);
    (d.pasos || []).forEach((p, i) => cont.appendChild(tarjeta(i + 1, String(p.titulo || '').replace(/^\s*(paso\s*)?\d+\s*[.):-]\s*/i, ''), esc(p.explicacion).replace(/\n/g, '<br>'), p.latex)));
    const fin = document.createElement('div'); fin.className = 'final';
    fin.innerHTML = `<small>Resultado</small><div class="eq"></div><p>${esc(d.interpretacion)}</p>`;
    tex(fin.querySelector('.eq'), `${d.resultado_exacto_latex} \\approx ${fmt(Number(d.resultado_decimal))}\\ \\text{${esc(d.unidades)}}`);
    texEnLinea(fin.querySelector('p'));
    cont.appendChild(fin);
  }

  // ---------------- Gráficas ----------------
  $$('.gtab').forEach((b) => (b.onclick = () => verGrafica(b.dataset.g)));
  function verGrafica(g) {
    st.grafica = g;
    $$('.gtab').forEach((b) => b.classList.toggle('on', b.dataset.g === g));
    $('#plot2d').classList.toggle('oculto', g !== '2d');
    $('#plot3d').classList.toggle('oculto', g !== '3d');
    try { Plotly.purge(g === '2d' ? 'plot3d' : 'plot2d'); } catch (_) {}
    $('#graf-ayuda').textContent = g === '2d' ? 'Puntos ◆ = evaluados por Gemini' : 'Arrastra para rotar · rueda para zoom';
    if (st.res) dibujar();
  }

  const cfgPlot = { responsive: true, displaylogo: false, modeBarButtonsToRemove: ['lasso2d', 'select2d', 'autoScale2d'] };

  function baseLayout() {
    const tinta = css('--tinta'), rejilla = css('--rejilla');
    const eje = { gridcolor: rejilla, zerolinecolor: css('--tinta-suave'), color: tinta, zerolinewidth: 1.5 };
    return {
      paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
      font: { family: 'IBM Plex Sans, sans-serif', color: tinta, size: 12 },
      margin: { l: 48, r: 16, t: 16, b: 40 }, xaxis: { ...eje }, yaxis: { ...eje },
      legend: { orientation: 'h', y: -0.15 }, hovermode: 'closest', modebar: { orientation: 'v', bgcolor: 'rgba(0,0,0,0)', color: css('--tinta-suave') }
    };
  }

  function dibujar() {
    if (!st.res) return;
    if (st.grafica === '2d') dibujar2D(); else dibujar3D();
  }

  function dibujar2D() {
    const r = st.res, { xs, yf, yg } = Calc.region2D(r);
    const acento = css('--acento'), acento2 = css('--acento-2'), region = css('--region');
    const t = [];
    t.push({ x: [...xs, ...xs.slice().reverse()], y: [...yf, ...yg.slice().reverse()], fill: 'toself', fillcolor: region, line: { width: 0 }, hoverinfo: 'skip', name: r.dimension === 2 ? 'Área' : 'Región que gira' });
    t.push({ x: xs, y: yf, mode: 'lines', line: { color: acento, width: 3 }, name: `f(x) = ${r.F.expr}` });
    if (r.G) t.push({ x: xs, y: yg, mode: 'lines', line: { color: acento2, width: 3 }, name: `g(x) = ${r.G.expr}` });
    const pg = st.gemini && Array.isArray(st.gemini.puntos) ? st.gemini.puntos.filter((q) => isFinite(q.x) && isFinite(q.y)) : [];
    if (pg.length) t.push({ x: pg.map((q) => q.x), y: pg.map((q) => q.y), mode: 'markers', marker: { symbol: 'diamond', size: 9, color: css('--fondo'), line: { color: acento, width: 2 } }, name: 'Puntos de Gemini' });

    const lo = baseLayout();
    const ymin = Math.min(0, ...yf, ...yg), ymax = Math.max(0, ...yf, ...yg), pad = (ymax - ymin || 1) * 0.12;
    lo.yaxis.range = [ymin - pad, ymax + pad];
    const lineaV = (x, color, dash) => ({ type: 'line', x0: x, x1: x, yref: 'paper', y0: 0, y1: 1, line: { color, width: 1.5, dash } });
    lo.shapes = [lineaV(r.a, css('--tinta-suave'), 'dot'), lineaV(r.b, css('--tinta-suave'), 'dot')];
    lo.annotations = [
      { x: r.a, y: 1, yref: 'paper', text: `x = ${fmt(r.a)}`, showarrow: false, yanchor: 'bottom', font: { size: 11 } },
      { x: r.b, y: 1, yref: 'paper', text: `x = ${fmt(r.b)}`, showarrow: false, yanchor: 'bottom', font: { size: 11 } }
    ];
    if (r.dimension === 3) {
      const rojo = css('--eje');
      if (r.horizontal) {
        lo.shapes.push({ type: 'line', xref: 'paper', x0: 0, x1: 1, y0: r.c, y1: r.c, line: { color: rojo, width: 2, dash: 'dash' } });
        lo.annotations.push({ xref: 'paper', x: 1, y: r.c, text: `eje de giro y = ${fmt(r.c)}`, showarrow: false, xanchor: 'right', yanchor: 'bottom', font: { color: rojo, size: 11 } });
      } else {
        lo.shapes.push(lineaV(r.c, rojo, 'dash'));
        lo.annotations.push({ x: r.c, y: 0.02, yref: 'paper', text: `eje x = ${fmt(r.c)}`, showarrow: false, xanchor: 'left', font: { color: rojo, size: 11 } });
        const xr = [Math.min(r.a, r.c), Math.max(r.b, r.c)], px = (xr[1] - xr[0]) * 0.08 || 1;
        lo.xaxis.range = [xr[0] - px, xr[1] + px];
      }
      if (r.horizontal) { lo.yaxis.range = [Math.min(lo.yaxis.range[0], r.c - pad), Math.max(lo.yaxis.range[1], r.c + pad)]; }
    }
    Plotly.react('plot2d', t, lo, cfgPlot);
  }

  function dibujar3D() {
    const r = st.res; if (r.dimension !== 3) return;
    const capas = Calc.superficies3D(r);
    const esc1 = [[0, css('--s3d-1')], [1, css('--s3d-2')]];
    const esc2 = [[0, css('--s3d-3')], [1, css('--s3d-4')]];
    // la superficie exterior va en azul translúcido; la interior (hueco o base) en ámbar sólido
    const radioMedio = (c) => { const k = Math.floor(c.X[0].length / 2), r = st.res; return r.horizontal ? Math.hypot(c.Y[0][k] - r.c, c.Z[0][k]) : Math.abs(c.Z[0][k]); };
    if (capas.length > 1 && r.horizontal && radioMedio(capas[1]) > radioMedio(capas[0])) capas.reverse();
    const t = capas.map((c, i) => ({
      type: 'surface', x: c.X, y: c.Y, z: c.Z, name: c.nombre, showscale: false,
      colorscale: i === 0 ? esc1 : esc2, cmin: -1, cmax: 1,
      surfacecolor: c.X.map((fila, j) => fila.map(() => Math.cos((2 * Math.PI * j) / (c.X.length - 1) - 0.8))),
      opacity: i === 0 ? (capas.length > 1 ? 0.8 : 0.95) : 1,
      lighting: { ambient: 0.55, diffuse: 0.7, specular: 0.25, roughness: 0.6 },
      contours: { x: { show: false } }, hoverinfo: 'skip'
    }));
    // eje de giro
    const ext = (a, b) => [a - (b - a) * 0.1, b + (b - a) * 0.1];
    if (r.horizontal) { const [x0, x1] = ext(r.a, r.b); t.push({ type: 'scatter3d', mode: 'lines', x: [x0, x1], y: [r.c, r.c], z: [0, 0], line: { color: css('--eje'), width: 6 }, name: 'Eje de giro', hoverinfo: 'skip' }); }
    else { const zs = capas.flatMap((c) => c.Z.flat()); const [z0, z1] = ext(Math.min(...zs), Math.max(...zs)); t.push({ type: 'scatter3d', mode: 'lines', x: [r.c, r.c], y: [0, 0], z: [z0, z1], line: { color: css('--eje'), width: 6 }, name: 'Eje de giro', hoverinfo: 'skip' }); }

    const tinta = css('--tinta'), rejilla = css('--rejilla');
    const eje = (titulo) => ({ title: titulo, gridcolor: rejilla, color: tinta, backgroundcolor: 'rgba(0,0,0,0)', showbackground: false, zerolinecolor: css('--tinta-suave') });
    Plotly.react('plot3d', t, {
      paper_bgcolor: 'rgba(0,0,0,0)', font: { family: 'IBM Plex Sans, sans-serif', color: tinta },
      margin: { l: 0, r: 0, t: 0, b: 0 }, showlegend: false,
      scene: {
        xaxis: eje('x'), yaxis: eje(r.horizontal ? 'y' : 'z'), zaxis: eje(r.horizontal ? 'z' : 'y'),
        aspectmode: 'data', camera: { eye: r.horizontal ? { x: 1.4, y: -1.6, z: 0.9 } : { x: 1.5, y: 1.5, z: 0.9 } }
      }
    }, cfgPlot);
  }

  // ---------------- Aplicaciones ----------------
  function pintarApps() {
    const grid = $('#grid-apps');
    grid.innerHTML = '';
    PLANTILLAS.forEach((pl) => {
      const c = document.createElement('button'); c.className = 'app-card';
      c.innerHTML = `<div class="app-ico">${pl.icono}</div><small>${esc(pl.categoria)}</small><h3>${esc(pl.titulo)}</h3><p>${esc(pl.contexto)}</p>
        <div class="app-meta"><code>${esc(pl.f)}</code>${pl.g ? `<code>g = ${esc(pl.g)}</code>` : ''}<span>[${pl.a}, ${pl.b}] ${pl.unidad}</span><span>${pl.tipo === 'area' ? 'Área' : { discos: 'Discos', arandelas: 'Arandelas', capas: 'Capas' }[pl.metodo]}</span></div>`;
      c.onclick = () => usarPlantilla(pl);
      grid.appendChild(c);
    });
    const ia = document.createElement('div'); ia.className = 'app-card ia';
    ia.innerHTML = `<div class="app-ico">✨</div><small>Generado con IA</small><h3>Proponer un caso con Gemini</h3>
      <p>La IA inventa un problema real nuevo, con su función perfil y límites, listo para resolver.</p>
      <select id="ia-cat"><option>diseño industrial y manufactura</option><option>obras civiles y arquitectura</option><option>física y mediciones de depósitos</option><option>gastronomía y envases de alimentos</option></select>
      <button class="primario" id="btn-proponer">Proponer caso</button><p class="nota" id="ia-estado"></p>`;
    grid.appendChild(ia);
    ia.querySelector('#btn-proponer').onclick = proponerCaso;
  }

  function usarPlantilla(pl) {
    cambiarModo(pl.tipo === 'area' ? 'area' : 'volumen');
    cargar(pl);
    ponerContexto(pl);
    calcular();
  }

  async function proponerCaso() {
    const btn = $('#btn-proponer'), est = $('#ia-estado');
    btn.disabled = true; est.textContent = 'Gemini está pensando un caso…';
    try {
      const r = await fetch('/api/resolver', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'proponer', categoria: $('#ia-cat').value }) });
      const c = await r.json();
      if (!r.ok || c.error) throw new Error(c.error || `Error ${r.status}`);
      Calc.compilar(c.f); if (c.g) Calc.compilar(c.g);
      usarPlantilla({ ...c, tipo: 'volumen', icono: '✨', categoria: 'Caso propuesto por IA' });
      est.textContent = '';
    } catch (e) { est.textContent = `No se pudo: ${e.message}`; }
    finally { btn.disabled = false; }
  }

  // ---------------- Inicio ----------------
  pintarApps();
  ajustarMetodos(true);
  cambiarModo('area');
  window.addEventListener('resize', () => { if (st.res) dibujar(); });
})();
