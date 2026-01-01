import Notification from "../models/systemNotification.model.js";

export const createNotification = async ({ userId, title, message, type, relatedId, onModel }) => {
  try {
    const notif = new Notification({
      userId,
      title,
      message,
      type,
      relatedId,
      onModel,
    });
    await notif.save();
  } catch (error) {
    console.error("Error creating notification:", error);
  }
};
