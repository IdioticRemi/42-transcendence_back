# Ressources

- https://docs.nestjs.com (NestJS Docs)
- https://wanago.io/2021/01/25/api-nestjs-chat-websockets/ (Realtime chat with sockets and database saves)
- https://wanago.io/2021/03/08/api-nestjs-two-factor-authentication/ (2FA Routes)

# Endpoints

### AppController {/}

### UsersController {/users}
- GET     /users
- GET     /users/:id
- POST    /users/register
- DELETE  /users/:id
- POST    /users/avatar/:user
- GET     /users/avatar/:user
- GET     /users/:userid/channels
- GET     /users/:userid/friends
- POST    /users/:userid/friends
- DELETE  /users/:userid/friends
- GET     /users/:userid/blocked

### ChannelController {/channels}
- GET     /channels
- POST    /channels
- DELETE  /channels
- GET     /channels/:id/messages
- POST    /channels/:id/messages

### AuthorizationController {/auth}

- GET     /auth
- GET     /auth/check
- GET     /auth/42Auth/callback

### GameController {/game}
