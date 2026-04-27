/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['mammoth', 'pdfjs-dist', 'xlsx'],
  },
}

export default nextConfig;
