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
}

function addRow(stack, spacing) {
  let row = stack.addStack()
  row.layoutHorizontally()
  row.spacing = spacing
  return row
}

// ---- Template "default": verde, como el grafico de GitHub ----

function renderDefault(widget, { month, today, grid, countFor, monthTotal }) {
  const HEADER_H = 24, WEEKDAY_H = 13, GAP_AFTER_HEADER = 8, GAP_AFTER_WEEKDAYS = 5
  let side = widgetSide()
  let numRows = grid.length

  // --- Tamanio de celda: el menor que entre a lo ancho y a lo alto ---
  let slot = (side - PADDING * 2) / 7
  let spacing = Math.max(slot * 0.12, 2)
  let availableHeight = side - (PADDING * 2 + HEADER_H + GAP_AFTER_HEADER + WEEKDAY_H + GAP_AFTER_WEEKDAYS)
  let box = Math.max(Math.min(slot - spacing, (availableHeight - spacing * (numRows - 1)) / numRows), 1)

  widget.backgroundColor = new Color("#0d1117")
  widget.setPadding(PADDING, PADDING, PADDING, PADDING)

  // ---- Encabezado: mes a la izquierda, total del mes a la derecha ----
  let header = widget.addStack()
  header.layoutHorizontally()
  header.centerAlignContent()
  addText(header, MONTHS[month], Font.boldSystemFont(17), Color.white())
  header.addSpacer()
  addText(header, `${monthTotal}`, Font.boldSystemFont(17), new Color("#39d353"))
  header.addSpacer(4)
  addText(header, "este mes", Font.mediumSystemFont(10), new Color("#6e7681"))
  widget.addSpacer(GAP_AFTER_HEADER)

  // ---- Iniciales de los dias de la semana ----
  let weekdayRow = addRow(widget, spacing)
  for (let wd of WEEKDAYS) {
    let cell = weekdayRow.addStack()
    cell.size = new Size(box, WEEKDAY_H)
    cell.centerAlignContent()
    addText(cell, wd, Font.mediumSystemFont(10), new Color("#6e7681"))
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
      cell.cornerRadius = Math.min(box * 0.22, 8)

      // Fuera del mes: invisible. Dia futuro: se marca apenas, para mantener la forma del calendario
      let count = day === null ? null : countFor(day)
      cell.backgroundColor = day === null ? Color.clear()
        : count === undefined ? new Color("#0f141a")
        : colorForCount(count)

      // Marca el dia de hoy con un borde
      if (day === today) {
        cell.borderWidth = 1.5
        cell.borderColor = new Color("#58a6ff")
      }
    }
  }

  widget.addSpacer()
}

// ---- Template "glitch": violeta y oro sobre negro, tramado y con cortes ----

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

