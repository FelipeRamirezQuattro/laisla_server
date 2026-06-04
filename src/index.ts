import express from "express";
import cors from "cors";
import { env } from "./config/env";
import { connectDatabase } from "./config/database";
import { errorHandler, notFound } from "./middleware/errorHandler";
import { authMiddleware } from "./middleware/auth";

// Routes
import authRoutes from "./routes/auth";
import productRoutes from "./routes/admin/products";
import tableRoutes from "./routes/admin/tables";
import orderRoutes from "./routes/admin/orders";
import clientRoutes from "./routes/admin/clients";
import providerRoutes from "./routes/admin/providers";
import cashClosingRoutes from "./routes/admin/cashClosings";
import dailyExpenseRoutes from "./routes/admin/dailyExpenses";
import eventRoutes from "./routes/admin/events";
import reservationRoutes from "./routes/admin/reservations";
import reportRoutes from "./routes/admin/reports";
import dashboardRoutes from "./routes/admin/dashboard";
import usersRoutes from "./routes/admin/users";
import projectsRoutes from "./routes/admin/projects";
import tasksRoutes from "./routes/admin/tasks";
import notificationsRoutes from "./routes/admin/notifications";
import { requireRole } from "./middleware/requireRole";
// Cost module routes
import rawMaterialsRoutes from "./costs/routes/rawMaterials.routes";
import laborOverheadRoutes from "./costs/routes/laborOverhead.routes";
import disposablePacksRoutes from "./costs/routes/disposablePacks.routes";
import recipesRoutes from "./costs/routes/recipes.routes";
import projectionsRoutes from "./costs/routes/projections.routes";
import actualResultsRoutes from "./costs/routes/actualResults.routes";
import inventoryRoutes from "./costs/routes/inventory.routes";
// Inventario diario routes
import inventarioDiarioInsumosRoutes from "./inventario/routes/insumos.routes";
import inventarioDiarioRevisionesRoutes from "./inventario/routes/revisiones.routes";
import inventarioDiarioAlertasRoutes from "./inventario/routes/alertas.routes";
import inventarioDiarioHistorialRoutes from "./inventario/routes/historial.routes";
import inventarioDiarioReportesRoutes from "./inventario/routes/reportes.routes";
import inventarioDiarioStockRoutes from "./inventario/routes/stock.routes";
import publicEventRoutes from "./routes/public/events";
import publicReservationRoutes from "./routes/public/reservations";
import publicEventBookingRoutes from "./routes/public/eventBookings";
import publicDinnerRoutes from "./routes/public/dinnerRegistrations";
import publicMenuRoutes from "./routes/public/menu";
import { applyTimezonePlugin } from "./utils/timezone";

// Must run after all model imports so every schema is patched
applyTimezonePlugin();

const app = express();
const allowedOrigins = env.CORS_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean);
const apiBasePaths = env.API_BASE_PATHS
  .split(",")
  .map((path) => path.trim())
  .filter(Boolean)
  .map((path) => `/${path.replace(/^\/+|\/+$/g, "")}`);

// Middleware
app.use(cors({
  origin: env.CORS_ORIGIN === "*" ? "*" : allowedOrigins,
  credentials: env.CORS_ORIGIN !== "*",
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

function mountApiRoutes(basePath: string) {
  // Health check
  app.get(`${basePath}/health`, (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Auth (public)
  app.use(`${basePath}/auth`, authRoutes);

  // Admin routes (protected)
  app.use(`${basePath}/admin/products`, authMiddleware, productRoutes);
  app.use(`${basePath}/admin/tables`, authMiddleware, tableRoutes);
  app.use(`${basePath}/admin/orders`, authMiddleware, orderRoutes);
  app.use(`${basePath}/admin/clients`, authMiddleware, clientRoutes);
  app.use(`${basePath}/admin/providers`, authMiddleware, providerRoutes);
  app.use(`${basePath}/admin/expenses`, authMiddleware, dailyExpenseRoutes);
  app.use(`${basePath}/admin/cashclosings`, authMiddleware, cashClosingRoutes);
  app.use(`${basePath}/admin/events`, authMiddleware, eventRoutes);
  app.use(`${basePath}/admin/reservations`, authMiddleware, reservationRoutes);
  app.use(`${basePath}/admin/reports`, authMiddleware, reportRoutes);
  app.use(`${basePath}/admin/dashboard`, authMiddleware, dashboardRoutes);
  app.use(`${basePath}/admin/users`, authMiddleware, usersRoutes);
  app.use(`${basePath}/admin/projects`, authMiddleware, requireRole('admin', 'superadmin'), projectsRoutes);
  app.use(`${basePath}/admin/tasks`, authMiddleware, tasksRoutes);
  app.use(`${basePath}/admin/notifications`, authMiddleware, notificationsRoutes);

  // Cost module
  app.use(`${basePath}/admin/raw-materials`, authMiddleware, requireRole('admin', 'superadmin'), rawMaterialsRoutes);
  app.use(`${basePath}/admin/labor-overhead-params`, authMiddleware, requireRole('admin', 'superadmin'), laborOverheadRoutes);
  app.use(`${basePath}/admin/disposable-packs`, authMiddleware, requireRole('admin', 'superadmin'), disposablePacksRoutes);
  app.use(`${basePath}/admin/recipes`, authMiddleware, requireRole('admin', 'superadmin'), recipesRoutes);
  app.use(`${basePath}/admin/projections`, authMiddleware, requireRole('admin', 'superadmin'), projectionsRoutes);
  app.use(`${basePath}/admin/results`, authMiddleware, requireRole('admin', 'superadmin'), actualResultsRoutes);
  app.use(`${basePath}/admin/inventory`, authMiddleware, requireRole('admin', 'superadmin'), inventoryRoutes);

  // Inventario diario
  app.use(`${basePath}/admin/inventario-diario/insumos`, authMiddleware, requireRole('admin', 'superadmin'), inventarioDiarioInsumosRoutes);
  app.use(`${basePath}/admin/inventario-diario/revisiones`, authMiddleware, requireRole('admin', 'superadmin'), inventarioDiarioRevisionesRoutes);
  app.use(`${basePath}/admin/inventario-diario/alertas`, authMiddleware, requireRole('admin', 'superadmin'), inventarioDiarioAlertasRoutes);
  app.use(`${basePath}/admin/inventario-diario/historial`, authMiddleware, requireRole('admin', 'superadmin'), inventarioDiarioHistorialRoutes);
  app.use(`${basePath}/admin/inventario-diario/reportes`, authMiddleware, requireRole('admin', 'superadmin'), inventarioDiarioReportesRoutes);
  app.use(`${basePath}/admin/inventario-diario/stock`, authMiddleware, requireRole('admin', 'superadmin'), inventarioDiarioStockRoutes);

  // Public routes
  app.use(`${basePath}/public/events`, publicEventRoutes);
  app.use(`${basePath}/public/menu`, publicMenuRoutes);
  app.use(`${basePath}/public/reservations`, publicReservationRoutes);
  app.use(`${basePath}/public/events`, publicEventBookingRoutes);
  app.use(`${basePath}/public/dinner-registrations`, publicDinnerRoutes);
}

apiBasePaths.forEach(mountApiRoutes);

// 404 and error handler
app.use(notFound);
app.use(errorHandler);

// Start server
connectDatabase().then(() => {
  app.listen(env.PORT, () => {
    console.log(`🚀 La Isla Cafe backend running on port ${env.PORT}`);
    console.log(`   Environment: ${env.NODE_ENV}`);
  });
});

export default app;
