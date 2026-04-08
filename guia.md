# Guía de Documentación: Proyecto Admin Residencial

## 1. Visión General del Proyecto

**Admin Residencial** es una aplicación web de gestión y seguridad residencial desarrollada con **Node.js (Express)** y **React (Vite)**. Permite controlar el acceso vehicular mediante el reconocimiento automático de placas (**YOLOv8**), gestionar el ingreso de visitantes con códigos QR dinámicos, administrar plazas de parqueadero y, como funcionalidad avanzada, ofrece monitoreo de telemetría en tiempo real y reportes de auditoría detallados.

## 1.1 Stack Tecnológico

| Tecnología | Versión / Detalle | Propósito |
| :--- | :--- | :--- |
| **Node.js** | LTS | Entorno de ejecución de JavaScript en el servidor |
| **Express** | 4.21.2 | Framework web principal del backend |
| **React** | 19.2.4 | Biblioteca para la interfaz de usuario (Frontend) |
| **Vite** | 8.0.1 | Herramienta de construcción y server de desarrollo |
| **Tailwind CSS** | 4.2.2 | Framework CSS utilitario para diseño responsivo |
| **MongoDB / Mongoose** | 7.6.3 | Base de datos principal (NoSQL) para usuarios y registros |
| **MySQL (mysql2)** | 3.15.3 | Base de datos secundaria (Relacional) para módulos específicos |
| **YOLOv8** | yolov8n.pt | Reconocimiento de Placas Vehiculares (LPR) |
| **Weka (J48)** | Java backend | Modelos predictivos de comportamiento |
| **JWT** | 9.0.2 | Estándar de autenticación y transmisión de tokens |
| **Lucide React** | 0.577.0 | Conjunto de iconos para la interfaz de usuario |
| **Winston** | 3.19.0 | Sistema de logging y auditoría |
| **Axios** | 1.13.x | Cliente HTTP para comunicación entre capas |

## 1.2 Funcionalidades Implementadas

*   **Gestión de Usuarios y Residentes**: Registro, edición y eliminación de administradores, porteros y residentes (**CRUD completo**).
*   **Control de Acceso Vehicular**: Reconocimiento automático de placas en tiempo real mediante el modelo **YOLOv8**.
*   **Gestión de Visitantes**: Registro de ingresos y salidas con generación automática de **códigos QR** para acceso seguro.
*   **Administración de Parqueaderos**: Control dinámico del estado de las plazas (Libre, Ocupado, En Espera) y asignación a residentes/visitantes.
*   **Dashboards de Supervisión**: Panel con indicadores clave (movimientos recientes, logs de auditoría, resumen de ocupación).
*   **Sistema de Telemetría**: Reporte automático de salud y estadísticas del servidor on-premise hacia la nube (**Azure**).
*   **Arquitectura Multi-tenant**: Gestión independiente de múltiples conjuntos residenciales desde la misma infraestructura.


## 2. Estructura del Proyecto

El proyecto sigue una arquitectura modular basada en **Node.js** para el backend y **React (Vite)** para el frontend. A continuación se detalla la organización de carpetas y archivos más relevantes.

### 2.1 Árbol de Directorios Principal

```
admin-residencial/
├── server.js               ← Punto de entrada de la aplicación
├── package.json            ← Dependencias y scripts del backend
├── Dockerfile              ← Configuración de contenedor Docker
├── config/                 ← Configuraciones de base de datos y utilidades
├── src/                    ← Código fuente principal del backend
│   ├── modules/            ← Arquitectura modular por dominio
│   │   ├── usuarios/       ← Rutas, controladores y lógica de usuarios
│   │   ├── visitantes/     ← Gestión de ingresos y QR
│   │   ├── parqueaderos/   ← Control de plazas de parqueadero
│   │   └── conjuntos/      ← Gestión multi-tenant
│   ├── middlewares/        ← Validaciones y seguridad (Auth, Rate Limit)
│   ├── models/             ← Definición de esquemas de Mongoose
│   └── services/           ← Lógica de negocio compartida
├── ml_services/            ← Servicios de IA (YOLOv8, Weka)
│   ├── predict.js          ← Ejecución de modelos de IA
│   └── yolov8n.pt          ← Pesos del modelo LPR
├── frontend/               ← Aplicación React (Vite)
│   ├── src/                ← Componentes, hooks y servicios frontend
│   │   ├── components/     ← UI Reutilizable
│   │   └── pages/          ← Vistas principales del dashboard
│   ├── vite.config.js      ← Configuración de construcción
│   └── package.json        ← Dependencias del frontend
└── logs/                   ← Archivos de registro de Winston
```

### 2.2 Patrón Arquitectónico

La aplicación implementa el patrón de arquitectura modular en capas **Route/Controller → Service/Logic → Model → Database**, optimizado para escalabilidad en **Node.js/Express**.

| Capa | Responsabilidad | Detalle Técnico |
| :--- | :--- | :--- |
| **Route / Controller** | Recibe peticiones HTTP, gestiona rutas y retorna respuestas JSON | `src/modules/*/routes.js` |
| **Service / Logic** | Contiene la lógica de negocio, validaciones complejas y reglas de dominio | `src/modules/*/services/` |
| **Model** | Define la estructura de los datos y esquemas de persistencia | `Mongoose Models` / `Schema` |
| **Middleware** | Filtra peticiones por seguridad, autenticación (JWT) y rate-limit | `src/middlewares/` |



## 3. Configuración de la Aplicación (.env)

El archivo `.env`, ubicado en la raíz del proyecto, centraliza toda la configuración del sistema (**Environment Variables**). Este enfoque permite separar la configuración del código, facilitando el despliegue en diferentes entornos.

### 3.1 Configuración Básica del Servidor

```bash
# Nombre de la aplicación (referencial)
APP_NAME=admin-residencial
# Puerto del servidor
PORT=5000
# Entorno de ejecución
NODE_ENV=development
```

### 3.2 Base de Datos (MongoDB)

```bash
# URI de conexión a la base de datos MongoDB
MONGO_URI=mongodb://localhost:27017/adminResidencial
```

### 3.3 Persistencia y Modelos (Mongoose)

El proyecto utiliza **Mongoose** para el mapeo de objetos (ODM) a documentos en MongoDB.

```javascript
// Habilitar depuración de consultas (equivalente a show-sql)
mongoose.set('debug', true);
```
mongoose.set('debug', true)**: Imprime en la consola todas las consultas realizadas a la base de datos MongoDB. Es ideal para depuración en desarrollo.

