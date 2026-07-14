# -*- coding: utf-8 -*-
"""
🔐 QR Scanner Multi-Cámara - Sistema de Control de Acceso
==========================================================
Aplicación con vista de 4 cámaras simultáneas para control
de entradas y salidas del conjunto residencial.

Versión: 3.0.0 - Multi-cámara con soporte entrada/salida
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

# Configurar encoding para Windows
import sys
import io
if sys.stdout is not None and hasattr(sys.stdout, 'buffer'):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

# Archivo para guardar sesión
SESSION_FILE = os.path.join(os.path.dirname(__file__), ".session.json")

# Archivo para guardar configuración de cámaras
CAMERA_CONFIG_FILE = os.path.join(os.path.dirname(__file__), ".camera_config.json")

# Configuración por defecto de cámaras
DEFAULT_CAMERA_CONFIG = [
    {"index": 0, "nombre": "Cámara 1", "modo": "entrada"},
    {"index": 1, "nombre": "Cámara 2", "modo": "salida"},
    {"index": 2, "nombre": "Cámara 3", "modo": "entrada"},
    {"index": 3, "nombre": "Cámara 4", "modo": "salida"},
]

def load_camera_config():
    """Cargar configuración de cámaras desde archivo"""
    if os.path.exists(CAMERA_CONFIG_FILE):
        try:
            with open(CAMERA_CONFIG_FILE, "r") as f:
                config = json.load(f)
                return config.get("cameras", DEFAULT_CAMERA_CONFIG)
        except:
            pass
    return DEFAULT_CAMERA_CONFIG.copy()

def save_camera_config(cameras):
    """Guardar configuración de cámaras a archivo"""
    try:
        with open(CAMERA_CONFIG_FILE, "w") as f:
            json.dump({"cameras": cameras}, f, indent=2)
        return True
    except Exception as e:
        print(f"Error guardando config: {e}")
        return False

# Cargar configuración
CAMERA_CONFIG = load_camera_config()

# Número de cámaras a usar (puede ser 1, 2 o 4)
NUM_CAMERAS = int(os.getenv("NUM_CAMERAS", 4))


class CameraFeed:
    """Hilo individual para cada cámara"""
    
    def __init__(self, config, parent_app):
        self.index = config["index"]
        self.nombre = config["nombre"]
        self.modo = config["modo"]  # "entrada" o "salida"
        self.app = parent_app
        
        self.cap = None
        self.running = False
        self.current_frame = None
        self.last_scanned = {}
        self.frame_lock = threading.Lock()
    
    def start(self):
        """Iniciar captura de cámara (no bloqueante)"""
        self.running = True
        # Iniciar en hilo para no bloquear UI
        threading.Thread(target=self._init_camera, daemon=True).start()
        return True  # Siempre retorna True, el estado real se ve en el hilo
    
    def _init_camera(self):
        """Inicializar cámara en hilo separado"""
        try:
            self.app.log(f"Intentando abrir cámara {self.index}...")
            self.cap = cv2.VideoCapture(self.index, cv2.CAP_DSHOW)  # DirectShow más rápido en Windows
            
            # Timeout: intentar leer un frame para verificar
            self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
            self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
            
            if not self.cap.isOpened():
                self.app.log(f"Cámara {self.index} no disponible")
                self.app.update_camera_status(self.index, "❌ No disponible", "red")
                return
            
            # Intentar leer un frame de prueba
            ret, frame = self.cap.read()
            if not ret:
                self.app.log(f"Cámara {self.index} no responde")
                self.app.update_camera_status(self.index, "❌ Sin respuesta", "red")
                self.cap.release()
                self.cap = None
                return
            
            self.app.log(f"Cámara {self.index} iniciada correctamente")
            self.app.update_camera_status(self.index, "✅ Activa", "green")
            
            # Iniciar loop de captura
            self._capture_loop()
            
        except Exception as e:
            self.app.log(f"Error iniciando cámara {self.index}: {e}")
            self.app.update_camera_status(self.index, f"❌ Error", "red")
    
    def stop(self):
        """Detener cámara"""
        self.running = False
        if self.cap:
            self.cap.release()
            self.cap = None
    
    def _capture_loop(self):
        """Loop de captura de frames"""
        while self.running:
            try:
                ret, frame = self.cap.read()
                if ret:
                    # Detectar QR
                    qr_codes = pyzbar.decode(frame)
                    
                    for qr in qr_codes:
                        # Dibujar rectángulo
                        pts = qr.polygon
                        if len(pts) == 4:
                            pts = [(p.x, p.y) for p in pts]
                            for i in range(4):
                                cv2.line(frame, pts[i], pts[(i+1) % 4], (0, 255, 0), 3)
                        
                        # Procesar QR
                        qr_data = qr.data.decode('utf-8')
                        self._process_qr(qr_data)
                    
                    # Guardar frame
                    with self.frame_lock:
                        self.current_frame = frame.copy()
                
                time.sleep(0.03)  # ~30 FPS
            except Exception as e:
                self.app.log(f"Error en cámara {self.index}: {e}")
                time.sleep(0.1)
    
    def _process_qr(self, qr_data):
        """Procesar QR detectado"""
        token = self.app.extract_token(qr_data)
        if not token:
            return
        
        # Evitar procesar mismo QR muy seguido
        now = time.time()
        if token in self.last_scanned and (now - self.last_scanned[token]) < 3:
            return
        
        self.last_scanned[token] = now
        
        # Sonido de escaneo
        try:
            winsound.Beep(800, 100)
        except:
            pass
        
        # Verificar QR según modo
        self.app.verify_qr(token, self.modo, self.nombre)
    
    def get_frame(self):
        """Obtener frame actual"""
        with self.frame_lock:
            return self.current_frame.copy() if self.current_frame is not None else None


class MultiCameraApp:
    """Aplicación principal multi-cámara"""
    
    def __init__(self):
        # Configuración
        self.api_url = os.getenv("API_BASE_URL", "http://localhost:5000")
        self.debug = os.getenv("DEBUG", "false").lower() == "true"
        # Secreto compartido para autenticar contra las rutas de cámara del backend
        self.camera_service_key = os.getenv("CAMERA_SERVICE_KEY", "")
        
        # Sesión
        self.logged_in = False
        self.token = None
        self.user_id = None
        self.user_name = None
        self.user_rol = None
        self.conjunto_id = None
        self.conjunto_nombre = None
        
        # Cámaras
        self.cameras = []
        self.running = False
        
        # Stats
        self.stats = {"total": 0, "entradas": 0, "salidas": 0}
        
        # UI
        self.setup_ui()
        self.root.after(100, self.try_load_session)
    
    def log(self, message):
        if self.debug:
            print(f"[DEBUG] {datetime.now().strftime('%H:%M:%S')} - {message}")
    
    def setup_ui(self):
        """Configurar interfaz"""
        ctk.set_appearance_mode("dark")
        ctk.set_default_color_theme("blue")
        
        self.root = ctk.CTk()
        self.root.title("🔐 SafeEntry - Multi Scanner")
        self.root.geometry("1400x900")
        self.root.resizable(True, True)
        
        self.main_container = ctk.CTkFrame(self.root)
        self.main_container.pack(fill="both", expand=True)
        
        self.root.protocol("WM_DELETE_WINDOW", self.on_closing)
    
    # ==========================================
    # LOGIN
    # ==========================================
    
    def show_login_screen(self):
        """Mostrar pantalla de login"""
        for widget in self.main_container.winfo_children():
            widget.destroy()
        
        # Frame central - más alto para que quepa el botón
        login_frame = ctk.CTkFrame(self.main_container, width=420, height=550)
        login_frame.place(relx=0.5, rely=0.5, anchor="center")
        login_frame.pack_propagate(False)
        
        # Logo
        ctk.CTkLabel(login_frame, text="🔐", font=("Helvetica", 64)).pack(pady=(30, 10))
        ctk.CTkLabel(login_frame, text="SafeEntry Multi-Scanner", 
                     font=("Helvetica", 20, "bold")).pack(pady=(0, 5))
        ctk.CTkLabel(login_frame, text="Vista de 4 cámaras", 
                     font=("Helvetica", 12), text_color="gray").pack(pady=(0, 30))
        
        # Campos
        ctk.CTkLabel(login_frame, text="Cédula:", font=("Helvetica", 12)).pack(anchor="w", padx=40)
        self.cedula_entry = ctk.CTkEntry(login_frame, width=320, height=40, 
                                          placeholder_text="Ingresa tu cédula")
        self.cedula_entry.pack(pady=(5, 15))
        
        ctk.CTkLabel(login_frame, text="Contraseña:", font=("Helvetica", 12)).pack(anchor="w", padx=40)
        self.password_entry = ctk.CTkEntry(login_frame, width=320, height=40, 
                                            placeholder_text="Ingresa tu contraseña", show="•")
        self.password_entry.pack(pady=(5, 15))
        
        # Remember
        self.remember_var = ctk.BooleanVar(value=True)
        ctk.CTkCheckBox(login_frame, text="Recordar sesión", 
                        variable=self.remember_var).pack(pady=10)
        
        # Error label
        self.login_error_label = ctk.CTkLabel(login_frame, text="", text_color="red")
        self.login_error_label.pack(pady=5)
        
        # Botón
        self.login_btn = ctk.CTkButton(login_frame, text="Iniciar Sesión",
                                        command=self.do_login, height=45, width=320)
        self.login_btn.pack(pady=20)
        
        self.password_entry.bind("<Return>", lambda e: self.do_login())
    
    def do_login(self):
        """Realizar login"""
        cedula = self.cedula_entry.get().strip()
        password = self.password_entry.get().strip()
        
        if not cedula or not password:
            self.login_error_label.configure(text="Ingresa cédula y contraseña")
            return
        
        self.login_btn.configure(state="disabled", text="Verificando...")
        
        def attempt():
            try:
                response = requests.post(
                    f"{self.api_url}/api/usuarios/login",
                    json={"cedula": cedula, "password": password},
                    timeout=10
                )
                
                if response.status_code == 200:
                    data = response.json()
                    rol = data.get("usuario", {}).get("rol", "")
                    
                    if rol not in ["porteria", "admin"]:
                        self.root.after(0, lambda: self.show_login_error(
                            "Solo portería o admin pueden usar esta app"))
                        return
                    
                    self.token = data.get("token")
                    self.user_id = data.get("usuario", {}).get("id")
                    self.user_name = data.get("usuario", {}).get("nombre", "Usuario")
                    self.user_rol = rol
                    self.conjunto_id = data.get("usuario", {}).get("conjuntoId")
                    self.conjunto_nombre = data.get("usuario", {}).get("conjuntoNombre", "Mi Conjunto")
                    self.logged_in = True
                    
                    if self.remember_var.get():
                        self.save_session()
                    
                    self.root.after(0, self.show_scanner_screen)
                else:
                    error = response.json().get("error", "Credenciales inválidas")
                    self.root.after(0, lambda: self.show_login_error(error))
            except Exception as e:
                self.root.after(0, lambda e=e: self.show_login_error(f"Error: {e}"))
        
        threading.Thread(target=attempt, daemon=True).start()
    
    def show_login_error(self, message):
        self.login_error_label.configure(text=message)
        self.login_btn.configure(state="normal", text="Iniciar Sesión")
    
    def save_session(self):
        try:
            with open(SESSION_FILE, "w") as f:
                json.dump({
                    "token": self.token,
                    "user_id": self.user_id,
                    "user_name": self.user_name,
                    "user_rol": self.user_rol,
                    "conjunto_id": self.conjunto_id,
                    "conjunto_nombre": self.conjunto_nombre
                }, f)
        except Exception as e:
            self.log(f"Error guardando sesión: {e}")
    
    def try_load_session(self):
        if os.path.exists(SESSION_FILE):
            try:
                with open(SESSION_FILE, "r") as f:
                    session = json.load(f)
                
                self.token = session.get("token")
                self.user_id = session.get("user_id")
                self.user_name = session.get("user_name")
                self.user_rol = session.get("user_rol")
                self.conjunto_id = session.get("conjunto_id")
                self.conjunto_nombre = session.get("conjunto_nombre")
                
                if self.validate_session():
                    self.logged_in = True
                    self.show_scanner_screen()
                    return
            except Exception as e:
                self.log(f"Error cargando sesión: {e}")
        
        self.show_login_screen()
    
    def validate_session(self):
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
        self.logged_in = False
        self.token = None
        self.stop_cameras()
        
        if os.path.exists(SESSION_FILE):
            try:
                os.remove(SESSION_FILE)
            except:
                pass
        
        self.show_login_screen()
    
    # ==========================================
    # SCANNER MULTI-CÁMARA
    # ==========================================
    
    def show_scanner_screen(self):
        """Mostrar pantalla principal con 4 cámaras"""
        for widget in self.main_container.winfo_children():
            widget.destroy()
        
        main_frame = ctk.CTkFrame(self.main_container)
        main_frame.pack(fill="both", expand=True, padx=10, pady=10)
        
        # Header
        header = ctk.CTkFrame(main_frame, height=60)
        header.pack(fill="x", padx=5, pady=5)
        header.pack_propagate(False)
        
        ctk.CTkLabel(header, text="🔐 SafeEntry Multi-Scanner", 
                     font=("Helvetica", 22, "bold")).pack(side="left", padx=20, pady=10)
        
        # Info usuario
        info_frame = ctk.CTkFrame(header, fg_color="transparent")
        info_frame.pack(side="right", padx=20)
        
        ctk.CTkLabel(info_frame, text=f"📍 {self.conjunto_nombre}", 
                     font=("Helvetica", 13, "bold")).pack(anchor="e")
        ctk.CTkLabel(info_frame, text=f"👤 {self.user_name}", 
                     font=("Helvetica", 11), text_color="gray").pack(anchor="e")
        
        # Contenedor central
        center = ctk.CTkFrame(main_frame)
        center.pack(fill="both", expand=True, padx=5, pady=5)
        
        # Grid de cámaras (2x2)
        self.camera_grid = ctk.CTkFrame(center)
        self.camera_grid.pack(side="left", fill="both", expand=True, padx=5, pady=5)
        
        self.camera_labels = []
        self.camera_status_labels = []
        
        for i in range(NUM_CAMERAS):
            row = i // 2
            col = i % 2
            
            config = CAMERA_CONFIG[i] if i < len(CAMERA_CONFIG) else {"nombre": f"Cámara {i}", "modo": "entrada"}
            
            # Frame para cada cámara
            cam_frame = ctk.CTkFrame(self.camera_grid)
            cam_frame.grid(row=row, column=col, padx=5, pady=5, sticky="nsew")
            
            # Header de cámara con color según modo
            bg_color = "#2d5a27" if config["modo"] == "entrada" else "#8b4513"
            
            cam_header = ctk.CTkFrame(cam_frame, height=35, fg_color=bg_color)
            cam_header.pack(fill="x")
            cam_header.pack_propagate(False)
            
            modo_icon = "🟢 ENTRADA" if config["modo"] == "entrada" else "🟠 SALIDA"
            ctk.CTkLabel(cam_header, text=f"{config['nombre']} - {modo_icon}",
                        font=("Helvetica", 11, "bold")).pack(pady=5)
            
            # Video label
            video_label = ctk.CTkLabel(cam_frame, text="📷 Esperando...", 
                                        font=("Helvetica", 14), width=400, height=280)
            video_label.pack(fill="both", expand=True, padx=5, pady=5)
            self.camera_labels.append(video_label)
            
            # Status label
            status_label = ctk.CTkLabel(cam_frame, text="⏸️ Detenida", 
                                         font=("Helvetica", 10), text_color="gray")
            status_label.pack(pady=2)
            self.camera_status_labels.append(status_label)
        
        # Configurar weights del grid
        self.camera_grid.grid_columnconfigure(0, weight=1)
        self.camera_grid.grid_columnconfigure(1, weight=1)
        self.camera_grid.grid_rowconfigure(0, weight=1)
        self.camera_grid.grid_rowconfigure(1, weight=1)
        
        # Panel lateral derecho
        side_panel = ctk.CTkFrame(center, width=300)
        side_panel.pack(side="right", fill="y", padx=5, pady=5)
        side_panel.pack_propagate(False)
        
        # === SECCIÓN ESTADÍSTICAS ===
        stats_frame = ctk.CTkFrame(side_panel, fg_color="#1a1a2e")
        stats_frame.pack(fill="x", padx=10, pady=10)
        
        ctk.CTkLabel(stats_frame, text="📊 Estadísticas", 
                     font=("Helvetica", 14, "bold")).pack(pady=(10, 5))
        
        stats_grid = ctk.CTkFrame(stats_frame, fg_color="transparent")
        stats_grid.pack(pady=10, padx=15)
        
        # Entradas
        ctk.CTkLabel(stats_grid, text="🟢 Entradas:", font=("Helvetica", 12), anchor="w").grid(row=0, column=0, sticky="w", pady=2)
        self.entries_count = ctk.CTkLabel(stats_grid, text="0", font=("Helvetica", 12, "bold"), text_color="#4ade80")
        self.entries_count.grid(row=0, column=1, sticky="e", padx=(20, 0), pady=2)
        
        # Salidas
        ctk.CTkLabel(stats_grid, text="🟠 Salidas:", font=("Helvetica", 12), anchor="w").grid(row=1, column=0, sticky="w", pady=2)
        self.exits_count = ctk.CTkLabel(stats_grid, text="0", font=("Helvetica", 12, "bold"), text_color="#fb923c")
        self.exits_count.grid(row=1, column=1, sticky="e", padx=(20, 0), pady=2)
        
        # Total
        ctk.CTkLabel(stats_grid, text="📊 Total:", font=("Helvetica", 12), anchor="w").grid(row=2, column=0, sticky="w", pady=2)
        self.total_count = ctk.CTkLabel(stats_grid, text="0", font=("Helvetica", 12, "bold"))
        self.total_count.grid(row=2, column=1, sticky="e", padx=(20, 0), pady=2)
        
        # === MENSAJE DE ESTADO ===
        self.message_frame = ctk.CTkFrame(side_panel, fg_color="#1e3a1e", height=60)
        self.message_frame.pack(fill="x", padx=10, pady=5)
        self.message_frame.pack_propagate(False)
        
        self.message_label = ctk.CTkLabel(self.message_frame, text="Esperando escaneo...", 
                                           font=("Helvetica", 14, "bold"))
        self.message_label.pack(expand=True)
        
        # === ÚLTIMO ESCANEO ===
        scan_frame = ctk.CTkFrame(side_panel, fg_color="#1a1a2e")
        scan_frame.pack(fill="x", padx=10, pady=10)
        
        ctk.CTkLabel(scan_frame, text="📋 Último Escaneo", 
                     font=("Helvetica", 14, "bold")).pack(pady=(10, 5))
        
        self.last_scan_frame = ctk.CTkFrame(scan_frame, fg_color="transparent")
        self.last_scan_frame.pack(fill="x", padx=15, pady=10)
        
        self.scan_camera = ctk.CTkLabel(self.last_scan_frame, text="📍 -", font=("Helvetica", 11), anchor="w")
        self.scan_camera.pack(fill="x")
        self.scan_name = ctk.CTkLabel(self.last_scan_frame, text="👤 -", font=("Helvetica", 11), anchor="w")
        self.scan_name.pack(fill="x")
        self.scan_detail = ctk.CTkLabel(self.last_scan_frame, text="🏠 -", font=("Helvetica", 11), anchor="w")
        self.scan_detail.pack(fill="x")
        self.scan_plate = ctk.CTkLabel(self.last_scan_frame, text="🚗 -", font=("Helvetica", 11), anchor="w")
        self.scan_plate.pack(fill="x")
        self.scan_time = ctk.CTkLabel(self.last_scan_frame, text="⏰ -", font=("Helvetica", 11), anchor="w")
        self.scan_time.pack(fill="x")
        
        # Botones
        btn_frame = ctk.CTkFrame(side_panel, fg_color="transparent")
        btn_frame.pack(side="bottom", pady=20, fill="x", padx=10)
        
        self.start_btn = ctk.CTkButton(btn_frame, text="▶️ Iniciar Cámaras",
                                        command=self.start_cameras, height=40)
        self.start_btn.pack(fill="x", pady=5)
        
        self.stop_btn = ctk.CTkButton(btn_frame, text="⏹️ Detener Cámaras",
                                       command=self.stop_cameras, height=40,
                                       fg_color="gray", state="disabled")
        self.stop_btn.pack(fill="x", pady=5)
        
        # Botón de configuración de cámaras
        ctk.CTkButton(btn_frame, text="⚙️ Configurar Cámaras",
                      command=self.show_camera_config_dialog, height=35,
                      fg_color="#2d3748").pack(fill="x", pady=5)
        
        ctk.CTkButton(btn_frame, text="🚪 Cerrar Sesión",
                      command=self.logout, height=35, 
                      fg_color="#8b0000").pack(fill="x", pady=(20, 5))
    
    def start_cameras(self):
        """Iniciar todas las cámaras (no bloqueante)"""
        self.cameras = []
        
        for i in range(NUM_CAMERAS):
            config = CAMERA_CONFIG[i] if i < len(CAMERA_CONFIG) else {
                "index": i, "nombre": f"Cámara {i}", "modo": "entrada"
            }
            
            camera = CameraFeed(config, self)
            self.cameras.append(camera)
            # Iniciar cámara (no bloqueante)
            camera.start()
            self.camera_status_labels[i].configure(text="🔄 Iniciando...", text_color="yellow")
        
        self.running = True
        self.start_btn.configure(state="disabled")
        self.stop_btn.configure(state="normal", fg_color="#8b0000")
        
        # Iniciar actualización de UI
        self.update_camera_frames()
    
    def update_camera_status(self, camera_index, text, color):
        """Actualizar estado de una cámara en la UI (thread-safe)"""
        def update():
            if camera_index < len(self.camera_status_labels):
                self.camera_status_labels[camera_index].configure(text=text, text_color=color)
        self.root.after(0, update)
    
    def stop_cameras(self):
        """Detener todas las cámaras"""
        self.running = False
        
        for camera in self.cameras:
            if camera:
                camera.stop()
        
        self.cameras = []
        
        for i, label in enumerate(self.camera_status_labels):
            label.configure(text="⏸️ Detenida", text_color="gray")
            self.camera_labels[i].configure(image=None, text="📷 Esperando...")
        
        self.start_btn.configure(state="normal")
        self.stop_btn.configure(state="disabled", fg_color="gray")
    
    def show_camera_config_dialog(self):
        """Mostrar diálogo de configuración de cámaras"""
        global CAMERA_CONFIG
        
        # Detener cámaras primero
        if self.running:
            self.stop_cameras()
        
        # Crear ventana de diálogo
        dialog = ctk.CTkToplevel(self.root)
        dialog.title("⚙️ Configurar Cámaras")
        dialog.geometry("500x450")
        dialog.transient(self.root)
        dialog.grab_set()
        
        # Centrar
        dialog.update_idletasks()
        x = self.root.winfo_x() + (self.root.winfo_width() - 500) // 2
        y = self.root.winfo_y() + (self.root.winfo_height() - 450) // 2
        dialog.geometry(f"+{x}+{y}")
        
        # Título
        ctk.CTkLabel(dialog, text="⚙️ Configuración de Cámaras", 
                     font=("Helvetica", 18, "bold")).pack(pady=(20, 10))
        
        ctk.CTkLabel(dialog, text="Selecciona el índice y modo de cada cámara", 
                     font=("Helvetica", 12), text_color="gray").pack(pady=(0, 20))
        
        # Variables para almacenar selecciones
        index_vars = []
        mode_vars = []
        name_vars = []
        
        # Frame para cámaras
        cameras_frame = ctk.CTkFrame(dialog)
        cameras_frame.pack(fill="both", expand=True, padx=20, pady=10)
        
        for i in range(NUM_CAMERAS):
            config = CAMERA_CONFIG[i] if i < len(CAMERA_CONFIG) else {"index": i, "nombre": f"Cámara {i+1}", "modo": "entrada"}
            
            row_frame = ctk.CTkFrame(cameras_frame, fg_color="transparent")
            row_frame.pack(fill="x", pady=8, padx=10)
            
            # Nombre editable
            name_var = ctk.StringVar(value=config.get("nombre", f"Cámara {i+1}"))
            name_vars.append(name_var)
            
            ctk.CTkLabel(row_frame, text=f"📹 Slot {i+1}:", font=("Helvetica", 11, "bold"), width=70).pack(side="left")
            
            name_entry = ctk.CTkEntry(row_frame, textvariable=name_var, width=120, placeholder_text="Nombre")
            name_entry.pack(side="left", padx=5)
            
            # Índice de cámara
            idx_var = ctk.IntVar(value=config.get("index", i))
            index_vars.append(idx_var)
            
            ctk.CTkLabel(row_frame, text="Índice:", font=("Helvetica", 10)).pack(side="left", padx=(10, 5))
            idx_menu = ctk.CTkOptionMenu(row_frame, variable=idx_var, values=["0", "1", "2", "3", "4", "5"], 
                                          width=60, command=lambda v, var=idx_var: var.set(int(v)))
            idx_menu.set(str(config.get("index", i)))
            idx_menu.pack(side="left")
            
            # Modo entrada/salida
            mode_var = ctk.StringVar(value=config.get("modo", "entrada"))
            mode_vars.append(mode_var)
            
            ctk.CTkLabel(row_frame, text="Modo:", font=("Helvetica", 10)).pack(side="left", padx=(10, 5))
            mode_menu = ctk.CTkOptionMenu(row_frame, variable=mode_var, values=["entrada", "salida"], width=90)
            mode_menu.pack(side="left")
        
        # Botones
        btn_frame = ctk.CTkFrame(dialog, fg_color="transparent")
        btn_frame.pack(pady=20)
        
        def save_config():
            global CAMERA_CONFIG
            new_config = []
            for i in range(NUM_CAMERAS):
                new_config.append({
                    "index": int(index_vars[i].get()),
                    "nombre": name_vars[i].get(),
                    "modo": mode_vars[i].get()
                })
            
            CAMERA_CONFIG = new_config
            save_camera_config(new_config)
            dialog.destroy()
            
            # Refrescar pantalla para mostrar nuevos nombres
            self.show_scanner_screen()
        
        ctk.CTkButton(btn_frame, text="💾 Guardar", command=save_config, 
                      width=120, height=40, fg_color="#2d5a27").pack(side="left", padx=10)
        ctk.CTkButton(btn_frame, text="❌ Cancelar", command=dialog.destroy, 
                      width=120, height=40, fg_color="#8b0000").pack(side="left", padx=10)
    
    def update_camera_frames(self):
        """Actualizar frames en la UI"""
        if not self.running:
            return
        
        for i, camera in enumerate(self.cameras):
            if camera and i < len(self.camera_labels):
                frame = camera.get_frame()
                if frame is not None:
                    # Convertir frame a imagen
                    frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                    frame_resized = cv2.resize(frame_rgb, (400, 280))
                    img = Image.fromarray(frame_resized)
                    photo = ImageTk.PhotoImage(img)
                    
                    self.camera_labels[i].configure(image=photo, text="")
                    self.camera_labels[i].image = photo
        
        self.root.after(50, self.update_camera_frames)
    
    # ==========================================
    # LÓGICA DE QR
    # ==========================================
    
    def extract_token(self, qr_data):
        """Extraer token del QR"""
        # URL de residente
        if "/verificar-qr/" in qr_data:
            parts = qr_data.split("/verificar-qr/")
            return parts[1].split("?")[0].split("/")[0] if len(parts) > 1 else None
        
        # URL de visitante
        if "/qr/verificar/" in qr_data:
            parts = qr_data.split("/qr/verificar/")
            return parts[1].split("?")[0].split("/")[0] if len(parts) > 1 else None
        
        # Token hex directo
        if len(qr_data) == 32 and all(c in "0123456789abcdef" for c in qr_data.lower()):
            return qr_data
        
        # Último segmento de URL
        if "/" in qr_data:
            token = qr_data.rstrip("/").split("/")[-1]
            if len(token) >= 16:
                return token
        
        return qr_data if len(qr_data) >= 16 else None
    
    def verify_qr(self, token, modo, camera_nombre):
        """Verificar QR y actuar según modo entrada/salida"""
        def do_verify():
            try:
                # Verificar residente
                response = requests.get(
                    f"{self.api_url}/api/usuarios/verificar-qr/{token}",
                    timeout=10
                )
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get("valid"):
                        self.handle_resident(data, modo, camera_nombre)
                        return
                
                # Verificar visitante
                response = requests.get(
                    f"{self.api_url}/api/visitantes/qr/verificar/{token}",
                    timeout=10
                )
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get("valid"):
                        self.handle_visitor(data, token, modo, camera_nombre)
                        return
                
                # No autorizado
                self.root.after(0, lambda: self.show_denied(camera_nombre))
                
            except Exception as e:
                self.log(f"Error verificando QR: {e}")
                self.root.after(0, lambda: self.update_message(f"❌ Error: {e}", "red"))
        
        threading.Thread(target=do_verify, daemon=True).start()
    
    def handle_resident(self, data, modo, camera_nombre):
        """Manejar residente"""
        residente = data.get("residente", {})
        nombre = f"{residente.get('nombre', '')} {residente.get('apellido', '')}"
        placa = residente.get("placa", "N/A")
        apto = residente.get("apartamento", "N/A")
        torre = residente.get("torre", "N/A")
        
        tipo_acceso = "entrada" if modo == "entrada" else "salida"
        
        # Registrar en historial
        self.registrar_acceso(placa, tipo_acceso, "residente")
        
        # Actualizar stats
        if modo == "entrada":
            self.stats["entradas"] += 1
        else:
            self.stats["salidas"] += 1
        self.stats["total"] += 1
        
        # Sonido
        try:
            winsound.Beep(1000, 200)
        except:
            pass
        
        # Actualizar UI
        self.root.after(0, lambda: self.show_access(
            tipo="RESIDENTE",
            nombre=nombre,
            detalle=f"Torre {torre} - Apto {apto}",
            placa=placa,
            modo=modo,
            camera=camera_nombre
        ))
    
    def handle_visitor(self, data, token, modo, camera_nombre):
        """Manejar visitante"""
        visitante = data.get("visitante", {})
        nombre = f"{visitante.get('nombre', '')} {visitante.get('apellido', '')}"
        placa = visitante.get("placa", visitante.get("placaVehiculo", "N/A"))
        destino = visitante.get("apartamentoDestino", "N/A")
        visitante_id = visitante.get("id", "")
        
        if modo == "entrada":
            # Marcar ingreso
            self.marcar_ingreso_visitante(token)
            
            # Registrar entrada (ocupa plaza)
            if placa and placa != "N/A":
                self.registrar_entrada_visitante(placa, visitante_id)
            
            self.stats["entradas"] += 1
        else:
            # SALIDA - Liberar plaza
            if placa and placa != "N/A":
                self.registrar_salida_visitante(placa, visitante_id, token)
            
            self.stats["salidas"] += 1
        
        self.stats["total"] += 1
        
        # Sonido
        try:
            winsound.Beep(1000, 200)
        except:
            pass
        
        # Actualizar UI
        self.root.after(0, lambda: self.show_access(
            tipo="VISITANTE",
            nombre=nombre,
            detalle=f"Destino: {destino}",
            placa=placa,
            modo=modo,
            camera=camera_nombre
        ))
    
    def registrar_acceso(self, placa, tipo_acceso, tipo_usuario):
        """Registrar acceso en historial"""
        try:
            requests.post(
                f"{self.api_url}/api/parqueaderos/registrar-acceso",
                json={
                    "placa": placa,
                    "conjuntoId": self.conjunto_id,
                    "tipoAcceso": tipo_acceso
                },
                headers={"X-Camera-Service-Key": self.camera_service_key},
                timeout=5
            )
        except Exception as e:
            self.log(f"Error registrando acceso: {e}")
    
    def marcar_ingreso_visitante(self, token):
        """Marcar ingreso de visitante"""
        try:
            requests.post(
                f"{self.api_url}/api/visitantes/qr/ingreso/{token}",
                timeout=5
            )
        except Exception as e:
            self.log(f"Error marcando ingreso: {e}")
    
    def registrar_entrada_visitante(self, placa, visitante_id):
        """Registrar entrada de visitante (ocupa plaza)"""
        try:
            requests.post(
                f"{self.api_url}/api/parqueaderos/registrar-entrada",
                json={
                    "placa": placa,
                    "conjuntoId": self.conjunto_id,
                    "visitanteId": visitante_id
                },
                headers={"X-Camera-Service-Key": self.camera_service_key},
                timeout=5
            )
        except Exception as e:
            self.log(f"Error registrando entrada: {e}")
    
    def registrar_salida_visitante(self, placa, visitante_id, token):
        """Registrar salida de visitante (libera plaza)"""
        try:
            requests.post(
                f"{self.api_url}/api/parqueaderos/registrar-salida",
                json={
                    "placa": placa,
                    "conjuntoId": self.conjunto_id,
                    "visitanteId": visitante_id
                },
                headers={"X-Camera-Service-Key": self.camera_service_key},
                timeout=5
            )
            self.log(f"Salida registrada: {placa} - Plaza liberada")
        except Exception as e:
            self.log(f"Error registrando salida: {e}")
    
    def show_access(self, tipo, nombre, detalle, placa, modo, camera):
        """Mostrar acceso en UI"""
        modo_text = "ENTRADA" if modo == "entrada" else "SALIDA"
        color = "#4ade80" if modo == "entrada" else "#fb923c"
        bg_color = "#1e3a1e" if modo == "entrada" else "#3a2a1e"
        
        # Actualizar mensaje
        self.message_frame.configure(fg_color=bg_color)
        self.message_label.configure(
            text=f"✅ {modo_text} - {tipo}",
            text_color=color
        )
        
        # Actualizar último escaneo
        self.scan_camera.configure(text=f"📍 {camera}")
        self.scan_name.configure(text=f"👤 {nombre}")
        self.scan_detail.configure(text=f"🏠 {detalle}")
        self.scan_plate.configure(text=f"🚗 {placa}")
        self.scan_time.configure(text=f"⏰ {datetime.now().strftime('%H:%M:%S')}")
        
        # Actualizar estadísticas
        self.entries_count.configure(text=str(self.stats['entradas']))
        self.exits_count.configure(text=str(self.stats['salidas']))
        self.total_count.configure(text=str(self.stats['total']))
    
    def show_denied(self, camera_nombre):
        """Mostrar acceso denegado"""
        try:
            winsound.Beep(400, 500)
        except:
            pass
        
        self.message_frame.configure(fg_color="#3a1e1e")
        self.message_label.configure(text="❌ DENEGADO", text_color="#ef4444")
        
        self.scan_camera.configure(text=f"📍 {camera_nombre}")
        self.scan_name.configure(text="❌ QR no válido")
        self.scan_detail.configure(text="o expirado")
        self.scan_plate.configure(text="")
        self.scan_time.configure(text=f"⏰ {datetime.now().strftime('%H:%M:%S')}")
    
    def update_message(self, text, color):
        self.message_label.configure(text=text, text_color=color)
    
    def on_closing(self):
        """Cerrar aplicación"""
        self.stop_cameras()
        self.root.destroy()
    
    def run(self):
        """Iniciar aplicación"""
        self.root.mainloop()


if __name__ == "__main__":
    app = MultiCameraApp()
    app.run()
