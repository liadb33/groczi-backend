import prisma from "../../shared/prisma-client/prisma-client.js";

export const findByUsername = async (username: string) => {
  const users = await prisma.users.findMany({
    where: {
      username,
    },
  });
  return users[0];
};
export const insertUser = async (username: string, passwordHash: string) => {
  const user = await prisma.users.create({
    data: {
      username,
      passwordHash,
    },
  });
  return user.id;
};

export const updateLastLogin = async (userId: number) => {
  await prisma.users.update({
    where: {
      id: userId,
    },
    data: {
      lastLogin: new Date(),
    },
  });
};