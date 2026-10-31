/*
 * Calculo App — función serverless (Vercel)
 * Recibe el problema desde el navegador, arma el prompt estructurado y
 * llama a Gemini. La API key vive SOLO aquí, en la variable de entorno
 * GEMINI_API_KEY (nunca llega al navegador).
 *
 *   POST /api/resolver   { accion: 'resolver', tipo, f, g, a, b, eje, c, metodo, unidad, contexto, referencia }
 *   POST /api/resolver   { accion: 'proponer', categoria }
 */

// Modelo principal + respaldos por si está saturado o no disponible para la cuenta.
// GEMINI_MODEL y GEMINI_RESPALDO (separados por coma) se configuran en Vercel.
const MODELOS = [...new Set([
  process.env.GEMINI_MODEL || 'gemini-3.8-flash',
  ...(process.env.GEMINI_RESPALDO || 'gemini-3.8-flash-lite,gemini-flash-latest,gemini-flash-lite-latest').split(',')
].map((m) => m.trim()).filter(Boolean))];
const URL_GEMINI = (m) => `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`;

// ---------- Esquemas de salida (JSON estructurado) ----------
const ESQUEMA_SOLUCION = {
  type: 'OBJECT',
  properties: {
    continuidad: { type: 'STRING', description: 'Análisis de dominio y continuidad en [a,b]' },
    metodo: { type: 'STRING' },
    diferencial: { type: 'STRING', description: 'dx o dy, y por qué' },
    integral_latex: { type: 'STRING', description: 'Integral planteada, LaTeX sin delimitadores $' },
    pasos: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          titulo: { type: 'STRING' },
          explicacion: { type: 'STRING', description: 'Texto en español; fórmulas en línea entre $...$' },
          latex: { type: 'STRING', description: 'Ecuación principal del paso, LaTeX sin $' }
        },
        required: ['titulo', 'explicacion', 'latex']
      }
    },
    resultado_exacto_latex: { type: 'STRING' },
    resultado_decimal: { type: 'NUMBER' },
    unidades: { type: 'STRING' },
    interpretacion: { type: 'STRING', description: 'Qué significa el resultado en el contexto' },
    puntos: {
      type: 'ARRAY',
      description: '11 puntos (x, f(x)) equiespaciados en [a,b] para graficar',
      items: { type: 'OBJECT', properties: { x: { type: 'NUMBER' }, y: { type: 'NUMBER' } }, required: ['x', 'y'] }
    }
  },
  required: ['continuidad', 'metodo', 'diferencial', 'integral_latex', 'pasos', 'resultado_exacto_latex', 'resultado_decimal', 'unidades', 'interpretacion', 'puntos']
};

const ESQUEMA_CASO = {
  type: 'OBJECT',
  properties: {
    titulo: { type: 'STRING' },
    contexto: { type: 'STRING', description: '2-3 oraciones describiendo el caso real' },
    f: { type: 'STRING', description: 'Función perfil en sintaxis math.js usando solo x (ej. 2+0.5*sin(x))' },
    g: { type: 'STRING', description: 'Función interior o cadena vacía' },
    a: { type: 'NUMBER' },
    b: { type: 'NUMBER' },
    eje: { type: 'STRING', enum: ['x', 'y'] },
    metodo: { type: 'STRING', enum: ['discos', 'arandelas', 'capas'] },
    unidad: { type: 'STRING', enum: ['cm', 'm'] }
  },
  required: ['titulo', 'contexto', 'f', 'g', 'a', 'b', 'eje', 'metodo', 'unidad']
};

