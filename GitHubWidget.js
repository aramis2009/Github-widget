    const GITHUB_TOKEN = "TU_TOKEN_AQUI"

const GITHUB_USER = "TU_USUARIO_AQUI"

// Estilo del widget: "default" (verde, como GitHub) o "glitch" (violeta y oro, tramado).
// Si escribis un estilo en el campo "Parameter" del widget, ese tiene prioridad.
const TEMPLATE = "default"


const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio",
                "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]
const WEEKDAYS = ["D","L","M","M","J","V","S"]
const PADDING = 16

async function getContributions() {
  let query = `{ user(login: "${GITHUB_USER}") { contributionsCollection { contributionCalendar {
    weeks { contributionDays { contributionCount date } } } } } }`

  let req = new Request("https://api.github.com/graphql")
  req.method = "POST"
  req.headers = { "Authorization": `Bearer ${GITHUB_TOKEN}`, "Content-Type": "application/json" }
  req.body = JSON.stringify({ query })

  let res = await req.loadJSON()
  if (!res.data || !res.data.user) throw new Error(res.message || "No se pudo obtener data de GitHub")
  return res.data.user.contributionsCollection.contributionCalendar
}

// Nivel de intensidad de un dia (0 a 4). Lo usan los dos templates.
function level(count) {
  if (count == 0) return 0
  if (count <= 2) return 1
  if (count <= 4) return 2
  if (count <= 6) return 3
  return 4
}

const GREENS = ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"]
const colorForCount = count => new Color(GREENS[level(count)])

// El widget grande se toma como un cuadrado del 86% del lado corto de la pantalla
function widgetSide() {
  let screen = Device.screenSize()
  return Math.min(screen.width, screen.height) * 0.86
}

const pad2 = n => String(n).padStart(2, "0")
const dateKey = (year, month, day) => `${year}-${pad2(month + 1)}-${pad2(day)}`

// Arma la grilla del mes: filas = semanas, columnas = dias (Dom..Sab).
// Las celdas antes del dia 1 o despues del ultimo dia quedan en null.
function buildMonthGrid(year, month) {
  let cells = new Array(new Date(year, month, 1).getDay()).fill(null)
  let daysInMonth = new Date(year, month + 1, 0).getDate()
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  let rows = []
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7))
  return rows
}

// Junta lo que necesitan los dos templates. countFor(dia) devuelve undefined
// para los dias que todavia no llegaron.
async function loadMonthData() {
  let calendar = await getContributions()

  let now = new Date()   // se recalcula cada vez que corre: cambia solo al pasar de mes
  let year = now.getFullYear(), month = now.getMonth(), today = now.getDate()

  let countByDate = {}
  for (let week of calendar.weeks) {
    for (let day of week.contributionDays) countByDate[day.date] = day.contributionCount
  }
  let countFor = day => countByDate[dateKey(year, month, day)]

  let grid = buildMonthGrid(year, month)
  let monthTotal = 0
  for (let day of grid.flat()) if (day !== null) monthTotal += countFor(day) || 0

  return { year, month, today, grid, countFor, monthTotal }
}

function addText(stack, text, font, color) {
  let label = stack.addText(text)
  label.font = font
  label.textColor = color
  return label
}

function addRow(stack, spacing) {
  let row = stack.addStack()
  row.layoutHorizontally()
  row.spacing = spacing
  return row
}

// ---- Tramado del template "glitch": violeta y oro sobre negro ----

const GLITCH = {
  background: "#050505", text: "#ece6ff", muted: "#6b6485",
  empty: "#2b2538",     // dia pasado sin contribuciones
  future: "#0a090e",    // dia del mes que todavia no llego
  violetDim: "#5b43c4", violet: "#8a6cf2", gold: "#d2a54a", yellow: "#f2c45a",
  melt: "#c48fe0",      // tramado al pie de las celdas mas intensas
}
const HEAVY = "AvenirNextCondensed-Heavy", DEMIBOLD = "AvenirNextCondensed-DemiBold"

// Generador pseudoaleatorio con semilla: el mismo dia da los mismos cortes,
// asi el widget no cambia de forma en cada refresco.
function seededRandom(seed) {
  let state = seed >>> 0
  return () => (state = (state * 1664525 + 1013904223) >>> 0) / 4294967296
}

function newContext(width, height) {
  let ctx = new DrawContext()
  ctx.size = new Size(width, height)
  ctx.opaque = false
  ctx.respectScreenScale = true
  return ctx
}

function fill(ctx, rect, color) {
  ctx.setFillColor(new Color(color))
  ctx.fillRect(rect)
}

