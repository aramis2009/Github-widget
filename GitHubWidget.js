const GITHUB_TOKEN = "TU_TOKEN_AQUI"

const GITHUB_USER = "TU_USUARIO_AQUI"


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

async function createWidget() {
  let widget = new ListWidget()

  try {
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

    let grid = buildMonthGrid(year, month)
    let numRows = grid.length

    // Suma las contribuciones de todos los dias de este mes
    let daysInMonth = new Date(year, month + 1, 0).getDate()
    let monthTotal = 0
    for (let d = 1; d <= daysInMonth; d++) {
      let key = `${year}-${pad2(month + 1)}-${pad2(d)}`
      if (countByDate[key] !== undefined) monthTotal += countByDate[key]
    }

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

        let key = `${year}-${pad2(month + 1)}-${pad2(day)}`
        let count = countByDate[key]

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

  } catch (error) {
    widget.backgroundColor = new Color("#0d1117")
    widget.setPadding(16, 16, 16, 16)
    let errTitle = widget.addText("Error")
    errTitle.font = Font.boldSystemFont(15)
    errTitle.textColor = new Color("#f78166")
    widget.addSpacer(6)
    let errMsg = widget.addText(error.message)
    errMsg.font = Font.systemFont(12)
    errMsg.textColor = new Color("#8b949e")
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
