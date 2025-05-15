import { RequestHandler } from "express";
import prisma from "../prisma-client/prisma-client.js";

// ensure device user
export const ensureDeviceUser: RequestHandler = async (req, res, next) => {
  const deviceId = req.header("X-Device-ID");

  if (!deviceId) {
    res.status(400).json({ message: "Missing X-Device-ID header" });
    return;
  }

  try {
    // Use as any to bypass TypeScript checking until the declaration file works
    (req as any).deviceId = deviceId;

    await prisma.deviceUser.upsert({
      where: { deviceId },
      update: {},
      create: { deviceId },
    });

    next();
  } catch (error) {
    console.error("Failed to ensure DeviceUser:", error);
    res.status(500).json({ message: "Internal server error" });
    return;
  }
};