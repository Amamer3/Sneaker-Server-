# Frontend Notification Integration Guide

This guide explains how to integrate the notification system with your frontend application. The system supports in-app notifications only, focusing on delivering order updates, promotions, and general information through the web application.

## 1. Real-time Notifications (Server-Sent Events)

### JavaScript/TypeScript Example

```javascript
class NotificationService {
  constructor(baseUrl, authToken) {
    this.baseUrl = baseUrl;
    this.authToken = authToken;
    this.eventSource = null;
  }

  // Connect to real-time notification stream
  connectToNotifications(onNotification, onUnreadCount, onError) {
    const url = `${this.baseUrl}/api/notifications/stream`;
    
    this.eventSource = new EventSource(url, {
      headers: {
        'Authorization': `Bearer ${this.authToken}`
      }
    });

    this.eventSource.addEventListener('notification', (event) => {
      const notification = JSON.parse(event.data);
      onNotification(notification);
    });

    this.eventSource.addEventListener('unread-count', (event) => {
      const count = JSON.parse(event.data);
      onUnreadCount(count);
    });

    this.eventSource.addEventListener('error', (event) => {
      console.error('SSE Error:', event);
      onError(event);
    });

    return this.eventSource;
  }

  // Disconnect from notifications
  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }
}
```

### React Hook Example

```jsx
import { useState, useEffect, useCallback } from 'react';

export const useNotifications = (authToken) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);

  const handleNewNotification = useCallback((notification) => {
    setNotifications(prev => [notification, ...prev]);
    // Show toast or update UI
    showNotificationToast(notification);
  }, []);

  const handleUnreadCount = useCallback((count) => {
    setUnreadCount(count);
  }, []);

  useEffect(() => {
    if (!authToken) return;

    const notificationService = new NotificationService(
      process.env.REACT_APP_API_URL,
      authToken
    );

    const eventSource = notificationService.connectToNotifications(
      handleNewNotification,
      handleUnreadCount,
      (error) => {
        console.error('Notification connection error:', error);
        setIsConnected(false);
      }
    );

    eventSource.onopen = () => {
      setIsConnected(true);
    };

    return () => {
      notificationService.disconnect();
      setIsConnected(false);
    };
  }, [authToken, handleNewNotification, handleUnreadCount]);

  return {
    notifications,
    unreadCount,
    isConnected
  };
};

function showNotificationToast(notification) {
  // Implementation depends on your toast library
  // Example with react-hot-toast:
  // toast(notification.message, {
  //   icon: getNotificationIcon(notification.type),
  //   duration: 4000
  // });
}
```

## 2. Notification API Calls

### Fetch User Notifications

```javascript
async function fetchNotifications(page = 1, limit = 20, unreadOnly = false) {
  const response = await fetch(
    `${API_BASE_URL}/api/notifications?page=${page}&limit=${limit}&unreadOnly=${unreadOnly}`,
    {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  return response.json();
}
```

### Mark Notification as Read

```javascript
async function markAsRead(notificationId) {
  const response = await fetch(
    `${API_BASE_URL}/api/notifications/${notificationId}/read`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  return response.json();
}
```

### Get Unread Count

```javascript
async function getUnreadCount() {
  const response = await fetch(
    `${API_BASE_URL}/api/notifications/unread-count`,
    {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    }
  );
  
  return response.json();
}
```

## 3. Notification Preferences

### Get User Preferences

```javascript
async function getNotificationPreferences() {
  const response = await fetch(
    `${API_BASE_URL}/api/notifications/preferences`,
    {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    }
  );
  
  return response.json();
}
```

### Update Preferences

```javascript
async function updateNotificationPreferences(preferences) {
  const response = await fetch(
    `${API_BASE_URL}/api/notifications/preferences`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(preferences)
    }
  );
  
  return response.json();
}

// Example preferences structure (in-app only)
const examplePreferences = {
  orderUpdates: {
    push: true     // Controls in-app notifications
  },
  promotions: {
    push: true     // Controls in-app notifications
  },
  wishlistUpdates: {
    push: true     // Controls in-app notifications
  },
  inventoryAlerts: {
    push: true     // Controls in-app notifications
  },
  reviewRequests: {
    push: false    // Controls in-app notifications
  },
  abandonedCart: {
    push: true     // Controls in-app notifications
  }
};

// Note: Only in-app notifications are supported
// Email and SMS functionality has been removed
```