### 3.4 Integración Groq AI (Chatbot)

El sistema integra un asistente conversacional avanzado utilizando la API de Groq con el modelo `llama-3.1-8b-instant`.

#### Configuración de Variables de Entorno (.env)
```env
GROQ_API_KEY=gsk_... # Clave generada en Groq Console
GROQ_MODEL=llama-3.1-8b-instant
```
#### Implementación del Backend
- **Servicio (`chatbot.service.js`)**: Recopila contexto en tiempo real de MongoDB (`HistorialAcceso`, `Visitante`, `Parqueadero`) para alimentar el prompt de la IA.
- **Ruta (`chatbot.routes.js`)**: Endpoint `POST /api/chat` protegido por JWT.

#### Interfaz de Usuario (Frontend)
- **Componente `ChatbotUI.jsx`**: Burbuja flotante en React que permite interacción directa.
- **Micro-animaciones**: Incluye efectos de carga (typing animation) y scroll automático para mejorar la experiencia del usuario.
- **Seguridad**: Solo usuarios autenticados pueden interactuar con el asistente, heredando el filtrado por conjunto (Multi-tenant).

La clave API se lee desde la variable de entorno GROQ_API_KEY. La sintaxis ${GROQ_API_KEY:} permite que la aplicación arranque sin la clave (queda vacía) mientras el módulo de chat no esté activo.

## 4. Capa Model — Esquemas Mongoose (Entidades)

Los esquemas (schemas) definen la estructura de los documentos en la base de datos MongoDB. Están ubicados habitualmente en `src/modules/[nombre_modulo]/[nombre].model.js`. El sistema utiliza un patrón multi-tenant, donde cada documento pertenece a un **Conjunto** específico.

### 4.1 Clase Usuario.model.js
Mapea la colección `usuarios` y representa los datos personales y de acceso de cada usuario registrado en el sistema.

| Campo / Atributo | Tipo JavaScript | Mongoose / MongoDB | Restricciones / Notas |
| :--- | :--- | :--- | :--- |
| **_id** | ObjectId | `_id` (PK) | Generado automáticamente por MongoDB |
| **conjunto** | ObjectId | `ref: "Conjunto"` | Relación referencial (BelongsTo) con el tenant |
| **nombre** | String | `nombre` | `required: true` — campo obligatorio |
| **apellido** | String | `apellido` | `required: true` — campo obligatorio |
| **cedula** | String | `cedula` | `unique` en el contexto del conjunto (Índice compuesto) |
| **password** | String | `password` | `required: true` — Hash almacenado |
| **rol** | String | `rol` | `enum: ["superadmin", "admin", "residente", "porteria"]` |
| **createdAt** | Date | `timestamps: true` | Fecha de registro automática |

#### Características Mongoose destacadas en Usuario
- **`ref: "Conjunto"`**: Establece la relación con la colección de conjuntos para permitir búsquedas cruzadas (`.populate()`).
- **`timestamps: true`**: Mongoose añade automáticamente los campos `createdAt` y `updatedAt`.
- **Índice Compuesto (`conjunto: 1, cedula: 1`)**: Garantiza que un administrador no pueda registrar la misma cédula dos veces en el mismo conjunto residencial.
- **`generarQRAcceso()`**: Método de instancia que genera un token aleatorio único para el acceso seguro de residentes.
- **`buscarPorQR()`**: Método estático que busca un usuario basándose en su token de acceso QR.

### 4.2 Clase Visitante.model.js
Mapea la colección `visitantes`. Cada visitante pertenece a un conjunto (Tenant) y puede estar vinculado a un residente (relación ManyToOne) para representar una visita programada.

| Campo / Atributo | Tipo JavaScript | Mongoose / MongoDB | Restricciones / Notas |
| :--- | :--- | :--- | :--- |
| **_id** | ObjectId | `_id` (PK) | Generado automáticamente |
| **conjunto** | ObjectId | `ref: "Conjunto"` | **Required** — Todos pertenecen a un conjunto |
| **nombre** | String | `nombre` | `required: true` — campo obligatorio |
| **cedula** | String | `cedula` | `required: true` — campo obligatorio |
| **placaVehiculo** | String | `placaVehiculo` | `required: true` — para control LPR |
| **residenteId** | ObjectId | `ref: "Usuario"` | **Relación ManyToOne** — Residente anfitrión |
| **estado** | String | `estado` | `enum: ["pendiente", "ingresado", "salido"]` |
| **qrExpiracion** | Date | `qrExpiracion` | Fecha de validez del código QR |

> **Reglas de Acceso de Visitantes**
> - Los visitantes en estado `pendiente` pueden ingresar si su código QR no ha expirado.
> - Al ingresar, el sistema puede asignar automáticamente una plaza de parqueadero disponible.
> - Se usa `crypto` para generar tokens de 32 caracteres y validar el ingreso seguro.

### 4.3 Clase Conjunto.model.js
Mapea la colección `conjuntos` y representa la entidad Tenant principal. Concentra la configuración, planes de suscripción y límites (cuántos parqueaderos o visitantes puede alojar un edificio en particular).

| Campo / Atributo | Tipo JavaScript | Mongoose / MongoDB | Restricciones / Notas |
| :--- | :--- | :--- | :--- |
| **_id** | ObjectId | `_id` (PK) | Generado automáticamente |
| **nombre** | String | `nombre` | `unique: true` — nombre del edificio |
| **nit** | String | `nit` | `unique: true` — identificador comercial/fiscal |
| **estado** | String | `estado` | `enum: ["activo", "suspendido", "inactivo"]` |
| **configuracion**| Object | `configuracion` | Sub-documento configurable (`maxParqueaderos`, etc.) |
| **plan** | Object | `plan` | Establece fecha de vencimiento (`tipo: trial`, básico, etc.) |

### 4.4 Clase Parqueadero.model.js
Mapea la colección `parqueaderos` gestionando el inventario físico y la asignación de vehículos.

| Campo / Atributo | Tipo JavaScript | Mongoose / MongoDB | Restricciones / Notas |
| :--- | :--- | :--- | :--- |
| **_id** | ObjectId | `_id` (PK) | Generado automáticamente |
| **conjunto** | ObjectId | `ref: "Conjunto"` | **Required** — Tenant |
| **numero** | String | `numero` | `required: true` — Identificador físico (ej. "S1-04") |
| **tipo** | String | `tipo` | `enum: ["visitante", "residente", "discapacitados"]` |
| **estado** | String | `estado` | `enum: ["disponible", "ocupado", "mantenimiento"]` |
| **visitanteActual**| ObjectId| `ref: "Visitante"` | (Opcional) Si está ocupado por una visita |

