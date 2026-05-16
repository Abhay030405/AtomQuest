import { format, parseISO, isAfter, isBefore } from "date-fns";

export const formatDate = (iso: string, fmt = "dd MMM yyyy") =>
  format(parseISO(iso), fmt);

export const isOverdue = (dueDate: string) => isBefore(parseISO(dueDate), new Date());

export const isUpcoming = (date: string) => isAfter(parseISO(date), new Date());
