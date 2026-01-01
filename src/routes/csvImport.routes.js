import express from "express";
import { importCSV, uploadAndImportCSV, getPlayerStats, getImportLogs, getImportLogById, cleanupOldLogs } from "../controllers/csvImport.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";
import { uploadCSV } from "../middleware/csvUpload.middleware.js";

const router = express.Router();

// Import from server file system (admin only)
router.post(
  "/import-from-directory",
  authenticate,
  authorizeRoles("superAdmin", "coach", "scout"),
  importCSV
);

// Upload and import CSV (admin only)
router.post(
  "/upload-import",
  authenticate,
  authorizeRoles("superAdmin", "coach", "scout"),
  uploadCSV.single("csvFile"),
  uploadAndImportCSV
);

// Get player stats (authenticated users)
router.get(
  "/player/:playerId/stats",
  authenticate,
  getPlayerStats
);

// Log management routes
router.get('/import-logs', getImportLogs);
router.get('/import-logs/:logId', getImportLogById);
router.delete('/import-logs/cleanup', cleanupOldLogs);

export default router;