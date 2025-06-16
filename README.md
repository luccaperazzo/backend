# 🔧 Backend - Fitness Platform API

API REST para la plataforma de fitness y entrenamiento personal.

## 🚀 Inicio Rápido

```powershell
# Instalar dependencias
npm install

# Configurar variables de entorno
copy .env.example .env
# Editar .env con tus configuraciones

# Ejecutar en desarrollo
npm start
# o con nodemon
npx nodemon server.js
```

## 📋 Variables de Entorno Requeridas

Crea un archivo `.env` en la raíz del backend:

```env
# Base de datos MongoDB
MONGO_URI=mongodb://localhost:27017/fitness-platform

# JWT Secret (genera uno seguro)
JWT_SECRET=tu_jwt_secret_muy_seguro_aqui

# Stripe (obtener de https://dashboard.stripe.com/test/apikeys)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...

# SendGrid para emails (opcional)
SENDGRID_API_KEY=SG.xxx...
FROM_EMAIL=noreply@tudominio.com

# Puerto del servidor
PORT=3001

# Ruta de uploads
UPLOAD_PATH=./uploads
```

## 🔗 Endpoints Principales

### 🔐 Autenticación
```http
POST   /api/auth/register       # Registrar usuario
POST   /api/auth/login          # Iniciar sesión
POST   /api/auth/forgot-password # Recuperar contraseña
POST   /api/auth/reset-password  # Restablecer contraseña
```

### 🏃 Servicios
```http
GET    /api/service/trainers     # Buscar entrenadores
POST   /api/service/create       # Crear servicio (entrenador)
GET    /api/service/:id          # Detalle servicio
GET    /api/service/:id/real-availability # Disponibilidad tiempo real
PUT    /api/service/:id          # Actualizar servicio
DELETE /api/service/:id          # Eliminar servicio
```

### 📅 Reservas
```http
GET    /api/reserve              # Listar reservas del usuario
POST   /api/reserve              # Crear reserva
PATCH  /api/reserve/:id/state    # Cambiar estado (aceptar/rechazar)
GET    /api/reserve/:id/documents # Listar documentos
POST   /api/reserve/:id/documents # Subir documento
GET    /api/reserve/:id/documents/:filename # Descargar
DELETE /api/reserve/:id/documents/:filename # Eliminar documento
```

### 💳 Pagos
```http
POST   /api/payment/create-checkout-session # Crear sesión Stripe
POST   /api/payment/webhook      # Webhook Stripe (para Stripe CLI)
```

### 👨‍🏫 Entrenadores
```http
GET    /api/trainers/top-trainers # Top 3 entrenadores
GET    /api/trainers/:id         # Perfil entrenador
GET    /api/trainers/:id/stats   # Estadísticas
GET    /api/trainers/:id/reviews # Reseñas
POST   /api/trainers/:id/reviews # Crear reseña
```

## 🧪 Testing

### Ping de salud
```http
GET /api/ping
```

### Poblar con datos de prueba
```http
POST /api/dev/seed
```

Esto crea:
- 2 clientes (juan@test.com, ana@test.com)
- 2 entrenadores (carlos@test.com, lucia@test.com)
- Servicios de ejemplo
- Contraseña para todos: `Test1234!`

## 📁 Estructura de Carpetas

```
backend/
├── config/              # Configuraciones
├── middleware/          # Middleware personalizado
│   ├── authMiddleware.js    # Autenticación JWT
│   └── validateReservation.js # Validación reservas
├── models/              # Modelos MongoDB
│   ├── User.js             # Usuarios (clientes/entrenadores)
│   ├── Service.js          # Servicios de entrenadores
│   ├── Reserve.js          # Reservas
│   ├── Rating.js           # Calificaciones
│   └── TrainerStats.js     # Estadísticas entrenadores
├── routes/              # Rutas de la API
│   ├── auth.js             # Autenticación
│   ├── service.js          # Servicios
│   ├── reserve.js          # Reservas
│   ├── payment.js          # Pagos Stripe
│   ├── trainers.js         # Entrenadores
│   └── dev.js              # Desarrollo/seeding
├── uploads/             # Archivos subidos
│   ├── perfiles/           # Avatares usuarios
│   ├── documentos/         # Documentos reservas
│   └── reservas/           # (legacy)
├── utils/               # Utilidades
│   ├── sendEmail.js        # Envío emails SendGrid
│   ├── stateMachine.js     # Estados de reservas
│   └── cron.js             # Tareas programadas
└── server.js            # Punto de entrada
```