### 4.5 Clase Instalacion.model.js (Telemetría Edge)
Colección especializada que soporta el ecosistema híbrido (`On-Premise` $\leftrightarrow$ `Cloud`) para la sincronización de la Raspberry Pi y las antenas LPR locales de los conjuntos residenciales con los servidores web.

| Campo / Atributo | Tipo JavaScript | Mongoose / MongoDB | Restricciones / Notas |
| :--- | :--- | :--- | :--- |
| **_id** | ObjectId | `_id` (PK) | Generado automáticamente |
| **conjunto** | ObjectId | `ref: "Conjunto"` | **Required** — Edificio en el que fue instalado el server local |
| **hostname** | String | `hostname` | Identificador de la máquina / Raspberry Pi |
| **ultimaConexion**| Date | `ultimaConexion` | Reflejo del *Heartbeat* (Latido del servidor local) |
| **estado** | String | `estado` | `enum: ["online", "offline", "error"]` |


## 5. Capa Repository (Acceso a Datos — Mongoose)

En este proyecto, los **Modelos de Mongoose** actúan como la capa de acceso a datos (Repository). No es necesario extender una interfaz específica; el modelo en sí mismo provee automáticamente todos los métodos robustos para interactuar con MongoDB.

### 5.1 Usuario.model.js (Repostitorio de Datos)
En Mongoose, el modelo hereda todos los métodos CRUD básicos. Adicionalmente, se definen consultas personalizadas mediante objetos de criterio:

| Método Mongoose | Tipo de Consulta | Descripción |
| :--- | :--- | :--- |
| `findOne({ cedula: "..." })` | Por criterio | Busca un usuario por su número de cédula. Retorna un documento o `null`. |
| `exists({ cedula: "..." })` | Verificación | Verifica si ya existe un usuario con esa cédula. Retorna el ID si existe. |
| `find({ torre: "A" })` | Por filtrado | Lista todos los usuarios de la torre especificada. |
| `find({ $or: [...] })` | Operador lógico | Búsqueda flexible en nombres o apellidos usando operadores de MongoDB. |

#### Comparativa: Selectores Mongoose vs. SQL
En MongoDB/Mongoose se utilizan **Query Objects** (Objetos de Consulta) para filtrar:

| Concepto JPA | Operador Mongoose | Equivalente SQL / MongoDB |
| :--- | :--- | :--- |
| `findBy...` | `find({ campo: valor })` | `SELECT * FROM ... WHERE campo = valor` |
| `existsBy...` | `exists({ campo: valor })` | `SELECT COUNT(*) > 0 FROM ... WHERE ...` |
| `Containing` | `{ $regex: /valor/i }` | `campo LIKE '%valor%'` (Búsqueda parcial) |
| `IgnoreCase` | `{ $regex: /valor/i }` | `LOWER(campo) = LOWER(valor)` |
| `Or` | `{ $or: [ {c1}, {c2} ] }` | `OR` en la cláusula WHERE |

### 5.2 Visitante.model.js (Repositorio de Datos)
Este modelo permite realizar consultas avanzadas para el control de accesos, similar a `CalificacionRepository`. Incluye métodos para filtrar por residente y generar estadísticas de ocupación.

| Método | Tipo de consulta | Descripción |
| :--- | :--- | :--- |
| `find({ residenteId: "..." })` | Por criterio | Recupera todos los visitantes vinculados a un residente específico. |
| `countDocuments({ conjunto: "..." })` | Contador | Calcula el total de visitantes registrados en un conjunto residencial. |
| `aggregate([...])` | Agregación | Realiza cálculos complejos (grupos, filtros temporales) en la BD. |

#### Ejemplo de consulta avanzada (Mongoose Aggregation)
Mongoose utiliza un **Aggregation Pipeline** (tubería de agregación) para procesar datos de manera eficiente:

```javascript
// Consulta de agregación: cuenta visitantes agrupados por estado
const estadisticas = await Visitante.aggregate([
  { $match: { conjunto: conjuntoId } },
  { $group: { 
      _id: "$estado", 
      total: { $sum: 1 } 
    } 
  }
]);
```
*En este ejemplo, `aggregate` filtra por conjunto y cuenta cuántos visitantes hay por cada estado (`pendiente`, `ingresado`, `salido`).*

### 5.3 Conjunto, Parqueadero e Instalación (Repositorios Adicionales)
Al igual que con los usuarios y visitantes, el resto de los modelos en la aplicación fungen nativamente como repositorios y exponen consultas especializadas:

| Repositorio (Model) | Explicación |
| :--- | :--- |
| `Conjunto.model.js` | Posee métodos estáticos predefinidos como `obtenerActivos()` para listar los *Tenants* no suspendidos, o `obtenerEstadisticas()` que lanza consultas *countDocuments* en paralelo para generar reportes cruzados. |
| `Parqueadero.model.js` | Repositorio de inventario físico. Para ubicar una plaza libre, los servicios usan operaciones CRUD directas como `findOne({ conjunto: ID, estado: "disponible" })`. |
| `Instalacion.model.js` | Repositorio para Telemetría. Para saber si el equipo *On-Premise* está conectado, se realizan operaciones recurrentes de actualización de fecha mediante `findByIdAndUpdate()`. |

## 6. Capa Service — Lógica de Negocio

Los servicios contienen la lógica de negocio central de la aplicación. En la arquitectura modular de este proyecto (Node.js), los servicios son módulos organizados por dominio (por ejemplo, `visitante.service.js`) que encapsulan las reglas principales, validaciones avanzadas o el consumo de APIs de terceros.

Estos módulos exportan sus funciones o clases estructuradas y son importadas orgánicamente mediante `require()` en los distintos Controladores (`controllers`), actuando como puente entre la recepción de la petición y las consultas hacia la base de datos (Mongoose), asegurando que el controlador se mantenga limpio y enfocado.

### 6.1 conjunto.service.js
Gestiona el ciclo de vida completo de los conjuntos residenciales (Tenants). Al crear un conjunto, también genera automáticamente sus parqueaderos usando `Promise.all`, aplicando el patrón de **transacciones en paralelo** de Node.js.

