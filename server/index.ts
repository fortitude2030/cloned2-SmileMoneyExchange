import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { storage } from "./storage";

const app = express();

// Daily reset scheduler - actively resets all wallets at midnight
// Uses a more flexible approach to handle timezone differences
setInterval(async () => {
  try {
    // Check if any wallet needs reset based on lastResetDate comparison
    const { db } = await import("./db");
    const { users, wallets } = await import("../shared/schema");
    
    // Get all users with wallets and check if they need reset
    const allUsers = await db.select().from(users);
    let resetCount = 0;
    
    for (const user of allUsers) {
      const wallet = await storage.getOrCreateWallet(user.id);
      const now = new Date();
      const lastReset = new Date(wallet.lastResetDate);
      
      // Check if it's a new day (more reliable than time-based check)
      const nowDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const lastResetDateOnly = new Date(lastReset.getFullYear(), lastReset.getMonth(), lastReset.getDate());
      
      if (nowDateOnly.getTime() !== lastResetDateOnly.getTime()) {
        await storage.checkAndResetDailySpending(wallet);
        resetCount++;
      }
    }
    
    if (resetCount > 0) {
      log(`Daily reset completed for ${resetCount} users`);
    }
  } catch (error) {
    log(`Error during daily reset check: ${error}`);
  }
}, 10 * 60 * 1000); // Check every 10 minutes

// Transaction expiration cleanup - runs every 30 seconds
setInterval(async () => {
  try {
    await storage.markExpiredTransactions();
    await storage.expungeExpiredQrCodes();
  } catch (error) {
    log(`Error cleaning up expired transactions/QR codes: ${error}`);
  }
}, 30 * 1000); // Check every 30 seconds
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
