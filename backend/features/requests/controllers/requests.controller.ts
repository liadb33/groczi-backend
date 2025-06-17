import { Request, Response, NextFunction } from "express";
import {
  findAllRequests,
  findRequestById,
  insertRequest,
  updateRequest,
  deleteRequest,
} from "../repositories/requests.repository.js";

export const getAllRequests = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const requests = await findAllRequests();
    res.json(requests);
  } catch (err) {
    next(err);
  }
};

export const getRequestById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    const request = await findRequestById(id);
    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }
    res.json(request);
  } catch (err) {
    next(err);
  }
};

export const createRequest = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { itemId, deviceId, reqSubject, reqBody } = req.body;
    if (!itemId || !deviceId || !reqSubject || !reqBody ) 
      return res.status(400).json({ message: "All fields are required" });
    
  
    const newRequest = await insertRequest(itemId, deviceId, reqSubject, reqBody);
    res.status(201).json(newRequest);
  } catch (err) {
    next(err);
  }
};

export const updateRequestById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    const { reqSubject, reqBody, requestStatus } = req.body;
    if (!reqSubject || !reqBody || !requestStatus) {
      return res.status(400).json({ message: "reqSubject, reqBody and requestStatus are required" });
    }

    const validStatuses = ["נשלחה", "בטיפול", "טופל", "נדחתה"];
    if (!validStatuses.includes(requestStatus)) {
      return res.status(400).json({ message: "Invalid requestStatus value" });
    }

    const updated = await updateRequest(id, reqSubject, reqBody, requestStatus);
    res.json(updated);
  } catch (err) {
    next(err);
  }
};

export const deleteRequestById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    await deleteRequest(id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};