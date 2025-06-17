import { RequestHandler, Router } from "express";
import {
  getAllRequests,
  getRequestById,
  createRequest,
  updateRequestStatusById,
  deleteRequestById,
} from "../controllers/requests.controller.js";

const requestsRoutes = Router();

requestsRoutes.get("/", getAllRequests);
requestsRoutes.get("/:id", getRequestById as RequestHandler);
requestsRoutes.post("/", createRequest as RequestHandler);
requestsRoutes.put("/:id", updateRequestStatusById  as RequestHandler);
requestsRoutes.delete("/:id", deleteRequestById);

export default requestsRoutes;