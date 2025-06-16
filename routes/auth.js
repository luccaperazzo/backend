const express = require('express');
const router = express.Router();
const sendEmail = require('../utils/sendEmail');
const User = require('../models/User');
const jwt = require('jsonwebtoken'); 
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');


router.post('/register', async (req, res) => {
  try {
    const { nombre, apellido, email, password, confirmPassword, fechaNacimiento, role, zona, idiomas,presentacion } = req.body;

    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Las contraseñas no coinciden.' });
    }

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
    }    //Basicamente, se chequea si la request viene con un archivo de imagen
    let avatarUrl = null;
    if (req.files && req.files.avatar) {
      const file = req.files.avatar;
      
      // Validar tamaño del archivo (máximo 5MB)
      if (file.size > 5 * 1024 * 1024) {
        return res.status(400).json({ error: 'La imagen debe ser menor a 5MB' });
      }
      
      const ext = path.extname(file.name).toLowerCase();
      if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) { // Verifica la extensión del archivo, que sea válida
        return res.status(400).json({ error: 'Formato de imagen no permitido' });
      }
      const uploadDir = path.join(__dirname, '../uploads/perfiles'); // Se contstruye la ruta de subida y se guarda el file
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
      const filename = `${Date.now()}_${file.name}`;
      const savePath = path.join(uploadDir, filename);
      await file.mv(savePath);
      avatarUrl = `/uploads/perfiles/${filename}`;
    }

    // Armar objeto de usuario
    const userData = {
      nombre,
      apellido,
      email,
      password,
      fechaNacimiento,
      role,
      avatarUrl
    };

    // Si es entrenador, agregar zona e idiomas
    if (role === 'entrenador') {
      userData.zona = zona;
      // 👇 Parsear idiomas si viene como string (por FormData)
      if (typeof idiomas === "string") {
        try {
          userData.idiomas = JSON.parse(idiomas);
        } catch {
          userData.idiomas = [];
        }
      } else {
        userData.idiomas = idiomas;
      }
      userData.presentacion = presentacion;
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
    // Manejo de errores de validación de Mongoose
    if (err.name === "ValidationError" && err.errors) {
      // Tomar el primer mensaje de error de validación
      const firstError = Object.values(err.errors)[0];
      return res.status(400).json({ error: firstError.message });
    }
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email: new RegExp('^' + email + '$', 'i') });
    if (!user) return res.status(400).json({ error: 'Credenciales inválidas' });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(400).json({ error: 'Contraseña incorrecta' });
    console.log(isMatch)    // Generar token
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    );

  res.json({ 
    token,
    role: user.role, // 👈 agrega esto
    user: {
      _id: user._id,
      nombre: user.nombre,
      apellido: user.apellido,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl // <-- ahora se incluye el avatar
    }
  });
  } catch (err) {
    console.error('❌ Error en login:', err);
    res.status(500).json({ error: 'Error en login' });
  }
});

router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

  // Generar token y expiración
  const token = crypto.randomBytes(32).toString('hex');
  user.resetToken = token; // el user lo ubica por el mail que pones en el body del endpoint
  user.resetTokenExpires = Date.now() + 15 * 60 * 1000; // 15 minutos
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
 
  // Enviar email de control (opcional)
  await sendEmail(
    'testgymapi@gmail.com',
    `Copia - Recuperar contraseña de ${user.email}`,
    `<p>Este es un aviso automático de que el usuario <strong>${user.email}</strong> solicitó recuperar su contraseña.</p>
    <p>Enlace generado: <a href="${resetLink}">${resetLink}</a></p>`
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

  // Actualizar la contraseña y eliminar el token
  user.password = password;
  user.resetToken = undefined;
  user.resetTokenExpires = undefined;

  await user.save();

  res.json({ message: 'Contraseña actualizada con éxito' });
});
module.exports = router;


