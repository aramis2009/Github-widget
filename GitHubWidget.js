const GITHUB_TOKEN = "TU_TOKEN_AQUI"

const GITHUB_USER = "TU_USUARIO_AQUI"

// Estilo del widget: "default" (verde, como GitHub) o "glitch" (violeta y oro, tramado).
// Si escribis un estilo en el campo "Parameter" del widget, ese tiene prioridad.
const TEMPLATE = "default"


const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio",
                "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]
const WEEKDAYS = ["D","L","M","M","J","V","S"]

async function getContributions() {
  let query = `
  {
    user(login: "${GITHUB_USER}") {
      contributionsCollection {
        contributionCalendar {
          weeks {
            contributionDays {
              contributionCount
              date
            }
          }
        }
      }
    }
  }`

  let req = new Request("https://api.github.com/graphql")
  req.method = "POST"
  req.headers = {
    "Authorization": `Bearer ${GITHUB_TOKEN}`,
    "Content-Type": "application/json"
  }
  req.body = JSON.stringify({ query: query })

  let res = await req.loadJSON()
  if (!res.data || !res.data.user) {
    throw new Error(res.message || "No se pudo obtener data de GitHub")
  }
  return res.data.user.contributionsCollection.contributionCalendar
}

function colorForCount(count) {
  if (count == 0) return new Color("#161b22")
  if (count <= 2) return new Color("#0e4429")
  if (count <= 4) return new Color("#006d32")
  if (count <= 6) return new Color("#26a641")
  return new Color("#39d353")
}

function getLargeWidgetSize() {
  let screen = Device.screenSize()
  let side = Math.min(screen.width, screen.height) * 0.86
  return { width: side, height: side }
}

function pad2(n) {
  return n < 10 ? "0" + n : "" + n
}

// Arma la grilla del mes: filas = semanas, columnas = dias (Dom..Sab).
// Las celdas antes del dia 1 o despues del ultimo dia quedan en null.
function buildMonthGrid(year, month) {
  let daysInMonth = new Date(year, month + 1, 0).getDate()
  let firstWeekday = new Date(year, month, 1).getDay()

  let rows = []
  let row = new Array(7).fill(null)
  let cursor = firstWeekday

  for (let d = 1; d <= daysInMonth; d++) {
    row[cursor] = d
    cursor++
    if (cursor === 7) {
      rows.push(row)
      row = new Array(7).fill(null)
      cursor = 0
    }
  }
  if (cursor !== 0) rows.push(row)

  return rows
}

