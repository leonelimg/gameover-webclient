# 🚀 QUICK REFERENCE - Mejora de UI GameOver

## ⚡ Importes Esenciales

```kotlin
// Colores
import com.gameover.android.core.ui.theme.*

// Componentes
import com.gameover.android.core.ui.component.*

// Material Design 3
import androidx.compose.material3.*
```

---

## 🎨 USO DE COLORES

### Colores Disponibles
```kotlin
// Principales
GoRed           // Primario (rojo)
GoGold          // Secundario (dorado)
GoBlue          // Terciario (azul)

// Estados
GoSuccess       // Verde ✓
GoWarning       // Naranja ⚠
GoDanger        // Rojo ✗
GoInfo          // Azul ℹ

// Neutros
GoNeutral       // Gris neutral
GoText          // Negro texto principal
GoTextSecondary // Gris texto secundario

// Tema (automático)
MaterialTheme.colorScheme.primary      // Rojo automático
MaterialTheme.colorScheme.secondary    // Dorado automático
MaterialTheme.colorScheme.surface      // Fondo automático
```

---

## 🔘 BOTONES

### GoButton
```kotlin
// Primario (recomendado)
GoButton(
    text = "Guardar",
    onClick = { },
    variant = ButtonVariant.PRIMARY
)

// Secundario (elevado)
GoButton(
    text = "Aceptar",
    onClick = { },
    variant = ButtonVariant.SECONDARY
)

// Outlined (menos prominente)
GoButton(
    text = "Cancelar",
    onClick = { },
    variant = ButtonVariant.OUTLINED
)

// Text (link style)
GoButton(
    text = "Más",
    onClick = { },
    variant = ButtonVariant.TEXT
)

// Con loading
GoButton(
    text = "Procesando...",
    onClick = { },
    loading = true,
    enabled = false
)
```

---

## 📦 TARJETAS

### GoCard
```kotlin
// Básica
GoCard {
    Text("Contenido")
}

// Con elevation personalizada
GoCard(elevation = 6f) {
    Text("Contenido importante")
}

// Clickeable
GoCard(onClick = { /* acción */ }) {
    Text("Clickear aquí")
}
```

---

## 🖊️ CAMPOS DE TEXTO

### GoTextField
```kotlin
// Básico
GoTextField(
    value = text,
    onValueChange = { text = it },
    label = "Usuario"
)

// Con validación
GoTextField(
    value = text,
    onValueChange = { text = it },
    label = "Email",
    isError = !isValidEmail,
    errorMessage = "Email inválido",
    placeholder = "ejemplo@correo.com"
)

// Con iconografía
GoTextField(
    value = text,
    onValueChange = { text = it },
    label = "Búsqueda",
    leadingIcon = { Icon(Icons.Default.Search, null) },
    trailingIcon = { Icon(Icons.Default.Close, null) }
)

// Densidad completa
GoTextField(
    value = text,
    onValueChange = { text = it },
    label = "Descripción",
    placeholder = "Escribe aquí...",
    singleLine = false,
    maxLines = 4
)
```

---

## 🏷️ INSIGNIAS

### GoBadge
```kotlin
// Success (verde)
GoBadge("Pagado", BadgeVariant.SUCCESS)

// Warning (naranja)
GoBadge("Pendiente", BadgeVariant.WARNING)

// Danger (rojo)
GoBadge("Rechazado", BadgeVariant.DANGER)

// Info (azul)
GoBadge("Información", BadgeVariant.INFO)

// Neutral (gris)
GoBadge("Indefinido", BadgeVariant.NEUTRAL)

// Helpers
PaymentStatusBadge("pagado", isCanceled = false)
DrawStatusBadge("abierto")
```

---

## 🚨 BANNERS

### ErrorBanner
```kotlin
ErrorBanner(
    message = uiState.error,  // null = invisible
    modifier = Modifier
)
```

### NoConnectionBanner
```kotlin
NoConnectionBanner(
    isVisible = !uiState.isOnline,
    onRetry = { viewModel.refresh() }  // opcional
)
```

---

## 📏 TIPOGRAFÍA

### Estilos Disponibles
```kotlin
// Grandes
Text("Título", style = MaterialTheme.typography.displayLarge)     // 32sp
Text("Título", style = MaterialTheme.typography.headlineSmall)    // 20sp

// Mediano
Text("Sección", style = MaterialTheme.typography.titleMedium)     // 16sp
Text("Cuerpo", style = MaterialTheme.typography.bodyLarge)        // 16sp

// Pequeño
Text("Etiqueta", style = MaterialTheme.typography.labelSmall)     // 11sp
Text("Nota", style = MaterialTheme.typography.bodySmall)          // 12sp
```

### Sin Estilo Predefinido
```kotlin
// Aplicar fontWeight
Text("Importante", fontWeight = FontWeight.Bold, fontSize = 14.sp)

// Con color automático
Text(
    "Éxito",
    color = MaterialTheme.colorScheme.primary,
    style = MaterialTheme.typography.labelLarge
)
```

---

## 🎭 ANIMACIONES

