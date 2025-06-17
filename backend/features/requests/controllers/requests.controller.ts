import { Request, Response, NextFunction } from "express";
import {
  findAllRequests,
  findRequestById,
  insertRequest,
  updateRequestStatus,
  deleteRequest,
  updateAllRequestsStatus,
} from "../repositories/requests.repository.js";
import { ReqStatus } from "@prisma/client";


const mapReqStatusToHebrew = (status: string) => {
  switch (status) {
    case "SENT":
      return "נשלחה";
    case "IN_PROGRESS":
      return "בטיפול";
    case "DONE":
      return "טופל";
    default:
      return status;
  }
};

export const getAllRequests = async (req: Request, res: Response, next: NextFunction) => {
  try {

    await updateAllRequestsStatus(ReqStatus.IN_PROGRESS);
    const requests = await findAllRequests();
    const finalRequests = requests.map(r => ({
      ...r,
      reqStatus: mapReqStatusToHebrew(r.reqStatus),
    }));
    res.json(finalRequests);
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
    if (!itemId || !deviceId || !reqSubject || !reqBody)
      return res.status(400).json({ message: "All fields are required" });


    const newRequest = await insertRequest(itemId, deviceId, reqSubject, reqBody);
    res.status(201).json(newRequest);
  } catch (err) {
    next(err);
  }
};

export const updateRequestStatusById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    const { requestStatus } = req.body;
    if (!requestStatus)
      return res.status(400).json({ message: "reqSubject, reqBody and requestStatus are required" });


    const validStatuses = ["טופל", "בטיפול", "נדחתה"];
    if (!validStatuses.includes(requestStatus))
      return res.status(400).json({ message: "Invalid requestStatus value" });


    const updated = await updateRequestStatus(id, requestStatus);
    res.json(updated);
  } catch (err) {
    next(err);
  }
};

export const deleteRequestById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    await deleteRequest(id);
    res.status(204).send("Request deleted succesfully");
  } catch (err) {
    next(err);
  }
};