import {Controller, UseGuards} from '@nestjs/common';
import {UserTokenGuard} from 'src/auth/auth.guard';
import {GameService} from './game.service';

@UseGuards(UserTokenGuard)
@Controller('game')
export class GameController {
    constructor(
        private gameService: GameService
    ) {
    }


}
