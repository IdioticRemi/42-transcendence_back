import { Expose } from "class-transformer";

export class GameEntityDto {

    @Expose()
    id: number;

    @Expose()
    playerId: number;

    @Expose()
    opponentId: number;
    
    @Expose()
    playerScore: number;
    
    @Expose()
    opponnentScore: number;

    @Expose()
    type: string;

    @Expose()
    endedAt: Date;

}