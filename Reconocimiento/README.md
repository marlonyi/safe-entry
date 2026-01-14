# 🚗 Sistema de Reconocimiento de Placas Colombianas

Sistema inteligente de detección y registro de vehículos usando YOLO y OCR.

## 📋 Características

- ✅ Detección en tiempo real de placas colombianas (ABC123)
- ✅ OCR con EasyOCR (inglés y español)
- ✅ Integración con MongoDB para registro de vehículos
- ✅ Verificación automática de estado de expensa
- ✅ Registro de entrada/salida de vehículos
- ✅ Interfaz web moderna y responsiva
- ✅ Estadísticas en tiempo real
- ✅ Exportación de registros en CSV
- ✅ Alertas sonoras configurables
- ✅ API RESTful para integración

## 🛠️ Instalación

### Requisitos Previos
- Python 3.8+
- MongoDB corriendo en `localhost:27017`
- Cámara web conectada
- NVIDIA GPU (opcional, recomendado para mejor rendimiento)

### Dependencias

```bash
pip install opencv-python easyocr ultralytics pymongo flask flask-cors pillow
```

**Instalación GPU (CUDA):**
```bash
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
```

## 🚀 Uso

### 1. Iniciar el Servidor Backend

```bash
cd Reconocimiento
python Placascolombianas.py
```

El servidor iniciará en `http://localhost:5001`

### 2. Acceder a la Interfaz Web

Abre el archivo `Vista/ReconocimientoPlacas.html` en tu navegador o accede a través de:
- `http://localhost:3000/ReconocimientoPlacas.html` (si lo sirves con un servidor web)
- Abre directamente en el navegador: `file:///ruta/a/ReconocimientoPlacas.html`

### 3. Usar la Interfaz

1. **Iniciar**: Haz clic en el botón "▶️ Iniciar" para comenzar la detección
2. **Monitorear**: Observa el feed en vivo y las placas detectadas
3. **Controlar**: Usa los toggles para ajustar configuración
4. **Exportar**: Descarga el registro en CSV

## 📡 Endpoints de la API

### `GET /api/reconocimiento/estado`
Obtener estado del sistema

**Respuesta:**
```json
{
  "running": true,
  "stats": {
    "total": 5,
    "permitidas": 3,
    "denegadas": 1,
    "desconocidas": 1
  },
  "detected_plates": [...]
}
```

### `POST /api/reconocimiento/iniciar`
Iniciar reconocimiento

**Respuesta:**
```json
{
  "success": true,
  "mensaje": "Reconocimiento iniciado"
}
```

### `POST /api/reconocimiento/detener`
Detener reconocimiento

**Respuesta:**
```json
{
  "success": true,
  "mensaje": "Reconocimiento detenido"
}
```

### `GET /api/reconocimiento/frame`
Obtener frame actual como JPEG

### `GET /api/reconocimiento/estadisticas`
Obtener estadísticas

```json
{
  "total": 5,
  "permitidas": 3,
  "denegadas": 1,
  "desconocidas": 1
}
```

### `GET /api/reconocimiento/placas-detectadas`
Obtener lista de placas detectadas

```json
[
  {
    "placa": "ABC123",
    "status": "permitida",
    "tiempo": "2024-11-25T10:30:45.123456"
  }
]
```

### `GET /api/reconocimiento/exportar`
Descargar registro en CSV

### `GET /api/reconocimiento/health`
Verificar salud del servicio

```json
{
  "status": "ok",
  "timestamp": "2024-11-25T10:30:45.123456"
}
```

## 🗄️ Estructura de MongoDB

### Colección: `usuarios`
```javascript
{
  "_id": ObjectId,
  "nombre": "Juan",
  "apellido": "Pérez",
  "cedula": "1234567890",
  "placaVehiculo": "ABC123",
  "estadoExpensa": "al dia", // o "mora"
  "rol": "residente"
}
```

### Colección: `registrovisitas`
```javascript
{
  "_id": ObjectId,
  "placa": "ABC123",
  "usuarioId": ObjectId,
  "rol": "residente",
  "movimientos": [
    {
      "tipo": "entrada",
      "fecha": ISODate("2024-11-25T10:30:45.123Z")
    }
  ],
  "conteoEntradas": 1,
  "conteoSalidas": 0
}
```

## 🎨 Interfaz Web

### Secciones Principales

1. **📹 Feed en Vivo**: Transmisión en tiempo real de la cámara
2. **⚙️ Controles**: Botones para iniciar/detener y configuración
3. **🎯 Placas Detectadas**: Historial visual de placas reconocidas
4. **📋 Registro de Actividad**: Log de eventos y detecciones

### Características UI

- Modo oscuro minimalista
- Animaciones suaves
- Indicadores de estado en tiempo real
- Estadísticas en vivo
- Notificaciones toast
- Responsivo (funciona en móviles)

## ⚙️ Configuración

### Formato de Placa
```python
# Patrón: 3 letras + 3 números
# Ejemplo: ABC123
self.plate_pattern = re.compile(r"^[A-Z]{3}\d{3}$")
```

### Parámetros de Cámara
```python
self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
```

### Modelos
- **YOLO**: `yolov8n.pt` (nano - rápido)
- **OCR**: EasyOCR con GPU
- **Base de Datos**: MongoDB

## 🔧 Solución de Problemas

### Error: "No se ha podido resolver la importación"
```bash
pip install -r requirements.txt
```

### Error: "Cámara no disponible"
- Verifica que la cámara esté conectada
- Comprueba permisos: `sudo usermod -a -G video $USER`

### Error: "MongoDB no disponible"
- Asegúrate de que MongoDB esté corriendo:
```bash
mongod
```

### Error: "CUDA no disponible"
- Instalación CPU (más lenta):
```bash
pip install --force-reinstall torch torchvision torchaudio
```

## 📊 Rendimiento

| Componente | Requisito |
|-----------|-----------|
| **CPU** | Intel i5/Ryzen 5+ |
| **RAM** | 8GB mínimo, 16GB recomendado |
| **GPU** | NVIDIA RTX 3060+ (opcional) |
| **FPS** | 25-45 FPS (depende del GPU) |

## 🔐 Seguridad

- ✅ Validación de formato de placa
- ✅ Verificación de estado de expensa
- ✅ Registro de todas las operaciones
- ✅ Autenticación con JWT (integrado con sistema admin)
- ⚠️ TODO: Agregar CORS más restrictivo en producción
- ⚠️ TODO: Implementar SSL/TLS

## 📝 Licencia

Proyecto desarrollado para Admin Residencial

## 👨‍💻 Autor

Sistema de Reconocimiento de Placas - Admin Residencial