## 🔑 Autenticación

El API usa JWT Bearer tokens:

```javascript
// Headers requeridos para rutas protegidas
{
  "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Roles de usuario:
- `cliente` - Puede reservar servicios, ver entrenadores
- `entrenador` - Puede crear servicios, gestionar reservas

## 🗄️ Modelos de Datos

### Usuario
```javascript
{
  nombre: String,
  apellido: String,
  email: String (unique),
  password: String (hashed),
  role: "cliente" | "entrenador",
  zona: String, // Para entrenadores
  idiomas: [String], // Para entrenadores
  presentacion: String, // Para entrenadores
  avatarUrl: String
}
```

### Servicio
```javascript
{
  titulo: String,
  descripcion: String,
  precio: Number,
  categoria: String,
  duracion: Number, // minutos
  presencial: Boolean,
  disponibilidad: Map, // { "Lunes": [["09:00", "17:00"]] }
  entrenador: ObjectId,
  publicado: Boolean,
  vistas: Number
}
```

### Reserva
```javascript
{
  cliente: ObjectId,
  servicio: ObjectId,
  fechaInicio: Date,
  duracion: Number,
  estado: "Pendiente" | "Aceptado" | "Cancelado" | "Finalizado",
  documentos: [String] // nombres de archivos
}
```

## 🔄 Estados de Reserva

```
Pendiente → Aceptado → Finalizado
    ↓          ↓
Cancelado  Cancelado
```

## 📧 Sistema de Emails

Eventos que disparan emails automáticos:
- Nueva reserva → Email al entrenador
- Reserva aceptada → Email al cliente  
- Reserva reprogramada → Email a ambos
- Recuperar contraseña → Email al usuario

## 🕐 Tareas Programadas (Cron)

- **Cada hora**: Actualiza reservas vencidas a "Finalizado"
- **Diario**: Limpia tokens expirados

## 🛠️ Scripts NPM

```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "seed": "curl -X POST http://localhost:3001/api/dev/seed"
  }
}
```

## 🐛 Debugging

### Logs importantes:
```javascript
// El servidor muestra logs como:
✅ Conectado a MongoDB
🚀 Servidor corriendo en puerto 3001
📧 Enviando email a usuario@email.com
📅 Reserva creada: ID_RESERVA
💳 Pago exitoso para sesión: SESSION_ID
```

### Variables de debugging:
```env
# Agregar al .env para más logs
DEBUG=app:*
NODE_ENV=development
```

## 🔐 Seguridad

- Contraseñas hasheadas con bcrypt (10 salt rounds)
- Tokens JWT con expiración 2 horas
- Validación de roles en rutas protegidas
- Sanitización de inputs con Joi
- Upload de archivos con validación de tipos
- CORS configurado para desarrollo

## ⚡ Performance

- Índices en MongoDB para queries frecuentes
- Lazy loading de relaciones con populate
- Compresión de respuestas
- Rate limiting (próximamente)

## 🔧 Configuración de Producción

Para producción, configurar:

```env
NODE_ENV=production
MONGO_URI=mongodb+srv://...atlas.mongodb.net/
JWT_SECRET=super_secret_production_key
```

Y considerar:
- HTTPS obligatorio
- Rate limiting
- Logs centralizados
- Monitoreo de salud
- Backup automatizado de DB
