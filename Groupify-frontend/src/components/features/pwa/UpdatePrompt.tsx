import { useRegisterSW } from 'virtual:pwa-register/react';
import { toast } from 'sonner';
import { useEffect, useRef } from 'react';

/**
 * Listens for service worker updates and shows a toast prompting the user to refresh.
 * Checks for updates every 60 minutes.
 */
export default function UpdatePrompt() {
  const toastShownRef = useRef(false);

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  useEffect(() => {
    if (needRefresh && !toastShownRef.current) {
      toastShownRef.current = true;
      toast('A new version is available!', {
        duration: Infinity,
        action: {
          label: 'Update',
          onClick: () => updateServiceWorker(true),
        },
        onDismiss: () => {
          toastShownRef.current = false;
        },
      });
    }
  }, [needRefresh, updateServiceWorker]);

  return null;
}
