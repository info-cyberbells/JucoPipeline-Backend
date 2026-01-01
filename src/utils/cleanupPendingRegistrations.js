import PendingRegistration from "../models/pendingRegistration.model.js";

export const cleanupOldPendingRegistrations = async () => {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const result = await PendingRegistration.deleteMany({
      status: "pending_payment",
      createdAt: { $lt: oneHourAgo }
    });

    console.log(`🧹 Cleaned up ${result.deletedCount} old pending registrations`);
    return result.deletedCount;
  } catch (error) {
    console.error("Cleanup error:", error);
    return 0;
  }
};

// Run every hour
setInterval(cleanupOldPendingRegistrations, 60 * 60 * 1000);