# -*- coding: utf-8 -*-
"""
Sistema de Reconocimiento de Placas - Optimizacion Total YOLO
- Utiliza YOLOv8 Artificial Intelligence (Coches, Motos).
- Ignora personas y entornos (Soluciona el problema de enfocar otras cosas).
- Extrae el texto con EasyOCR
"""

import cv2
import easyocr
import numpy as np
import re
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

class PlateRecognizer:
    def __init__(self):
        print("Iniciando sistema de reconocimiento de placas con MODO IA (YOLO) ...")

        self.api_url = "http://localhost:5000/api"

        try:
            self.client = MongoClient("mongodb+srv://marlonyi:marlonyi@cluster0.oplr0za.mongodb.net/adminResidencial?retryWrites=true&w=majority&appName=Cluster0", serverSelectionTimeoutMS=5000)
            self.db = self.client["adminResidencial"]
            self.usuarios_collection = self.db["usuarios"]
            self.visitantes_collection = self.db["visitantes"]
            print("Conectado a MongoDB local")
        except Exception as e:
            print("Error conectando a MongoDB")
            self.db = None

        print("Cargando Red Neuronal (Pesos)...")
        model_path = "Reconocimiento/yolov8n.pt" if os.path.exists("Reconocimiento/yolov8n.pt") else "yolov8n.pt"
        self.model = YOLO(model_path)
        
        print("Cargando motor OCR para lectura...")
        self.reader = easyocr.Reader(["en"], gpu=True, verbose=False) 
        
        self.cap = cv2.VideoCapture(0)
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

        self.last_boxes = []
        self.message = ""
        self.message_time = 0
        self.cooldowns = {}
        
    def procesar_texto(self, text):
        text = re.sub(r"[^A-Z0-9]", "", text.upper())
        text = text.replace('O','0').replace('I','1')
        return text

    def verificar_base_datos(self, placa):
        if self.db is None: return "BD no conectada"
        u = self.usuarios_collection.find_one({"placaVehiculo": placa})
        if u: return f"RESIDENTE: {u.get('nombre','')}"
        
        v = self.visitantes_collection.find_one({"placaVehiculo": placa})
        if v: 
            try: requests.post(f"{self.api_url}/visitantes/registrar-entrada", json={"placaVehiculo": placa}, timeout=1)
            except: pass
            return f"VISITANTE: {v.get('nombre','')}"
            
        return f"NO REGISTRADA"

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
            if not ret: break
            
            frame_count += 1
            
            # FRAME SKIPPING: 1 de cada 4 frames leemos.
            if frame_count % 4 == 0:
                results = self.model(frame, verbose=False)
                new_boxes = []
                
                for r in results:
                    for box_obj in r.boxes:
                        x1, y1, x2, y2 = map(int, box_obj.xyxy[0])
                        conf = float(box_obj.conf[0])
                        cls_id = int(box_obj.cls[0])
                        
                        w = x2 - x1
                        h = y2 - y1
                        
                        # Filtramos con confianza mayor a 40% para que ignore sillas u otras cosas
                        if w > 40 and h > 20 and conf > 0.4: 
                            cls_name = self.model.names[cls_id]
                            new_boxes.append((x1, y1, x2, y2, cls_name))
                            
                            # Tomamos la caja completa, no solo la mitad, para que lea el celular bien
                            roi_vehiculo = frame[y1:y2, x1:x2]
                            
                            if roi_vehiculo.size == 0: continue
                            
                            gray = cv2.cvtColor(roi_vehiculo, cv2.COLOR_BGR2GRAY)
                            gray = cv2.bilateralFilter(gray, 11, 17, 17)
                            thresh = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 11, 2)
                            
                            ocr_res = self.reader.readtext(thresh, decoder='beamsearch')
                            
                            for (bbox, text, prob) in ocr_res:
                                if prob < 0.2: continue 
                                text_clean = self.procesar_texto(text)
                                
                                if len(text_clean) >= 5 and len(text_clean) <= 6:
                                    t = time.time()
                                    if text_clean not in self.cooldowns or (t - self.cooldowns[text_clean] > 5):
                                        self.cooldowns[text_clean] = t
                                        db_res = self.verificar_base_datos(text_clean)
                                        self.message = f"PLACA: {text_clean} - {db_res}"
                                        self.message_time = t
                                        print(f"-> Leido: {self.message}")

                self.last_boxes = new_boxes

            for (x1, y1, x2, y2, cls_name) in self.last_boxes:
                cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
                cv2.putText(frame, str(cls_name), (x1, y1-10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
                
            if self.message and (time.time() - self.message_time) < 4:
                cv2.rectangle(frame, (10, 420), (630, 470), (0, 0, 0), -1)
                cv2.putText(frame, self.message, (20, 455), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)

            cv2.imshow("LPR YOLO - Solo Vehiculos", frame)
            
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break

        self.cap.release()
        cv2.destroyAllWindows()

if __name__ == "__main__":
    app = PlateRecognizer()
    app.run()
