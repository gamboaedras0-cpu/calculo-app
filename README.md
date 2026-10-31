# ∫ Calculo App — Asistente de Sólidos de Revolución con IA

Proyecto de **Cálculo II** (Ingeniería en Sistemas). Calcula áreas bajo la curva y volúmenes de sólidos de revolución (discos, arandelas y capas cilíndricas). Muestra el procedimiento paso a paso generado por **Google Gemini** y grafica la región en 2D y el sólido en 3D.

## Arquitectura (3 capas)

```
Navegador (public/)                 Vercel serverless (api/)          Google
┌───────────────────────────┐      ┌──────────────────────────┐     ┌──────────┐
│ 1. Interfaz               │ POST │ /api/resolver            │     │          │
│    f(x), g(x), a, b, eje, │─────▶│  - arma prompt didáctico │────▶│  Gemini  │
│    método, plantillas     │      │  - pide JSON con esquema │◀────│          │
│ 3. Render 2D/3D (Plotly)  │◀─────│  - API key en env var    │     └──────────┘
│    + verificación Simpson │ JSON └──────────────────────────┘
└───────────────────────────┘
```

* **Interfaz:** `index.html`, `styles.css`, `app.js`, `plantillas.js`
* **Motor de IA:** `api/resolver.js` envía el problema a Gemini y recibe un **JSON estructurado**: continuidad, método, diferencial, pasos con LaTeX, resultado exacto y decimal, unidades y 11 puntos evaluados para graficar.
* **Motor local:** `calculo.js` (math.js + regla de Simpson con n = 10 000). Grafica la curva y **verifica** el resultado de Gemini. Si los dos coinciden aparece el sello «✓ Verificado».

## Fórmulas implementadas

| Caso | Integral |
|---|---|
| Área | A = ∫ₐᵇ \|f(x) − g(x)\| dx |
| Discos (eje X o y = c) | V = π ∫ₐᵇ [f(x) − c]² dx |
| Arandelas (eje X o y = c) | V = π ∫ₐᵇ (R(x)² − r(x)²) dx |
| Capas (eje Y o x = c) | V = 2π ∫ₐᵇ \|x − c\| · [f(x) − g(x)] dx |

## Despliegue: GitHub + Vercel

1. **API key de Gemini:** entra a <https://aistudio.google.com/apikey> → *Create API key*. Cópiala.
2. **GitHub:** crea un repositorio nuevo (por ejemplo `calculo-app`) y sube esta carpeta:
   ```bash
   git init
   git add .
   git commit -m "Calculo App"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/calculo-app.git
   git push -u origin main
   ```
   (También puedes arrastrar los archivos en github.com → *Add file → Upload files*.)
3. **Vercel:** en <https://vercel.com/new> importa el repo.
   * Framework Preset: **Other** (no hay build; Vercel sirve `public/` y la carpeta `api/` como funciones).
   * En **Environment Variables** agrega `GEMINI_API_KEY` = tu key.
   * Opcional: `GEMINI_MODEL` (por defecto `gemini-2.5-flash`).
   * Dale a **Deploy**. El link queda tipo `https://calculo-app.vercel.app`.
4. Si cambias la variable de entorno después, haz **Redeploy** para que tome efecto.

### Probar en tu compu
```bash
npm i -g vercel
vercel dev        # pide login la primera vez; usa .env.local con GEMINI_API_KEY=...
```

## Seguridad
La API key **nunca** se manda al navegador: solo existe como variable de entorno en Vercel y la usa `api/resolver.js`. Las entradas se recortan antes de enviarse al modelo, y las funciones se validan con una lista blanca (solo `x`, constantes y funciones matemáticas).

## Uso rápido
* **Área bajo la curva:** escribe `f(x)`, opcionalmente `g(x)`, los límites (aceptan `pi`, `pi/2`) y presiona *Calcular área con IA*.
* **Sólido de revolución:** elige el eje (X, Y, y = c, x = c). El método se ajusta solo a lo que es válido integrando en dx.
* **Aplicaciones prácticas:** 8 plantillas (botella, jarrón, buje de acero, tanque de concreto, tanque esférico, cúpula, depósito de combustible, terreno) y un botón para que **Gemini proponga un caso nuevo**.
