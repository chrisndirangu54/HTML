FROM node:22-alpine AS build
WORKDIR /srv/cms
RUN apk add --no-cache python3 make g++
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build
FROM node:22-alpine
WORKDIR /srv/cms
ENV NODE_ENV=production
COPY --from=build /srv/cms ./
USER node
EXPOSE 1337
CMD ["npm","run","start"]