| Función exportada | Descripción |
| :--- | :--- |
| `crearConjunto(datos)` | Crea el Tenant y genera los parqueaderos (`P-1` … `P-N`) en paralelo mediante `Promise.all`. |
| `obtenerConjuntos(query)` | Listado paginado con filtros opcionales por `estado` y búsqueda textual por `nombre`. |
| `obtenerConjuntoPorId(id)` | Busca un conjunto específico o lanza `Error("Conjunto no encontrado")`. |
| `actualizarConjunto(id, datos)` | Actualiza campos individualmente (nombre, dirección, módulos activos). |
| `eliminarConjunto(id)` | Desactiva el conjunto (soft delete: `estado = 'inactivo'`). |
| `obtenerEstadisticasGlobales()` | Cruza colecciones (Conjunto, Usuario, Visitante) con `countDocuments` en paralelo y agrupa por plan. |
| `actualizarPlan(id, plan)` | Valida que el plan sea uno de `['basico', 'estandar', 'premium', 'enterprise']` antes de guardar. |

### 6.2 parqueadero.service.js
Gestiona el inventario físico de plazas vehiculares e integra accesos al `HistorialAcceso` para registrar trazabilidad completa de entradas y salidas.

| Función exportada | Descripción |
| :--- | :--- |
| `obtenerPlazas(tenantFilter)` | Lista las plazas con populate del visitante activo (nombre, placa). |
| `asignarVisitante(visitanteId)` | Busca una plaza `DISPONIBLE` y la pasa a `EN_ESPERA` asignando el visitante. |
| `liberarPlaza(idPlaza)` | Libera la plaza y vuelve su estado a `DISPONIBLE`. |
| `registrarEntrada(codigoQR)` | Marca la plaza como `OCUPADO` y crea un `HistorialAcceso` de tipo `ENTRADA`. |
| `registrarSalida(plazaId)` | Libera la plaza y registra un `HistorialAcceso` de tipo `SALIDA`. |
| `registrarAccesoVehicular(placa, tipo)` | Identifica si la placa pertenece a un residente o visitante activo para registrar la acción vía LPR. |
| `crearPlazasConjunto(conjuntoId, n)` | Crea `n` plazas con código QR único para un conjunto nuevo (máx. 500). |
| `editarPlaza(plazaId, numero, estado)` | Valida unicidad del número en el conjunto y estados válidos antes de actualizar. |

### 6.3 visitante.service.js
Gestiona el ciclo de visitas con orquestación directa sobre `parqueadero.service.js` para disponibilidad de plazas.

| Función exportada | Descripción |
| :--- | :--- |
| `listarTodos(tenantFilter)` | Retorna todos los visitantes del conjunto con datos del residente anfitrión. |
| `registrarIngreso(datos)` | Valida al residente, consulta parqueaderos disponibles y crea el visitante en la colección. |
| `obtenerEstadisticas(tenantFilter)` | Agrega contadores por estado (`pendiente`, `ingresado`, `salido`). |
| `eliminar(id, tenantFilter)` | Verifica pertenencia al conjunto antes de eliminar el registro. |

### 6.4 chatbot.service.js (Servicio Coordinador)
Servicio especializado en consultas generativas con IA. Coordina a los demás servicios para armar un contexto en tiempo real antes de llamar a la API de Groq.

| Función exportada | Descripción |
| :--- | :--- |
| `generarContextoGlobal(conjuntoId)` | Cruza Visitante, Parqueadero y Usuario para devolver un resumen del conjunto. |
| `procesarPregunta(mensaje, contexto)` | Envía el prompt enriquecido con el contexto a Groq AI y retorna la respuesta en texto natural. |

## 7. Capa Controller — Controladores (API REST)

La capa Controller es la puerta de entrada HTTP de la aplicación. A diferencia de un sistema tradicional que renderiza vistas en el servidor (como Thymeleaf o JSP), este proyecto funciona como una **API RESTful**. 

Los controladores reciben las peticiones HTTP directamente desde el cliente web (el Frontend construido en React), extraen la información necesaria, mandan a ejecutar la lógica y devuelven **exclusivamente respuestas en formato JSON**.

### 7.1 conjunto.controller.js
Controlador que gestiona las operaciones administrativas de los Tenants (conjuntos residenciales). Incluye integración con el sistema de auditoría (`AuditLog.registrar`) para registrar acciones críticas de administración.

| Función (Handler) | HTTP | Ruta API | Descripción |
| :--- | :--- | :--- | :--- |
| `crearConjunto(req, res)` | `POST` | `/api/conjuntos` | Crea un nuevo conjunto residencial e impacta `AuditLog` con nivel `critical`. |
| `obtenerConjuntos(req, res)` | `GET` | `/api/conjuntos` | Retorna la lista paginada con filtros opcionales (`estado`, `busqueda`). |
| `obtenerConjuntoPorId(req, res)` | `GET` | `/api/conjuntos/:id` | Retorna el detalle de un conjunto específico o responde `404` si no existe. |
| `actualizarConjunto(req, res)` | `PUT` | `/api/conjuntos/:id` | Actualiza datos del conjunto e impacta `AuditLog` con nivel `warning`. |
| `eliminarConjunto(req, res)` | `DELETE` | `/api/conjuntos/:id` | Desactiva el conjunto (soft delete) e impacta `AuditLog` con nivel `critical`. |
| `obtenerEstadisticasGlobales(req, res)` | `GET` | `/api/conjuntos/estadisticas` | Agrega conteos de usuarios, visitantes y parqueaderos para el panel global. |

#### Patrón de Respuesta Estandarizada
Todos los handlers delegan el formato de respuesta al módulo utilitario `responseHandler`, el cual envuelve automáticamente los datos en la estructura `{ success, message, data }`, garantizando consistencia en toda la API.

### 7.2 usuario.controller.js
Controlador que gestiona el CRUD de usuarios (residentes, porteros, admins) y concentra también el flujo de **autenticación** (login/logout con JWT).

| Función (Handler) | HTTP | Ruta API | Descripción |
| :--- | :--- | :--- | :--- |
| `login(req, res)` | `POST` | `/api/usuarios/login` | Valida cédula + contraseña, genera y retorna un token JWT. Soporta cuenta de admin del sistema vía `.env`. |
| `crearUsuario(req, res)` | `POST` | `/api/usuarios` | Crea un usuario con hash de contraseña (`bcryptjs`) y valida unicidad de cédula. |
| `obtenerUsuarios(req, res)` | `GET` | `/api/usuarios` | Lista usuarios del conjunto autenticado (filtrado por Tenant automático). |
| `actualizarUsuario(req, res)` | `PUT` | `/api/usuarios/:id` | Actualiza datos y re-hashea la contraseña si se modifica. |
| `eliminarUsuario(req, res)` | `DELETE` | `/api/usuarios/:id` | Elimina el usuario del conjunto verificando permisos del Tenant. |