const SISTEMA = `Eres un tutor experto de Cálculo II para estudiantes de Ingeniería en Sistemas en Guatemala.
Resuelves integrales definidas (áreas y volúmenes de sólidos de revolución) de forma didáctica, en español, paso a paso, como lo haría un estudiante ordenado en su cuaderno.
Reglas:
- Muestra TODAS las fórmulas y sustituciones; no te saltes álgebra.
- Pasos obligatorios, en este orden: (1) Análisis de la función y continuidad en [a,b]; (2) Método elegido, diferencial (dx o dy) y por qué; (3) Radio(s)/altura y planteamiento de la integral; (4) Desarrollo del integrando (expandir/simplificar); (5) Antiderivada; (6) Teorema Fundamental del Cálculo: F(b) - F(a) con sustitución explícita; (7) Resultado exacto y decimal con unidades.
- Si la antiderivada no es elemental, dilo claramente y explica que se usa integración numérica (Simpson), mostrando la fórmula.
- Si el área cruza el eje x, separa los intervalos y usa valor absoluto para el área geométrica.
- El campo "latex" va SIN signos $. En "explicacion" las fórmulas en línea van entre $...$.
- Usa unidades cuadradas para áreas y cúbicas para volúmenes. Si la unidad es cm³ menciona su equivalente en mL; si es m³, en litros.
- Se te da un valor numérico de referencia calculado por la app con Simpson; tu resultado debe coincidir. Si no coincide, revisa tu álgebra.`;

// ---------- Utilidades ----------
const txt = (v, max = 160) => String(v ?? '').slice(0, max);
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);

async function llamarGemini({ prompt, esquema, temperatura = 0.2 }) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    const e = new Error('Falta configurar GEMINI_API_KEY en Vercel (Settings → Environment Variables).');
    e.status = 500; throw e;
  }
  const limite = Date.now() + 55000;          // Vercel corta la función a los 60 s
  const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));
  const sinThinking = new Set();               // modelos que no aceptan thinkingConfig

  // Una sola petición a un modelo. Devuelve { r, data } o lanza si se agotó el tiempo.
  const pedir = async (modelo) => {
    const restante = limite - Date.now();
    if (restante < 3000) { const e = new Error('Tiempo agotado'); e.name = 'AbortError'; throw e; }
    const generationConfig = { temperature: temperatura, responseMimeType: 'application/json', responseSchema: esquema, maxOutputTokens: 8192 };
    // Los modelos 3.x "piensan" antes de responder: razonamiento bajo = respuesta más rápida
    if (!sinThinking.has(modelo)) generationConfig.thinkingConfig = { thinkingLevel: 'low' };
    const ctrl = new AbortController();
    const reloj = setTimeout(() => ctrl.abort(), Math.min(45000, restante));
    try {
      const r = await fetch(URL_GEMINI(modelo), {
        method: 'POST', signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SISTEMA }] },
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig
        })
      });
      const data = await r.json().catch(() => ({}));
      if (r.status === 400 && /thinking/i.test(data?.error?.message || '') && !sinThinking.has(modelo)) {
        sinThinking.add(modelo);
        return pedir(modelo);
      }
      return { r, data };
    } finally { clearTimeout(reloj); }
  };

  // Plan: modelo principal (2 intentos si está saturado) y luego modelos de respaldo
  const plan = [];
  MODELOS.forEach((m, i) => { plan.push(m); if (i === 0) plan.push(m); });

  let ultimoError = 'Gemini no respondió';
  let ultimoStatus = 502;
  for (let i = 0; i < plan.length; i++) {
    const modelo = plan[i];
    let r, data;
    try { ({ r, data } = await pedir(modelo)); }
    catch (err) {
      if (err.name === 'AbortError') { ultimoError = 'Gemini tardó demasiado en responder. Intenta de nuevo.'; ultimoStatus = 504; continue; }
      ultimoError = `No se pudo conectar con Gemini: ${err.message}`; ultimoStatus = 502; continue;
    }
    if (r.ok) {
      const texto = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
      try { return { datos: JSON.parse(texto), modelo }; }
      catch { ultimoError = 'Gemini devolvió una respuesta que no es JSON válido.'; ultimoStatus = 502; continue; }
    }
    ultimoError = data?.error?.message || `Gemini respondió ${r.status}`;
    ultimoStatus = r.status === 429 ? 429 : 502;
    // Saturación o error temporal → pausa corta y siguiente intento.
    // Modelo inexistente o no disponible → pasa directo al siguiente.
    const modeloNoDisponible = r.status === 404 || ((r.status === 400 || r.status === 403) && /model/i.test(ultimoError));
    if ([429, 500, 503].includes(r.status)) await espera(1200);
    else if (!modeloNoDisponible) break;          // key inválida, etc.: no tiene caso reintentar
  }
  if (/high demand|overloaded|unavailable/i.test(ultimoError)) ultimoError = 'Gemini está saturado en este momento (alta demanda en los servidores de Google). Espera unos segundos y presiona Calcular de nuevo.';
  else if (/quota|rate limit|exhausted/i.test(ultimoError)) ultimoError = 'Se alcanzó el límite gratuito de Gemini por minuto. Espera un minuto e intenta de nuevo.';
  else if (/api key/i.test(ultimoError)) ultimoError = 'La API key de Gemini no es válida. Revisa GEMINI_API_KEY en Vercel.';
  const e = new Error(ultimoError); e.status = ultimoStatus; throw e;
}

