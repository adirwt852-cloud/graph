import React, { useEffect, useState } from 'react';
import { api, User } from './api-client';
import { UserProfile } from './UserProfile';
import { OrderSummary } from './OrderSummary';

export const UserDashboard: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('usr_101');

  useEffect(() => {
    // Calling via api-client wrapper without try/catch (Unprotected call -> Failed status when endpoint breaks)
    api.listUsers().then((data) => {
      setUsers(data);
    });
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Organization Directory & Orders</h1>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h2 className="text-lg font-medium mb-2">Team Members</h2>
          <ul className="divide-y border rounded">
            {users.map((u) => (
              <li
                key={u.id}
                onClick={() => setSelectedUserId(u.id)}
                className="p-3 hover:bg-gray-50 cursor-pointer flex justify-between"
              >
                <span>{u.name}</span>
                <span className="text-sm text-gray-500">{u.role}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <UserProfile userId={selectedUserId} />
          <div className="mt-4">
            <OrderSummary orderId="ord_501" />
          </div>
        </div>
      </div>
    </div>
  );
};