### 7.3 visitante.controller.js
Controlador dedicado al ciclo de vida de las visitas, con orquestación interna hacia `parqueadero.service.js` al momento de registrar el ingreso.

| Función (Handler) | HTTP | Ruta API | Descripción |
| :--- | :--- | :--- | :--- |
| `obtenerVisitantes(req, res)` | `GET` | `/api/visitantes` | Lista todos los visitantes del conjunto con su estado actual. |
| `registrarIngreso(req, res)` | `POST` | `/api/visitantes` | Registra el visitante, vincula al residente anfitrión y asigna parqueadero si hay disponibilidad. |
| `obtenerEstadisticasVisitantes(req, res)` | `GET` | `/api/visitantes/estadisticas` | Retorna contadores por estado (pendiente, ingresado, salido). |
| `eliminarVisitante(req, res)` | `DELETE` | `/api/visitantes/:id` | Elimina el registro validando pertenencia al Tenant activo. |

### 7.4 parqueadero.controller.js
Controlador que expone el inventario de plazas y registra el historial de accesos vehiculares, integrando datos de LPR cuando el ingreso es por reconocimiento de placa.

| Función (Handler) | HTTP | Ruta API | Descripción |
| :--- | :--- | :--- | :--- |
| `obtenerPlazas(req, res)` | `GET` | `/api/parqueaderos` | Lista plazas con datos del visitante que las ocupa (populate). |
| `asignarVisitante(req, res)` | `POST` | `/api/parqueaderos/asignar` | Busca la primera plaza disponible y la asigna al visitante. |
| `liberarPlaza(req, res)` | `PUT` | `/api/parqueaderos/liberar/:id` | Libera la plaza y la deja disponible para la siguiente asignación. |
| `registrarEntrada(req, res)` | `POST` | `/api/parqueaderos/entrada` | Registra la entrada por QR y crea un `HistorialAcceso` de tipo `ENTRADA`. |
| `registrarSalida(req, res)` | `POST` | `/api/parqueaderos/salida/:id` | Libera la plaza y crea un `HistorialAcceso` de tipo `SALIDA`. |
| `registrarAccesoVehicular(req, res)` | `POST` | `/api/parqueaderos/lpr` | Procesa el acceso LPR (reconocimiento de placa): identifica si es residente o visitante y registra en historial. |

## 8. Vistas — Interfaz de Usuario (Frontend React)

Las vistas están ubicadas en `frontend/src/` y están construidas con **React + Vite**. A diferencia de un motor de plantillas que genera HTML en el servidor (SSR), este proyecto usa una arquitectura **SPA (Single Page Application)**: React renderiza las vistas directamente en el navegador del usuario consumiendo los datos de la API REST.

| Concepto Thymeleaf (SSR) | Equivalente en este proyecto (CSR/SPA) |
| :--- | :--- |
| Plantillas `.html` en `templates/` | Componentes `.jsx` en `frontend/src/pages/` |
| Motor procesa el HTML en el servidor | React renderiza el HTML en el navegador |
| `th:text="${variable}"` | `{variable}` (JSX Expression) |
| `th:if="${condición}"` | `{condición && <Componente />}` |
| `th:each="item : ${lista}"` | `{lista.map(item => <Componente />)}` |
| Navegación con `<a href="...">` | Navegación con `<Link to="..." />` (React Router) |

### 8.1 Sintaxis JSX utilizada en el proyecto
Las expresiones JSX sustituyen las directivas de Thymeleaf para generar contenido dinámico directamente en el navegador:

| Expresión JSX | Uso | Ejemplo en el proyecto |
| :--- | :--- | :--- |
| `{variable}` | Inserta texto o valor dinámico en el elemento HTML | `{totalVisitantes}` |
| `{condición && <Comp />}` | Renderizado condicional (muestra si es verdadero) | `{isAdmin && <PanelAdmin />}` |
| `{!condición && <Comp />}` | Renderizado condicional inverso (ocultar si es verdadero) | `{!cargando && <Tabla />}` |
| `{lista.map(item => ...)}` | Itera sobre colecciones para renderizar componentes | `{visitantes.map(v => <FilaVisitante key={v._id} />)}` |
| `onChange / onSubmit` | Vincula el formulario a una función manejadora | `<form onSubmit={handleLogin}>` |
| `useState(...)` | Estado local del componente (reemplaza el `Model` del controlador) | `const [usuarios, setUsuarios] = useState([])` |
| `useEffect(...)` | Dispara una llamada a la API al montar el componente | `useEffect(() => fetchVisitantes(), [])` |
| `<Link to="...">` | Navegación entre páginas sin recargar (SPA) | `<Link to="/admin">Ir al Panel</Link>` |

### 8.2 Login.jsx — Pantalla de Autenticación
Formulario de inicio de sesión que permite acceder a los tres roles del sistema. Los valores son manejados localmente mediante `useState` y enviados al backend mediante `fetch` a `POST /api/usuarios/login`.
*   `cedula`: número de identificación del usuario.
*   `password`: contraseña en texto plano (encriptada en el servidor con `bcryptjs`).
*   Al recibir el JWT, lo almacena en `localStorage` y redirige según el rol (`admin` → `/admin`, `portero` → `/portero`, `residente` → `/residente`).
*   La expresión `{error && <p className="text-red-500">{error}</p>}` previene mensajes vacíos si el login fue exitoso.

### 8.3 AdminDashboard.jsx — Panel del Administrador
Muestra tarjetas de métricas clave del conjunto residencial y botones de gestión. Los valores son cargados al montar el componente mediante `useEffect` que llama a `GET /api/conjuntos/estadisticas`.
*   `totalUsuarios`: número total de residentes registrados.
*   `totalVisitantes`: número total de visitas en el sistema.
*   `parqueaderosDisponibles`: plazas libres en tiempo real (resaltado en verde o rojo según disponibilidad).
*   `planActual`: tipo de suscripción del conjunto (`basico`, `premium`, etc.).

### 8.4 PorteroDashboard.jsx — Panel del Portero
Vista operativa del portero que permite registrar el ingreso de visitantes y controlar la ocupación de parqueaderos. Actúa como el punto de entrada físico del conjunto.
*   Formulario de registro de visitante (`nombre`, `apellido`, `cédula`, `placaVehiculo`) con `onSubmit` hacia `POST /api/visitantes`.
*   Lista de parqueaderos renderizada con `{plazas.map(...)}`, donde cada plaza muestra su estado (`DISPONIBLE`, `EN_ESPERA`, `OCUPADO`) con colores diferenciados.
*   El botón "Liberar" envía `PUT /api/parqueaderos/liberar/:id` y actualiza el estado local sin recargar la página.

