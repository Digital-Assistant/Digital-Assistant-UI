export const on = (eventType: string, listener: EventListenerOrEventListenerObject) => {
    document.addEventListener(eventType, listener);
}

export const off = (eventType: string, listener: EventListenerOrEventListenerObject) => {
    document.removeEventListener(eventType, listener);
}

export const once = (eventType: string, listener: any) => {
    on(eventType, handleEventOnce);

    function handleEventOnce(event: any) {
        listener(event);
        off(eventType, handleEventOnce);
    }
}

export const trigger = (eventType: string, data: any) => {
    const event = new CustomEvent(eventType, { detail: data });
    document.dispatchEvent(event);
}
