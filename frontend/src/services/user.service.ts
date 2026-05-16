import { mockUsers } from "@/mocks/mockUsers";
import { mockRequestOrThrow } from "./api.client";

export const userService = {
  getDirectReports: (managerId: string) =>
    mockRequestOrThrow(() => mockUsers.filter((u) => u.managerId === managerId)),

  getUserById: (userId: string) =>
    mockRequestOrThrow(() => mockUsers.find((u) => u.id === userId) ?? null),
};
