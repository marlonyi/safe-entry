# -*- coding: utf-8 -*-
"""
🔐 QR Scanner - Sistema de Control de Acceso Residencial
=========================================================
Aplicación para leer códigos QR de residentes y visitantes,
verificar su autorización y registrar el acceso en el sistema.

Versión: 2.0.0 - Con sistema de login integrado
"""

import cv2
import requests
import time
import os
import threading
import winsound
import json
from datetime import datetime
from pyzbar import pyzbar
from dotenv import load_dotenv
import customtkinter as ctk
from PIL import Image, ImageTk

# Cargar configuración
load_dotenv()

# Configurar encoding para Windows (evita errores con emojis en consola)
import sys
import io
# Solo configurar stdout si existe (en modo --windowed no hay consola)
if sys.stdout is not None and hasattr(sys.stdout, 'buffer'):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

# Archivo para guardar sesión
SESSION_FILE = os.path.join(os.path.dirname(__file__), ".session.json")


class QRScannerApp:
    """Aplicación principal del escáner QR con interfaz gráfica y login"""
    
    def __init__(self):
        # Configuración desde .env
        self.api_url = os.getenv("API_BASE_URL", "http://localhost:5000")
        self.camera_index = int(os.getenv("CAMERA_INDEX", 0))
        self.cooldown_seconds = int(os.getenv("COOLDOWN_SECONDS", 10))
        self.debug = os.getenv("DEBUG", "false").lower() == "true"
        
        # Estados de sesión
        self.logged_in = False
        self.user_id = None
        self.user_name = None
        self.user_rol = None
        self.conjunto_id = None
        self.conjunto_nombre = None
        self.token = None
        
        # Estados de cámara
        self.cap = None
        self.running = False
        self.last_scanned = {}  # {token: timestamp} para cooldown
        self.current_message = ""
        self.message_color = "green"
        self.message_time = 0
        
        # Contadores
        self.stats = {"total": 0, "authorized": 0, "denied": 0}
        
        # Inicializar interfaz
        self.setup_ui()
        
        # Intentar cargar sesión guardada
        self.root.after(100, self.try_load_session)
    
    def log(self, message):
        """Imprimir mensaje de debug"""
        if self.debug:
            print(f"[DEBUG] {datetime.now().strftime('%H:%M:%S')} - {message}")
    
    def setup_ui(self):
        """Configurar la interfaz gráfica"""
        ctk.set_appearance_mode("dark")
        ctk.set_default_color_theme("blue")
        
        self.root = ctk.CTk()
        self.root.title("🔐 SafeEntry - QR Scanner")
        self.root.geometry("1000x700")
        self.root.resizable(True, True)
        
        # Frame principal (contendrá login o scanner)
        self.main_container = ctk.CTkFrame(self.root)
        self.main_container.pack(fill="both", expand=True)
        
        # Cerrar ventana
        self.root.protocol("WM_DELETE_WINDOW", self.on_closing)
    
    # =========================================
    # PANTALLA DE LOGIN
    # =========================================
    
    def show_login_screen(self):
        """Mostrar pantalla de login"""
        # Limpiar contenedor
        for widget in self.main_container.winfo_children():
            widget.destroy()
        
        # Frame centrado para login
        login_frame = ctk.CTkFrame(self.main_container, width=400, height=500)
        login_frame.place(relx=0.5, rely=0.5, anchor="center")
        login_frame.pack_propagate(False)
        
        # Logo/Título
        logo_label = ctk.CTkLabel(
            login_frame,
            text="🔐",
            font=("Helvetica", 64)
        )
        logo_label.pack(pady=(30, 10))
        
        title_label = ctk.CTkLabel(
            login_frame,
            text="SafeEntry Scanner",
            font=("Helvetica", 28, "bold")
        )
        title_label.pack(pady=(0, 5))
        
        subtitle_label = ctk.CTkLabel(
            login_frame,
            text="Control de Acceso Residencial",
            font=("Helvetica", 12),
            text_color="gray"
        )
        subtitle_label.pack(pady=(0, 30))
        
        # Campo cédula
        cedula_label = ctk.CTkLabel(
            login_frame,
            text="Cédula",
            font=("Helvetica", 12, "bold"),
            anchor="w"
        )
        cedula_label.pack(fill="x", padx=40)
        
        self.cedula_entry = ctk.CTkEntry(
            login_frame,
            placeholder_text="Ingresa tu número de cédula",
            height=45,
            font=("Helvetica", 14)
        )
        self.cedula_entry.pack(fill="x", padx=40, pady=(5, 15))
        
        # Campo contraseña
        password_label = ctk.CTkLabel(
            login_frame,
            text="Contraseña",
            font=("Helvetica", 12, "bold"),
            anchor="w"
        )
        password_label.pack(fill="x", padx=40)
        
        self.password_entry = ctk.CTkEntry(
            login_frame,
            placeholder_text="Ingresa tu contraseña",
            show="•",
            height=45,
            font=("Helvetica", 14)
        )
        self.password_entry.pack(fill="x", padx=40, pady=(5, 10))
        
        # Checkbox recordar
        self.remember_var = ctk.BooleanVar(value=True)
        remember_check = ctk.CTkCheckBox(
            login_frame,
            text="Recordar sesión",
            variable=self.remember_var,
            font=("Helvetica", 11)
        )
        remember_check.pack(anchor="w", padx=40, pady=(0, 20))
        
        # Mensaje de error
        self.login_error_label = ctk.CTkLabel(
            login_frame,
            text="",
            font=("Helvetica", 11),
            text_color="red"
        )
        self.login_error_label.pack(fill="x", padx=40)
        
        # Botón login
        self.login_btn = ctk.CTkButton(
            login_frame,
            text="Iniciar Sesión",
            command=self.do_login,
            height=45,
            width=320,
            font=("Helvetica", 14, "bold")
        )
        self.login_btn.pack(pady=(10, 20))
        
        # Bind Enter key
        self.password_entry.bind("<Return>", lambda e: self.do_login())
        self.cedula_entry.bind("<Return>", lambda e: self.password_entry.focus())
        
        # Footer
        footer_label = ctk.CTkLabel(
            login_frame,
            text="Solo personal autorizado de portería",
            font=("Helvetica", 10),
            text_color="gray"
        )
        footer_label.pack(pady=(20, 10))
        
        # Status de conexión
        self.connection_label = ctk.CTkLabel(
            login_frame,
            text="",
            font=("Helvetica", 10),
            text_color="gray"
        )
        self.connection_label.pack(pady=(0, 10))
        
        # Verificar conexión al servidor
        self.check_server_connection()
    
    def check_server_connection(self):
        """Verificar conexión al servidor"""
        def check():
            try:
                response = requests.get(f"{self.api_url}/api/health", timeout=5)
                if response.status_code == 200:
                    self.root.after(0, lambda: self.connection_label.configure(
                        text=f"🟢 Conectado a {self.api_url}",
                        text_color="green"
                    ))
                else:
                    self.root.after(0, lambda: self.connection_label.configure(
                        text="🟡 Servidor responde pero con error",
                        text_color="orange"
                    ))
            except:
                self.root.after(0, lambda: self.connection_label.configure(
                    text=f"🔴 Sin conexión al servidor",
                    text_color="red"
                ))
        
        threading.Thread(target=check, daemon=True).start()
    
    def do_login(self):
        """Realizar login"""
        cedula = self.cedula_entry.get().strip()
        password = self.password_entry.get().strip()
        
        if not cedula or not password:
            self.login_error_label.configure(text="Ingresa cédula y contraseña")
            return
        
        self.login_btn.configure(state="disabled", text="Verificando...")
        self.login_error_label.configure(text="")
        
        def attempt_login():
            try:
                response = requests.post(
                    f"{self.api_url}/api/usuarios/login",
                    json={"cedula": cedula, "password": password},
                    timeout=10
                )
                
                if response.status_code == 200:
                    data = response.json()
                    
                    # Verificar que sea personal de portería o admin
                    rol = data.get("usuario", {}).get("rol", "")
                    if rol not in ["porteria", "admin"]:
                        self.root.after(0, lambda: self.show_login_error(
                            "Solo personal de portería o admin puede usar esta app"
                        ))
                        return
                    
                    # Guardar datos de sesión
                    self.token = data.get("token")
                    self.user_id = data.get("usuario", {}).get("id")
                    self.user_name = data.get("usuario", {}).get("nombre", "Usuario")
                    self.user_rol = rol
                    self.conjunto_id = data.get("usuario", {}).get("conjuntoId")  # Campo correcto
                    self.conjunto_nombre = data.get("usuario", {}).get("conjuntoNombre", "Mi Conjunto")  # Campo correcto
                    self.logged_in = True
                    
                    # Guardar sesión si está marcado
                    if self.remember_var.get():
                        self.save_session()
                    
                    # Mostrar scanner
                    self.root.after(0, self.show_scanner_screen)
                    
                elif response.status_code == 401:
                    self.root.after(0, lambda: self.show_login_error("Cédula o contraseña incorrecta"))
                else:
                    error = response.json().get("error", "Error desconocido")
                    self.root.after(0, lambda: self.show_login_error(error))
                    
            except requests.exceptions.ConnectionError:
                self.root.after(0, lambda: self.show_login_error("No hay conexión al servidor"))
            except Exception as e:
                self.root.after(0, lambda: self.show_login_error(f"Error: {str(e)}"))
        
        threading.Thread(target=attempt_login, daemon=True).start()
    
    def show_login_error(self, message):
        """Mostrar error de login"""
        self.login_error_label.configure(text=message)
        self.login_btn.configure(state="normal", text="Iniciar Sesión")
    
    def save_session(self):
        """Guardar sesión en archivo local"""
        session_data = {
            "token": self.token,
            "user_id": self.user_id,
            "user_name": self.user_name,
            "user_rol": self.user_rol,
            "conjunto_id": self.conjunto_id,
            "conjunto_nombre": self.conjunto_nombre,
            "saved_at": datetime.now().isoformat()
        }
        try:
            with open(SESSION_FILE, "w") as f:
                json.dump(session_data, f)
            self.log("Sesión guardada")
        except Exception as e:
            self.log(f"Error guardando sesión: {e}")
    
    def try_load_session(self):
        """Intentar cargar sesión guardada"""
        if os.path.exists(SESSION_FILE):
            try:
                with open(SESSION_FILE, "r") as f:
                    session = json.load(f)
                
                # Verificar que el token sigue siendo válido
                self.token = session.get("token")
                if self.validate_session():
                    self.user_id = session.get("user_id")
                    self.user_name = session.get("user_name")
                    self.user_rol = session.get("user_rol")
                    self.conjunto_id = session.get("conjunto_id")
                    self.conjunto_nombre = session.get("conjunto_nombre")
                    self.logged_in = True
                    self.log(f"Sesión restaurada: {self.user_name}")
                    self.show_scanner_screen()
                    return
            except Exception as e:
                self.log(f"Error cargando sesión: {e}")
        
        # Si no hay sesión válida, mostrar login
        self.show_login_screen()
    
    def validate_session(self):
        """Verificar que el token de sesión sigue siendo válido"""
        if not self.token:
            return False
        
        try:
            response = requests.get(
                f"{self.api_url}/api/usuarios/me",
                headers={"Authorization": f"Bearer {self.token}"},
                timeout=5
            )
            return response.status_code == 200
        except:
            return False
    
    def logout(self):
        """Cerrar sesión"""
        self.logged_in = False
        self.token = None
        self.user_id = None
        self.user_name = None
        self.conjunto_id = None
        
        # Eliminar archivo de sesión
        if os.path.exists(SESSION_FILE):
            try:
                os.remove(SESSION_FILE)
            except:
                pass
        
        # Detener cámara si está corriendo
        if self.running:
            self.stop_camera()
        
        # Mostrar login
        self.show_login_screen()
    
    # =========================================
    # PANTALLA DEL SCANNER
    # =========================================
    
    def show_scanner_screen(self):
        """Mostrar pantalla principal del scanner"""
        # Limpiar contenedor
        for widget in self.main_container.winfo_children():
            widget.destroy()
        
        # Frame principal
        self.main_frame = ctk.CTkFrame(self.main_container)
        self.main_frame.pack(fill="both", expand=True, padx=10, pady=10)
        
        # Header
        self.header_frame = ctk.CTkFrame(self.main_frame, height=60)
        self.header_frame.pack(fill="x", padx=5, pady=5)
        self.header_frame.pack_propagate(False)
        
        self.title_label = ctk.CTkLabel(
            self.header_frame, 
            text="🔐 SafeEntry Scanner",
            font=("Helvetica", 24, "bold")
        )
        self.title_label.pack(side="left", padx=20, pady=10)
        
        # Info del usuario y conjunto
        user_info_frame = ctk.CTkFrame(self.header_frame, fg_color="transparent")
        user_info_frame.pack(side="right", padx=20, pady=10)
        
        self.conjunto_label = ctk.CTkLabel(
            user_info_frame,
            text=f"📍 {self.conjunto_nombre}",
            font=("Helvetica", 14, "bold")
        )
        self.conjunto_label.pack(anchor="e")
        
        self.user_label = ctk.CTkLabel(
            user_info_frame,
            text=f"👤 {self.user_name} ({self.user_rol})",
            font=("Helvetica", 11),
            text_color="gray"
        )
        self.user_label.pack(anchor="e")
        
        # Contenedor central
        self.center_frame = ctk.CTkFrame(self.main_frame)
        self.center_frame.pack(fill="both", expand=True, padx=5, pady=5)
        
        # Panel izquierdo - Cámara
        self.camera_frame = ctk.CTkFrame(self.center_frame)
        self.camera_frame.pack(side="left", fill="both", expand=True, padx=5, pady=5)
        
        self.camera_label = ctk.CTkLabel(
            self.camera_frame,
            text="📷 Presiona 'Iniciar Cámara' para comenzar",
            font=("Helvetica", 16)
        )
        self.camera_label.pack(fill="both", expand=True, padx=20, pady=20)
        
        # Panel derecho - Información
        self.info_frame = ctk.CTkFrame(self.center_frame, width=350)
        self.info_frame.pack(side="right", fill="y", padx=5, pady=5)
        self.info_frame.pack_propagate(False)
        
        # Estado de conexión
        self.status_label = ctk.CTkLabel(
            self.info_frame,
            text="🟢 Conectado",
            font=("Helvetica", 14)
        )
        self.status_label.pack(pady=10)
        
        # Información del último escaneo
        self.scan_info_frame = ctk.CTkFrame(self.info_frame)
        self.scan_info_frame.pack(fill="both", expand=True, padx=10, pady=10)
        
        ctk.CTkLabel(
            self.scan_info_frame,
            text="📋 Último Escaneo:",
            font=("Helvetica", 12, "bold")
        ).pack(anchor="w", padx=10, pady=5)
        
        self.scan_result_text = ctk.CTkTextbox(
            self.scan_info_frame,
            height=200,
            font=("Consolas", 12)
        )
        self.scan_result_text.pack(fill="both", expand=True, padx=10, pady=5)
        
        # Panel de mensaje de estado
        self.message_frame = ctk.CTkFrame(self.info_frame, height=80)
        self.message_frame.pack(fill="x", padx=10, pady=10)
        self.message_frame.pack_propagate(False)
        
        self.message_label = ctk.CTkLabel(
            self.message_frame,
            text="Esperando escaneo...",
            font=("Helvetica", 16, "bold"),
            wraplength=300
        )
        self.message_label.pack(expand=True, padx=10, pady=10)
        
        # Botones de control
        self.control_frame = ctk.CTkFrame(self.main_frame, height=60)
        self.control_frame.pack(fill="x", padx=5, pady=5)
        self.control_frame.pack_propagate(False)
        
        self.start_btn = ctk.CTkButton(
            self.control_frame,
            text="▶️ Iniciar Cámara",
            command=self.toggle_camera,
            width=150,
            height=40,
            font=("Helvetica", 14)
        )
        self.start_btn.pack(side="left", padx=20, pady=10)
        
        self.logout_btn = ctk.CTkButton(
            self.control_frame,
            text="🚪 Cerrar Sesión",
            command=self.logout,
            width=150,
            height=40,
            fg_color="gray",
            hover_color="darkgray",
            font=("Helvetica", 14)
        )
        self.logout_btn.pack(side="left", padx=10, pady=10)
        
        self.quit_btn = ctk.CTkButton(
            self.control_frame,
            text="❌ Salir",
            command=self.on_closing,
            width=100,
            height=40,
            fg_color="red",
            hover_color="darkred",
            font=("Helvetica", 14)
        )
        self.quit_btn.pack(side="right", padx=20, pady=10)
        
        # Estadísticas
        self.stats_label = ctk.CTkLabel(
            self.control_frame,
            text="Escaneos: 0 | Autorizados: 0 | Denegados: 0",
            font=("Helvetica", 12)
        )
        self.stats_label.pack(side="right", padx=20, pady=10)
    
    # =========================================
    # FUNCIONES DE LA CÁMARA
    # =========================================
    
    def toggle_camera(self):
        """Iniciar o detener la cámara"""
        if self.running:
            self.stop_camera()
        else:
            self.start_camera()
    
    def start_camera(self):
        """Iniciar la cámara"""
        if not self.conjunto_id:
            self.update_message("❌ Error: No hay conjunto asignado", "red")
            return
        
        try:
            self.cap = cv2.VideoCapture(self.camera_index, cv2.CAP_DSHOW)
            if not self.cap.isOpened():
                self.update_message("❌ No se pudo abrir la cámara", "red")
                return
            
            self.running = True
            self.start_btn.configure(text="⏹️ Detener Cámara")
            self.update_message("📷 Cámara activa - Escanea un QR", "gray")
            
            # Iniciar hilo de captura
            threading.Thread(target=self.camera_loop, daemon=True).start()
            
        except Exception as e:
            self.update_message(f"❌ Error: {str(e)}", "red")
    
    def stop_camera(self):
        """Detener la cámara"""
        self.running = False
        if self.cap:
            self.cap.release()
            self.cap = None
        
        self.start_btn.configure(text="▶️ Iniciar Cámara")
        self.camera_label.configure(image=None, text="📷 Cámara detenida")
        self.update_message("Cámara detenida", "gray")
    
    def camera_loop(self):
        """Loop principal de captura de cámara"""
        while self.running:
            try:
                ret, frame = self.cap.read()
                if not ret:
                    continue
                
                # Buscar QR codes
                qr_codes = pyzbar.decode(frame)
                
                for qr in qr_codes:
                    # Dibujar rectángulo
                    points = qr.polygon
                    if len(points) == 4:
                        pts = [(p.x, p.y) for p in points]
                        for i in range(4):
                            cv2.line(frame, pts[i], pts[(i+1) % 4], (0, 255, 0), 3)
                    
                    # Procesar QR
                    qr_data = qr.data.decode('utf-8')
                    self.process_qr(qr_data)
                
                # Convertir frame para mostrar en Tkinter
                frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                frame = cv2.resize(frame, (640, 480))
                
                img = Image.fromarray(frame)
                imgtk = ImageTk.PhotoImage(image=img)
                
                self.root.after(0, lambda img=imgtk: self.camera_label.configure(image=img, text=""))
                self.camera_label.image = imgtk  # Mantener referencia
                
                time.sleep(0.033)  # ~30 FPS
                
            except Exception as e:
                self.log(f"Error en camera loop: {e}")
                time.sleep(0.1)
    
    def process_qr(self, qr_data):
        """Procesar QR detectado"""
        self.log(f"QR detectado: {qr_data}")
        
        # Extraer token
        token = self.extract_token(qr_data)
        if not token:
            self.log("No se pudo extraer token del QR")
            return
        
        # Sin cooldown - permite escanear diferentes QR inmediatamente
        self.stats["total"] += 1
        
        # Sonido de escaneo
        try:
            winsound.Beep(800, 100)
        except:
            pass
        
        # Verificar con API
        self.verify_qr(token)
    
    def extract_token(self, qr_data):
        """Extraer el token del contenido del QR"""
        self.log(f"QR Data recibido: {qr_data}")
        
        # Si es una URL de residente (/verificar-qr/token o /api/usuarios/verificar-qr/token)
        if "/verificar-qr/" in qr_data:
            parts = qr_data.split("/verificar-qr/")
            token = parts[1].split("?")[0].split("/")[0] if len(parts) > 1 else None
            self.log(f"Token extraído (residente): {token}")
            return token
        
        # Si es una URL de visitante (/qr/verificar/token o /api/visitantes/qr/verificar/token)
        if "/qr/verificar/" in qr_data:
            parts = qr_data.split("/qr/verificar/")
            token = parts[1].split("?")[0].split("/")[0] if len(parts) > 1 else None
            self.log(f"Token extraído (visitante): {token}")
            return token
        
        # Si parece un token hex (32 caracteres)
        if len(qr_data) == 32 and all(c in "0123456789abcdef" for c in qr_data.lower()):
            self.log(f"Token hex directo: {qr_data}")
            return qr_data
        
        # Si es cualquier URL con un token al final (formato genérico)
        if "/" in qr_data:
            parts = qr_data.rstrip("/").split("/")
            possible_token = parts[-1]
            if len(possible_token) == 32 and all(c in "0123456789abcdef" for c in possible_token.lower()):
                self.log(f"Token extraído del final de URL: {possible_token}")
                return possible_token
        
        self.log(f"No se pudo extraer token de: {qr_data}")
        return None
    
    def verify_qr(self, token):
        """Verificar el QR con la API"""
        def do_verify():
            try:
                # Primero verificar si es un residente
                response = requests.get(
                    f"{self.api_url}/api/usuarios/verificar-qr/{token}",
                    timeout=10
                )
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get("valid"):
                        self.handle_authorized_resident(data)
                        return
                
                # Si no es residente, verificar si es visitante
                response = requests.get(
                    f"{self.api_url}/api/visitantes/qr/verificar/{token}",
                    timeout=10
                )
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get("valid"):
                        self.handle_authorized_visitor(data, token)
                        return
                
                # No autorizado
                self.root.after(0, lambda: self.handle_denied(token))
                
            except requests.exceptions.ConnectionError:
                self.root.after(0, lambda: self.update_message("❌ Sin conexión al servidor", "red"))
            except Exception as e:
                self.log(f"Error verificando QR: {e}")
                self.root.after(0, lambda: self.update_message(f"❌ Error: {str(e)}", "red"))
        
        threading.Thread(target=do_verify, daemon=True).start()
    
    def handle_authorized_resident(self, data):
        """Manejar residente autorizado"""
        residente = data.get("residente", {})
        nombre = f"{residente.get('nombre', '')} {residente.get('apellido', '')}"
        apartamento = residente.get("apartamento", "N/A")
        torre = residente.get("torre", "N/A")
        placa = residente.get("placa", "N/A")
        
        # Registrar acceso
        self.registrar_acceso_residente(residente.get("id"), placa)
        
        self.stats["authorized"] += 1
        self.root.after(0, lambda: self.show_authorized(
            tipo="RESIDENTE",
            nombre=nombre,
            detalle=f"Torre {torre} - Apto {apartamento}",
            placa=placa
        ))
    
    def handle_authorized_visitor(self, data, token=None):
        """Manejar visitante autorizado"""
        visitante = data.get("visitante", {})
        nombre = f"{visitante.get('nombre', '')} {visitante.get('apellido', '')}"
        destino = visitante.get("apartamentoDestino", "N/A")
        torre = visitante.get("torreDestino", "")
        # La API devuelve 'placa', no 'placaVehiculo'
        placa = visitante.get("placa", visitante.get("placaVehiculo", "N/A"))
        visitante_id = visitante.get("id", "")
        
        # 1. Marcar ingreso del visitante (cambia estado a 'ingresado')
        if token:
            self.marcar_ingreso_visitante(token)
        
        # 2. Registrar entrada del visitante (marca plaza como OCUPADO)
        if placa and placa != "N/A":
            self.registrar_entrada_visitante(placa, visitante_id)
        
        detalle_destino = f"Torre {torre} - " if torre else ""
        detalle_destino += f"Destino: {destino}"
        
        self.stats["authorized"] += 1
        self.root.after(0, lambda: self.show_authorized(
            tipo="VISITANTE",
            nombre=nombre,
            detalle=detalle_destino,
            placa=placa
        ))
    
    def registrar_acceso_residente(self, residente_id, placa):
        """Registrar acceso de residente en el historial"""
        try:
            requests.post(
                f"{self.api_url}/api/parqueaderos/registrar-acceso",
                json={
                    "placa": placa,
                    "conjuntoId": self.conjunto_id
                },
                timeout=5
            )
            self.log(f"Acceso registrado para residente: {placa}")
        except Exception as e:
            self.log(f"Error registrando acceso: {e}")
    
    def registrar_entrada_visitante(self, placa, visitante_id=None):
        """Registrar entrada de visitante (marca plaza como OCUPADO)"""
        try:
            response = requests.post(
                f"{self.api_url}/api/parqueaderos/registrar-entrada",
                json={
                    "placa": placa,
                    "conjuntoId": self.conjunto_id,
                    "visitanteId": visitante_id
                },
                timeout=5
            )
            
            if response.status_code == 200:
                data = response.json()
                plaza = data.get("plaza", {}).get("numero", "?")
                self.log(f"Entrada registrada: Placa {placa} -> Plaza {plaza}")
            else:
                self.log(f"Respuesta entrada: {response.status_code} - {response.text}")
                
        except Exception as e:
            self.log(f"Error registrando entrada: {e}")
    
    def marcar_ingreso_visitante(self, token):
        """Marcar ingreso del visitante (cambia estado a 'ingresado')"""
        try:
            response = requests.post(
                f"{self.api_url}/api/visitantes/qr/ingreso/{token}",
                timeout=5
            )
            
            if response.status_code == 200:
                self.log(f"Ingreso marcado para token: {token[:8]}...")
            else:
                self.log(f"Error marcando ingreso: {response.status_code}")
                
        except Exception as e:
            self.log(f"Error marcando ingreso: {e}")
    
    def handle_denied(self, token):
        """Manejar acceso denegado"""
        self.stats["denied"] += 1
        self.show_denied(token)
    
    def show_authorized(self, tipo, nombre, detalle, placa):
        """Mostrar acceso autorizado en la UI"""
        # Sonido de éxito
        try:
            winsound.Beep(1000, 200)  # Tono alto, corto
        except:
            pass
        
        # Actualizar UI
        self.update_message(f"✅ {tipo} AUTORIZADO", "green")
        
        # Mostrar detalles
        info = f"""
╔══════════════════════════════════════╗
║  ✅ ACCESO AUTORIZADO
╠══════════════════════════════════════╣
║  Tipo: {tipo}
║  Nombre: {nombre}
║  {detalle}
║  Placa: {placa}
║  Hora: {datetime.now().strftime('%H:%M:%S')}
╚══════════════════════════════════════╝
        """
        
        self.scan_result_text.delete("1.0", "end")
        self.scan_result_text.insert("1.0", info)
        
        self.update_stats()
    
    def show_denied(self, token):
        """Mostrar acceso denegado en la UI"""
        # Sonido de error
        try:
            winsound.Beep(300, 500)  # Tono bajo, largo
        except:
            pass
        
        self.update_message("❌ ACCESO DENEGADO", "red")
        
        info = f"""
╔══════════════════════════════════════╗
║  ❌ ACCESO DENEGADO
╠══════════════════════════════════════╣
║  QR no reconocido o expirado
║  Token: {token[:16]}...
║  Hora: {datetime.now().strftime('%H:%M:%S')}
╚══════════════════════════════════════╝
        """
        
        self.scan_result_text.delete("1.0", "end")
        self.scan_result_text.insert("1.0", info)
        
        self.update_stats()
    
    def update_message(self, message, color):
        """Actualizar mensaje de estado"""
        colors = {
            "green": "#00FF00",
            "red": "#FF0000",
            "orange": "#FFA500",
            "gray": "#808080"
        }
        self.message_label.configure(text=message, text_color=colors.get(color, "white"))
    
    def update_stats(self):
        """Actualizar estadísticas"""
        self.stats_label.configure(
            text=f"Escaneos: {self.stats['total']} | Autorizados: {self.stats['authorized']} | Denegados: {self.stats['denied']}"
        )
    
    def on_closing(self):
        """Cerrar la aplicación"""
        self.running = False
        if self.cap:
            self.cap.release()
        self.root.destroy()
    
    def run(self):
        """Ejecutar la aplicación"""
        print("🔐 SafeEntry Scanner - Control de Acceso Residencial")
        print("=" * 50)
        print(f"API URL: {self.api_url}")
        print(f"Cámara: {self.camera_index}")
        print("=" * 50)
        self.root.mainloop()


if __name__ == "__main__":
    app = QRScannerApp()
    app.run()
