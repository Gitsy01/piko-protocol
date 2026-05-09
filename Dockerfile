FROM node:20

WORKDIR /app

COPY package*.json ./
COPY turbo.json ./

COPY apps ./apps
COPY packages ./packages
COPY scripts ./scripts
COPY tsconfig.json ./

RUN npm install

RUN npm run build

EXPOSE 3001

CMD ["npm", "run", "dev:server"]