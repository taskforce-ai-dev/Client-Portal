/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      // Serve the cloned Sentinel admin portal (static, self-contained HTML).
      { source: "/admin", destination: "/admin/index.html" },
      { source: "/admin/login", destination: "/admin/login.html" },
    ];
  },
};

export default nextConfig;