// Rellena un rectangulo con puntos de 1pt, como un tramado de pixeles.
// "sparse" deja un punto cada 3pt, "grid" uno cada 2pt y "checker" arma un damero.
function fillDither(ctx, rect, color, pattern) {
  let step = pattern === "sparse" ? 3 : 2
  let checker = pattern === "checker"
  let dots = []
  for (let y = rect.y, row = 0; y < rect.y + rect.height; y += checker ? 1 : step, row++) {
    for (let x = rect.x + (checker ? row % 2 : 0); x < rect.x + rect.width; x += step) {
      dots.push(new Rect(x, y, 1, 1))
    }
  }
  let path = new Path()
  path.addRects(dots)
  ctx.addPath(path)
  ctx.setFillColor(new Color(color))
  ctx.fillPath()
}

// La intensidad sube por densidad de puntos y por color. Las celdas de nivel 3 y 4
// llevan al pie una franja tramada de otro color.
function drawGlitchCell(ctx, rect, count) {
  let meltH = Math.max(Math.round(rect.height * 0.22), 3)
  let top = new Rect(rect.x, rect.y, rect.width, rect.height - meltH)
  let melt = new Rect(rect.x, rect.y + rect.height - meltH, rect.width, meltH)

  switch (level(count)) {
    case 0: return fillDither(ctx, rect, GLITCH.empty, "sparse")
    case 1: return fillDither(ctx, rect, GLITCH.violetDim, "grid")
    case 2: return fillDither(ctx, rect, GLITCH.violet, "checker")
    case 3:
      fillDither(ctx, top, GLITCH.gold, "checker")
      return fillDither(ctx, melt, GLITCH.violet, "checker")
    default:
      fill(ctx, top, GLITCH.yellow)
      fill(ctx, melt, GLITCH.melt)
      fillDither(ctx, melt, GLITCH.yellow, "checker")
  }
}

// Imagen de fondo de una celda. Con "tear", una franja horizontal queda corrida,
// como una senial de video trabada. Cada contexto se cierra con su getImage():
// en Scriptable no se sigue dibujando sobre un contexto despues de sacarle la imagen.
const glitchImages = {}
function glitchCellImage(box, count, tear) {
  let key = level(count)
  if (!tear && glitchImages[key]) return glitchImages[key]

  let ctx = newContext(box, box)
  drawGlitchCell(ctx, new Rect(0, 0, box, box), count)
  let image = ctx.getImage()
  if (!tear) return (glitchImages[key] = image)

  let slice = newContext(box, tear.h)
  slice.drawImageAtPoint(image, new Point(0, -tear.y))
  let strip = slice.getImage()

  let torn = newContext(box, box)
  torn.drawImageAtPoint(image, new Point(0, 0))
  fill(torn, new Rect(0, tear.y, box, tear.h), GLITCH.background)
  torn.drawImageAtPoint(strip, new Point(tear.dx, tear.y))
  return torn.getImage()
}

// Elige hasta tres dias con contribuciones para mostrarlos trabados.
function pickTears({ year, month, today, countFor }, box) {
  let random = seededRandom(year * 10000 + (month + 1) * 100 + today)
  let between = (min, max) => min + Math.floor(random() * (max - min + 1))

  let candidates = []
  for (let day = 1; day <= today; day++) if (countFor(day) > 0) candidates.push(day)

  let tears = {}
  for (let i = 0; i < 3 && candidates.length > 0; i++) {
    let day = candidates.splice(between(0, candidates.length - 1), 1)[0]
    let h = between(2, 4)
    tears[day] = { y: between(2, Math.floor(box) - h - 2), h, dx: between(3, 6) * (random() < 0.5 ? -1 : 1) }
  }
  return tears
}

// ---- Templates ----
// Todos usan el mismo orden: encabezado, dias de la semana y grilla del mes.
// Cada template solo define colores, fuentes y como se pinta cada celda.

const THEMES = {
  default: {
    background: new Color("#0d1117"),
    monthFont: Font.boldSystemFont(17), monthColor: Color.white(),
    countFont: Font.boldSystemFont(17), countColor: new Color("#39d353"),
    smallFont: Font.mediumSystemFont(10), mutedColor: new Color("#6e7681"),
    todayColor: new Color("#58a6ff"),
    errorColor: new Color("#f78166"), errorTextColor: new Color("#8b949e"),
    cornerRadius: box => Math.min(box * 0.22, 8),
    // Dia futuro: se marca apenas, para mantener la forma del calendario
    paintCell: (cell, count) => {
      cell.backgroundColor = count === undefined ? new Color("#0f141a") : colorForCount(count)
    },
  },

  glitch: {
    background: new Color(GLITCH.background),
    monthFont: new Font(HEAVY, 17), monthColor: new Color(GLITCH.text),
    // Sombra violeta corrida y sin desenfoque: el nombre del mes se ve doble
    monthShadow: new Color(GLITCH.violet),
    countFont: new Font(HEAVY, 17), countColor: new Color(GLITCH.yellow),
    smallFont: new Font(DEMIBOLD, 10), mutedColor: new Color(GLITCH.muted),
    todayColor: new Color(GLITCH.yellow),
    errorColor: new Color(GLITCH.yellow), errorTextColor: new Color(GLITCH.text),
    cornerRadius: () => 0,
    pickTears,
    paintCell: (cell, count, box, tear) => {
      if (count === undefined) cell.backgroundColor = new Color(GLITCH.future)
      else cell.backgroundImage = glitchCellImage(box, count, tear)
    },
  },
}

