declare namespace Express {
    export interface Request {
        user?: import("../src/users/entities/user.entity").UserEntity,
    }
}