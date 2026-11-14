FROM node:22-alpine
WORKDIR /app
COPY package.json server.js admin.html ./
COPY data ./data
COPY public ./public
ENV NODE_ENV=production DB_PATH=/data/orders.db PORT=3000
VOLUME /data
EXPOSE 3000
HEALTHCHECK CMD wget -qO- http://localhost:3000/healthz || exit 1
CMD ["node", "--no-warnings", "server.js"]
