FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /asciicam

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY server.js ./
COPY src ./src

USER node
EXPOSE 2525
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:2525/ >/dev/null || exit 1
CMD ["node", "server.js"]