function dateKey(year, month, day) {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`
}

// Junta lo que necesitan los dos templates: la grilla del mes,
// las contribuciones de cada dia y el total del mes.
async function loadMonthData() {
  let calendar = await getContributions()

  let now = new Date()
  let year = now.getFullYear()
  let month = now.getMonth()   // se recalcula cada vez que corre: cambia solo al pasar de mes
  let today = now.getDate()

  // Diccionario fecha -> contribuciones
  let countByDate = {}
  for (let week of calendar.weeks) {
    for (let day of week.contributionDays) {
      countByDate[day.date] = day.contributionCount
    }
  }

  // Suma las contribuciones de todos los dias de este mes
  let daysInMonth = new Date(year, month + 1, 0).getDate()
  let monthTotal = 0
  for (let d = 1; d <= daysInMonth; d++) {
    let key = dateKey(year, month, d)
    if (countByDate[key] !== undefined) monthTotal += countByDate[key]
  }

  return { year, month, today, grid: buildMonthGrid(year, month), countByDate, monthTotal }
}

// ---- Template "default": verde, como el grafico de GitHub ----

function renderDefault(widget, data) {
  let { year, month, today, grid, countByDate, monthTotal } = data
  let numRows = grid.length

  let size = getLargeWidgetSize()
  const PADDING = 16
  const HEADER_H = 24
  const WEEKDAY_H = 13
  const GAP_AFTER_HEADER = 8
  const GAP_AFTER_WEEKDAYS = 5

  // --- Tamanio de celda ---
  let availableWidth = size.width - (PADDING * 2)
  let slot = availableWidth / 7
  let spacing = Math.max(slot * 0.12, 2)
  let boxByWidth = slot - spacing

  let usedVertical = (PADDING * 2) + HEADER_H + GAP_AFTER_HEADER + WEEKDAY_H + GAP_AFTER_WEEKDAYS
  let availableHeight = size.height - usedVertical
  let boxByHeight = (availableHeight - (spacing * (numRows - 1))) / numRows

  let box = Math.max(Math.min(boxByWidth, boxByHeight), 1)

  widget.backgroundColor = new Color("#0d1117")
  widget.setPadding(PADDING, PADDING, PADDING, PADDING)

  // ---- Encabezado: nombre del mes ----
  let header = widget.addStack()
  header.layoutHorizontally()
  header.centerAlignContent()

  let monthLabel = header.addText(MONTHS[month])
  monthLabel.font = Font.boldSystemFont(17)
  monthLabel.textColor = Color.white()

  header.addSpacer()

  let countLabel = header.addText(`${monthTotal}`)
  countLabel.font = Font.boldSystemFont(17)
  countLabel.textColor = new Color("#39d353")

  header.addSpacer(4)

  let countCaption = header.addText("este mes")
  countCaption.font = Font.mediumSystemFont(10)
  countCaption.textColor = new Color("#6e7681")

  widget.addSpacer(GAP_AFTER_HEADER)

  // ---- Iniciales de los dias de la semana ----
  let weekdayRow = widget.addStack()
  weekdayRow.layoutHorizontally()
  weekdayRow.spacing = spacing

  for (let wd of WEEKDAYS) {
    let cell = weekdayRow.addStack()
    cell.size = new Size(box, WEEKDAY_H)
    cell.centerAlignContent()
    let label = cell.addText(wd)
    label.font = Font.mediumSystemFont(10)
    label.textColor = new Color("#6e7681")
  }

  widget.addSpacer(GAP_AFTER_WEEKDAYS)

  // ---- Grilla del mes ----
  let gridStack = widget.addStack()
  gridStack.layoutVertically()
  gridStack.spacing = spacing

  for (let row of grid) {
    let rowStack = gridStack.addStack()
    rowStack.layoutHorizontally()
    rowStack.spacing = spacing

    for (let day of row) {
      let cell = rowStack.addStack()
      cell.size = new Size(box, box)
      cell.cornerRadius = Math.min(box * 0.22, 8)

      if (day === null) {
        // Fuera del mes: invisible
        cell.backgroundColor = Color.clear()
        continue
      }

      let count = countByDate[dateKey(year, month, day)]

      if (count === undefined) {
        // Dia futuro del mes: se marca apenas, para mantener la forma del calendario
        cell.backgroundColor = new Color("#0f141a")
      } else {
        cell.backgroundColor = colorForCount(count)
      }

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
  background: "#050505",
  text: "#ece6ff",
  muted: "#6b6485",
  empty: "#2b2538",     // dia pasado sin contribuciones
  future: "#0a090e",    // dia del mes que todavia no llego
  violetDim: "#5b43c4",
  violet: "#8a6cf2",
  gold: "#d2a54a",
  yellow: "#f2c45a",
  melt: "#c48fe0",      // tramado al pie de las celdas mas intensas
}

// Generador pseudoaleatorio con semilla: el mismo dia da los mismos cortes,
// asi el widget no cambia de forma en cada refresco.
function seededRandom(seed) {
  let state = seed >>> 0
  return function () {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

// Rellena un rectangulo con puntos de 1pt, como un tramado de pixeles.
// "sparse" deja un punto cada 3pt, "grid" uno cada 2pt y "checker" arma un damero.
function fillDither(ctx, rect, color, pattern) {
  let step = pattern === "sparse" ? 3 : 2
  let rowStep = pattern === "checker" ? 1 : step
  let dots = []
  let row = 0
  for (let y = rect.y; y < rect.y + rect.height; y += rowStep) {
    let shift = pattern === "checker" ? row % 2 : 0
    for (let x = rect.x + shift; x < rect.x + rect.width; x += step) {
      dots.push(new Rect(x, y, 1, 1))
    }
    row++
  }
  let path = new Path()
  path.addRects(dots)
  ctx.addPath(path)
  ctx.setFillColor(new Color(color))
  ctx.fillPath()
}

// Mismos cortes que colorForCount: la intensidad sube por densidad de puntos y por color.
function drawGlitchCell(ctx, rect, count) {
  let meltH = Math.max(Math.round(rect.height * 0.22), 3)
  let top = new Rect(rect.x, rect.y, rect.width, rect.height - meltH)
  let melt = new Rect(rect.x, rect.y + rect.height - meltH, rect.width, meltH)

  if (count === undefined) {
    ctx.setFillColor(new Color(GLITCH.future))
    ctx.fillRect(rect)
  } else if (count == 0) {
    fillDither(ctx, rect, GLITCH.empty, "sparse")
  } else if (count <= 2) {
    fillDither(ctx, rect, GLITCH.violetDim, "grid")
  } else if (count <= 4) {
    fillDither(ctx, rect, GLITCH.violet, "checker")
  } else if (count <= 6) {
    fillDither(ctx, top, GLITCH.gold, "checker")
    fillDither(ctx, melt, GLITCH.violet, "checker")
  } else {
    ctx.setFillColor(new Color(GLITCH.yellow))
    ctx.fillRect(top)
    ctx.setFillColor(new Color(GLITCH.melt))
    ctx.fillRect(melt)
    fillDither(ctx, melt, GLITCH.yellow, "checker")
  }
}

function renderGlitch(widget, data) {
  let { year, month, today, grid, countByDate, monthTotal } = data
  let numRows = grid.length

  let size = getLargeWidgetSize()
  const PADDING = 16
  const HEADER_H = 34
  const WEEKDAY_H = 13
  const GAP_AFTER_HEADER = 8
  const GAP_AFTER_WEEKDAYS = 5

  // Todo se dibuja en una sola imagen para poder tramar las celdas y correr franjas
  let width = Math.floor(size.width - (PADDING * 2))
  let height = Math.floor(size.height - (PADDING * 2))

  let ctx = new DrawContext()
  ctx.size = new Size(width, height)
  ctx.opaque = false
  ctx.respectScreenScale = true

  // ---- Encabezado: mes a la izquierda, total del mes a la derecha ----
  ctx.setTextAlignedLeft()
  ctx.setFont(new Font("AvenirNextCondensed-Heavy", 26))
  ctx.setTextColor(new Color(GLITCH.text))
  ctx.drawTextInRect(MONTHS[month], new Rect(0, 0, width * 0.6, HEADER_H))

  ctx.setTextAlignedRight()
  ctx.setFont(new Font("AvenirNextCondensed-Heavy", 20))
  ctx.setTextColor(new Color(GLITCH.yellow))
  ctx.drawTextInRect(`${monthTotal}`, new Rect(width * 0.6, 0, width * 0.4, 22))
  ctx.setFont(new Font("AvenirNextCondensed-DemiBold", 10))
  ctx.setTextColor(new Color(GLITCH.muted))
  ctx.drawTextInRect("este mes", new Rect(width * 0.6, 22, width * 0.4, 12))

  // ---- Tamanio de celda ----
  // A diferencia del template verde, las celdas se estiran a lo alto
  // para llenar el widget: quedan como barras y no como cuadrados.
  let spacing = Math.max(Math.round((width / 7) * 0.12), 2)
  let gridTop = HEADER_H + GAP_AFTER_HEADER + WEEKDAY_H + GAP_AFTER_WEEKDAYS
  let cellW = Math.floor((width - (spacing * 6)) / 7)
  let cellH = Math.floor((height - gridTop - (spacing * (numRows - 1))) / numRows)
  let left = Math.floor((width - (cellW * 7 + spacing * 6)) / 2)

  // ---- Iniciales de los dias de la semana ----
  ctx.setTextAlignedCenter()
  ctx.setFont(new Font("AvenirNextCondensed-DemiBold", 10))
  ctx.setTextColor(new Color(GLITCH.muted))
  WEEKDAYS.forEach((wd, i) => {
    let x = left + i * (cellW + spacing)
    ctx.drawTextInRect(wd, new Rect(x, HEADER_H + GAP_AFTER_HEADER, cellW, WEEKDAY_H))
  })

  // ---- Grilla del mes ----
  grid.forEach((row, r) => {
    row.forEach((day, c) => {
      if (day === null) return   // fuera del mes: no se dibuja

      let cell = new Rect(left + c * (cellW + spacing), gridTop + r * (cellH + spacing), cellW, cellH)
      drawGlitchCell(ctx, cell, countByDate[dateKey(year, month, day)])

      // Hoy: un marco amarillo corrido, como una impresion mal registrada
      if (day === today) {
        ctx.setStrokeColor(new Color(GLITCH.yellow))
        ctx.setLineWidth(1)
        ctx.strokeRect(new Rect(cell.x + 2.5, cell.y - 1.5, cellW - 1, cellH - 1))
      }
    })
  })

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
    let slice = new DrawContext()
    slice.size = new Size(band.w, band.h)
    slice.opaque = false
    slice.respectScreenScale = true
    slice.drawImageAtPoint(base, new Point(0, -band.y))

    ctx.setFillColor(new Color(GLITCH.background))
    ctx.fillRect(new Rect(0, band.y, band.w, band.h))
    ctx.drawImageAtPoint(slice.getImage(), new Point(band.dx, band.y))
  }

  widget.backgroundColor = new Color(GLITCH.background)
  widget.setPadding(PADDING, PADDING, PADDING, PADDING)
  let image = widget.addImage(ctx.getImage())
  image.imageSize = new Size(width, height)
}

function renderError(widget, error, template) {
  let glitch = template === "glitch"
  widget.backgroundColor = new Color(glitch ? GLITCH.background : "#0d1117")
  widget.setPadding(16, 16, 16, 16)
  let errTitle = widget.addText("Error")
  errTitle.font = Font.boldSystemFont(15)
  errTitle.textColor = new Color(glitch ? GLITCH.yellow : "#f78166")
  widget.addSpacer(6)
  let errMsg = widget.addText(error.message)
  errMsg.font = Font.systemFont(12)
  errMsg.textColor = new Color(glitch ? GLITCH.text : "#8b949e")
}

// El parametro del widget gana sobre la constante TEMPLATE.
// Un nombre desconocido cae en el template verde.
function pickTemplate() {
  let chosen = (args.widgetParameter || TEMPLATE).trim().toLowerCase()
  return chosen === "glitch" ? "glitch" : "default"
}

async function createWidget() {
  let widget = new ListWidget()
  let template = pickTemplate()

  try {
    let data = await loadMonthData()
    if (template === "glitch") {
      renderGlitch(widget, data)
    } else {
      renderDefault(widget, data)
    }
  } catch (error) {
    renderError(widget, error, template)
  }

  return widget
}

let widget = await createWidget()

if (config.runsInWidget) {
  Script.setWidget(widget)
} else {
  widget.presentLarge()
}

Script.complete()
