# GitHub Contributions Widget

Widget para la pantalla de inicio de iPhone que muestra tus contribuciones de GitHub del mes actual, con el estilo de cuadrados verdes de la plataforma. Corre sobre [Scriptable](https://scriptable.app) (gratis, App Store) y no depende de ningún backend propio: consulta la API de GitHub directamente desde el widget.

<img src="assets/screenshot.jpg" alt="Captura del widget" width="320">

## Características

- Calendario del mes en curso: 7 columnas (días de la semana) por la cantidad de semanas que tenga el mes.
- Cambia de mes automáticamente, porque el mes se calcula en cada ejecución.
- Contador de contribuciones acumuladas del mes, visible en el encabezado.
- El día de hoy queda marcado con un borde.
- Los días futuros del mes se pintan tenues, para mantener la forma del calendario sin mostrar datos que no existen.
- Tamaño de celda calculado a partir de `Device.screenSize()`, así que se adapta a cualquier iPhone.
- Pensado para el tamaño de widget grande.
- Dos templates con el mismo diseño: el verde de GitHub (por defecto) y `glitch`, en violeta y oro con tramado de píxeles.

## Requisitos

- iPhone con iOS 14 o superior.
- App [Scriptable](https://apps.apple.com/app/scriptable/id1405459188) (gratis).
- Cuenta de GitHub.

## Instalación

### 1. Instalar Scriptable

Descargala desde la App Store: [apps.apple.com/app/scriptable](https://apps.apple.com/app/scriptable/id1405459188).

### 2. Crear el Personal Access Token

El widget usa la API GraphQL de GitHub para leer el calendario de contribuciones, y esa API **solo acepta tokens classic**, no fine-grained.

1. Entrá a [github.com/settings/tokens](https://github.com/settings/tokens).
2. **Generate new token → Generate new token (classic)**.
3. Ponele un nombre (por ejemplo `scriptable-widget`) y una expiración.
4. Marcá el permiso `read:user`. No necesitás nada más.
5. Generá el token y copialo — GitHub solo lo muestra una vez.

> Un token **fine-grained** no funciona acá: la API GraphQL de contribuciones no lo reconoce y vas a obtener errores de autenticación aunque el token sea válido.

### 3. Pegar el script

1. Abrí Scriptable y creá un script nuevo.
2. Pegá el contenido de [`GitHubWidget.js`](GitHubWidget.js).
3. Reemplazá los dos placeholders al principio del archivo:

```js
const GITHUB_TOKEN = "TU_TOKEN_AQUI"
const GITHUB_USER = "TU_USUARIO_AQUI"
```

por tu token classic y tu nombre de usuario de GitHub.

4. Corré el script una vez desde Scriptable para confirmar que carga bien (`widget.presentLarge()` se ejecuta automáticamente fuera del widget).

### 4. Agregar el widget a la pantalla de inicio

1. Mantené presionada la pantalla de inicio hasta que entre en modo edición.
2. Tocá **+** y buscá **Scriptable**.
3. Elegí el tamaño **grande**.
4. Agregalo y tocá el widget recién puesto para configurarlo.
5. En **Script** elegí el archivo que pegaste. Dejá **When Interacting** en `Run Script` u **Open App**, como prefieras.

## Templates

El widget trae dos estilos. Los dos tienen el mismo diseño (mes y total arriba, días de la semana y la grilla del mes); cambian los colores, las fuentes y el relleno de las celdas.

- **`default`**: el verde de GitHub, con celdas redondeadas.
- **`glitch`**: fondo negro, celdas cuadradas tramadas en violeta, oro y amarillo, y el nombre del mes con una sombra violeta corrida.

En `glitch` la intensidad se lee por la densidad del tramado y el color: puntos sueltos para los días sin contribuciones, violeta tenue, violeta denso, oro y amarillo sólido para los días con más actividad. Hasta tres días con contribuciones aparecen "trabados", con una franja de la celda corrida hacia un costado. Cuáles son cambia una vez por día, no en cada refresco.

Para elegirlo, cambiá la constante al principio del script:

```js
const TEMPLATE = "default"
```

por `"glitch"`. También podés dejar la constante como está y escribir `glitch` en el campo **Parameter** al configurar el widget. Así podés tener dos widgets con el mismo script y un estilo distinto en cada uno. El parámetro tiene prioridad sobre la constante, y un nombre que no existe vuelve al template verde.

Cada template es una entrada del objeto `THEMES` en `GitHubWidget.js`. Ahí se cambian sus colores y fuentes, como se explica en [Personalización](#personalización).

## Personalización

Todos son fragmentos reales de `GitHubWidget.js`.

### Para los dos templates

**Cuántas contribuciones hacen falta para cada intensidad**:

```js
function level(count) {
  if (count == 0) return 0
  if (count <= 2) return 1
  if (count <= 4) return 2
  if (count <= 6) return 3
  return 4
}
```

Los dos templates usan esta función, así que si cambiás los cortes cambian en los dos.

**Idioma de meses y días de la semana**:

```js
const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio",
                "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]
const WEEKDAYS = ["D","L","M","M","J","V","S"]
```

Cambiá estos dos arrays para otro idioma. `WEEKDAYS` empieza en domingo (índice 0), igual que `Date.getDay()` en JavaScript.

### Template `default`

**Paleta de verdes**, del día sin contribuciones (nivel 0) al de más actividad (nivel 4):

```js
const GREENS = ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"]
```

**Colores, fuentes, borde del día actual y redondeo**, en `THEMES.default`:

```js
default: {
  background: new Color("#0d1117"),
  monthFont: Font.boldSystemFont(17), monthColor: Color.white(),
  countFont: Font.boldSystemFont(17), countColor: new Color("#39d353"),
  smallFont: Font.mediumSystemFont(10), mutedColor: new Color("#6e7681"),
  todayColor: new Color("#58a6ff"),
  errorColor: new Color("#f78166"), errorTextColor: new Color("#8b949e"),
  cornerRadius: box => Math.min(box * 0.22, 8),
```

`countColor` es el color del total del mes y `todayColor` el del borde del día actual. Subí el `0.22` de `cornerRadius` para celdas más redondeadas, bajalo para celdas más cuadradas.

### Template `glitch`

**Paleta**:

```js
const GLITCH = {
  background: "#050505", text: "#ece6ff", muted: "#6b6485",
  empty: "#2b2538",     // dia pasado sin contribuciones
  future: "#0a090e",    // dia del mes que todavia no llego
  violetDim: "#5b43c4", violet: "#8a6cf2", gold: "#d2a54a", yellow: "#f2c45a",
  melt: "#c48fe0",      // tramado al pie de las celdas mas intensas
}
```

`violetDim`, `violet`, `gold` y `yellow` van del nivel 1 al 4. Las fuentes, el color del total del mes y el del borde del día actual están en `THEMES.glitch`, igual que en el template verde.

## Solución de problemas

**`Bad credentials`**
El token es inválido, expiró, o fue revocado. Generá uno nuevo siguiendo el paso 2 de instalación.

**`Could not resolve to a User`**
`GITHUB_USER` está mal escrito o no existe. Verificá que coincida exactamente con tu nombre de usuario de GitHub (no el nombre completo).

**Widget en blanco o sin datos**
Suele pasar cuando el token es **fine-grained** en vez de classic. La API GraphQL de contribuciones no los soporta: recreá el token como classic con permiso `read:user`.

**Mis contribuciones privadas no aparecen**
El conteo depende de la opción de tu perfil de GitHub *"Include private contributions on my profile"* (en `github.com/settings/profile`). Si está desactivada, la API tampoco te las va a devolver a vos, sea con este widget o mirando tu propio perfil.

## Seguridad

`GITHUB_TOKEN` queda escrito en texto plano dentro del script. **No subas tu script con el token real a un repositorio público** (ni privado, si no confiás en quién puede verlo). Si lo llegaste a subir por error, revocalo inmediatamente en [github.com/settings/tokens](https://github.com/settings/tokens) y generá uno nuevo.

## Licencia

MIT. Ver [LICENSE](LICENSE).
