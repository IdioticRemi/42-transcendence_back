import {MiddlewareConsumer, Module, NestModule} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
import {DataSource} from 'typeorm';
import {AppController} from './app.controller';
import {AppService} from './app.service';
import {UserEntity} from './users/entities/user.entity';
import {UsersModule} from './users/users.module';
import {ChannelModule} from './channel/channel.module';
import {ChannelEntity} from './channel/entities/channel.entity';
import {AuthorizationModule} from './auth/auth.module';
import {AuthorizationStrategy} from './auth/auth.strategy';
import {ConfigModule} from '@nestjs/config';
import {MulterModule} from '@nestjs/platform-express';
import {GameModule} from './game/game.module';
import {GameEntity} from './game/entities/game.entity';
import {SanctionEntity} from './channel/entities/sanction.entity';
import {GameQueueEntity} from './game/entities/game.queue.entity';
import {MessageEntity} from './channel/entities/message.entity';
import {UserInfoMiddleware} from './auth/auth.middleware';
import {SocketModule} from './socket/socket.module';

@Module({
    imports: [ConfigModule.forRoot(),
        TypeOrmModule.forRoot({
            type: 'postgres',
            host: process.env.DB_HOST,
            port: parseInt(process.env.DB_PORT),
            username: process.env.DB_USERNAME,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            entities: [UserEntity, ChannelEntity, GameEntity, SanctionEntity, GameQueueEntity, MessageEntity],
            // synchronize: true => dev only
            synchronize: true,
        }),
        UsersModule,
        ChannelModule,
        AuthorizationModule,
        MulterModule.register({
            dest: './uploads',
        }),
        GameModule,
        SocketModule
    ],
    controllers: [AppController],
    providers: [AppService, AuthorizationStrategy],
})
export class AppModule implements NestModule {
    constructor(private dataSource: DataSource) {
    }

    configure(consumer: MiddlewareConsumer) {
        consumer.apply(UserInfoMiddleware).forRoutes("*");
    }
}
