"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function setSignalStatus(id: string, status: "approved" | "rejected" | "new"): Promise<void> {
  if (!id) throw new Error("Missing id");

  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("raw_signals")
    .update({ status })
    .eq("id", id)
    .eq("owner_id", user.id);

  if (error) throw error;

  revalidatePath("/review");
}
