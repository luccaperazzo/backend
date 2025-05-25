// routes/payment.js

const express = require("express");
const router = express.Router();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const auth = require("../middleware/authMiddleware");
const User = require("../models/User");
const Service = require("../models/Service");

// Ruta protegida para crear sesión de pago con Stripe Checkout
router.post("/create-checkout-session", auth, async (req, res) => {
  const { serviceId } = req.body;

  if (!serviceId) {
    return res.status(400).json({ message: "Falta el ID del servicio" });
  }

  try {
    // Buscar el servicio y traer el entrenador vinculado
    const servicio = await Service.findById(serviceId).populate("entrenador", "nombre apellido");
    if (!servicio) {
      return res.status(404).json({ message: "Servicio no encontrado" });
    }

    const trainerName = `${servicio.entrenador.nombre} ${servicio.entrenador.apellido}`;
    const serviceName = servicio.titulo;

    // Buscar al cliente autenticado
    const cliente = await User.findById(req.user.userId);
    if (!cliente) {
      return res.status(404).json({ message: "Cliente no encontrado" });
    }

    // Crear un cliente real (customer) en Stripe
    const customer = await stripe.customers.create({
      email: cliente.email,
      name: `${cliente.nombre} ${cliente.apellido}`
    });

    // Crear la sesión de Stripe con el customer creado
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer: customer.id, // Asociamos el customer real
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `${serviceName} por ${trainerName}`
            },
            unit_amount: servicio.precio * 100 // Precio en centavos (Stripe lo requiere así)
          },
          quantity: 1
        }
      ],
      success_url: "http://localhost:3000/success", // URL a redirigir luego del pago exitoso
      cancel_url: "http://localhost:3000/cancel", // URL a redirigir si se cancela el proceso de pago
      metadata: {
        serviceId, // ID del servicio comprado (para usar luego en la reserva)
        userId: req.user.userId, // ID del cliente interno
        cliente: `${cliente.nombre} ${cliente.apellido} <${cliente.email}>`
      }
    });

    // Devolver la URL de la sesión de pago
    res.json({ url: session.url });
  } catch (err) {
    console.error("Error al crear checkout session:", err);
    res.status(500).json({ message: "Error interno en el pago" });
  }
});

module.exports = router;