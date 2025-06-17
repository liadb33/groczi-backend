import prisma from "../../shared/prisma-client/prisma-client.js";
import { ReqStatus } from ".prisma/client/index.js";

export const findAllRequests = async () => {
  return prisma.requests.findMany();
};

export const findRequestById = async (id: number) => {
  return prisma.requests.findUnique({where: { id },});
};

export const insertRequest = async (
  itemId: string,
  deviceId: string,
  reqSubject: string,
  reqBody: string,
) => {
  return prisma.requests.create({
    data: {
      itemId,
      deviceId,
      reqSubject,
      reqBody,
      createdAt: new Date(),
    },
  });
};

export const updateRequestStatus = async (
  id: number,
  reqStatus: ReqStatus
) => {
  return prisma.requests.update({
    where: { id },
    data: {
      reqStatus,
    },
  });
};

export const deleteRequest = async (id: number) => {
  return prisma.requests.delete({
    where: { id },
  });
};