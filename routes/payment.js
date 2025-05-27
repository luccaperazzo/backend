// routes/payment.js

const express = require("express");
const router = express.Router();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const bodyParser = require("body-parser");
const auth = require("../middleware/authMiddleware");
const User = require("../models/User");
const Service = require("../models/Service");
const Reserva = require("../models/Reserva");



// Ruta protegida para crear sesión de pago con Stripe Checkout
router.post('/create-checkout-session', auth, async (req, res) => {
  const { serviceId, fechaInicio } = req.body;

  if (!serviceId || !fechaInicio) {
    return res.status(400).json({ message: "Faltan datos: serviceId o fechaInicio" });
  }

  // Validá que fechaInicio sea una ISO válida
  const inicioDate = new Date(fechaInicio);
  if (isNaN(inicioDate.valueOf())) {
    return res.status(400).json({ message: "Formato de fecha/hora inválido" });
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
        fechaInicio, // Fecha de inicio de la reserva (puede ser modificada luego)
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

// -------------------------
// WEBHOOK DE STRIPE
// -------------------------
// Esta ruta escucha eventos automáticos desde Stripe
router.post("/webhook", bodyParser.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Error al verificar firma del webhook:", err);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    try {
      const { serviceId, userId, fechaInicio } = session.metadata;

      // Se crea la reserva una vez confirmado el pago en Stripe
      // La reserva queda en estado PENDIENTE
      await Reserva.create({
        cliente: userId,
        servicio: serviceId,
        fechaInicio: new Date(fechaInicio)
      });

      console.log("Reserva creada tras pago exitoso");
    } catch (err) {
      console.error("Error al crear reserva desde webhook:", err);
    }
  }

  res.status(200).json({ received: true });
});

module.exports = router;