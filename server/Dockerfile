FROM node:20-alpine

WORKDIR /app

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

COPY package*.json ./
RUN npm install --include=dev

COPY . .

# Generate Prisma client
RUN npx prisma generate

EXPOSE 4000

# Start command handles migrations and then starts the app
CMD npx prisma db push && npm run start
