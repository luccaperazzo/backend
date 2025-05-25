const express = require("express");
const router = express.Router();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY); // Se importa Stripe usando la clave secreta del .env
const auth = require("../middleware/authMiddleware");


router.post("/create-checkout-session", auth, async (req, res) => {
  const { serviceId, serviceName, amount } = req.body;

  // Verificar que haya datos suficientes
  if (!serviceId || !amount) {
    return res.status(400).json({ message: "Faltan datos del servicio" });
  }

  try {
    // Crear sesión de pago en Stripe
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"], // Acepta tarjeta de crédito/débito
      mode: "payment", // Modo de pago único (no suscripción)
      line_items: [
        {
          price_data: {
            currency: "usd", // Moneda en dólares estadounidenses
            product_data: {
              name: serviceName || `Servicio ID ${serviceId}` // Nombre que aparece en el checkout
            },
            unit_amount: amount * 100 // Stripe trabaja en centavos (ej. 5000 = 50.00 USD)
          },
          quantity: 1
        }
      ],
      success_url: "http://localhost:3000/success", // Redirige aquí si el pago fue exitoso
      cancel_url: "http://localhost:3000/cancel" // Redirige aquí si el usuario cancela
    });

    // Respondemos con la URL que redirige al formulario de pago de Stripe
    res.json({ url: session.url });
  } catch (err) {
    // Si algo falla, mostramos el error por consola y avisamos al frontend
    console.error("Error en Stripe:", err);
    res.status(500).json({ error: "Fallo al crear sesión de pago" });
  }
});

module.exports = router;