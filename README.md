# Ressources

- https://docs.nestjs.com (NestJS Docs)
- https://wanago.io/2021/01/25/api-nestjs-chat-websockets/ (Realtime chat with sockets and database saves)
- https://wanago.io/2021/03/08/api-nestjs-two-factor-authentication/ (2FA Routes)

# Endpoints

### AppController {/}

### UsersController {/users}
- GET     /users
- GET	  users/leaderboard
- GET     /users/:id
- POST    /users/register
- DELETE  /users/:id
- POST    /users/avatar/me
- GET     /users/avatar/:user
- GET     /users/:userid/channels
- GET     /users/:userid/friends
- POST    /users/:userid/friends
- DELETE  /users/:userid/friends
- GET     /users/:userid/blocked
- POST    /users/:userid/blocked
- DELETE  /users/:userid/blocked
- GET	  /users/:userid/games

### ChannelController {/channels}
- GET     /channels
- GET     /channels/:id/

### AuthorizationController {/auth}

- GET     /auth
- GET     /auth/check
- GET     /auth/42Auth/callback
- POST	  /auth/generate
- POST	  /auth/enable-2fa
- POST	  /auth/disable-2fa
- POST	  /auth/verify-2fa

### GameController {/game}


### SSL Certificate

`openssl genrsa -out key.pem`
`openssl req -new -key key.pem -out csr.pem`
`openssl req -x509 -nodes -days 360 -newkey rsa:2048 -keyout ./cert/key.pem -out ./cert/cert.pem -subj "/C=FR/ST=Rhone/L=Lyon/O=42Lyon/CN=mdesoeuv"`
