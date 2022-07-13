import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SocketGateway } from './socket.gateway';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'root',
      password: 'myrootpassword',
      database: 'user_db',
      entities: ["dist/**/*.entity{.ts,.js}"],
      // synchronize: true => dev only
      synchronize: true,
    }),
  ],
  controllers: [AppController],
  providers: [AppService, SocketGateway],
})
export class AppModule {}