function drawText(ctx, text, rect, font, color) {
  ctx.setFont(font)
  ctx.setTextColor(new Color(color))
  ctx.drawTextInRect(text, rect)
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
  if (count === undefined) return fill(ctx, rect, GLITCH.future)

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

function renderGlitch(widget, { year, month, today, grid, countFor, monthTotal }) {
  const HEADER_H = 34, WEEKDAY_H = 13, GAP_AFTER_HEADER = 8, GAP_AFTER_WEEKDAYS = 5
  let numRows = grid.length

  // Todo se dibuja en una sola imagen para poder tramar las celdas y correr franjas
  let width = Math.floor(widgetSide() - PADDING * 2)
  let height = width
  let ctx = newContext(width, height)

  // ---- Encabezado: mes a la izquierda, total del mes a la derecha ----
  ctx.setTextAlignedLeft()
  drawText(ctx, MONTHS[month], new Rect(0, 0, width * 0.6, HEADER_H), new Font(HEAVY, 26), GLITCH.text)
  ctx.setTextAlignedRight()
  drawText(ctx, `${monthTotal}`, new Rect(width * 0.6, 0, width * 0.4, 22), new Font(HEAVY, 20), GLITCH.yellow)
  drawText(ctx, "este mes", new Rect(width * 0.6, 22, width * 0.4, 12), new Font(DEMIBOLD, 10), GLITCH.muted)

  // ---- Tamanio de celda ----
  // A diferencia del template verde, las celdas se estiran a lo alto
  // para llenar el widget: quedan como barras y no como cuadrados.
  let spacing = Math.max(Math.round((width / 7) * 0.12), 2)
  let gridTop = HEADER_H + GAP_AFTER_HEADER + WEEKDAY_H + GAP_AFTER_WEEKDAYS
  let cellW = Math.floor((width - spacing * 6) / 7)
  let cellH = Math.floor((height - gridTop - spacing * (numRows - 1)) / numRows)
  let left = Math.floor((width - (cellW * 7 + spacing * 6)) / 2)
  let colX = col => left + col * (cellW + spacing)

  // ---- Iniciales de los dias de la semana ----
  ctx.setTextAlignedCenter()
  WEEKDAYS.forEach((wd, i) => {
    let rect = new Rect(colX(i), HEADER_H + GAP_AFTER_HEADER, cellW, WEEKDAY_H)
    drawText(ctx, wd, rect, new Font(DEMIBOLD, 10), GLITCH.muted)
  })

  // ---- Grilla del mes ----
  grid.forEach((row, r) => row.forEach((day, c) => {
    if (day === null) return   // fuera del mes: no se dibuja

    let cell = new Rect(colX(c), gridTop + r * (cellH + spacing), cellW, cellH)
    drawGlitchCell(ctx, cell, countFor(day))

    // Hoy: un marco amarillo corrido, como una impresion mal registrada
    if (day === today) {
      ctx.setStrokeColor(new Color(GLITCH.yellow))
      ctx.setLineWidth(1)
      ctx.strokeRect(new Rect(cell.x + 2.5, cell.y - 1.5, cellW - 1, cellH - 1))
    }
  }))

  // ---- Cortes: franjas horizontales corridas, como una senial de video trabada ----
  let random = seededRandom(year * 10000 + (month + 1) * 100 + today)
  let between = (min, max) => min + Math.floor(random() * (max - min + 1))
  let bands = [
    // la primera siempre cruza el nombre del mes, sin tocar el total
    { y: between(8, 14), h: between(4, 7), w: Math.round(width * 0.6), dx: between(3, 6) },
    { y: between(gridTop, height - 8), h: between(3, 7), w: width, dx: -between(3, 8) },
    { y: between(gridTop, height - 2), h: between(1, 2), w: width, dx: between(10, 20) },
  ]

  let base = ctx.getImage()
  for (let band of bands) {
    let slice = newContext(band.w, band.h)
    slice.drawImageAtPoint(base, new Point(0, -band.y))
    fill(ctx, new Rect(0, band.y, band.w, band.h), GLITCH.background)
    ctx.drawImageAtPoint(slice.getImage(), new Point(band.dx, band.y))
  }

  widget.backgroundColor = new Color(GLITCH.background)
  widget.setPadding(PADDING, PADDING, PADDING, PADDING)
  widget.addImage(ctx.getImage()).imageSize = new Size(width, height)
}

function renderError(widget, error, template) {
  let glitch = template === "glitch"
  widget.backgroundColor = new Color(glitch ? GLITCH.background : "#0d1117")
  widget.setPadding(PADDING, PADDING, PADDING, PADDING)
  addText(widget, "Error", Font.boldSystemFont(15), new Color(glitch ? GLITCH.yellow : "#f78166"))
  widget.addSpacer(6)
  addText(widget, error.message, Font.systemFont(12), new Color(glitch ? GLITCH.text : "#8b949e"))
}

async function createWidget() {
  let widget = new ListWidget()
  // El parametro del widget gana sobre la constante TEMPLATE.
  // Un nombre desconocido cae en el template verde.
  let template = (args.widgetParameter || TEMPLATE).trim().toLowerCase() === "glitch" ? "glitch" : "default"

  try {
    let data = await loadMonthData()
    if (template === "glitch") renderGlitch(widget, data)
    else renderDefault(widget, data)
  } catch (error) {
    renderError(widget, error, template)
  }
  return widget
}

let widget = await createWidget()

if (config.runsInWidget) Script.setWidget(widget)
else widget.presentLarge()

Script.complete()