### 8.5 ResidenteDashboard.jsx — Panel del Residente
Vista de solo lectura donde el residente puede ver el historial de sus visitantes y el estado actual de sus visitas pendientes.
*   Carga el historial con `useEffect` → `GET /api/visitantes` (filtrado por `residenteId` en el token JWT).
*   Muestra una tabla de visitas con columnas: nombre del visitante, fecha de ingreso, estado y acción (eliminar).
*   La expresión `{visitantes.length === 0 && <p>No tiene visitas registradas.</p>}` maneja listas vacías.
*   Desde esta vista el residente puede ver el código QR de acceso de su visitante actual.

### 8.6 VisitanteAcceso.jsx — Confirmación de Acceso por Token
Página pública accesible sin autenticación. Valida el token QR recibido por URL y muestra el estado de la visita al visitante o al portero que escanea el código.
*   Lee el token desde `useParams()` → `GET /api/visitantes/acceso/:token`.
*   Si el token es válido muestra: nombre del visitante, nombre del residente anfitrión y hora de autorización.
*   Si el token expiró o es inválido muestra un mensaje de error con acción sugerida.

### 8.7 components/Chatbot/ChatbotUI.jsx — Asistente IA Integrado
Componente global con estilos propios en TailwindCSS, inyectado en `App.jsx` para que esté disponible en todas las vistas de usuarios autenticados. La comunicación con el backend se realiza mediante `fetch` a `POST /api/chat`, enviando y recibiendo JSON.
*   Mensajes del usuario renderizados en burbujas azules (`bg-blue-500`).
*   Respuestas del bot en burbujas grises (`bg-gray-100`) con animación de escritura (*typing animation*) usando estados `isCargando`.
*   Incluye botones de preguntas sugeridas que autocompletan el campo de texto: *"¿Cuántos visitantes hay hoy?"*, *"¿Hay parqueaderos disponibles?"*.
*   El historial de conversación se guarda en `useState` durante la sesión activa del usuario.

## 9. Flujo de Datos — Ciclo de Vida de una Petición

A continuación se describe el ciclo completo de una petición HTTP típica en el sistema, tomando como ejemplo el registro de un nuevo visitante por parte del portero.

### 9.1 Ejemplo: Registrar un Visitante

1. El portero accede a `PorteroDashboard.jsx` desde el navegador (cargado por React Router).
2. `useEffect()` dispara `GET /api/parqueaderos` para cargar las plazas disponibles y `GET /api/visitantes` para el historial. Los datos se guardan en el estado local con `useState`.
3. React renderiza el formulario de ingreso con los campos: `nombre`, `apellido`, `cédula`, `placaVehiculo` y el selector de residente anfitrión.
4. El portero llena el formulario y hace clic en **"Registrar Ingreso"** → se dispara `onSubmit` → `fetch POST /api/visitantes` con el JSON del cuerpo.
5. El Router de Express pasa la petición a `visitante.controller.js → registrarIngreso(req, res)`.
6. El Controller extrae `req.body` y delega a `visitanteService.registrarIngreso(datos)`.
7. El Service verifica que el residente anfitrión exista (`Mongoose findById`). Si no existe, lanza `throw new Error("Residente no encontrado")`.
8. Si el formulario incluye placa de vehículo, llama a `parqueaderoService.asignarVisitante(visitanteId)` para reservar la primera plaza `DISPONIBLE`.
9. `parqueaderoService` busca la plaza con `Parqueadero.findOne({ estado: "DISPONIBLE" })`, la actualiza a `EN_ESPERA` y la guarda.
10. El Service crea el documento visitante con `new Visitante({...}).save()`. MongoDB inserta el registro y retorna el `_id` generado.
11. El Controller recibe el objeto persistido y responde con `successResponse(res, visitante, "Visitante registrado", 201)`.
12. El `fetch` en React recibe el JSON, actualiza el `state` de visitantes y de parqueaderos, y la UI se re-renderiza automáticamente reflejando el nuevo visitante y la plaza ocupada.

### 9.2 Flujo del Asistente IA (Chatbot)
1. El portero o administrador escribe una pregunta en la burbuja flotante `ChatbotUI.jsx` y presiona **"Enviar"**.
2. El componente actualiza `isCargando = true` (muestra la animación *typing*) y ejecuta `fetch POST /api/chat` con el body `{ message: "..." }` y el token JWT en el Header.
3. El Router de Express valida el JWT mediante `authMiddleware` y pasa la petición al handler de `chatbot.routes.js`.
4. `chatbot.service.js` recibe el mensaje y ejecuta `generarContextoGlobal(conjuntoId)`, que consulta en paralelo:
   - `Visitante.countDocuments(...)` → total de visitas activas.
   - `Parqueadero.find(...)` → plazas disponibles / ocupadas.
   - `Usuario.countDocuments(...)` → total de residentes.
5. El Service construye un *prompt* enriquecido con el contexto del conjunto y lo envía a la **API de Groq AI** (`llama-3.1-8b-instant`).
6. Groq retorna la respuesta en lenguaje natural. El Service la encapsula y la retorna al Controller.
7. El Controller responde con `res.json({ respuesta: "..." })`.
8. React recibe el JSON, agrega el mensaje del bot como burbuja gris en el historial del chat y actualiza `isCargando = false`.

## 10. Guía de Ejecución Local

Pasos para clonar, configurar y ejecutar el proyecto en un entorno de desarrollo local con VS Code.

### 10.1 Requisitos Previos

| Herramienta | Versión mínima | Descarga |
| :--- | :--- | :--- |
| Node.js | 18 LTS o superior | https://nodejs.org/ |
| MongoDB | 6.0 o superior | https://www.mongodb.com/try/download/community |
| Git | Cualquiera | https://git-scm.com/ |
| VS Code | Cualquiera | https://code.visualstudio.com/ |
| Groq API Key | — | https://console.groq.com/ |

### 10.2 Pasos de Instalación

1. **Clonar el repositorio:**
```bash
git clone https://github.com/tu-usuario/admin-residencial.git
cd admin-residencial
```

2. **Instalar dependencias del Backend:**
```bash
npm install
```

3. **Configurar las variables de entorno:**
Crear el archivo `.env` en la raíz del proyecto con el siguiente contenido:
```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/admin_residencial
JWT_SECRET=tu_clave_secreta_aqui
GROQ_API_KEY=gsk_...tu_clave_de_groq...
GROQ_MODEL=llama-3.1-8b-instant
```

