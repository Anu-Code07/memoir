import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Required for @memoir packages to work with Turbopack
  transpilePackages: ["@getmemoir/vercel-ai-provider", "@getmemoir/sdk", "react-data-grid"],
  images: {
    remotePatterns: [
      {
        hostname: "avatar.vercel.sh",
      },
      {
        protocol: "https",
        //https://nextjs.org/docs/messages/next-image-unconfigured-host
        hostname: "*.public.blob.vercel-storage.com",
      },
    ],
  },
};

export default nextConfig;
