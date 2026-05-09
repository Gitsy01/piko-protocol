FROM node:20

WORKDIR /app

COPY package*.json ./
COPY turbo.json ./

COPY apps ./apps
COPY packages ./packages
COPY scripts ./scripts

RUN npm install

RUN npx prisma generate

EXPOSE 3001

CMD ["npm", "run", "dev:server"]