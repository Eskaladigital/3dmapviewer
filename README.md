# FloorCraft — Planificador de Viviendas 2D/3D

Aplicación web para diseñar planos de viviendas en 2D con visualización 3D en tiempo real. Incluye importación de planos, análisis con IA y generación de renders fotorrealistas.

## Requisitos

- **Node.js** 18+ 
- **npm** 9+
- **OPENAI_API_KEY** (opcional): Para generación de renders con IA y análisis de planos. Crear `.env.local` con `OPENAI_API_KEY=sk-...`

## Instalación y arranque

```bash
cd "3D MAP VIEWER"
npm install
npm run dev
```

Se abrirá en `http://localhost:5173`. Para Electron: `npm run electron:dev`

## Estructura de la app

La interfaz tiene tres columnas:

| Izquierda | Centro | Derecha |
|-----------|--------|---------|
| Editor 2D del plano | Panel de configuración | Visor 3D en tiempo real |

### Editor 2D (izquierda)

- **Dibujar paredes**: Selecciona la herramienta "Pared", haz clic para empezar, clic para cada punto. Clic derecho o Escape para terminar la cadena.
- **Puertas y ventanas**: Selecciona la herramienta correspondiente y haz clic sobre una pared existente.
- **Muebles**: Ve a la pestaña "Muebles" en el panel central, haz clic en cualquier mueble para añadirlo a la escena en (0,0). Luego usa "Seleccionar" para arrastrarlo.
- **Zoom**: Rueda del ratón.
- **Pan**: Botón central del ratón (rueda pulsada) + arrastrar.
- **Seleccionar**: Clic sobre un mueble o pared para seleccionarlo.
- **Rotar mueble**: Selecciónalo y pulsa `R` (gira 45°). También desde el slider en el panel.
- **Borrar**: Selecciona un elemento y pulsa `Delete`/`Supr`, o usa la herramienta "Borrar" y haz clic.
- **Snap a grid**: Todos los elementos se alinean automáticamente a una rejilla de 0.25m.

### Panel de configuración (centro)

Cuatro pestañas:

- **🔧 Herramientas**: Seleccionar, Pared, Puerta, Ventana, Muebles, Borrar. Modo de cámara 3D (Orbital / Primera persona). Control de hora del día. Mostrar/ocultar techo. Propiedades del elemento seleccionado.
- **🛋️ Muebles**: Catálogo de 30+ muebles organizados por categoría (Salón, Cocina, Dormitorio, Baño, General). Clic para añadir al plano.
- **🎨 Estilo**: Presets arquitectónicos (Moderno, Industrial, Nórdico, Mediterráneo, Minimalista, Rústico). Color de paredes. Material y color de suelo.
- **🏢 Pisos**: Gestión de plantas. Añadir/eliminar pisos. Cambiar entre pisos (cada piso se renderiza independientemente).

### Visor 3D (derecha)

- **Modo Orbital**: Arrastrar para rotar, rueda para zoom, clic derecho para pan. Visión general de la vivienda.
- **Modo Primera Persona**: Haz clic en el visor para capturar el ratón. Usa WASD para moverte, ratón para mirar. Pulsa Escape para salir. Altura de cámara a 1.60m simulando la vista real.
- **Iluminación**: Cambia dinámicamente con la hora del día configurada en el panel. Incluye cielo, sol direccional, hemisférica y ambient occlusion (SSAO).
- **Muebles**: Cada tipo tiene geometría diferenciada (sofás con brazos/respaldo, camas con cabecero y colchón, mesas con patas, duchas con cristal, lámparas con luz puntual, etc.).

## Controles rápidos

| Acción | Atajo |
|--------|-------|
| Terminar pared | Clic derecho / Escape |
| Rotar mueble | `R` |
| Borrar selección | `Delete` / `Supr` |
| Cancelar selección | `Escape` |
| Zoom | Rueda ratón |
| Pan (mover vista) | Botón central ratón |

## Stack técnico

- **React 18** + **TypeScript**
- **Vite** como bundler
- **Zustand** para estado global
- **Canvas 2D** nativo para el editor de planos
- **React Three Fiber** + **Drei** para el visor 3D
- **Three.js** para renderizado WebGL
- **@react-three/postprocessing** para SSAO y Bloom

## Catálogo de muebles incluido

**Salón**: Sofá 3 plazas, Sofá 2 plazas, Mesa centro, Mueble TV, Televisión, Estantería, Sillón, Lámpara de pie, Alfombra.

**Cocina**: Encimera, Isla cocina, Nevera, Mesa comedor, Silla comedor, Placa/Horno.

**Dormitorio**: Cama doble, Cama individual, Mesita noche, Armario, Cómoda, Escritorio, Silla escritorio.

**Baño**: Inodoro, Lavabo, Bañera, Ducha.

**General**: Planta, Planta pequeña.

## Importar plano e IA

### Generación de renders con IA ✅

Desde la vista 3D puedes generar imágenes fotorrealistas con IA:

- **Imagen directa** (recomendado): Envía la captura a GPT Image Edit para preservar el layout exacto.
- **DALL·E**: Analiza la escena con GPT-4 Vision y genera con DALL·E.
- **Cantidad**: 2, 4 o 6 imágenes (2 por defecto).
- Requiere `OPENAI_API_KEY` en `.env.local`.

### Análisis de planos con IA ⚠️ En desarrollo

Importa un plano (imagen, PDF o DXF) y analízalo con GPT-4 Vision:

- **Extracción en dos fases**: Primero paredes, luego muebles, puertas y habitaciones.
- **Selector visual de referencia**: Haz clic en un mueble o pared del plano para usarlo como escala.
- **Calcar manualmente**: Fallback cuando la IA simplifica demasiado — haz clic en las esquinas del plano para trazar las paredes.

**Estado actual**: Los resultados del análisis automático son inconsistentes; la IA suele simplificar las paredes en lugar de seguir las líneas reales. Se recomienda usar **Calcar manualmente** para planos complejos.

## Próximos pasos

- [ ] Mejorar detección automática de paredes (OpenCV, modelos especializados)
- [ ] Detección automática de habitaciones cerradas
- [ ] Asignación de materiales por habitación
- [ ] Assets 3D reales (glTF/GLB) en lugar de geometría procedural
- [ ] Texturas PBR para suelos y paredes
- [ ] Guardado en base de datos (Supabase)
- [ ] Medición de superficies por habitación (m²)
