# -*- coding: utf-8 -*-
"""
Prueba de deteccion de QR con OpenCV nativo (cv2.QRCodeDetector)
Esta alternativa NO requiere zbar y es mas compatible
"""
import cv2
import sys

print("=" * 50)
print("TEST DE DETECCION QR (OpenCV Nativo)")
print("=" * 50)

# Crear detector QR de OpenCV
qr_detector = cv2.QRCodeDetector()
print("[OK] QRCodeDetector creado")

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
    
    # Detectar QR con OpenCV nativo
    data, points, straight_qrcode = qr_detector.detectAndDecode(frame)
    
    if data:
        print("\n>>> QR DETECTADO:", data)
        
        # Dibujar rectangulo si se detectó
        if points is not None:
            points = points[0].astype(int)
            for i in range(4):
                cv2.line(frame, tuple(points[i]), tuple(points[(i+1) % 4]), (0, 255, 0), 3)
        
    # Mostrar ventana
    cv2.imshow('Test QR (OpenCV) - Presiona Q para salir', frame)
    
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
print("\nTest finalizado.")
