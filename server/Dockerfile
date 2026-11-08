FROM node:22-slim
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY src ./src
COPY migrations ./migrations
USER node
CMD ["node","src/index.js"]
