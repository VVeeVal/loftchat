export function convertFastifyHeaders(fastifyHeaders: Record<string, string | string[] | undefined>): Headers {
    const headers = new Headers();
    Object.entries(fastifyHeaders).forEach(([key, value]) => {
        if (value) {
            if (Array.isArray(value)) {
                value.forEach(v => headers.append(key, v));
            } else {
                headers.append(key, value.toString());
            }
        }
    });
    return headers;
}
