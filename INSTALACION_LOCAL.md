# 🏠 Guía de Instalación Local - Admin Residencial

Esta guía explica cómo instalar Admin Residencial en una PC local para uso on-premise.

---

## 📋 Requisitos del Sistema

### Hardware Mínimo
| Componente | Especificación |
|------------|----------------|
| CPU | Intel i3 / AMD Ryzen 3 o superior |
| RAM | 8 GB (recomendado 16 GB) |
| Disco | SSD 128 GB mínimo |
| Red | Puerto Ethernet |

### Software Requerido
- Windows 10/11 (64-bit)
- Docker Desktop (incluido en instalación)
- Navegador web moderno (Chrome, Edge, Firefox)

---

## 🚀 Instalación Rápida (Recomendada)

### Paso 1: Descargar e instalar Docker Desktop

1. Descargar desde: https://www.docker.com/products/docker-desktop/
2. Ejecutar el instalador y seguir las instrucciones
3. Reiniciar el equipo si se solicita
4. Abrir Docker Desktop y esperar que inicie (icono verde)

### Paso 2: Descomprimir el paquete

1. Descomprimir el archivo `admin-residencial-onpremise.zip` en `C:\AdminResidencial`
2. La estructura debe quedar así:
```
C:\AdminResidencial\
├── docker-compose-local.yml
├── .env.local
├── Vista\
├── controllers\
├── config\
├── Reconocimiento\
└── ...
```

### Paso 3: Configurar credenciales

1. Abrir el archivo `.env.local` con el Bloc de notas
2. Modificar estos valores:

```env
# Cambiar por el nombre de su conjunto
CONJUNTO_NOMBRE=Mi Conjunto Residencial

# Cambiar estas credenciales del administrador
ADMIN_CEDULA=123456789
ADMIN_PASSWORD=MiClaveSegura2024

# Generar una clave secreta única (puede usar: https://randomkeygen.com/)
JWT_SECRET=cambiar_por_clave_secreta_muy_larga_y_segura
```

### Paso 4: Ejecutar la instalación

1. Hacer doble clic en `instalar.bat`
2. Esperar a que se descarguen las imágenes (puede tardar 5-10 minutos la primera vez)
3. Cuando vea el mensaje "✅ Instalación completada", el sistema está listo

### Paso 5: Acceder al sistema

1. Abrir el navegador
2. Ir a: **http://localhost:5000**
3. Iniciar sesión con las credenciales configuradas

---

## 🔧 Comandos Útiles

Ejecutar desde la carpeta `C:\AdminResidencial` en PowerShell o CMD:

| Comando | Descripción |
|---------|-------------|
| `docker-compose -f docker-compose-local.yml up -d` | Iniciar servicios |
| `docker-compose -f docker-compose-local.yml down` | Detener servicios |
| `docker-compose -f docker-compose-local.yml logs -f` | Ver logs en tiempo real |
| `docker-compose -f docker-compose-local.yml restart` | Reiniciar servicios |

---

## 💾 Respaldo de Datos

### Crear respaldo manual

```powershell
docker exec admin-residencial-mongodb mongodump --out /backup
docker cp admin-residencial-mongodb:/backup ./backup-$(Get-Date -Format "yyyy-MM-dd")
```

### Restaurar respaldo

```powershell
docker cp ./backup-2024-01-15 admin-residencial-mongodb:/backup
docker exec admin-residencial-mongodb mongorestore /backup
```

---

## 🌐 Acceso desde otros dispositivos

Para acceder desde otros dispositivos en la misma red:

1. Obtener la IP del servidor: abrir CMD y ejecutar `ipconfig`
2. Usar la IP en lugar de localhost: `http://192.168.1.X:5000`
3. Asegurarse que el Firewall de Windows permita el puerto 5000

---

## ❓ Solución de Problemas

### El sistema no inicia
1. Verificar que Docker Desktop esté corriendo (icono verde en la bandeja)
2. Ejecutar: `docker-compose -f docker-compose-local.yml logs`
3. Revisar mensajes de error

### No puedo acceder desde http://localhost:5000
1. Verificar que los contenedores estén corriendo: `docker ps`
2. Verificar que el puerto 5000 no esté ocupado por otra aplicación

### Error de conexión a base de datos
1. Verificar que el contenedor MongoDB esté corriendo: `docker ps | findstr mongo`
2. Reiniciar el servicio: `docker-compose -f docker-compose-local.yml restart mongodb`

---

## 📞 Soporte

Para soporte técnico contactar a:
- Email: soporte@tuempresa.com
- Teléfono: +57 XXX XXX XXXX
- WhatsApp: +57 XXX XXX XXXX
