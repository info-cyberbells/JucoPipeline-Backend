import express from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";
import { getProfile, updateProfile, changePassword } from "../controllers/profile.controller.js";
import { validateChangePassword } from "../validation/profile.validation.js";
import { getPendingApprovals, getUserDetails, approveUser, rejectUser, getPendingCounts} from "../controllers/superAdmin/superAdmin.controller.js";
import { getAllUsers, updateUser, updateUserStatus, manualEditListing } from "../controllers/superAdmin/userManagement.controller.js";
import { getAllScrapeJobs, getScrapeJobById, deleteScrapeJob, getScrapeJobsStats, updateScrapeJob, getAllUsersByRole } from "../controllers/superAdmin/scrapeJobs.controller.js";
import { createGame, getAllGames, getGameById, updateGame, deleteGame, getGameStatistics, bulkDeleteGames, updateGameStatus,  } from "../controllers/superAdmin/game.controller.js";
import { validateCreateGame, validateUpdateGame, validateUpdateStatus, validateBulkDelete} from "../validation/game.validation.js";
import { validateUpdateUser } from "../validation/userManagement.validation.js";
import { validateUpdateScrapeJob } from "../validation/superAdmin/scrapeJob.validation.js";
const router = express.Router();

// Protect all routes with superAdmin role
router.use(authenticate, authorizeRoles("superAdmin"));
// router.use(authorizeRoles("superAdmin", "coach", "scout"));  // PENDING FOR TESTING : Refrence for future use

// Super Admin Dashboard
// router.get("/dashboard", (req, res) => {
//   res.json({ message: "Super Admin Panel Access Granted" });
// });

// =================== Profile ===================
router.get("/profile", getProfile);
router.put("/profile", updateProfile);
router.put("/change-password", validateChangePassword, changePassword);

// Get pending approval counts
router.get("/pending-counts", getPendingCounts);

// Get all pending approvals (with pagination and filters)
router.get("/dashboard", getPendingApprovals);
// Profile Verifications
router.get("/pending-approvals", getPendingApprovals);

// Get user details (View Profile)
router.get("/users/:userId", getUserDetails);

// Approve user
router.patch("/approve/:userId", approveUser);

// Reject user
router.patch("/reject/:userId", rejectUser);

// Games
router.get("/games", getAllGames);
router.post("/game/create",validateCreateGame, createGame);
router.get("/statistics", getGameStatistics);
router.get("/game/:gameId", getGameById);
router.patch("/game/:gameId", validateUpdateGame, updateGame );
router.patch("/game/:gameId/status", validateUpdateStatus, updateGameStatus);
router.delete("/game/:gameId", deleteGame);
router.post("/games/bulk-delete",validateBulkDelete,bulkDeleteGames);

// Manual Edits User Management
router.get("/manual-edits/users", manualEditListing);
router.patch("/manual-edits/users/:userId", validateUpdateUser, updateUser);

// Scrape JOBs
router.get("/scrape-jobs", getAllScrapeJobs);
router.get("/scrape-jobs/stats", getScrapeJobsStats);
router.get("/scrape-jobs/:jobId", getScrapeJobById);
router.patch("/scrape-jobs/:jobId", validateUpdateScrapeJob, updateScrapeJob);
router.delete("/scrape-jobs/:jobId", deleteScrapeJob);

// All Users
router.get("/get-users-by-roles", getAllUsersByRole);

export default router;
