FROM node:alpine3.15

# Create app directory
WORKDIR /app
RUN mkdir -p uploads

# Install app dependencies
COPY package*.json .

RUN npm i -g @nestjs/cli
RUN npm i

# Bundle app source
COPY . .

# Build package
RUN npm run build

EXPOSE 3000
CMD npm run start