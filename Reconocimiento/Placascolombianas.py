"""
Sistema de Reconocimiento de Placas Colombianas - Versión Mejorada
Incluye:
- Detección por contornos (no depende de YOLO para placas)
- Múltiples métodos de preprocesamiento
- OCR optimizado con EasyOCR
- Cooldown para evitar detecciones repetidas
- Soporte para placas nuevas (AAA00A) y antiguas (AAA000)
"""

import cv2
import easyocr
import numpy as np
import re
from datetime import datetime
from pymongo import MongoClient
import time
import requests


class PlateRecognizer:
    def __init__(self):
        print("🚗 Iniciando sistema de reconocimiento de placas...")
        
        # URL del servidor Node.js
        self.api_url = "http://localhost:5000/api"
        
        # Conexión a MongoDB (una sola vez)
        try:
            self.client = MongoClient("mongodb://localhost:27017", serverSelectionTimeoutMS=5000)
            self.client.server_info()  # Verificar conexión
            self.db = self.client["adminResidencial"]
            self.usuarios_collection = self.db["usuarios"]
            self.visitantes_collection = self.db["visitantes"]
            print("✅ Conectado a MongoDB")
        except Exception as e:
            print(f"❌ Error conectando a MongoDB: {e}")
            self.db = None
        
        # Iniciar EasyOCR con configuración optimizada
        print("📖 Cargando motor OCR...")
        self.reader = easyocr.Reader(
            ["en"],  # Solo inglés (mejor para caracteres alfanuméricos)
            gpu=True,
            verbose=False
        )
        print("✅ OCR cargado")
        
        # Patrones de placas colombianas
        # Formato antiguo: ABC123 (3 letras + 3 números)
        # Formato nuevo: ABC12D (3 letras + 2 números + 1 letra)
        self.plate_patterns = [
            re.compile(r"^[A-Z]{3}\d{3}$"),      # Antiguo: ABC123
            re.compile(r"^[A-Z]{3}\d{2}[A-Z]$"), # Nuevo: ABC12D
        ]
        
        # Caracteres válidos para placas
        self.valid_chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
        
        # Configuración de la cámara
        self.cap = None
        self.init_camera()
        
        # Control de detecciones (cooldown para placas CONFIRMADAS)
        self.confirmed_plates = {}  # {placa: timestamp} - placas ya anunciadas
        self.cooldown_seconds = 15  # No repetir misma placa por 15 segundos
        
        # Sistema de votación para mejorar precisión
        self.vote_buffer = {}  # {placa_aproximada: [lecturas]}
        self.vote_threshold = 3  # Mínimo 3 lecturas similares para confirmar
        self.vote_window = 5.0  # Ventana de tiempo en segundos para votar
        self.last_vote_cleanup = time.time()
        
        # Caché de placas registradas (para fuzzy matching)
        self.registered_plates = set()
        self.load_registered_plates()
        
        # Variables para anuncio en pantalla
        self.message = ""
        self.message_time = 0
        self.message_duration = 4  # Mostrar mensaje por 4 segundos
        self.message_color = (0, 255, 0)
        
        # Parámetros de detección de placa
        self.min_plate_width = 80
        self.max_plate_width = 400
        self.min_plate_height = 20
        self.max_plate_height = 100
        self.plate_aspect_ratio_min = 2.0  # Ancho/Alto mínimo
        self.plate_aspect_ratio_max = 6.0  # Ancho/Alto máximo
        
        # FPS
        self.fps = 0
        self.frame_count = 0
        self.fps_time = time.time()
    
    def load_registered_plates(self):
        """Cargar placas registradas de la BD para fuzzy matching"""
        if self.db is None:
            return
        
        try:
            # Cargar placas de usuarios
            usuarios = self.usuarios_collection.find({}, {"placaVehiculo": 1})
            for u in usuarios:
                if u.get("placaVehiculo"):
                    self.registered_plates.add(u["placaVehiculo"].upper())
            
            # Cargar placas de visitantes
            visitantes = self.visitantes_collection.find({}, {"placaVehiculo": 1})
            for v in visitantes:
                if v.get("placaVehiculo"):
                    self.registered_plates.add(v["placaVehiculo"].upper())
            
            print(f"📋 {len(self.registered_plates)} placas registradas cargadas para matching")
        except Exception as e:
            print(f"⚠️ Error cargando placas: {e}")
    
    def init_camera(self, camera_index=None):
        """Inicializar cámara con configuración óptima - prueba múltiples índices"""
        print("📷 Buscando cámaras disponibles...")
        
        # Si se especifica índice, usar ese
        if camera_index is not None:
            indices_to_try = [camera_index]
        else:
            # Probar varios índices comunes
            indices_to_try = [0, 1, 2, -1]
        
        # Diferentes backends para Windows
        backends = [
            cv2.CAP_DSHOW,      # DirectShow (Windows)
            cv2.CAP_MSMF,       # Microsoft Media Foundation
            cv2.CAP_ANY,        # Automático
        ]
        
        for backend in backends:
            for idx in indices_to_try:
                try:
                    print(f"   Probando cámara {idx} con backend {backend}...")
                    cap = cv2.VideoCapture(idx, backend)
                    
                    if cap.isOpened():
                        # Intentar leer un frame para verificar
                        ret, test_frame = cap.read()
                        if ret and test_frame is not None:
                            self.cap = cap
                            
                            # Configurar resolución
                            self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
                            self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
                            self.cap.set(cv2.CAP_PROP_FPS, 30)
                            
                            # Obtener resolución real
                            actual_w = int(self.cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                            actual_h = int(self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                            
                            print(f"✅ Cámara {idx} inicializada ({actual_w}x{actual_h})")
                            return True
                    
                    cap.release()
                    
                except Exception as e:
                    print(f"   Error con cámara {idx}: {e}")
                    continue
        
        print("❌ No se encontró ninguna cámara disponible")
        print("💡 Sugerencias:")
        print("   1. Verifica que la cámara esté conectada")
        print("   2. Cierra otras aplicaciones que puedan estar usándola")
        print("   3. Ejecuta el script especificando el índice: python Placascolombianas.py --camera 1")
        return False
    
    def preprocess_for_detection(self, frame):
        """Preprocesar frame para detectar regiones candidatas de placas"""
        # Convertir a escala de grises
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        
        # Aplicar CLAHE para mejorar contraste
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        gray = clahe.apply(gray)
        
        # Blur para reducir ruido
        gray = cv2.GaussianBlur(gray, (5, 5), 0)
        
        # Detección de bordes
        edges = cv2.Canny(gray, 50, 150)
        
        # Dilatar para conectar bordes cercanos
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
        edges = cv2.dilate(edges, kernel, iterations=1)
        
        return edges, gray
    
    def find_plate_candidates(self, edges, frame):
        """Encontrar rectángulos candidatos a ser placas"""
        candidates = []
        
        # Encontrar contornos
        contours, _ = cv2.findContours(edges, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
        
        for contour in contours:
            # Aproximar el contorno a un polígono
            peri = cv2.arcLength(contour, True)
            approx = cv2.approxPolyDP(contour, 0.02 * peri, True)
            
            # Si tiene 4 lados, podría ser una placa
            if len(approx) >= 4 and len(approx) <= 6:
                x, y, w, h = cv2.boundingRect(contour)
                
                # Verificar dimensiones
                if w < self.min_plate_width or w > self.max_plate_width:
                    continue
                if h < self.min_plate_height or h > self.max_plate_height:
                    continue
                
                # Verificar aspect ratio (placas son rectangulares)
                aspect_ratio = w / h
                if aspect_ratio < self.plate_aspect_ratio_min or aspect_ratio > self.plate_aspect_ratio_max:
                    continue
                
                # Verificar área mínima
                area = cv2.contourArea(contour)
                if area < 1000:
                    continue
                
                # Extraer región de interés
                roi = frame[y:y+h, x:x+w]
                candidates.append({
                    'roi': roi,
                    'coords': (x, y, w, h),
                    'area': area
                })
        
        # Ordenar por área (las placas suelen ser de las más grandes)
        candidates.sort(key=lambda c: c['area'], reverse=True)
        
        return candidates[:10]  # Máximo 10 candidatos
    
    def preprocess_plate_image(self, plate_img, method=0):
        """
        Preprocesar imagen de placa para OCR
        Múltiples métodos para maximizar precisión
        """
        # Redimensionar para OCR óptimo
        height = 60
        aspect = plate_img.shape[1] / plate_img.shape[0]
        width = int(height * aspect)
        plate_img = cv2.resize(plate_img, (width, height))
        
        # Convertir a escala de grises
        if len(plate_img.shape) == 3:
            gray = cv2.cvtColor(plate_img, cv2.COLOR_BGR2GRAY)
        else:
            gray = plate_img.copy()
        
        if method == 0:
            # Método 1: CLAHE + Otsu
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
            gray = clahe.apply(gray)
            _, processed = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            
        elif method == 1:
            # Método 2: Adaptative threshold
            gray = cv2.GaussianBlur(gray, (3, 3), 0)
            processed = cv2.adaptiveThreshold(
                gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
                cv2.THRESH_BINARY, 11, 2
            )
            
        elif method == 2:
            # Método 3: Morphological operations
            clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
            gray = clahe.apply(gray)
            _, processed = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            kernel = np.ones((2, 2), np.uint8)
            processed = cv2.morphologyEx(processed, cv2.MORPH_CLOSE, kernel)
            
        elif method == 3:
            # Método 4: Invertido (para placas oscuras con texto claro)
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
            gray = clahe.apply(gray)
            _, processed = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
            
        else:
            # Método 5: Sin procesamiento (a veces funciona mejor)
            processed = gray
        
        return processed
    
    def clean_plate_text(self, text):
        """Limpiar y normalizar texto de placa"""
        # Convertir a mayúsculas
        text = text.upper()
        
        # Remover caracteres no válidos
        text = re.sub(r'[^A-Z0-9]', '', text)
        
        # Correcciones comunes de OCR
        corrections = {
            'O': '0',  # O -> 0 en posición numérica
            '0': 'O',  # 0 -> O en posición de letra
            'I': '1',
            'L': '1',
            'Z': '2',
            'S': '5',
            'B': '8',
            'G': '6',
        }
        
        # Si tiene 6 caracteres, intentar corregir
        if len(text) == 6:
            corrected = list(text)
            
            # Primeros 3 deben ser letras
            for i in range(3):
                if corrected[i].isdigit():
                    if corrected[i] == '0':
                        corrected[i] = 'O'
                    elif corrected[i] == '1':
                        corrected[i] = 'I'
                    elif corrected[i] == '8':
                        corrected[i] = 'B'
            
            # Posiciones 4-5 deben ser números (formato antiguo y nuevo)
            for i in range(3, 5):
                if corrected[i].isalpha():
                    if corrected[i] == 'O':
                        corrected[i] = '0'
                    elif corrected[i] in 'IL':
                        corrected[i] = '1'
                    elif corrected[i] == 'S':
                        corrected[i] = '5'
            
            # Posición 6: puede ser número (antiguo) o letra (nuevo)
            # No corregir
            
            text = ''.join(corrected)
        
        return text
    
    def validate_plate(self, text):
        """Validar formato de placa colombiana"""
        text = self.clean_plate_text(text)
        
        for pattern in self.plate_patterns:
            if pattern.match(text):
                return text
        
        return None
    
    def read_plate_ocr(self, plate_img):
        """
        Intentar leer placa con múltiples métodos de preprocesamiento
        Retorna la mejor lectura encontrada
        """
        best_result = None
        best_confidence = 0
        
        # Intentar con diferentes métodos de preprocesamiento
        for method in range(5):
            try:
                processed = self.preprocess_plate_image(plate_img, method)
                
                # OCR con EasyOCR
                results = self.reader.readtext(
                    processed,
                    allowlist=self.valid_chars,
                    paragraph=False,
                    min_size=10,
                    text_threshold=0.5,
                    low_text=0.3,
                    width_ths=0.7
                )
                
                for (bbox, text, confidence) in results:
                    # Limpiar y validar
                    clean_text = self.clean_plate_text(text)
                    validated = self.validate_plate(clean_text)
                    
                    if validated and confidence > best_confidence:
                        best_result = validated
                        best_confidence = confidence
                        
                        # Si tenemos alta confianza, parar
                        if confidence > 0.8:
                            return best_result, best_confidence
                            
            except Exception as e:
                continue
        
        return best_result, best_confidence
    
    def calculate_similarity(self, plate1, plate2):
        """Calcular similitud entre dos placas (0-6 caracteres iguales)"""
        if len(plate1) != 6 or len(plate2) != 6:
            return 0
        return sum(c1 == c2 for c1, c2 in zip(plate1, plate2))
    
    def find_best_match(self, detected_plate):
        """
        Buscar la mejor coincidencia en placas registradas
        Retorna (placa_match, similitud) o (None, 0)
        """
        best_match = None
        best_similarity = 0
        
        for registered in self.registered_plates:
            similarity = self.calculate_similarity(detected_plate, registered)
            
            # Necesitamos al menos 4 de 6 caracteres iguales
            if similarity >= 4 and similarity > best_similarity:
                best_similarity = similarity
                best_match = registered
        
        return best_match, best_similarity
    
    def add_vote(self, plate_text, confidence):
        """
        Añadir un voto para una placa detectada
        Retorna la placa confirmada si hay suficientes votos, None si no
        """
        current_time = time.time()
        
        # Limpiar votos antiguos periódicamente
        if current_time - self.last_vote_cleanup > 2.0:
            self.cleanup_votes()
            self.last_vote_cleanup = current_time
        
        # Buscar si hay match con placa registrada
        matched_plate, similarity = self.find_best_match(plate_text)
        
        # Usar la placa matched si hay buena similitud, sino usar la detectada
        if matched_plate and similarity >= 5:
            vote_key = matched_plate
            plate_to_use = matched_plate
        else:
            vote_key = plate_text
            plate_to_use = plate_text
        
        # Añadir voto
        if vote_key not in self.vote_buffer:
            self.vote_buffer[vote_key] = []
        
        self.vote_buffer[vote_key].append({
            'time': current_time,
            'confidence': confidence,
            'original': plate_text
        })
        
        # Contar votos válidos (dentro de la ventana de tiempo)
        valid_votes = [v for v in self.vote_buffer[vote_key] 
                       if current_time - v['time'] < self.vote_window]
        self.vote_buffer[vote_key] = valid_votes
        
        # Si hay suficientes votos, confirmar
        if len(valid_votes) >= self.vote_threshold:
            # Verificar que no esté en cooldown
            if vote_key not in self.confirmed_plates or \
               current_time - self.confirmed_plates[vote_key] > self.cooldown_seconds:
                
                # Confirmar placa
                self.confirmed_plates[vote_key] = current_time
                # Limpiar buffer de votos
                self.vote_buffer[vote_key] = []
                
                avg_confidence = sum(v['confidence'] for v in valid_votes) / len(valid_votes)
                return plate_to_use, avg_confidence
        
        return None, 0
    
    def cleanup_votes(self):
        """Limpiar votos antiguos"""
        current_time = time.time()
        keys_to_remove = []
        
        for key, votes in self.vote_buffer.items():
            valid_votes = [v for v in votes if current_time - v['time'] < self.vote_window]
            if not valid_votes:
                keys_to_remove.append(key)
            else:
                self.vote_buffer[key] = valid_votes
        
        for key in keys_to_remove:
            del self.vote_buffer[key]
    
    def process_frame(self, frame):
        """Procesar cada frame de video"""
        # Preprocesar para detección
        edges, gray = self.preprocess_for_detection(frame)
        
        # Encontrar candidatos a placa
        candidates = self.find_plate_candidates(edges, frame)
        
        # Procesar cada candidato
        for candidate in candidates:
            roi = candidate['roi']
            x, y, w, h = candidate['coords']
            
            # Intentar leer placa
            plate_text, confidence = self.read_plate_ocr(roi)
            
            if plate_text and confidence > 0.3:  # Umbral más bajo porque usamos votación
                # Añadir voto y verificar si se confirma
                confirmed_plate, avg_conf = self.add_vote(plate_text, confidence)
                
                if confirmed_plate:
                    # ¡Placa confirmada por votación!
                    cv2.rectangle(frame, (x, y), (x+w, y+h), (0, 255, 0), 3)
                    cv2.putText(
                        frame, 
                        f"CONFIRMADO: {confirmed_plate}", 
                        (x, y-10),
                        cv2.FONT_HERSHEY_SIMPLEX, 
                        0.9, 
                        (0, 255, 0), 
                        2
                    )
                    
                    # Buscar en base de datos
                    resultado = self.search_in_database(confirmed_plate)
                    self.show_message(resultado)
                    break
                else:
                    # Placa en proceso de votación - mostrar en amarillo
                    cv2.rectangle(frame, (x, y), (x+w, y+h), (0, 255, 255), 2)
                    cv2.putText(
                        frame, 
                        f"Leyendo: {plate_text}", 
                        (x, y-10),
                        cv2.FONT_HERSHEY_SIMPLEX, 
                        0.6, 
                        (0, 255, 255), 
                        1
                    )
            else:
                # Candidato no válido - mostrar en rojo tenue
                cv2.rectangle(frame, (x, y), (x+w, y+h), (0, 0, 150), 1)
        
        # Mostrar información en pantalla
        self.draw_overlay(frame)
        
        return frame
    
    def search_in_database(self, plate_text):
        """Buscar placa en la base de datos y registrar entrada si es visitante"""
        if self.db is None:
            return "⚠️ Sin conexión a base de datos"
        
        try:
            # Buscar en usuarios (residentes)
            usuario = self.usuarios_collection.find_one({"placaVehiculo": plate_text})
            if usuario:
                nombre = f"{usuario.get('nombre', '')} {usuario.get('apellido', '')}"
                self.message_color = (0, 255, 0)  # Verde
                return f"✓ RESIDENTE: {nombre}"
            
            # Buscar en visitantes
            visitante = self.visitantes_collection.find_one({"placaVehiculo": plate_text})
            if visitante:
                nombre = f"{visitante.get('nombre', '')} {visitante.get('apellido', '')}"
                
                # Registrar entrada via API (cambia estado de plaza a OCUPADO)
                entrada_registrada = self.registrar_entrada_api(plate_text)
                
                if entrada_registrada:
                    self.message_color = (0, 255, 0)  # Verde
                    return f"✓ VISITANTE INGRESÓ: {nombre}"
                else:
                    self.message_color = (0, 255, 255)  # Amarillo
                    return f"✓ VISITANTE: {nombre} (ya ingresado)"
            
            # No encontrado
            self.message_color = (0, 0, 255)  # Rojo
            return f"✗ PLACA NO REGISTRADA: {plate_text}"
            
        except Exception as e:
            print(f"Error buscando en DB: {e}")
            self.message_color = (0, 165, 255)  # Naranja
            return "⚠️ Error consultando base de datos"
    
    def registrar_entrada_api(self, plate_text):
        """Llamar al API de Node.js para registrar entrada del visitante"""
        try:
            response = requests.post(
                f"{self.api_url}/parqueaderos/registrar-entrada",
                json={"placa": plate_text},
                timeout=5
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("yaRegistrado"):
                    print(f"ℹ️ Visitante ya había ingresado anteriormente")
                    return False
                else:
                    print(f"🚗 Entrada registrada via API: Plaza {data.get('plaza', {}).get('numero', '?')}")
                    return True
            else:
                print(f"⚠️ API respondió con código {response.status_code}")
                return False
                
        except requests.exceptions.RequestException as e:
            print(f"⚠️ Error llamando API: {e}")
            return False
    
    def show_message(self, message):
        """Mostrar mensaje temporal en pantalla"""
        self.message = message
        self.message_time = time.time()
        print(f"📢 {message}")
    
    def draw_overlay(self, frame):
        """Dibujar información en pantalla"""
        height, width = frame.shape[:2]
        
        # Calcular FPS
        self.frame_count += 1
        if time.time() - self.fps_time >= 1.0:
            self.fps = self.frame_count
            self.frame_count = 0
            self.fps_time = time.time()
        
        # Barra superior con información
        cv2.rectangle(frame, (0, 0), (width, 40), (0, 0, 0), -1)
        cv2.putText(
            frame, 
            f"FPS: {self.fps} | Placas confirmadas: {len(self.confirmed_plates)} | Presiona 'Q' para salir",
            (10, 28),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            (255, 255, 255),
            1
        )
        
        # Mostrar mensaje si está activo
        if self.message and (time.time() - self.message_time) < self.message_duration:
            # Fondo para mensaje
            cv2.rectangle(frame, (10, height-70), (width-10, height-10), (0, 0, 0), -1)
            cv2.rectangle(frame, (10, height-70), (width-10, height-10), self.message_color, 2)
            
            # Texto del mensaje
            cv2.putText(
                frame,
                self.message,
                (20, height-30),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.8,
                self.message_color,
                2
            )
    
    def run(self):
        """Ejecutar el reconocimiento en tiempo real"""
        if not self.cap or not self.cap.isOpened():
            print("❌ Cámara no disponible")
            return
        
        print("\n" + "="*50)
        print("🚗 SISTEMA DE RECONOCIMIENTO DE PLACAS ACTIVO")
        print("="*50)
        print("• Presiona 'Q' para salir")
        print("• Presiona 'R' para reiniciar contador de placas")
        print("• Presiona 'D' para modo debug")
        print("="*50 + "\n")
        
        debug_mode = False
        
        while True:
            ret, frame = self.cap.read()
            if not ret:
                print("Error al capturar frame")
                break
            
            # Procesar frame
            processed_frame = self.process_frame(frame)
            
            # Modo debug: mostrar bordes detectados
            if debug_mode:
                edges, _ = self.preprocess_for_detection(frame)
                edges_color = cv2.cvtColor(edges, cv2.COLOR_GRAY2BGR)
                combined = np.hstack([processed_frame, edges_color])
                cv2.imshow("Reconocimiento de Placas - DEBUG", combined)
            else:
                cv2.imshow("Reconocimiento de Placas Colombianas", processed_frame)
            
            # Manejar teclas
            key = cv2.waitKey(1) & 0xFF
            if key == ord('q') or key == ord('Q'):
                break
            elif key == ord('r') or key == ord('R'):
                self.detected_plates.clear()
                print("🔄 Contador de placas reiniciado")
            elif key == ord('d') or key == ord('D'):
                debug_mode = not debug_mode
                if not debug_mode:
                    cv2.destroyWindow("Reconocimiento de Placas - DEBUG")
                print(f"🔧 Modo debug: {'ON' if debug_mode else 'OFF'}")
        
        # Limpiar
        self.cleanup()
    
    def cleanup(self):
        """Liberar recursos"""
        print("\n🛑 Cerrando sistema...")
        if self.cap:
            self.cap.release()
        cv2.destroyAllWindows()
        if self.client:
            self.client.close()
        print("✅ Sistema cerrado correctamente")


if __name__ == "__main__":
    recognizer = PlateRecognizer()
    recognizer.run()