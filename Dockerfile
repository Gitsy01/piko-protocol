FROM node:20

WORKDIR /app

COPY package*.json ./
COPY turbo.json ./

COPY apps ./apps
COPY packages ./packages
COPY scripts ./scripts

RUN npm install

RUN cd packages/server && npx prisma generate

RUN npm run build

EXPOSE 3001

CMD ["node", "packages/server/dist/index.js"]