4. **Asegurarse que MongoDB esté activo** (en Windows, buscar "MongoDB" en Servicios o ejecutar `mongod` en la terminal).

5. **Arrancar el servidor Backend:**
```bash
npm run dev
```

6. **Instalar dependencias del Frontend:**
```bash
cd frontend
npm install
```

7. **Arrancar el cliente Frontend (React + Vite):**
```bash
npm run dev
```

8. Abrir el navegador en **`http://localhost:5173`** (Vite) y el API en **`http://localhost:5000`**.

> **Verificación de inicio correcto**
> - En la consola del backend debe aparecer: `Servidor corriendo en puerto 5000` y `MongoDB conectado`.
> - Mongoose no crea tablas (no es SQL), las colecciones se generan automáticamente al insertar el primer documento.
> - Si hay error de conexión a MongoDB, verificar que el servicio esté activo y que `MONGO_URI` apunte al host correcto.

### 10.3 Habilitar el Chatbot con Groq

El asistente de inteligencia artificial está integrado en el proyecto. Para activarlo en un entorno local o de producción, solo es necesario configurar la variable de entorno correspondiente:

1. Crear una cuenta gratuita en https://console.groq.com y obtener una **API Key**.
2. Agregar la clave al archivo `.env` del proyecto:
```env
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxxxx
GROQ_MODEL=llama-3.1-8b-instant
```
3. En Windows CMD (alternativa sin archivo `.env`):
```cmd
set GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxxxx
```
4. En macOS / Linux:
```bash
export GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxxxx
```
5. Reiniciar el servidor con `npm run dev`. El `chatbot.service.js` leerá automáticamente la clave desde `process.env.GROQ_API_KEY` y comenzará a responder consultas de los usuarios autenticados.

> **Nota**: Si `GROQ_API_KEY` no está definida, el endpoint `POST /api/chat` retornará un error `500`. El resto del sistema (visitantes, parqueaderos, usuarios) funcionará con normalidad sin la clave de IA.

## 11. Buenas Prácticas Identificadas en el Código

El proyecto implementa varias buenas prácticas de desarrollo con Node.js, Mongoose y React que vale la pena destacar para aprendizaje.

### 11.1 Módulos con Dependencias Explícitas (`require`)
Todos los servicios y controladores declaran explícitamente sus dependencias al inicio del archivo mediante `require()`. Esto hace visibles de un vistazo todos los módulos de los que depende cada archivo, sin inyección implícita ni magia de framework:

```javascript
// conjunto.controller.js — dependencias explícitas
const conjuntoService = require('./conjunto.service');
const { successResponse, errorResponse } = require('../../../utils/responseHandler');
const { models, logger } = require('../../index');
```

### 11.2 Manejo de Errores Estandarizado
*   `throw new Error("mensaje")` en los servicios actúa como la excepción de dominio que escala hacia el controlador.
*   Los controladores capturan el error con `try-catch` y delegan al utilitario `errorResponse(res, error.message, 400/404/500)`.
*   Esto garantiza que **ningún error no controlado llegue al cliente** con un stack trace expuesto.

```javascript
// Patrón try-catch uniforme en todos los controllers
try {
    const datos = await conjuntoService.obtenerConjuntoPorId(req.params.id);
    return successResponse(res, datos, "Conjunto obtenido");
} catch (error) {
    return errorResponse(res, error.message, 404);
}
```

### 11.3 Validaciones en Múltiples Capas
*   **Capa Model (Mongoose Schema):** `required`, `enum`, `minlength`, índices `unique` garantizan integridad a nivel de base de datos.
*   **Capa Service:** validaciones de reglas de negocio (cédula única, parqueadero disponible, plan válido).
*   **Capa Controller:** revisión de `req.body` antes de delegar al servicio.
*   **Capa Vista (React):** validaciones HTML5 nativas (`required`, `type="number" min/max`) y condicionales JSX para mostrar mensajes de error.

### 11.4 Uso de `Number` y Validación de Rango
Los campos numéricos críticos (número de plaza, capacidad de parqueaderos, cantidad de parqueaderos a crear) son validados con `parseInt` / `isNaN` antes de procesarse, evitando errores de tipo en tiempo de ejecución:

```javascript
// parqueadero.service.js — validación de rango
const cantidad = parseInt(cantidadParam);
if (!cantidad || cantidad <= 0 || cantidad > 500) {
    throw new Error("Cantidad inválida. Debe ser un número entre 1 y 500");
}
```

### 11.5 Timestamps y Auditoría Automática
*   Todos los esquemas de Mongoose tienen `{ timestamps: true }`, que auto-asigna `createdAt` y `updatedAt` en cada operación, equivalente al `@PrePersist` de JPA.
*   El sistema de **AuditLog** (`AuditLog.registrar(...)`) en `conjunto.controller.js` registra acciones críticas (crear/eliminar conjuntos) con el usuario responsable, nivel de severidad y descripción legible.

### 11.6 Separación de Responsabilidades (SRP)
`chatbot.service.js` no tiene acceso directo a los repositorios (modelos de Mongoose). Depende exclusivamente de los demás servicios (`visitanteService`, `parqueaderoService`) para obtener datos, respetando el principio de responsabilidad única y asegurando que toda la lógica de consulta permanezca en la capa correcta:

```javascript
// chatbot.service.js respeta SRP — consume servicios, no modelos
const resumen = await visitanteService.obtenerEstadisticas(conjuntoId);
const plazas = await parqueaderoService.obtenerPlazas({ conjunto: conjuntoId });
```

## 12. Observaciones y Puntos de Mejora

Durante el análisis del código se identificaron algunos aspectos a tener en cuenta para evolucionar el proyecto en fases posteriores.

### 12.1 Ausencia de Capa de Validación de Entrada en Controladores
Actualmente los controladores confían en que el `req.body` llega correctamente formado desde el cliente React. Para una mayor robustez se recomienda integrar una librería de validación de esquemas en el servidor como **Joi** o **Zod**, que permita rechazar peticiones malformadas antes de llegar al Service:
```javascript
// Ejemplo futuro con Joi
const schema = Joi.object({ nombre: Joi.string().required() });
const { error } = schema.validate(req.body);
if (error) return errorResponse(res, error.details[0].message, 400);
```

