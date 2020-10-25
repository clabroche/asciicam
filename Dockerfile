FROM alpine:3.11 as builder
RUN apk --no-cache add gcc g++ make python nodejs npm

WORKDIR /asciicam
COPY package-lock.json ./package-lock.json
COPY package.json ./package.json
RUN npm ci
COPY . .

FROM alpine:3.11
RUN apk --no-cache add nodejs
WORKDIR /asciicam
RUN mkdir /asciicam/dist
COPY --from=builder /asciicam .

CMD ["node", "server.js"]
