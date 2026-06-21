import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
    Generates a completely static version of the app
    inside the /out directory.

    Capacitor will copy this directory into the iOS app.
  */
  output: "export",

  /*
    Produces routes such as:

    /recipes/index.html
    /pantry/index.html

    This is more reliable inside a native WebView than
    routes ending in standalone .html files.
  */
  trailingSlash: true,

  /*
    Next.js's default image optimizer requires a running
    Next.js server, which is unavailable in a static app.
  */
  images: {
    unoptimized: true,
  },
};

export default nextConfig;