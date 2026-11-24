"use client";

import { useEffect, useState } from "react";
import { todayIn } from "@/features/events/schemas";
import { createClient } from "@/lib/supabase/client";
import { localDb } from "./db";
import { getSelf, getSettings } from "./queries";
import { useLiveQuery } from "./use-live-query";

/** This device's profile from the local database (null before the first sync). */
export function useSelf() {
  return useLiveQuery(() => getSelf(localDb()), []);
}

export function useIsAdmin() {
  const self = useSelf();
  return self?.role === "admin" && !self.is_anonymous && self.status === "active";
}

export function useSettings() {
  return useLiveQuery(() => getSettings(localDb()), []);
}

/** Today's date in the church timezone, from the synced settings. */
export function useChurchToday() {
  const settings = useSettings();
  return settings ? todayIn(settings.timezone) : undefined;
}

/** The signed-in administrator's email, from the session cookie (works offline). */
export function useSessionEmail() {
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => {
    void createClient()
      .auth.getSession()
      .then(({ data }) => setEmail(data.session?.user.email || null));
  }, []);
  return email;
}
