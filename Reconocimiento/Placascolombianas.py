import cv2
import easyocr
import mysql.connector
import numpy as np
import re
from datetime import datetime
from ultralytics import YOLO
from pymongo import MongoClient
import time

class PlateRecognizer:
    def __init__(self):
        # Configuración de la base de datos
        self.db_config = {
            "host": "localhost",
            "user": "root",
            "password": "1234",
            "database": "placas_db"
        }
        
        # Iniciar EasyOCR 
        self.reader = easyocr.Reader(["en", "es"], gpu=True)
        
        # modelo YOLO 
        self.model = YOLO("yolov8n.pt")
        
        # Configuración de placas colombianas
        self.plate_pattern = re.compile(r"^[A-Z]{3}\d{3}$")  # Formato ABC123
        
        # Configuración de la cámara
        self.cap = cv2.VideoCapture(0)
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        
        # Variables para control de FPS
        self.fps_counter = 0
        self.fps = 0
        self.prev_time = 0
        
    def preprocess_plate(self, plate_img):
        """Preprocesamiento optimizado para placas colombianas"""
        gray = cv2.cvtColor(plate_img, cv2.COLOR_BGR2GRAY)
        gray = cv2.bilateralFilter(gray, 11, 17, 17)
        thresh = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
cv2.THRESH_BINARY_INV, 11, 2)
        return thresh
    
    def validate_plate(self, text):
        """formato de placa colombiana"""
        text = re.sub(r"[^A-Z0-9]", "", text.upper())
        return self.plate_pattern.match(text)
    
    def process_frame(self, frame):
        """Procesar cada frame de video"""
        # Detección con YOLO
        results = self.model(frame)
        
        for result in results:
            for box in result.boxes.xyxy:
                x1, y1, x2, y2 = map(int, box)
                plate_roi = frame[y1:y2, x1:x2]
                
                # Preprocesamiento y OCR
                processed_plate = self.preprocess_plate(plate_roi)
                ocr_results = self.reader.readtext(processed_plate, decoder='beamsearch')
                
                for (bbox, text, prob) in ocr_results:
                    if self.validate_plate(text):
                        plate_text = re.sub(r"[^A-Z0-9]", "", text.upper())
                        self.handle_detected_plate(plate_text, frame, (x1, y1, x2, y2))
        
        # Mostrar FPS
        self.display_fps(frame)
        return frame
    
    def handle_detected_plate(self, plate_text, frame, coords):
        """Manejar placas detectadas"""
        x1, y1, x2, y2 = coords
        
        # rectángulo y texto
        cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
        cv2.putText(frame, plate_text, (x1, y1-10), 
cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)
        
        # Registrar en base de datos
        self.save_to_database(plate_text)
    
    def save_to_database(self, plate_text):
        """Guardar placa en la base de datos y relacionarla con un usuario si existe"""
        # Conexión a MongoDB
        self.client = MongoClient("mongodb://localhost:27017")
        self.db = self.client["adminResidencial"]
        self.usuarios_collection = self.db["usuarios"]
        self.registrovisitas_collection = self.db["registrovisitas"]

        try:
            # Buscar si la placa pertenece a un usuario
            usuario = self.usuarios_collection.find_one({"placaVehiculo": plate_text})

            if usuario:
                # Validar el estado de expensa
                if usuario.get("estadoExpensa", "").lower() == "al dia":
                    # Si el usuario está al día, registrar la entrada/salida
                    registro = self.registrovisitas_collection.find_one({"placa": plate_text})

                    if registro:
                        # Verificar si ya existe al menos una entrada antes de registrar una salida
                        if any(movimiento["tipo"] == "entrada" for movimiento in registro["movimientos"]):
                            # Registrar una nueva salida
                            self.registrovisitas_collection.update_one(
                                {"placa": plate_text},
                                {
                                    "$push": {
                                        "movimientos": {
                                            "tipo": "salida",
                                            "fecha": datetime.now()
                                        }
                                    },
                                    "$inc": {"conteoSalidas": 1}
                                }
                            )
                            print(f"Salida registrada para la placa: {plate_text}")
                        else:
                            print(f"No se puede registrar una salida para la placa {plate_text} sin una entrada previa.")
                    else:
                        # Si no existe un registro previo, crear uno nuevo con una entrada
                        self.registrovisitas_collection.insert_one({
                            "placa": plate_text,
                            "usuarioId": usuario["_id"],
                            "rol": usuario["rol"],
                            "movimientos": [
                                {
                                    "tipo": "entrada",
                                    "fecha": datetime.now()
                                }
                            ],
                            "conteoEntradas": 1,
                            "conteoSalidas": 0
                        })
                        print(f"Entrada registrada para la placa: {plate_text}")
                else:
                    # Si el estado de expensa está en mora, denegar el acceso
                    print(f"Acceso denegado para la placa {plate_text}: Estado de expensa en mora.")
            else:
                # Si no se encuentra el usuario, preguntar si desea registrar
                print(f"Placa no asociada a ningún usuario: {plate_text}")
                # Mostrar ventana de OpenCV preguntando al usuario
                pregunta = f"Registrar placa {plate_text}? (S/N)"
                img = np.zeros((100, 500, 3), dtype=np.uint8)
                cv2.putText(img, pregunta, (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 1, (255,255,255), 2)
                cv2.imshow("Confirmar registro", img)
                while True:
                    key = cv2.waitKey(0)
                    if key in [ord('s'), ord('S')]:
                        # Registrar la placa
                        self.registrovisitas_collection.insert_one({
                            "placa": plate_text,
                            "movimientos": [
                                {
                                    "tipo": "entrada",
                                    "fecha": datetime.now()
                                }
                            ],
                            "conteoEntradas": 1,
                            "conteoSalidas": 0
                        })
                        print(f"Placa {plate_text} registrada por decisión del usuario.")
                        break
                    elif key in [ord('n'), ord('N')]:
                        print(f"Placa {plate_text} NO registrada por decisión del usuario.")
                        break
                cv2.destroyWindow("Confirmar registro")
        except Exception as e:
            print(f"Error al guardar en MongoDB: {e}")
    
    def display_fps(self, frame):
        """Calcular y mostrar FPS"""
        current_time = time.time()
        self.fps_counter += 1
        
        if (current_time - self.prev_time) > 1.0:
            self.fps = self.fps_counter
            self.fps_counter = 0
            self.prev_time = current_time
        
        cv2.putText(frame, f"FPS: {self.fps}", (10, 30),
        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
    
    def run(self):
        """Ejecutar el reconocimiento en tiempo real"""
        print("Iniciando reconocimiento de placas... (Presione 'q' para salir)")
        
        while True:
            ret, frame = self.cap.read()
            if not ret:
                print("Error al capturar frame")
                break
            
            # Procesar frame
            processed_frame = self.process_frame(frame)
            
            # Mostrar resultado
            cv2.imshow("Reconocimiento de Placas Colombianas", processed_frame)
            
            # Salir con 'q'
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break
        
        self.cap.release()
        cv2.destroyAllWindows()

if __name__ == "__main__":
    recognizer = PlateRecognizer()
    recognizer.run()
