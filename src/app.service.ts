import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }

  getToken(code: string, res: Response): string {
    const body = {
      grant_type: 'client_credentials',
      client_id: process.env.UID,
      client_secret: process.env.SECRET,
      code
    }
    const options = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "http://127.0.0.1:3000",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
      body: JSON.stringify(body),
    };
    fetch("https://api.intra.42.fr/oauth/token", options)
      .then(async (response) => {
        let json = await response.json();
        console.log("response:", json);
        if (!response.ok) {
          return Promise.reject(json.message);
        }
        return json.access_token;

      })
      .catch((error) => {
        console.log(error);
      });
      return '';
  }

  authenticate(code: string, res: Response) {
    const token = this.getToken(code, res);
    console.log(token);
    // get user info 
    const options = {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "http://127.0.0.1:3000",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    };
    fetch("https://api.intra.42.fr/v2/me", options)
      .then(async (response) => {
        let json = await response.json();
        console.log("response:", json);
        if (!response.ok) {
          return Promise.reject(json.message);
        }
        console.log(json);
      })
      .catch((error) => {
        console.log(error);
      });
  }

  authLogin(req) {
    if (!req.user) {
      return 'No user from 42'
    }
    return {
      message: 'User Info from 42',
      user: req.user
    }
  }
}
