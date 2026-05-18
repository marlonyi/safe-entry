# -*- coding: utf-8 -*-
"""
Escáner QR con OpenCV nativo (cv2.QRCodeDetector)
Con debounce para evitar detecciones múltiples del mismo código
y verificación contra el API de SafeEntry.
"""
import cv2
import sys
import time
import requests

API_BASE_URL = "http://localhost:5000"
COOLDOWN_SECONDS = 10  # No procesar el mismo QR durante 10 segundos

print("=" * 50)
print("ESCANER QR - SafeEntry (OpenCV Nativo)")
print("=" * 50)

# Crear detector QR de OpenCV
qr_detector = cv2.QRCodeDetector()
print("[OK] QRCodeDetector creado")

# Abrir camara — probar varios backends hasta encontrar uno que funcione
print("\nAbriendo camara...")
backends = [
    ("MSMF",   cv2.CAP_MSMF),    # Media Foundation (Windows 10+)
    ("DSHOW",  cv2.CAP_DSHOW),   # DirectShow (legacy Windows)
    ("ANY",    cv2.CAP_ANY),     # Que OpenCV decida
]
cap = None
for nombre, backend in backends:
    print(f"  Probando backend {nombre}...")
    cap_try = cv2.VideoCapture(0, backend)
    if cap_try.isOpened():
        # Verificar que la cámara realmente está produciendo frames válidos
        ret, frame = cap_try.read()
        if ret and frame is not None and frame.size > 0:
            cap = cap_try
            # Forzar resolución estándar para evitar errores de driver
            cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
            print(f"[OK] Camara abierta con backend {nombre}")
            break
        else:
            cap_try.release()
    else:
        cap_try.release()

if cap is None or not cap.isOpened():
    print("[ERROR] No se pudo abrir la camara con ningun backend")
    print("        Verifica que ninguna otra aplicacion la este usando")
    print("        (navegador, Teams, Zoom, etc.) y vuelve a intentar.")
    sys.exit(1)
print("\n[Presiona 'q' para salir]")
print("[Muestra un QR frente a la camara]\n")

# Historial de QRs escaneados con timestamp para debounce
last_scanned = {}

def extract_token(qr_data):
    """Extraer token del contenido del QR"""
    # URL de visitante: /api/visitantes/qr/verificar/TOKEN
    if "/qr/verificar/" in qr_data:
        parts = qr_data.split("/qr/verificar/")
        return ("visitante", parts[1].split("?")[0].split("/")[0]) if len(parts) > 1 else (None, None)

    # URL de residente: /api/usuarios/verificar-qr/TOKEN
    if "/verificar-qr/" in qr_data:
        parts = qr_data.split("/verificar-qr/")
        return ("residente", parts[1].split("?")[0].split("/")[0]) if len(parts) > 1 else (None, None)

    # URL genérica: /verificar/TOKEN (formato antiguo)
    if "/verificar/" in qr_data:
        parts = qr_data.split("/verificar/")
        token = parts[1].split("?")[0].split("/")[0] if len(parts) > 1 else None
        if token and len(token) >= 16:
            return ("auto", token)

    # Token hex directo (32 caracteres)
    if len(qr_data) == 32 and all(c in "0123456789abcdef" for c in qr_data.lower()):
        return ("auto", qr_data)

    return (None, None)


def verify_token(tipo, token):
    """Verificar token contra el API y REGISTRAR el ingreso si es válido"""
    try:
        if tipo == "visitante" or tipo == "auto":
            # Endpoint que verifica + registra el ingreso en una sola llamada
            resp = requests.post(
                f"{API_BASE_URL}/api/visitantes/qr/ingresar/{token}",
                timeout=5
            )
            if resp.status_code == 200:
                data = resp.json()
                if data.get("valid"):
                    v = data.get("visitante", {})
                    nombre = f"{v.get('nombre', '')} {v.get('apellido', '')}"
                    if data.get("yaIngreso"):
                        print(f"  ℹ️  VISITANTE YA ESTABA DENTRO: {nombre}")
                    else:
                        print(f"  ✅ VISITANTE AUTORIZADO E INGRESADO: {nombre}")
                    print(f"     Placa: {v.get('placa', 'N/A')}")
                    print(f"     Estado: {v.get('estado', 'N/A')}")
                    return True

        if tipo == "residente" or tipo == "auto":
            # Intentar como residente
            resp = requests.get(f"{API_BASE_URL}/api/usuarios/verificar-qr/{token}", timeout=5)
            if resp.status_code == 200:
                data = resp.json()
                if data.get("valid"):
                    r = data.get("residente", {})
                    nombre = f"{r.get('nombre', '')} {r.get('apellido', '')}"
                    print(f"  ✅ RESIDENTE AUTORIZADO: {nombre}")
                    print(f"     Torre: {r.get('torre', 'N/A')} Apto: {r.get('apartamento', 'N/A')}")
                    return True

        print(f"  ❌ QR NO VÁLIDO o expirado")
        return False

    except requests.exceptions.ConnectionError:
        print(f"  ⚠️ Error: No se pudo conectar al servidor ({API_BASE_URL})")
        return False
    except Exception as e:
        print(f"  ⚠️ Error verificando: {e}")
        return False


while True:
    ret, frame = cap.read()
    if not ret:
        continue

    # Detectar QR con OpenCV nativo
    data, points, straight_qrcode = qr_detector.detectAndDecode(frame)

    if data:
        now = time.time()

        # Debounce: ignorar si el mismo QR fue escaneado hace menos de COOLDOWN_SECONDS
        if data in last_scanned and (now - last_scanned[data]) < COOLDOWN_SECONDS:
            pass  # Silenciosamente ignorar
        else:
            last_scanned[data] = now
            print(f"\n>>> QR DETECTADO: {data}")

            tipo, token = extract_token(data)
            if token:
                verify_token(tipo, token)
            else:
                print(f"  ⚠️ No se pudo extraer token del QR")

        # Dibujar rectangulo si se detectó
        if points is not None:
            points = points[0].astype(int)
            for i in range(4):
                cv2.line(frame, tuple(points[i]), tuple(points[(i+1) % 4]), (0, 255, 0), 3)

    # Mostrar ventana
    cv2.imshow('SafeEntry QR Scanner - Presiona Q para salir', frame)

    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
print("\nEscáner finalizado.")
