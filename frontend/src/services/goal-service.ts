import type { Goal } from "@/types/goal.types";
import { GoalStatus } from "@/types/goal.types";
import { mockGoals } from "@/mocks/mockGoals";

export const goalService = {
  getAll: async (): Promise<Goal[]> => mockGoals,

  getByUser: async (userId: string): Promise<Goal[]> =>
    mockGoals.filter((g) => g.userId === userId),

  getById: async (id: string): Promise<Goal | undefined> =>
    mockGoals.find((g) => g.id === id),

  create: async (
    payload: Omit<Goal, "id" | "version" | "status" | "isShared" | "createdAt" | "updatedAt">
  ): Promise<Goal> => ({
    ...payload,
    id: crypto.randomUUID(),
    version: 1,
    status: GoalStatus.DRAFT,
    isShared: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }),

  update: async (id: string, payload: Partial<Goal>): Promise<Goal> => {
    const goal = mockGoals.find((g) => g.id === id);
    if (!goal) throw new Error(`Goal ${id} not found`);
    return { ...goal, ...payload, updatedAt: new Date().toISOString() };
  },
};
