import express from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";
import { uploadProfile } from "../middleware/upload.middleware.js";
import { getCoachDashboard, getSuggestedProfiles, followUser, unfollowUser, getFollowingList, getFollowersList, checkIfFollowing, getTopPlayers } from "../controllers/coach/coachDashboard.controller.js";
import { getCoachProfile, updateCoachProfile, updateCoachProfileImage, deleteCoachProfileImage, changePassword } from "../controllers/coach/coachProfile.controller.js";
import { validateUpdateCoachProfile, validateChangePassword } from "../validation/coachProfile.validation.js";
import { getTeamRoster } from "../controllers/teams.controller.js";
import { getPlayerById, getUncommittedPLayer, getTop10PlayersByMetric, getAvailableMetrics, searchPlayersForStatistics } from "../controllers/player/player.controller.js";

const router = express.Router();
// Protect all routes with coach role
router.use(authenticate, authorizeRoles("coach"));

// Coach Dashboard
router.get("/dashboard", getCoachDashboard);

// Profile
router.get("/profile", getCoachProfile);
router.patch("/profile", validateUpdateCoachProfile, updateCoachProfile);
router.patch( "/profile-image", uploadProfile.fields([{ name: "profileImage", maxCount: 1 }]), updateCoachProfileImage );
router.delete("/profile-image", deleteCoachProfileImage);
router.put("/change-password", validateChangePassword, changePassword);

// Get suggested profiles to follow
router.get("/suggestions", getSuggestedProfiles);
router.get("/top-players", getTopPlayers);
router.post("/follow/:userId", followUser);
router.delete("/unfollow/:userId", unfollowUser);
router.get("/following/check/:userId", checkIfFollowing);
// Get following list
router.get("/following", getFollowingList);
// Get followers list
router.get("/followers", getFollowersList);


// Get followed players stats (for dashboard table)
// router.get("/players/stats", getFollowedPlayersStats);
router.get("/player-profile/:playerId", getPlayerById);
router.get("/player-uncommitted", getUncommittedPLayer);

// Get top 10 players by metric
router.get("/statistics/top-players", getTop10PlayersByMetric);
router.get("/statistics/metrics", getAvailableMetrics);
router.get("/statistics/search", searchPlayersForStatistics);

// Teams
router.get("/team-roster/:teamId", getTeamRoster);

export default router;