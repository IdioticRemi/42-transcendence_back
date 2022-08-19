export type MResponse<Payload> = {
    status: 'error',
    message: string,
} | {
    status: 'success',
    payload: Payload,
};

export function successMResponse<Payload>(payload: Payload): MResponse<Payload> {
    return {
        status: 'success',
        payload,
    }
}

export function failureMResponse<Payload>(message: string): MResponse<Payload> {
    return {
        status: 'error',
        message,
    }
}