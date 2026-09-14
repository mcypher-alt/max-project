export interface INotificationProvider {
    send(phone: string, payload: string): Promise<boolean>;
}