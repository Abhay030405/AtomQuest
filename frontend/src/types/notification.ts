export interface Notification {
  id: string;
  userId: string;
  targetRole?: string;
  title: string;
  message: string;
  type: "info" | "warning" | "success" | "action";
  read: boolean;
  actionUrl?: string;
  createdAt: string;
}
