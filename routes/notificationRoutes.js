const express = require("express");
const router = express.Router();
const notifications = require("../data/notifications");
const { requireMember } = require("../middleware/auth");
const { asyncHandler } = require("../middleware/asyncHandler");

router.get("/mine", requireMember, asyncHandler(async (req, res) => {
  const limit = req.query.limit ? Number(req.query.limit) : 50;
  const list = await notifications.getForMember(req.session.member.id, limit);
  res.json({ notifications: list });
}));

router.post("/mine/read-all", requireMember, asyncHandler(async (req, res) => {
  const updated = await notifications.markAllReadForMember(req.session.member.id);
  res.json({ updated, message: "Notifications marked as read." });
}));

module.exports = router;