function promptResolver(b) {
  const ejes = { x: 'el eje X (y = 0)', y: 'el eje Y (x = 0)', yc: `la recta horizontal y = ${num(b.c)}`, xc: `la recta vertical x = ${num(b.c)}` };
  const u = txt(b.unidad, 4) === 'u' ? 'unidades (u)' : txt(b.unidad, 4);
  const lineas = [
    `Tipo de problema: ${b.tipo === 'area' ? 'ÁREA bajo la curva / entre curvas' : 'VOLUMEN de sólido de revolución (giro de 360°)'}`,
    `f(x) = ${txt(b.f)}`,
    b.g ? `g(x) = ${txt(b.g)}` : 'g(x): no aplica (la región llega hasta el eje x)',
    `Límites de integración: a = ${num(b.a)}, b = ${num(b.b)}`
  ];
  if (b.tipo !== 'area') {
    lineas.push(`Eje de rotación: ${ejes[b.eje] || ejes.x}`);
    lineas.push(`Método solicitado: ${txt(b.metodo, 20)}`);
  }
  lineas.push(`Unidad de longitud: ${u}`);
  if (b.contexto) lineas.push(`Contexto de aplicación real: ${txt(b.contexto, 500)}`);
  if (b.referencia) {
    lineas.push(`Integral planteada por la app (LaTeX): ${txt(b.referencia.integral, 400)}`);
    lineas.push(`Valor numérico de referencia (Simpson): ${num(b.referencia.valor)}`);
  }
  lineas.push('Devuelve la solución completa paso a paso y 11 puntos equiespaciados (x, f(x)) en [a, b].');
  return lineas.join('\n');
}

// ---------- Handler ----------
export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Usa POST' }); }
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

  try {
    if (body.accion === 'proponer') {
      const cat = txt(body.categoria || 'cualquier área de ingeniería', 80);
      const { datos: caso } = await llamarGemini({
        esquema: ESQUEMA_CASO,
        temperatura: 0.9,
        prompt: `Propón un caso REAL y original de ${cat} que se resuelva calculando el volumen de un sólido de revolución.
Da una función perfil sencilla en sintaxis math.js usando solo la variable x (operadores + - * / ^ y funciones sqrt, sin, cos, exp, log), positiva y continua en [a,b], con dimensiones realistas.
Si giras alrededor del eje y usa método "capas" con a >= 0. Si hay hueco interior usa g(x) y "arandelas"; si no, g = "" y "discos".`
      });
      return res.status(200).json(caso);
    }

    if (num(body.a) === null || num(body.b) === null || !body.f) return res.status(400).json({ error: 'Faltan f(x), a o b.' });
    const { datos: sol, modelo } = await llamarGemini({ prompt: promptResolver(body), esquema: ESQUEMA_SOLUCION });
    return res.status(200).json({ ...sol, modelo });
  } catch (e) {
    return res.status(e.status || 500).json({ error: e.message || 'Error interno' });
  }
}
