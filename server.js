require('dotenv').config();

const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');
const bodyParser = require("body-parser");
const fileUpload    = require('express-fileupload');

const app = express();

app.use(cors());

// Stripe necesita el cuerpo ANTES del json parser
app.use("/api/payment/webhook", bodyParser.raw({ type: "application/json" }));

app.use(express.json());
app.use(fileUpload({
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB límite
  abortOnLimit: true,
  responseOnLimit: "Archivo demasiado grande. Máximo 5MB permitido."
}));

// Rutas de autenticación
const authRoutes    = require('./routes/auth');
app.use('/api/auth', authRoutes);

// Rutas protegidas (middleware ejemplo)
const rutaProtegida = require('./routes/protected');
app.use('/api', rutaProtegida);

// Rutas de servicio
const serviceRoutes = require('./routes/service');
app.use('/api/service', serviceRoutes);

// Rutas de reserva (incluye endpoints de estado y comentarios)
const reservaRoutes = require('./routes/reserve');
app.use('/api/reserve', reservaRoutes);

// Inicializamos el cron que actualiza reservas automáticamente
require('./utils/cron');

// Rutas de entrenadores
const trainersRoutes = require('./routes/trainers');
app.use('/api/trainers', trainersRoutes);

// Rutas de pago
const paymentRoutes = require('./routes/payment');
app.use('/api/payment', paymentRoutes);

// Ruta de prueba
app.get('/api/ping', (req, res) => {
  res.json({ message: 'API funcionando 💪' });
});

app.use('/uploads/documentos', express.static(__dirname + '/uploads/documentos'));
app.use('/uploads/perfiles', express.static(__dirname + '/uploads/perfiles'));

// Ruta de desarrollo para poblar la base de datos
const devRoutes = require('./routes/dev');
app.use('/api/dev', devRoutes);

// Conexión a MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Conectado a MongoDB'))
  .catch((err) => console.error('❌ Error al conectar a MongoDB:', err));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});
