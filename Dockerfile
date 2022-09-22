FROM node:alpine3.15

# Create app directory
WORKDIR /app
RUN mkdir -p uploads

# Install app dependencies
COPY package*.json .

RUN npm install -g @nestjs/cli
RUN npm install

# Bundle app source
COPY . .

# Build package
RUN npm run build

# SSL certification creation
# RUN apk add openssl
# RUN mkdir -p cert ; `openssl req -x509 -nodes -days 360 -newkey rsa:2048 -keyout ./cert/key.pem -out ./cert/cert.pem -subj "/C=FR/ST=Rhone/L=Lyon/O=42Lyon/CN=mdesoeuv"`

EXPOSE 3000
CMD npm run start