### Fade In/Out
```kotlin
AnimatedVisibility(
    visible = isVisible,
    enter = fadeIn(),
    exit = fadeOut()
) {
    Text("Aparezco y desaparezco suavemente")
}
```

### Entrada/Salida Vertical
```kotlin
AnimatedVisibility(
    visible = isVisible,
    enter = slideInVertically(initialOffsetY = { -it }),
    exit = slideOutVertically(targetOffsetY = { -it })
) {
    Text("Deslizo desde arriba")
}
```

---

## 📱 ESTRUCTURA DE PANTALLA

### Scaffold Básica
```kotlin
@Composable
fun MyScreen() {
    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        "Mi Pantalla",
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.Bold
                    )
                }
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier.padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            item { NoConnectionBanner(...) }
            item { ErrorBanner(...) }
            items(data) { /* items */ }
        }
    }
}
```

### Con Bottom Navigation
```kotlin
// Ya incluida en NavGraph.kt
// Automáticamente muestra si no estás en Login
```

---

## 🎯 EMPTY STATES

### Patrón Estándar
```kotlin
if (data.isEmpty()) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 48.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Icon(
                Icons.Default.Info,
                contentDescription = null,
                modifier = Modifier.size(48.dp),
                tint = GoNeutral
            )
            Text(
                "Sin datos",
                color = GoNeutral,
                fontSize = 14.sp,
                fontWeight = FontWeight.Medium
            )
        }
    }
}
```

---

## ⏳ LOADING STATES

### Indicador Circular
```kotlin
if (isLoading) {
    Box(contentAlignment = Alignment.Center, modifier = Modifier.fillMaxSize()) {
        CircularProgressIndicator(strokeWidth = 4.dp)
    }
}
```

### En Botón
```kotlin
GoButton(
    text = "Procesando...",
    onClick = { },
    loading = true,
    enabled = false
)
```

---

## 🔄 PULL-TO-REFRESH

```kotlin
@OptIn(ExperimentalMaterial3Api::class)
PullToRefreshBox(
    isRefreshing = uiState.isLoading,
    onRefresh = viewModel::refresh,
    modifier = Modifier.fillMaxSize()
) {
    LazyColumn { /* contenido */ }
}
```

---

## 📐 ESPACIADO

Usar múltiples de 4dp o 8dp para consistencia:

```kotlin
// Pequeño
Spacer(modifier = Modifier.height(4.dp))
Spacer(modifier = Modifier.height(8.dp))

// Medio
Spacer(modifier = Modifier.height(16.dp))

// Grande
Spacer(modifier = Modifier.height(24.dp))
Spacer(modifier = Modifier.height(32.dp))

// En contenedores
PaddingValues(16.dp)                           // Exterior
Modifier.padding(16.dp)                        // Todo
Modifier.padding(horizontal = 16.dp, vertical = 8.dp)  // Selectivo
Arrangement.spacedBy(12.dp)                    // Entre items
```

---

## 📐 FORMAS

Usar shapes de Material Design:

```kotlin
// Pequeña (chips, badges)
shape = MaterialTheme.shapes.small

// Mediana (cards, inputs, botones)
shape = MaterialTheme.shapes.medium

// Grande (diálogos, bottom sheets)
shape = MaterialTheme.shapes.large

// Extra grande (FABs, avatares)
shape = MaterialTheme.shapes.extraLarge
```

---

## 📊 ELEVATION (Sombra)

```kotlin
// Minimal
elevation = 2f.dp

// Normal (Cards, Botones)
elevation = 4f.dp

// Importante (Diálogos)
elevation = 8f.dp

// Máximo (Floating buttons)
elevation = 12f.dp
```

---

## ✨ DARK MODE

Automático según preferencia del sistema:

```kotlin
// Colores se adaptan automáticamente
// No necesitas hacer nada especial

// Si necesitas comportamiento diferente por tema:
val isDarkTheme = isSystemInDarkTheme()
if (isDarkTheme) {
    // Comportamiento en dark mode
} else {
    // Comportamiento en light mode
}
```

---

## 📋 CHECKLIST PARA NUEVAS PANTALLAS

- [ ] Importar `core-ui` components
- [ ] Usar `Scaffold` con `TopAppBar`
- [ ] Agregar `NoConnectionBanner` si aplica
- [ ] Usar `GoCard` para contenedores
- [ ] Usar `GoButton` para acciones
- [ ] Usar `GoTextField` para inputs
- [ ] Usar `GoBadge` para estados
- [ ] Agregar `ErrorBanner` si aplica
- [ ] Implementar empty state con icono
- [ ] Usar tipografía estándar
- [ ] Respetar spacing (múltiples de 4dp)
- [ ] Agregar animaciones suaves
- [ ] Validar dark mode

---

## 🔗 REFERENCIAS RÁPIDAS

**Colores:** `core-ui/theme/Color.kt`
**Componentes:** `core-ui/component/`
**Tema:** `core-ui/theme/Theme.kt`
**Tipografía:** `core-ui/theme/Typography.kt`
**Documentación:** `UI_IMPROVEMENTS.md`

---

**Última actualización:** Mayo 2026

