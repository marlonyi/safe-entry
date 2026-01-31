# 🔐 QR Scanner - Control de Acceso Residencial

Aplicación de escritorio para leer códigos QR de residentes y visitantes, verificar su autorización contra el backend Node.js, y registrar automáticamente los accesos al conjunto residencial.

## ✨ Características

- **📷 Lectura de QR en tiempo real** usando OpenCV + pyzbar
- **🏢 Soporte multi-conjunto** - Selector de conjunto residencial
- **👥 Verifica residentes y visitantes** contra la API
- **🅿️ Registra accesos y ocupa plazas** automáticamente
- **🎨 Interfaz gráfica moderna** con CustomTkinter
- **🔊 Feedback sonoro** (beep autorizado/denegado)
- **📊 Estadísticas en tiempo real**

## 📋 Requisitos

- **Python 3.8+**
- **Windows** (para winsound y CAP_DSHOW)
- **Cámara web** o cámara IP
- **Backend Node.js corriendo** (tu aplicación admin-residencial)
- **Visual C++ Redistributable** ([descargar](https://aka.ms/vs/17/release/vc_redist.x64.exe))

## 🚀 Instalación

1. **Navegar a la carpeta:**
   ```powershell
   cd "c:\Users\Usuario\Music\admin-residencial\admin-residencial (1)\admin-residencial\qr-scanner"
   ```

2. **Instalar dependencias:**
   ```powershell
   pip install -r requirements.txt
   ```

3. **Configurar el archivo .env:**
   ```powershell
   copy .env.example .env
   ```
   Editar `.env` con la URL de tu servidor si es diferente de localhost.

## 🎮 Uso

1. **Iniciar el backend Node.js** (tu aplicación principal)

2. **Ejecutar el scanner:**
   ```powershell
   python qr_scanner.py
   ```

3. **En la interfaz:**
   - Selecciona el conjunto residencial
   - Haz clic en "▶️ Iniciar Cámara"
   - Muestra el código QR frente a la cámara

## 📖 Flujo de Funcionamiento

```
┌─────────────┐    ┌──────────────┐    ┌─────────────────┐
│ Detectar QR │ -> │ Verificar API│ -> │ Mostrar Resultado│
└─────────────┘    └──────────────┘    └─────────────────┘
                          │
                          ▼
              ┌────────────────────────┐
              │ Registrar en historial │
              │ y marcar plaza ocupada │
              └────────────────────────┘
```

### Para Residentes:
- ✅ Pantalla verde + datos del residente
- 📝 Registra entrada/salida en historial

### Para Visitantes:
- ✅ Pantalla verde + datos del visitante
- 🅿️ Cambia estado de plaza a OCUPADO
- 📝 Registra en historial de accesos

### QR No Válido:
- ❌ Pantalla roja + mensaje de error
- 🔊 Sonido de alerta

## ⚙️ Configuración (.env)

```env
# URL del servidor Node.js
API_BASE_URL=http://localhost:5000

# Índice de cámara (0 = primera cámara)
CAMERA_INDEX=0

# Segundos de espera entre lecturas del mismo QR
COOLDOWN_SECONDS=10

# Mostrar logs de debug
DEBUG=false
```

## 🔧 Solución de Problemas

### "No se pudo conectar al servidor"
- Verifica que el backend Node.js esté corriendo
- Comprueba la URL en el archivo `.env`

### "No se pudo abrir la cámara"
- Cierra otras aplicaciones que puedan estar usando la cámara
- Cambia `CAMERA_INDEX` en `.env` (prueba 0, 1, 2...)

### "Error: No module named 'pyzbar'"
- Instala Visual C++ Redistributable
- Reinstala: `pip install --force-reinstall pyzbar`

## 📁 Estructura del Proyecto

```
qr-scanner/
├── qr_scanner.py      # Aplicación principal
├── requirements.txt   # Dependencias Python
├── .env.example       # Configuración de ejemplo
├── .env               # Tu configuración (crear)
└── README.md          # Esta documentación
```

## 🔗 Endpoints Utilizados

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/conjuntos/lista` | GET | Lista pública de conjuntos |
| `/api/usuarios/verificar-qr/:token` | GET | Verificar residente |
| `/api/visitantes/qr/verificar/:token` | GET | Verificar visitante |
| `/api/parqueaderos/registrar-acceso` | POST | Registrar entrada/salida |
| `/api/parqueaderos/registrar-entrada` | POST | Marcar plaza ocupada |

---

Desarrollado para **Admin Residencial** 🏢
