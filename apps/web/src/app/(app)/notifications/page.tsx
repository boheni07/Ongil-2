import { getNotifications } from "./actions";
import { NotificationList } from "./NotificationList";

export default async function NotificationsPage() {
  const items = await getNotifications();
  return (
    <div className="max-w-2xl">
      <h1 className="text-headline-1 font-extrabold text-foreground">알림</h1>
      <NotificationList initialItems={items} />
    </div>
  );
}
