import { Router } from "express";
import { storage } from "../storage";

const router = Router();

// GET /api/history - Get all care history logs for the current user
router.get("/", async (req, res) => {
  try {
    // Clerk auth: userId comes from req.auth.userId (string), convert to number for DB lookup
    const clerkUserId = req.auth?.userId;
    if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });

    // Lookup numeric user ID from Clerk ID
    const user = await storage.getUserByClerkId(clerkUserId);
    if (!user) return res.status(404).json({ error: "User not found" });

    // Debug: Log user.id value and type
    console.log('[GET /api/history] user.id:', user.id, 'type:', typeof user.id);
    // Fetch all care history logs for the user
    const careHistory = await storage.getAllUserCareHistory(user.id);

    // Enrich with plant info (name, image, acquiredDate, lastWatered)
    const logs = await Promise.all(
      careHistory.map(async (log) => {
        const plant = await storage.getPlantById(log.plantId.toString());
        return {
          id: log.id,
          plantName: plant?.name || "Unknown Plant",
          plantImage: plant?.api_image_url || undefined,
          actionType: log.actionType,
          actionTime: log.performedAt,
          notes: log.notes || undefined,
          dateAdded: plant?.acquiredDate || undefined,
          lastWatered: plant?.lastWatered || undefined,
        };
      })
    );

    res.json({ logs });
  } catch (err) {
    console.error("[GET /api/history] Error:", err);
    res.status(500).json({ error: "Failed to fetch activity history" });
  }
});

export default router;
