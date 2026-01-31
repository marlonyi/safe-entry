# -*- coding: utf-8 -*-
"""
Prueba simple de deteccion de QR con pyzbar
"""
import cv2
from pyzbar import pyzbar
import sys

print("=" * 50)
print("TEST DE DETECCION QR")
print("=" * 50)

# Verificar que pyzbar funciona
try:
    from pyzbar.pyzbar import ZBarSymbol
    print("[OK] pyzbar importado correctamente")
except Exception as e:
    print("[ERROR] Error importando pyzbar:", str(e))
    sys.exit(1)

# Abrir camara
print("\nAbriendo camara...")
cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)

if not cap.isOpened():
    print("[ERROR] No se pudo abrir la camara")
    sys.exit(1)
    
print("[OK] Camara abierta")
print("\n[Presiona 'q' para salir]")
print("[Muestra un QR frente a la camara]\n")

while True:
    ret, frame = cap.read()
    if not ret:
        continue
    
    # Detectar QR
    qr_codes = pyzbar.decode(frame)
    
    for qr in qr_codes:
        # Dibujar rectangulo
        points = qr.polygon
        if len(points) == 4:
            pts = [(p.x, p.y) for p in points]
            for i in range(4):
                cv2.line(frame, pts[i], pts[(i+1) % 4], (0, 255, 0), 3)
        
        # Decodificar datos
        data = qr.data.decode('utf-8')
        print("\n>>> QR DETECTADO:", data)
        print("    Tipo:", qr.type)
        
    # Mostrar ventana
    cv2.imshow('Test QR Scanner - Presiona Q para salir', frame)
    
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
print("\nTest finalizado.")
