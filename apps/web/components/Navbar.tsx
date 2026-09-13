'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/AuthContext';
import { useNotificationCounts } from '../lib/useNotificationCounts';
import Logo from './Logo';

function Badge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="bg-amber-700 text-white text-xs rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">
      {count > 9 ? '9+' : count}
    </span>
  );
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { unreadMessages, bidActivity } = useNotificationCounts();
  const hasAnyNotification = unreadMessages > 0 || bidActivity > 0;

  function handleLogout() {
    logout();
    router.push('/');
  }

  return (
    <header className="border-b border-neutral-200 bg-white sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Logo size={30} />
          <span className="text-xl font-bold text-amber-700">Golden Attic</span>
          <span className="hidden sm:inline text-xs text-neutral-400 font-normal ml-1">Turn your attic into gold</span>
        </Link>

        <nav className="flex items-center gap-4">
          {user ? (
            <>
              <Link href="/sell" className="text-sm font-medium text-amber-700 hover:underline">
                Sell an item
              </Link>

              {/* Native <details>/<summary> gives a click-to-open dropdown for
                  free, no extra JS state needed - same pattern as the filter
                  sidebar accordions. Keeps the top-level nav from growing
                  every time a new account page gets added. */}
              <details className="relative">
                <summary className="text-sm font-medium text-neutral-700 cursor-pointer list-none flex items-center gap-1.5">
                  {user.name}
                  {/* Visible even before opening the menu, so unread activity
                      is noticeable at a glance rather than hidden behind a click. */}
                  {hasAnyNotification && <span className="w-2 h-2 rounded-full bg-red-500" />}
                  <span className="text-neutral-400 text-xs">▾</span>
                </summary>
                <div className="absolute right-0 mt-2 w-52 bg-white border border-neutral-200 rounded-md shadow-lg py-1 z-20">
                  <Link href="/profile" className="block px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50">
                    Profile
                  </Link>
                  <Link href="/my-listings" className="flex items-center justify-between px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50">
                    My Listings
                    <Badge count={bidActivity} />
                  </Link>
                  <Link href="/orders" className="block px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50">
                    Orders
                  </Link>
                  <Link href="/messages" className="flex items-center justify-between px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50">
                    Messages
                    <Badge count={unreadMessages} />
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 border-t border-neutral-100"
                  >
                    Log out
                  </button>
                </div>
              </details>
            </>
          ) : (
            <>
              <Link href="/login" className="text-sm font-medium text-neutral-700 hover:underline">
                Log in
              </Link>
              <Link
                href="/signup"
                className="text-sm font-medium bg-amber-700 text-white px-4 py-2 rounded-md hover:bg-amber-800"
              >
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
