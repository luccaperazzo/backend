const express = require('express');
const router = express.Router();
const sendEmail = require('../utils/sendEmail');
const User = require('../models/User');
const jwt = require('jsonwebtoken'); // Asegúrate de tener instalado jwt (npm install jsonwebtoken)
const bcrypt = require('bcryptjs');

// Registro de usuario
router.post('/register', async (req, res) => {
  try {
    const { nombre, apellido, email, password, fechaNacimiento, role, zona, idiomas } = req.body;

    // Validar si el email ya existe
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email ya registrado' });
    }

    // Validar la fortaleza de la contraseña
    const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({ 
        error: 'La contraseña debe tener al menos 8 caracteres, una letra mayúscula, un número y un carácter especial.'
      });
    }

    // Armar objeto de usuario
    const userData = {
      nombre,
      apellido,
      email,
      password,
      fechaNacimiento,
      role
    };

    // Si es entrenador, agregar zona e idiomas
    if (role === 'entrenador') {
      userData.zona = zona;
      userData.idiomas = idiomas;
    }

    // Crear y guardar el usuario
    const user = new User(userData);
    await user.save();

    // Generar JWT
    const token = jwt.sign(
      { user: { id: user._id, role: user.role } },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Devolver usuario (sin password) + token
    res.status(201).json({
      user: {
        _id: user._id,
        nombre: user.nombre,
        apellido: user.apellido,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      },
      token
    });

  } catch (err) {
    console.error('❌ Error al registrar usuario:', err);
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

///CAMBIO CONTRASEÑA
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
  const resetLink = `http://localhost:3000/reset-password?token=${token}`;

  // Enviar email usando SendGrid
  await sendEmail(
    user.email,
    'Recuperar contraseña - Marketplace',
    `<p>Hacé clic <a href="${resetLink}">aquí</a> para restablecer tu contraseña.</p>
     <p>El link expira en 15 minutos.</p>`
  );

  res.json({ message: 'Email de recuperación enviado. Revisá tu bandeja.' });
});


router.post('/reset-password', async (req, res) => {
  const { token, password, confirmPassword } = req.body;

  // Verificar que las contraseñas coincidan
  if (password !== confirmPassword) {
    return res.status(400).json({ message: 'Las contraseñas no coinciden' });
  }

  // Buscar al usuario por el token y verificar si el token no ha expirado
  const user = await User.findOne({
    resetToken: token,
    resetTokenExpires: { $gt: Date.now() },  // Verificar si el token no ha expirado
  });

  if (!user) {
    return res.status(400).json({ message: 'Token inválido o expirado' });
  }

  // Encriptar la nueva contraseña
  const hashedPassword = await bcrypt.hash(password, 10);

  // Actualizar la contraseña y eliminar el token
  user.password = hashedPassword;
  user.resetToken = undefined;
  user.resetTokenExpires = undefined;

  await user.save();

  res.json({ message: 'Contraseña actualizada con éxito' });
});
module.exports = router;


