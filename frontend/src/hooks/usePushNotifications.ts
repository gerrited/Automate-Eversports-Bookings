import { useEffect } from 'react'
import { getVapidPublicKey, registerSubscription } from '../api/push'

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

export function usePushNotifications(): void {
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

    async function setup() {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js')
        const { public_key } = await getVapidPublicKey()
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') return

        const existing = await registration.pushManager.getSubscription()
        if (existing) {
          await sendSubscription(existing)
          return
        }

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(public_key),
        })
        await sendSubscription(subscription)
      } catch {
        // Fehler still ignorieren
      }
    }

    function sendSubscription(sub: PushSubscription) {
      const json = sub.toJSON()
      const keys = json.keys ?? {}
      return registerSubscription({
        endpoint: sub.endpoint,
        p256dh: keys['p256dh'] ?? '',
        auth: keys['auth'] ?? '',
      })
    }

    setup()
  }, [])
}
