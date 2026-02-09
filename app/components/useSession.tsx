"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type SessionState = {
  loading: boolean;
  userId?: string;
  email?: string;
};

export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({ loading: true });

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const user = data.session?.user;
      setState({
        loading: false,
        userId: user?.id,
        email: user?.email ?? undefined,
      });
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user;
      setState({
        loading: false,
        userId: user?.id,
        email: user?.email ?? undefined,
      });
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  return state;
}
