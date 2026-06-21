"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      console.warn("Service workers are not supported in this browser.");
      return;
    }

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        console.log(
          "Service worker registered successfully:",
          registration.scope,
        );
      })
      .catch((error: unknown) => {
        console.error("Service worker registration failed:", error);
      });
  }, []);

  return null;
}