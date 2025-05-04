const express = require('express');
const router = express.Router();
const sendEmail = require('../utils/sendEmail');
const User = require('../models/User');
const jwt = require('jsonwebtoken'); // Asegúrate de tener instalado jwt (npm install jsonwebtoken)

// Registro de usuario
router.post('/register', async (req, res) => {
  try {
    const { nombre, apellido, email, password, fechaNacimiento, role } = req.body;

    // Validar si el email ya existe
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email ya registrado' });
    }

    // Crear usuario
    const user = new User({ nombre, apellido, email, password, fechaNacimiento, role });
    await user.save();

    // Generar token JWT
    const token = jwt.sign(
      { user: { id: user._id } }, 
      process.env.JWT_SECRET, // Añade JWT_SECRET a tu .env
      { expiresIn: '1h' }
    );

    // Respuesta con datos del usuario y token (sin password)
    res.status(201).json({
      user: {
        nombre: user.nombre,
        apellido: user.apellido,
        email: user.email,
        role: user.role,
        _id: user._id,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      },
      token
    });

  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: 'Email ya registrado' });
    }
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: 'Credenciales inválidas' });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(400).json({ error: 'Credenciales inválidas' });

    // Generar token
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '10d' }
    );

    res.json({ token });
  } catch (err) {
    console.error('❌ Error en login:', err);
    res.status(500).json({ error: 'Error en login' });
  }
});

/*
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

  // Generar token y expiración
  const token = crypto.randomBytes(32).toString('hex');
  user.resetToken = token;
  user.resetTokenExpires = Date.now() + 15 * 60 * 1000; // 15 min
  await user.save();

  // Link de recuperación (ajustá tu dominio/frontend)
  const resetLink = `https://tu-frontend.com/reset-password?token=${token}`;

  // Enviar email usando SendGrid
  await sendEmail(
    user.email,
    'Recuperar contraseña - Marketplace',
    `<p>Hacé clic <a href="${resetLink}">aquí</a> para restablecer tu contraseña.</p>
     <p>El link expira en 15 minutos.</p>`
  );

  res.json({ message: 'Email de recuperación enviado. Revisá tu bandeja.' });
});
module.exports = router;
*/

