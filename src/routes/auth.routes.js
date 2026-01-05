import express from "express";
import { getUSStates, register, login, logout, registerPlayer, loginPlayer, approvePlayer, rejectPlayer, getPendingPlayers, getTeams, getTeamById, registerWithPayment, verifyRegistrationStatus, registerJucoCoachaMedia } from "../controllers/auth.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";
import {validateRegister, validateLogin, validatePlayerRegister, validatePlayerLogin, validateRejectPlayer} from "../validation/auth.validation.js";
import { uploadFiles } from "../middleware/upload.middleware.js";
import { getUpcomingGames } from "../controllers/superAdmin/game.controller.js";
// import { getAllTeams, getTeamById, getPlayersByTeam, getTeamStatistics, getTeamPositions } from "../controllers/teamPlayers.controller.js";
import { handleOutsetaWebhook } from "../controllers/webhookHandler.controller.js";


const router = express.Router();

router.get('/states/us', getUSStates);

// Register
router.post("/register", uploadFiles.fields([{ name: "profileImage", maxCount: 1 }]), validateRegister, register);
router.post("/login", validateLogin, login);

router.post("/register-with-payment", uploadFiles.fields([{ name: "profileImage", maxCount: 1 }]), registerWithPayment);
router.get("/verify-registration", verifyRegistrationStatus);

router.post("/webhooks/outseta", express.json(), handleOutsetaWebhook);

router.post("/jucocoach-media-register", registerJucoCoachaMedia);

// Player registration
// router.post("/player/register", validatePlayerRegister, registerPlayer);
router.post("/player/register", uploadFiles.fields([{ name: "photoIdDocument", maxCount: 1 }]), validatePlayerRegister, registerPlayer);
router.get("/player/teams", getTeams);
router.get("/player/teams/:teamId", getTeamById);
router.post("/player/login", uploadFiles.fields([{ name: "photoIdDocument", maxCount: 1 }]), validatePlayerLogin, loginPlayer);

// Teams
// router.get("/teams", getAllTeams);
// router.get("/team/:teamId", getTeamById);
// router.get("/team/:teamId/players", getPlayersByTeam);
// router.get("/team/:teamId/statistics", getTeamStatistics);
// router.get("/team/:teamId/positions", getTeamPositions);


// ADMIN || Get all pending players
router.get("/admin/players/pending", authenticate, authorizeRoles("superAdmin", "scout", "coach"), getPendingPlayers);
// Approve player AND Reject player
router.patch("/admin/players/approve/:playerId", authenticate, authorizeRoles("superAdmin", "scout", "coach"), approvePlayer);
router.patch("/admin/players/reject/:playerId", authenticate, authorizeRoles("superAdmin", "scout", "coach"), validateRejectPlayer, rejectPlayer);

// Logout
router.post("/logout", authenticate, logout);

// Public routes
router.get("/games/upcoming", getUpcomingGames);




export default router;