import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
    Keep the application statically exportable for PWA hosting.
    The generated site is written to the /out directory.
  */
  output: "export",

  /*
    Produces directory-style routes such as /recipes/index.html.
    This keeps direct navigation reliable on static hosts.
  */
  trailingSlash: true,

  /*
    Next.js image optimization requires a running Next.js server.
    Static PWA deployments therefore use unoptimized images.
  */
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
