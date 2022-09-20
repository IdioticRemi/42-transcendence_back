import {NestFactory} from '@nestjs/core';
import {AppModule} from './app.module';
import * as fs from 'fs';


async function bootstrap() {

    // const httpsOptions = {
    //     key: fs.readFileSync('./cert/key.pem'),
    //     cert: fs.readFileSync('./cert/cert.pem'),
    // }
    const app = await NestFactory.create(AppModule, /*{httpsOptions}*/);
    app.enableCors(({
        "origin": "*",
        "methods": "GET,PUT,POST,DELETE",
        "preflightContinue": false,
        "optionsSuccessStatus": 204
    }));
    await app.listen(3000);
}

bootstrap();
