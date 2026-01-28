FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5173

# Using dev mode as per plan for now, can be optimized for prod later
CMD ["npm", "run", "dev", "--", "--host"]
