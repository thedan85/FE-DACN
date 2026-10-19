import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "res.cloudinary.com",
                pathname: "/ibk3z2nt/**",
            },
        ],
    },
    logging: {
        fetches: {
            fullUrl: true,
            hmrRefreshes: true,
        }
    }
};

export default nextConfig;
