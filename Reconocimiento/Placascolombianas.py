# -*- coding: utf-8 -*-
"""
Sistema de Reconocimiento de Placas - Optimizacion Total YOLO
- Utiliza YOLOv8 (filtra solo: coches, motos, buses, camiones).
- Enfoca la zona inferior del vehiculo donde se ubica la placa.
- Multi-preprocesamiento + EasyOCR con allowlist alfanumerico.
- Validacion estricta del formato de placa colombiana.
- Consenso multi-frame para evitar falsos positivos.
"""

import cv2
import easyocr
import numpy as np
import re
from collections import defaultdict, deque
from datetime import datetime
from pymongo import MongoClient
import time
import requests
import os

try:
    from ultralytics import YOLO
except ImportError:
    print("Error: Falta instalar ultralytics. Ejecuta: pip install ultralytics")
    import sys
    sys.exit(1)

# Clases COCO de vehiculos: 2=car, 3=motorcycle, 5=bus, 7=truck
VEHICLE_CLASSES = {2, 3, 5, 7}
# Clase celular (para placas mostradas en pantalla del telefono)
PHONE_CLASS = 67
# Clases aceptadas para correr OCR
ALLOWED_CLASSES = VEHICLE_CLASSES | {PHONE_CLASS}

# Formato placa colombiana:
#  - Carros:  3 letras + 3 numeros  (ABC123)
#  - Motos:   3 letras + 2 numeros + 1 letra  (ABC12D)
PLATE_REGEX = re.compile(r"^([A-Z]{3}\d{3}|[A-Z]{3}\d{2}[A-Z])$")


