'use client';

import Link from 'next/link';
import { useAuth } from '../lib/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();

  return (
    <header className="border-b border-neutral-200 bg-white sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-amber-700">
          Golden Attic
        </Link>

        <nav className="flex items-center gap-4">
          {user ? (
            <>
              <Link href="/sell" className="text-sm font-medium text-amber-700 hover:underline">
                Sell an item
              </Link>
              <Link href="/profile" className="text-sm font-medium text-neutral-700 hover:underline">
                {user.name}
              </Link>
              <button onClick={logout} className="text-sm text-neutral-500 hover:underline">
                Log out
              </button>
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
