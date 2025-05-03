require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());

// Rutas de autenticación
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// Rutas protegidas (middleware ejemplo)
const rutaProtegida = require('./routes/protegida');
app.use('/api', rutaProtegida);

// Rutas de servicio
const serviceRoutes = require('./routes/service');
app.use('/api/service', serviceRoutes);

const reservaRoutes = require('./routes/reserva');
app.use('/api/reserva', reservaRoutes);

const trainersRoutes = require('./routes/trainers');
app.use('/api/trainers', trainersRoutes);

// Ruta de prueba
app.get('/api/ping', (req, res) => {
  res.json({ message: 'API funcionando 💪' });
});

// Conexión a MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ Conectado a MongoDB'))
.catch((err) => console.error('❌ Error al conectar a MongoDB:', err));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});