class PlateRecognizer:
    def __init__(self):
        print("Iniciando sistema de reconocimiento de placas con MODO IA (YOLO) ...")

        self.api_url = "http://localhost:5000/api"

        try:
            self.client = MongoClient(
                "mongodb+srv://marlonyi:marlonyi@cluster0.oplr0za.mongodb.net/adminResidencial?retryWrites=true&w=majority&appName=Cluster0",
                serverSelectionTimeoutMS=5000,
            )
            self.db = self.client["adminResidencial"]
            self.usuarios_collection = self.db["usuarios"]
            self.visitantes_collection = self.db["visitantes"]
            print("Conectado a MongoDB local")
        except Exception:
            print("Error conectando a MongoDB")
            self.db = None

        print("Cargando Red Neuronal (Pesos)...")
        model_path = "Reconocimiento/yolov8n.pt" if os.path.exists("Reconocimiento/yolov8n.pt") else "yolov8n.pt"
        self.model = YOLO(model_path)

        print("Cargando motor OCR para lectura...")
        self.reader = easyocr.Reader(["en"], gpu=True, verbose=False)

        self.cap = cv2.VideoCapture(0)
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 960)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 540)
        self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

        self.last_boxes = []
        self.message = ""
        self.message_time = 0
        self.cooldowns = {}
        # Consenso: lecturas recientes por placa candidata
        self.recent_reads = defaultdict(lambda: deque(maxlen=6))
        # debe leerse >=2 veces igual antes de aceptar (1 = aceptar primera lectura valida)
        self.MIN_AGREEMENTS = 1
        self.last_fallback_time = 0.0

    # ---------- utilidades ----------
    @staticmethod
    def _solo_alfanumerico(text):
        return re.sub(r"[^A-Z0-9]", "", text.upper())

    @staticmethod
    def _aplicar_formato_colombiano(text):
        """Aplica correcciones contextuales: en posiciones de letra fuerza letra,
        en posiciones de numero fuerza numero. Solo para 6 caracteres."""
        if len(text) != 6:
            return text
        # Carro: LLL NNN  | Moto: LLL NN L
        letra_a_num = {"O": "0", "Q": "0", "D": "0", "I": "1", "L": "1", "Z": "2", "S": "5", "B": "8", "G": "6"}
        num_a_letra = {"0": "O", "1": "I", "2": "Z", "5": "S", "8": "B", "6": "G"}
        chars = list(text)
        # posiciones 0..2 deben ser letras
        for i in range(3):
            if chars[i].isdigit():
                chars[i] = num_a_letra.get(chars[i], chars[i])
        # posiciones 3..4 deben ser numeros
        for i in range(3, 5):
            if chars[i].isalpha():
                chars[i] = letra_a_num.get(chars[i], chars[i])
        # posicion 5: numero (carro) o letra (moto). Probamos ambas variantes.
        return "".join(chars)

    @staticmethod
    def _candidatos_placa(text):
        """Genera candidatos validos de placa colombiana a partir de texto crudo."""
        clean = PlateRecognizer._solo_alfanumerico(text)
        if len(clean) < 5:
            return []
        # ventanas de 6 caracteres
        candidatos = set()
        for i in range(0, len(clean) - 5):
            sub = clean[i:i + 6]
            corr = PlateRecognizer._aplicar_formato_colombiano(sub)
            # Variante carro (todo numero al final)
            if PLATE_REGEX.match(corr):
                candidatos.add(corr)
            # Variante moto: forzar ultimo a letra
            if len(corr) == 6 and corr[-1].isdigit():
                num_a_letra = {"0": "O", "1": "I", "2": "Z", "5": "S", "8": "B", "6": "G"}
                alt = corr[:5] + num_a_letra.get(corr[-1], corr[-1])
                if PLATE_REGEX.match(alt):
                    candidatos.add(alt)
        return list(candidatos)

    # ---------- procesamiento de imagen ----------
    @staticmethod
    def _zona_placa(roi_vehiculo, cls_name):
        """Recorta la zona donde tipicamente aparece la placa segun el tipo."""
        h, w = roi_vehiculo.shape[:2]
        if cls_name == "motorcycle":
            # Placa trasera moto: parte central-inferior
            y1 = int(h * 0.45)
            x1 = int(w * 0.15)
            x2 = int(w * 0.85)
            return roi_vehiculo[y1:h, x1:x2]
        if cls_name in ("cell phone", "frame"):
            # Pantalla de celular o frame completo: usar todo el ROI
            return roi_vehiculo
        # Carros / camiones / buses: tercio inferior centrado
        y1 = int(h * 0.55)
        x1 = int(w * 0.10)
        x2 = int(w * 0.90)
        return roi_vehiculo[y1:h, x1:x2]

    @staticmethod
    def _generar_variantes(roi):
        """Devuelve varias versiones preprocesadas para mejorar OCR."""
        variantes = []
        if roi is None or roi.size == 0:
            return variantes

        # Upscale para mejorar OCR de placas pequenas
        scale = 2 if max(roi.shape[:2]) < 300 else 1
        if scale > 1:
            roi = cv2.resize(roi, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)

        gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
        # Mejora de contraste
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
        gray_eq = clahe.apply(gray)
        # Ruido
        denoised = cv2.bilateralFilter(gray_eq, 9, 75, 75)

        variantes.append(denoised)
        # Otsu
        _, otsu = cv2.threshold(denoised, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        variantes.append(otsu)
        # Adaptativo
        adap = cv2.adaptiveThreshold(denoised, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                     cv2.THRESH_BINARY, 15, 9)
        variantes.append(adap)
        return variantes

    def procesar_texto(self, text):
        return self._solo_alfanumerico(text)

    # ---------- BD ----------
    def verificar_base_datos(self, placa):
        if self.db is None:
            return "BD no conectada"
        u = self.usuarios_collection.find_one({"placaVehiculo": placa})
        if u:
            return f"RESIDENTE: {u.get('nombre','')}"

        v = self.visitantes_collection.find_one({"placaVehiculo": placa})
        if v:
            try:
                requests.post(
                    f"{self.api_url}/visitantes/registrar-entrada",
                    json={"placaVehiculo": placa},
                    timeout=1,
                )
            except Exception:
                pass
            return f"VISITANTE: {v.get('nombre','')}"

        return "NO REGISTRADA"

    # ---------- OCR sobre un vehiculo ----------
    def _leer_placa(self, roi_vehiculo, cls_name, rapido=False):
        """Aplica OCR a varias variantes y devuelve la placa con mayor confianza/consenso.
        Si rapido=True usa una sola variante (modo fallback rapido)."""
        zona = self._zona_placa(roi_vehiculo, cls_name)
        if zona is None or zona.size == 0:
            return None, 0.0

        mejor_placa, mejor_score = None, 0.0
        allowlist = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"

        variantes = self._generar_variantes(zona)
        if rapido and variantes:
            variantes = variantes[:1]
        for img in variantes:
            try:
                ocr_res = self.reader.readtext(
                    img,
                    decoder="beamsearch",
                    allowlist=allowlist,
                    detail=1,
                    paragraph=False,
                )
            except Exception:
                continue

            for (_bbox, text, prob) in ocr_res:
                if prob < 0.30:
                    continue
                for cand in self._candidatos_placa(text):
                    if prob > mejor_score:
                        mejor_score = prob
                        mejor_placa = cand
        return mejor_placa, mejor_score

    # ---------- consenso y registro ----------
    def _registrar_lectura(self, placa, score):
        """Aplica consenso multi-frame y dispara verificacion en BD."""
        if not placa:
            return
        ahora = time.time()
        self.recent_reads[placa].append(ahora)
        # purgar lecturas viejas (>3s)
        while self.recent_reads[placa] and ahora - self.recent_reads[placa][0] > 3.0:
            self.recent_reads[placa].popleft()

        if len(self.recent_reads[placa]) < self.MIN_AGREEMENTS:
            return

        if placa not in self.cooldowns or (ahora - self.cooldowns[placa] > 5):
            self.cooldowns[placa] = ahora
            db_res = self.verificar_base_datos(placa)
            self.message = f"PLACA: {placa} ({score:.2f}) - {db_res}"
            self.message_time = ahora
            print(f"-> Leido: {self.message}")

    # ---------- loop principal ----------
    def run(self):
        if not self.cap.isOpened():
            print("Error: Camara no detectada.")
            return

        print("\n==================================================")
        print("SISTEMA DE RECONOCIMIENTO DE PLACAS ACTIVO (YOLO FILTRADO)")
        print("SOLO RECONOCE: Coches, Motocicletas, Camiones y Autobuses")
        print("==================================================")
        print("Presiona 'Q' en la pantalla de la camara para salir")

        frame_count = 0
        while True:
            ret, frame = self.cap.read()
            if not ret:
                break

            frame_count += 1

            # FRAME SKIPPING: 1 de cada 3 frames analizamos.
            if frame_count % 3 == 0:
                results = self.model(frame, verbose=False, conf=0.35, classes=list(ALLOWED_CLASSES))
                new_boxes = []
                hubo_deteccion = False

                for r in results:
                    for box_obj in r.boxes:
                        x1, y1, x2, y2 = map(int, box_obj.xyxy[0])
                        conf = float(box_obj.conf[0])
                        cls_id = int(box_obj.cls[0])

                        if cls_id not in ALLOWED_CLASSES:
                            continue

                        w = x2 - x1
                        h = y2 - y1
                        # Tamano minimo razonable (mas bajo para celulares)
                        min_w, min_h = (50, 50) if cls_id == PHONE_CLASS else (80, 60)
                        if w < min_w or h < min_h:
                            continue

                        cls_name = self.model.names[cls_id]
                        new_boxes.append((x1, y1, x2, y2, cls_name))
                        hubo_deteccion = True

                        roi_vehiculo = frame[max(0, y1):y2, max(0, x1):x2]
                        if roi_vehiculo.size == 0:
                            continue

                        placa, score = self._leer_placa(roi_vehiculo, cls_name)
                        self._registrar_lectura(placa, score)

                # FALLBACK: si YOLO no detecto vehiculos ni celulares, escanea todo el frame.
                # Util cuando se muestra una placa muy de cerca o la camara capta solo la imagen.
                # Throttle: solo cada 1s y con downscale para no congelar la UI.
                ahora = time.time()
                if not hubo_deteccion and (ahora - self.last_fallback_time) > 1.0:
                    self.last_fallback_time = ahora
                    h, w = frame.shape[:2]
                    if w > 640:
                        escala = 640.0 / w
                        small = cv2.resize(frame, (640, int(h * escala)))
                    else:
                        small = frame
                    placa, score = self._leer_placa(small, "frame", rapido=True)
                    self._registrar_lectura(placa, score)

                self.last_boxes = new_boxes

            for (x1, y1, x2, y2, cls_name) in self.last_boxes:
                cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
                cv2.putText(frame, str(cls_name), (x1, y1 - 10),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)

            if self.message and (time.time() - self.message_time) < 4:
                cv2.rectangle(frame, (10, frame.shape[0] - 60),
                              (frame.shape[1] - 10, frame.shape[0] - 10), (0, 0, 0), -1)
                cv2.putText(frame, self.message, (20, frame.shape[0] - 25),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)

            cv2.imshow("LPR YOLO - Solo Vehiculos", frame)

            if cv2.waitKey(1) & 0xFF == ord('q'):
                break

        self.cap.release()
        cv2.destroyAllWindows()


if __name__ == "__main__":
    app = PlateRecognizer()
    app.run()
