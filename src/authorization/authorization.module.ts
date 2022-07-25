import { Module } from '@nestjs/common';
import { AuthorizationController } from './authorization.controller';
import ClientOAuth2 from 'client-oauth2';

@Module({
  controllers: [AuthorizationController]
})
export class AuthorizationModule {}
