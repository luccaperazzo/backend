const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Registro
router.post('/register', async (req, res) => {
  try {
    const { nombre, apellido, email, password, fechaNacimiento, role } = req.body;
    const user = new User({ nombre, apellido, email, password, fechaNacimiento, role });
    await user.save();
    res.status(201).json({ message: 'Usuario creado' });
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

module.exports = router;
