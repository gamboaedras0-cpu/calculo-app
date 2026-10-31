/* Plantillas de aplicaciones prácticas preconfiguradas */
window.PLANTILLAS = [
  {
    id: 'botella', categoria: 'Diseño industrial', icono: '🍾',
    titulo: 'Botella de vidrio',
    contexto: 'Botella de 25 cm de alto: cuerpo de 3.5 cm de radio que se angosta suavemente hasta un cuello de 1.25 cm. Su perfil se modela con una función logística y se gira alrededor del eje X para obtener la capacidad.',
    tipo: 'volumen', f: '1.25 + 2.25/(1 + e^(1.2*(x - 17)))', g: '', a: 0, b: 25, eje: 'x', metodo: 'discos', unidad: 'cm'
  },
  {
    id: 'jarron', categoria: 'Diseño industrial', icono: '🏺',
    titulo: 'Vasija / jarrón cerámico',
    contexto: 'Jarrón torneado de 18 cm de alto cuyo radio varía según una onda senoidal (base, panza y boca). El volumen indica cuánta agua contiene.',
    tipo: 'volumen', f: '3 + 1.5*sin(x/3)', g: '', a: 0, b: 18, eje: 'x', metodo: 'discos', unidad: 'cm'
  },
  {
    id: 'buje', categoria: 'Manufactura', icono: '⚙️',
    titulo: 'Buje mecánico de acero',
    contexto: 'Buje cilíndrico de 6 cm de largo, radio exterior 2.5 cm y agujero central de 1 cm de radio. Con la densidad del acero (7.85 g/cm³) se obtiene la masa de material.',
    tipo: 'volumen', f: '2.5', g: '1', a: 0, b: 6, eje: 'x', metodo: 'arandelas', unidad: 'cm',
    extra: (v) => `Masa de acero ≈ ${(v * 7.85).toFixed(1)} g`
  },
  {
    id: 'tanque-cil', categoria: 'Obras civiles', icono: '🏗️',
    titulo: 'Tanque cilíndrico de concreto',
    contexto: 'Tanque de agua de 4 m de altura, radio interior 3 m y pared de 25 cm. Girando la sección de la pared (entre r = 3 y R = 3.25) se obtiene el volumen de concreto de las paredes.',
    tipo: 'volumen', f: '3.25', g: '3', a: 0, b: 4, eje: 'x', metodo: 'arandelas', unidad: 'm',
    extra: (v) => `Concreto ≈ ${v.toFixed(2)} m³ (≈ ${Math.ceil(v * 7)} sacos de cemento a 7 sacos/m³)`
  },
  {
    id: 'tanque-esf', categoria: 'Obras civiles', icono: '🌐',
    titulo: 'Tanque esférico de agua',
    contexto: 'Tanque esférico elevado de 4 m de radio. La semicircunferencia y = √(16 − x²) girada alrededor del eje X genera la esfera; el volumen es su capacidad.',
    tipo: 'volumen', f: 'sqrt(16 - x^2)', g: '', a: -4, b: 4, eje: 'x', metodo: 'discos', unidad: 'm'
  },
  {
    id: 'cupula', categoria: 'Arquitectura', icono: '🕌',
    titulo: 'Cúpula hemisférica',
    contexto: 'Cúpula de 6 m de radio sobre una sala. Al girar y = √(36 − x²) alrededor del eje Y (capas cilíndricas) se obtiene el volumen de aire interior, útil para dimensionar la ventilación.',
    tipo: 'volumen', f: 'sqrt(36 - x^2)', g: '', a: 0, b: 6, eje: 'y', metodo: 'capas', unidad: 'm'
  },
  {
    id: 'combustible', categoria: 'Física y mediciones', icono: '⛽',
    titulo: 'Depósito de combustible irregular',
    contexto: 'Depósito de 6 m de largo con sección circular de radio variable por abolladuras y refuerzos. Su perfil irregular se aproxima con una función y el volumen da la capacidad real.',
    tipo: 'volumen', f: '1 + 0.25*sin(1.2*x) + 0.04*x', g: '', a: 0, b: 6, eje: 'x', metodo: 'discos', unidad: 'm'
  },
  {
    id: 'parcela', categoria: 'Topografía', icono: '🗺️',
    titulo: 'Área de un terreno curvo',
    contexto: 'Terreno limitado por un camino recto (y = 0.5x) y la orilla de un río (y = 8 − 0.1x²), entre x = 0 y x = 8 metros. El área entre curvas da los m² de la parcela.',
    tipo: 'area', f: '8 - 0.1*x^2', g: '0.5*x', a: 0, b: 8, eje: 'x', metodo: 'discos', unidad: 'm'
  }
];

window.EJEMPLOS = {
  area: [
    { t: 'x²  [0,2]', f: 'x^2', g: '', a: '0', b: '2' },
    { t: 'sin x  [0,π]', f: 'sin(x)', g: '', a: '0', b: 'pi' },
    { t: 'x y x²', f: 'x', g: 'x^2', a: '0', b: '1' },
    { t: 'eˣ  [0,1]', f: 'e^x', g: '', a: '0', b: '1' }
  ],
  volumen: [
    { t: 'x² · eje X', f: 'x^2', g: '', a: '0', b: '2', eje: 'x', metodo: 'discos' },
    { t: '√x · eje X', f: 'sqrt(x)', g: '', a: '0', b: '4', eje: 'x', metodo: 'discos' },
    { t: 'x y x² · arandelas', f: 'x', g: 'x^2', a: '0', b: '1', eje: 'x', metodo: 'arandelas' },
    { t: 'x² · eje Y', f: 'x^2', g: '', a: '0', b: '2', eje: 'y', metodo: 'capas' },
    { t: 'x y x² · y = −1', f: 'x', g: 'x^2', a: '0', b: '1', eje: 'yc', c: '-1', metodo: 'arandelas' }
  ]
};
