import { Expose } from "class-transformer";

export class GameEntityDto {

    @Expose()
    id: number;

    @Expose()
    playerId: number;

    @Expose()
    opponentId: number;

    @Expose()
    opponentNick: string;
    
    @Expose()
    playerScore: number;
    
    @Expose()
    opponentScore: number;

    @Expose()
    type: string;

    @Expose()
    endedAt: Date;

}