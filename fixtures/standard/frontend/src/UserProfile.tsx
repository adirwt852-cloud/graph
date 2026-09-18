import React, { useEffect, useState } from 'react';
import { api, User } from './api-client';

interface Props {
  userId: string;
}

export const UserProfile: React.FC<Props> = ({ userId }) => {
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    // Resilient try/catch pattern around fetch
    async function loadUser() {
      try {
        setLoading(true);
        // Direct template literal fetch call pattern
        const res = await fetch(`/api/users/${userId}`);
        const data = await res.json();
        if (isMounted) {
          // Destructuring fields
          const { userId: uid, email, role, profile } = data;
          setUser({ ...data, userId: uid, email, role, profile });
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Error loading user profile');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadUser();
    return () => { isMounted = false; };
  }, [userId]);

  if (loading) return <div className="p-4">Loading user profile...</div>;
  if (error) return <div className="p-4 text-amber-600 bg-amber-50 rounded">Fallback: {error}</div>;
  if (!user) return null;

  return (
    <div className="border rounded p-4 shadow-sm">
      <h3 className="font-semibold text-lg">{user.profile?.displayName || user.name}</h3>
      <p className="text-gray-600 text-sm">{user.email}</p>
      <span className="inline-block px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded mt-2">{user.role}</span>
    </div>
  );
};
