import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchUnreadMessageCount } from '../api/conversations';
import { fetchBidNotifications } from '../api/bids';

const POLL_INTERVAL_MS = 20000;

export function useNotificationCounts() {
  const { user } = useAuth();
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [pendingBids, setPendingBids] = useState(0);
  const [counteredBids, setCounteredBids] = useState(0);

  useEffect(() => {
    if (!user) {
      setUnreadMessages(0);
      setPendingBids(0);
      setCounteredBids(0);
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const [messages, bids] = await Promise.all([fetchUnreadMessageCount(), fetchBidNotifications()]);
        if (!cancelled) {
          setUnreadMessages(messages.count);
          setPendingBids(bids.pendingOnMyListings);
          setCounteredBids(bids.counteredOnMyBids);
        }
      } catch {
        // Silent - a failed poll just tries again next interval.
      }
    }

    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user]);

  return {
    unreadMessages,
    pendingBids,
    counteredBids,
    bidActivity: pendingBids + counteredBids,
  };
}