## 4. React Component Examples

### Notification Bell Component

```jsx
import React from 'react';
import { useNotifications } from './hooks/useNotifications';

export const NotificationBell = ({ authToken }) => {
  const { unreadCount, isConnected } = useNotifications(authToken);

  return (
    <div className="notification-bell">
      <button className="bell-button">
        🔔
        {unreadCount > 0 && (
          <span className="badge">{unreadCount}</span>
        )}
      </button>
      <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
        {isConnected ? '🟢' : '🔴'}
      </div>
    </div>
  );
};
```

### Notification List Component

```jsx
import React, { useState, useEffect } from 'react';

export const NotificationList = ({ authToken }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications().then(data => {
      setNotifications(data.notifications);
      setLoading(false);
    });
  }, []);

  const handleMarkAsRead = async (notificationId) => {
    await markAsRead(notificationId);
    setNotifications(prev => 
      prev.map(notif => 
        notif.id === notificationId 
          ? { ...notif, read: true }
          : notif
      )
    );
  };

  if (loading) return <div>Loading notifications...</div>;

  return (
    <div className="notification-list">
      {notifications.map(notification => (
        <div 
          key={notification.id} 
          className={`notification-item ${!notification.read ? 'unread' : ''}`}
          onClick={() => handleMarkAsRead(notification.id)}
        >
          <h4>{notification.title}</h4>
          <p>{notification.message}</p>
          <small>{new Date(notification.createdAt).toLocaleString()}</small>
        </div>
      ))}
    </div>
  );
};
```

## 5. CSS Styles Example

```css
.notification-bell {
  position: relative;
  display: inline-block;
}

.bell-button {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  position: relative;
}

.badge {
  position: absolute;
  top: -8px;
  right: -8px;
  background: #ff4444;
  color: white;
  border-radius: 50%;
  padding: 2px 6px;
  font-size: 12px;
  min-width: 18px;
  text-align: center;
}

.connection-status {
  position: absolute;
  bottom: -5px;
  right: -5px;
  font-size: 8px;
}

.notification-list {
  max-width: 400px;
  max-height: 500px;
  overflow-y: auto;
  border: 1px solid #ddd;
  border-radius: 8px;
}

.notification-item {
  padding: 12px;
  border-bottom: 1px solid #eee;
  cursor: pointer;
  transition: background-color 0.2s;
}

.notification-item:hover {
  background-color: #f5f5f5;
}

.notification-item.unread {
  background-color: #e3f2fd;
  border-left: 4px solid #2196f3;
}

.notification-item h4 {
  margin: 0 0 4px 0;
  font-size: 14px;
  font-weight: 600;
}

.notification-item p {
  margin: 0 0 4px 0;
  font-size: 13px;
  color: #666;
}

.notification-item small {
  color: #999;
  font-size: 11px;
}
```

## 6. Testing the Integration

1. **Start the backend server**
2. **Authenticate a user** and get the JWT token
3. **Connect to the notification stream** using the examples above
4. **Use admin endpoints** to send test notifications:
   ```bash
   # Send a test in-app notification
   curl -X POST http://localhost:3000/api/admin/test-notifications/create \
     -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "userId": "USER_ID",
       "type": "order_update",
       "title": "Test Notification",
       "message": "This is a test in-app notification"
     }'
   ```

   ```bash
   # Test real-time notification delivery
   curl -X POST http://localhost:3000/api/admin/test-notifications/real-time \
     -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "userId": "USER_ID",
       "title": "Real-time Test",
       "message": "Testing real-time in-app delivery"
     }'
   ```

## 7. Error Handling

- **Connection failures**: Implement reconnection logic for SSE
- **Authentication errors**: Refresh tokens when needed
- **Network issues**: Show offline/online status
- **Rate limiting**: Handle 429 responses appropriately

## 8. Performance Considerations

- **Pagination**: Load notifications in chunks
- **Caching**: Cache notification preferences locally
- **Debouncing**: Debounce mark-as-read calls
- **Connection management**: Close SSE connections when not needed