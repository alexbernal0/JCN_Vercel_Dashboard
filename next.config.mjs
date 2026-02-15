/** @type {import('next').NextConfig} */

const nextConfig = {
  redirects: async () => {
    return [
      {
        source: "/",
        destination: "/overview",
        permanent: true,
      },
    ];
  },
  rewrites: async () => {
    return [
      {
        source: "/api/:path*",
        destination: "/api/index.py/:path*",
      },
    ];
  },
};

export default nextConfig;