function renderCalendar(widget, theme, data) {
  let { month, today, grid, countFor, monthTotal } = data
  const HEADER_H = 24, WEEKDAY_H = 13, GAP_AFTER_HEADER = 8, GAP_AFTER_WEEKDAYS = 5
  let side = widgetSide()
  let numRows = grid.length

  // --- Tamanio de celda: el menor que entre a lo ancho y a lo alto ---
  let slot = (side - PADDING * 2) / 7
  let spacing = Math.max(slot * 0.12, 2)
  let availableHeight = side - (PADDING * 2 + HEADER_H + GAP_AFTER_HEADER + WEEKDAY_H + GAP_AFTER_WEEKDAYS)
  let box = Math.max(Math.min(slot - spacing, (availableHeight - spacing * (numRows - 1)) / numRows), 1)
  let tears = theme.pickTears ? theme.pickTears(data, box) : {}

  widget.backgroundColor = theme.background
  widget.setPadding(PADDING, PADDING, PADDING, PADDING)

  // ---- Encabezado: mes a la izquierda, total del mes a la derecha ----
  let header = widget.addStack()
  header.layoutHorizontally()
  header.centerAlignContent()
  let monthLabel = addText(header, MONTHS[month], theme.monthFont, theme.monthColor)
  if (theme.monthShadow) {
    monthLabel.shadowColor = theme.monthShadow
    monthLabel.shadowOffset = new Point(-2, 0)
    monthLabel.shadowRadius = 0
  }
  header.addSpacer()
  addText(header, `${monthTotal}`, theme.countFont, theme.countColor)
  header.addSpacer(4)
  addText(header, "este mes", theme.smallFont, theme.mutedColor)
  widget.addSpacer(GAP_AFTER_HEADER)

  // ---- Iniciales de los dias de la semana ----
  let weekdayRow = addRow(widget, spacing)
  for (let wd of WEEKDAYS) {
    let cell = weekdayRow.addStack()
    cell.size = new Size(box, WEEKDAY_H)
    cell.centerAlignContent()
    addText(cell, wd, theme.smallFont, theme.mutedColor)
  }
  widget.addSpacer(GAP_AFTER_WEEKDAYS)

  // ---- Grilla del mes ----
  let gridStack = widget.addStack()
  gridStack.layoutVertically()
  gridStack.spacing = spacing

  for (let row of grid) {
    let rowStack = addRow(gridStack, spacing)
    for (let day of row) {
      let cell = rowStack.addStack()
      cell.size = new Size(box, box)
      cell.cornerRadius = theme.cornerRadius(box)

      if (day === null) {
        cell.backgroundColor = Color.clear()   // fuera del mes: invisible
        continue
      }
      theme.paintCell(cell, countFor(day), box, tears[day])

      // Marca el dia de hoy con un borde
      if (day === today) {
        cell.borderWidth = 1.5
        cell.borderColor = theme.todayColor
      }
    }
  }

  widget.addSpacer()
}

function renderError(widget, error, theme) {
  widget.backgroundColor = theme.background
  widget.setPadding(PADDING, PADDING, PADDING, PADDING)
  addText(widget, "Error", Font.boldSystemFont(15), theme.errorColor)
  widget.addSpacer(6)
  addText(widget, error.message, Font.systemFont(12), theme.errorTextColor)
}

async function createWidget() {
  let widget = new ListWidget()
  // El parametro del widget gana sobre la constante TEMPLATE.
  // Un nombre desconocido cae en el template verde.
  let name = (args.widgetParameter || TEMPLATE).trim().toLowerCase()
  let theme = name === "glitch" ? THEMES.glitch : THEMES.default

  try {
    renderCalendar(widget, theme, await loadMonthData())
  } catch (error) {
    renderError(widget, error, theme)
  }
  return widget
}

let widget = await createWidget()

if (config.runsInWidget) Script.setWidget(widget)
else widget.presentLarge()

Script.complete()
