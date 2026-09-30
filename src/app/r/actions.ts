"use server";

import { redirect } from "next/navigation";
import { deleteReport } from "@/lib/repo";

export async function removeReport(id: string): Promise<void> {
  await deleteReport(id);
  redirect("/?supprime=1");
}
