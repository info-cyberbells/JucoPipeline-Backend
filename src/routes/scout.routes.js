import express from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";
import { uploadProfile } from "../middleware/upload.middleware.js";
import { validateUpdateScoutProfile, validateForgotPassword, validateVerifyOtp, validateResetPassword } from "../validation/scoutProfile.validation.js";
import { getScoutDashboard, getSuggestedProfiles, followUser, unfollowUser, getFollowingList, getFollowersList, checkIfFollowing, getTopPlayers } from "../controllers/scout/scoutDashboard.controller.js";
import { getScoutProfile, updateScoutProfile, updateScoutProfileImage, deleteScoutProfileImage, resetPassword, forgotPassword, verifyOtp } from "../controllers/scout/scoutProfile.controller.js";
import { getPlayerById, getUncommittedPLayer, getTop10PlayersByMetric, getAvailableMetrics, searchPlayersForStatistics } from "../controllers/player/player.controller.js";
import { getAllTeams, getTeamRoster } from "../controllers/teams.controller.js";
import { getCoachStatistics } from "../controllers/coach/statistics.controller.js";
const router = express.Router();
router.use(authenticate, authorizeRoles("scout"));

// Owner Dashboard
router.get("/dashboard", getScoutDashboard);

// Profile
router.get("/profile", getScoutProfile);
router.patch("/profile", validateUpdateScoutProfile, updateScoutProfile);
router.patch( "/profile-image", uploadProfile.fields([{ name: "profileImage", maxCount: 1 }]), updateScoutProfileImage );
router.delete("/profile-image", deleteScoutProfileImage);
// router.put("/change-password", validateChangePassword, changePassword);

router.post("/forgot-password", validateForgotPassword, forgotPassword);
router.post("/verify-otp", validateVerifyOtp, verifyOtp);
router.put("/reset-password", validateResetPassword, resetPassword);

router.get("/suggestions", getSuggestedProfiles);
router.get("/top-players", getTopPlayers);
router.post("/follow/:userId", followUser);
router.delete("/unfollow/:userId", unfollowUser);
router.get("/following/check/:userId", checkIfFollowing);
router.get("/following", getFollowingList);
router.get("/followers", getFollowersList);

router.get("/player-profile/:playerId", getPlayerById);
router.get("/player-uncommitted", getUncommittedPLayer);
router.get("/teams", getAllTeams);
router.get("/team-roster/:teamId", getTeamRoster);

// Get top 10 players by metric
router.get("/statistics/top-players", getTop10PlayersByMetric);
router.get("/statistics/metrics", getAvailableMetrics);
router.get("/statistics/search", searchPlayersForStatistics);

// Get statistics
router.get("/statistics", getCoachStatistics);

export default router;