### 12.2 Sin Cobertura de Pruebas Automatizadas
El proyecto no incluye pruebas unitarias ni de integración. Se recomienda implementar **Jest** + **Supertest** para cubrir los servicios y rutas críticas (registro de visitantes, asignación de parqueaderos, login JWT), asegurando que los cambios futuros no rompan funcionalidades existentes.

### 12.3 Manejo de Concurrencia en Parqueaderos
La asignación de un parqueadero (`findOne` + `save`) no es atómica. En entornos con múltiples usuarios concurrentes podría asignarse la misma plaza dos veces. La solución recomendada es usar operaciones atómicas de Mongoose como `findOneAndUpdate` con un filtro estricto:
```javascript
// Solución atómica (evita condición de carrera)
const plaza = await Parqueadero.findOneAndUpdate(
    { conjunto: id, estado: "DISPONIBLE" },
    { $set: { estado: "EN_ESPERA", visitante: visitanteId } },
    { new: true }
);
```

### 12.4 Token JWT sin Blacklist (Logout Incompleto)
El logout actual solo borra el token del lado del cliente (`localStorage`). Un token JWT sigue siendo técnicamente válido hasta que expire. Para mejorar la seguridad se recomienda implementar una **lista negra de tokens** en Redis o en MongoDB que invalide el token inmediatamente al cerrar sesión.

### 12.5 Gestión de Imágenes y Archivos
El sistema actualmente no contempla el almacenamiento de fotos de visitantes o residentes. Para una fase futura se recomienda integrar **Multer** (middleware de Node.js) para manejar la subida de archivos, combinado con almacenamiento en la nube (AWS S3 o Cloudinary).

### 12.6 Paginación Incompleta en Algunos Endpoints
`conjunto.service.js` implementa paginación correctamente, pero otros endpoints como `GET /api/visitantes` retornan todos los documentos sin límite. Con colecciones grandes esto puede generar problemas de rendimiento, por lo que se recomienda aplicar `.skip()` y `.limit()` de forma consistente en todos los listados.

## 13. Glosario de Conceptos

| Término | Definición |
| :--- | :--- |
| **Mongoose Schema** | Define la estructura, tipos y reglas de validación de un documento MongoDB. Equivale a una entidad de datos pero sin SQL. |
| **Modelo Mongoose** | Clase generada a partir de un Schema que provee métodos CRUD (`find`, `save`, `findById`, etc.) sobre su colección en MongoDB. Actúa como Repository y Model al mismo tiempo. |
| **Express Router** | Módulo de Express que agrupa rutas relacionadas bajo un prefijo común (ej. `/api/visitantes`). Define cuál controlador maneja cada petición HTTP. |
| **Middleware** | Función que intercepta la petición HTTP antes de llegar al controlador. Ejemplos: `authMiddleware` (valida JWT), `cors()`, `express.json()`. |
| **JWT (JSON Web Token)** | Token firmado que contiene la identidad y el rol del usuario. Se almacena en el cliente (`localStorage`) y se envía en el header `Authorization` en cada petición protegida. |
| **`req.body`** | Objeto de Express con los datos enviados en el cuerpo de una petición `POST` o `PUT`. Contiene el JSON que envía el frontend. |
| **`req.params`** | Contiene los segmentos dinámicos de la URL (ej. `/api/visitantes/:id` → `req.params.id`). |
| **`req.query`** | Contiene los parámetros de consulta (ej. `?page=1&limit=10`). Usado para paginación y filtros. |
| **`async / await`** | Sintaxis de JavaScript para manejar operaciones asíncronas (base de datos, APIs externas) de forma legible y sin callbacks anidados. |
| **`try-catch`** | Bloque de control de errores. Captura excepciones lanzadas por el Service y permite retornar respuestas HTTP apropiadas desde el Controller. |
| **`Promise.all`** | Ejecuta múltiples operaciones asíncronas en paralelo y espera que todas finalicen. Usado en `conjunto.service.js` para crear parqueaderos de forma concurrente. |
| **Aggregation Pipeline** | Mecanismo de MongoDB para procesar y transformar documentos mediante etapas encadenadas (`$match`, `$group`, `$sort`). Equivale a consultas SQL avanzadas con `GROUP BY`, `COUNT`, etc. |
| **Tenant / Multi-Tenant** | Modelo de aislamiento de datos donde cada conjunto residencial es un *Tenant* independiente. Sus documentos se filtran por el campo `conjunto` (ObjectId) en cada consulta. |
| **`timestamps: true`** | Opción del Mongoose Schema que añade automáticamente `createdAt` y `updatedAt` a cada documento guardado. |
| **`populate()`** | Función de Mongoose que reemplaza un `ObjectId` referenciado por el documento completo de la colección asociada. Equivale a un `JOIN` entre colecciones. |
| **SPA (Single Page Application)** | Arquitectura frontend donde una sola página HTML es cargada inicialmente y React actualiza el contenido dinámicamente sin recargar el navegador. |
| **`useState`** | Hook de React para manejar el estado local de un componente (datos de formularios, listas). |
| **`useEffect`** | Hook de React que ejecuta código al montar o actualizar un componente. Se usa para cargar datos desde la API al abrir una vista. |
| **`fetch` API** | Función nativa del navegador para realizar peticiones HTTP (GET, POST, PUT, DELETE) hacia el backend REST. |
| **JSX** | Extensión de sintaxis de JavaScript que permite escribir HTML dentro de componentes React. Las expresiones dinámicas se insertan con `{variable}`. |
| **DTO (Data Transfer Object)** | Objeto plano de JavaScript que transporta datos entre capas sin lógica de negocio ni referencias directas a documentos de Mongoose. Evita exponer datos sensibles al cliente. |
| **`responseHandler`** | Módulo utilitario del proyecto que estandariza las respuestas JSON con la estructura `{ success, message, data }` para garantizar consistencia en toda la API. |
| **AuditLog** | Modelo compartido que registra acciones administrativas críticas (crear/eliminar conjuntos) con usuario responsable, descripción, nivel de severidad y timestamp. |
| **Groq API** | Servicio de inferencia de LLMs en la nube con alta velocidad. Usado en `chatbot.service.js` para generar respuestas en lenguaje natural sobre el estado del conjunto residencial. |
| **LPR (License Plate Recognition)** | Módulo de visión artificial (`services/lpr/`) que procesa imágenes de cámaras para extraer el texto de la placa vehicular y cotejarlo con los vehículos autorizados en el sistema. |
| **Soft Delete** | Estrategia de eliminación que no borra el documento de la base de datos, sino que cambia su estado (`estado: 'inactivo'`). Permite recuperar datos eliminados por error. |
