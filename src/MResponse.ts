export type MResponse<Payload> = {
	status: 'error',
	message: string,
} | {
	status: 'success',
	payload: Payload,
};