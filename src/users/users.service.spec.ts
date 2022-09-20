import {Test, TestingModule} from '@nestjs/testing';
import {UsersService} from './users.service';

describe('UsersService', () => {
    let service: UsersService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [UsersService],
        }).compile();

        service = module.get<UsersService>(UsersService);
    });

    it('should be defined', async () => {
        expect(service).toBeDefined();
        const request = new Request(`http://${process.env.BACKEND_IP}:3000/users`, {method: "GET"})
        const response = await fetch(request);
        const body = (await response.body.getReader().read()).value;
        const str = body.toString();
        const obj = JSON.parse(str);
        expect(obj).toBeInstanceOf(Array);
    });
});
