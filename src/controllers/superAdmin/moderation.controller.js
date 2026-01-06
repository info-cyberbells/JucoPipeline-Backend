import Vehicle from "../../models/vehicle.model.js";
import User from "../../models/user.model.js";
import { createNotification } from "../../utils/createSystemNotification.js";

// Verify a vehicle
export const verifyVehicle = async (req, res) => {
  try {
    const authUser = req.user;
    const { vehicleId } = req.params;
    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) {
      return res.status(400).json({
        success: false,
        message: "Vehicle not found",
      });
    }

    // Check if already verified
    if (vehicle.isVerified === true && req.body.verified === true) {
      return res.status(400).json({
        success: false,
        message: "This vehicle is already verified. No further action required.",
      });
    }

    // Check if already rejected
    if (vehicle.isVerified === false && req.body.verified === false && vehicle.verifiedBy) {
      return res.status(400).json({
        success: false,
        message: "This vehicle has already been rejected.",
      });
    }

    vehicle.isVerified = req.body.verified;
    vehicle.remarks = req.body.remarks;  // remarks by admin
    vehicle.verifiedBy = authUser.id;
    vehicle.verifiedAt = new Date();

    await vehicle.save();

    await createNotification({
      userId: vehicle.ownerId, // driver who owns the vehicle
      title: req.body.verified ? "Vehicle Verified" : "Vehicle Rejected",
      message: req.body.verified
        ? "Your vehicle has been successfully verified by the admin."
        : `Your vehicle was rejected. Remarks: ${req.body.remarks || "No remarks"}`,
      type: "vehicle",
      relatedId: vehicle._id,
      onModel: "Vehicle",
    });

    return res.status(200).json({
      success: true,
      message: `Vehicle ${req.body.verified ? "verified" : "unverified"} successfully.`,
      data: vehicle,
    });
  } catch (error) {
    console.error("Error verifying vehicle:", error);
    return res.status(500).json({
      success: false,
      message: "Server error verifying vehicle",
    });
  }
};

export const updateDriverStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body; // "approve" or "reject"
    const user = await User.findById(id);

    if (!user || user.role !== "driver") {
      return res.status(400).json({ message: "Driver not found" });
    }

    // Check for duplicate actions
    if (action === "approve" && user.status === "approved") {
      return res.status(400).json({
        success: false,
        message: "This driver is already approved.",
      });
    }

    if (action === "reject" && user.status === "rejected") {
      return res.status(400).json({
        success: false,
        message: "This driver is already rejected.",
      });
    }

    if (action === "approve") {
      user.isActive = true;
      user.status = "approved";

      await createNotification({
        userId: user._id,
        title: "Profile Approved",
        message: "Your driver profile has been approved by the admin.",
        type: "profile",
        relatedId: user._id,
        onModel: "User",
      });
    } else if (action === "reject") {
      user.isActive = false;
      user.status = "rejected";

      await createNotification({
        userId: user._id,
        title: "Profile Rejected",
        message: "Your driver profile has been rejected by the admin.",
        type: "profile",
        relatedId: user._id,
        onModel: "User",
      });


    } else {
      return res.status(400).json({ message: "Invalid action" });
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: `Driver ${action}d successfully.`,
      driver: user
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
