import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
  },
  /**
   * Where the build goes. `.next` unless told otherwise.
   *
   * `next dev` and `next build` both own `.next`, and a dev server left
   * running rewrites it under a production build: the page then renders but
   * never hydrates, because the manifest names chunks the other build
   * renamed. Nothing on the page works and nothing says why. Build somewhere
   * else to test against a dev server that is still up:
   *
   *   NEXT_DIST_DIR=.next-test npm run build && NEXT_DIST_DIR=.next-test npm start
   */
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
