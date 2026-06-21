"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export default function DatabaseTestPage() {
  const [status, setStatus] = useState("Testing connection...");

  useEffect(() => {
    async function testConnection() {
      try {
        const { error } = await supabase.auth.getSession();

        if (error) {
          throw error;
        }

        setStatus("Supabase connection is working.");
      } catch (error) {
        console.error("Supabase connection error:", error);
        setStatus(
          "Supabase connection failed. Check the browser console.",
        );
      }
    }

    void testConnection();
  }, []);

  return (
    <header className="page-header">
      <div>
        <p className="eyebrow">Database</p>
        <h1>Supabase test</h1>
        <p className="subtitle">{status}</p>
      </div>
    </header>
  );
}