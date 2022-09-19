FROM node:alpine3.15

# Create app directory
RUN mkdir -p /usr/src/app

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json /usr/src/app/

RUN npm install
# If you are building your code for production
# RUN npm ci --only=production

# Bundle app source
COPY . /usr/src/app

# SSL certification creation
RUN apk add openssl
RUN mkdir -p cert ; `openssl req -x509 -nodes -days 360 -newkey rsa:2048 -keyout ./cert/key.pem -out ./cert/cert.pem -subj "/C=FR/ST=Rhone/L=Lyon/O=42Lyon/CN=mdesoeuv"`

EXPOSE 3000
CMD [ "node", "dist/src/main.js" ]