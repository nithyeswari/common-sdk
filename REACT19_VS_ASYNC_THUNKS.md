# React 19 + RTK Query vs createAsyncThunk

## Why createAsyncThunk is Outdated

With **React 19** and **RTK Query**, `createAsyncThunk` is no longer necessary. Here's why:

## The Old Way (createAsyncThunk) ❌

```typescript
// actions.ts
import { createAsyncThunk } from '@reduxjs/toolkit';

export const fetchUsers = createAsyncThunk(
  'users/fetch',
  async (params: { limit: number }) => {
    const response = await fetch(`/api/users?limit=${params.limit}`);
    return response.json();
  }
);

export const createUser = createAsyncThunk(
  'users/create',
  async (user: User) => {
    const response = await fetch('/api/users', {
      method: 'POST',
      body: JSON.stringify(user),
    });
    return response.json();
  }
);
```

```typescript
// reducers.ts
import { createSlice } from '@reduxjs/toolkit';
import { fetchUsers, createUser } from './actions';

const usersSlice = createSlice({
  name: 'users',
  initialState: {
    list: [],
    loading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchUsers.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchUsers.fulfilled, (state, action) => {
        state.loading = false;
        state.list = action.payload;
      })
      .addCase(fetchUsers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      .addCase(createUser.pending, (state) => {
        state.loading = true;
      })
      .addCase(createUser.fulfilled, (state, action) => {
        state.loading = false;
        state.list.push(action.payload);
      })
      .addCase(createUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      });
  },
});
```

```typescript
// component.tsx
function UserList() {
  const dispatch = useDispatch();
  const users = useSelector((state) => state.users.list);
  const loading = useSelector((state) => state.users.loading);
  const error = useSelector((state) => state.users.error);

  useEffect(() => {
    dispatch(fetchUsers({ limit: 10 }));
  }, [dispatch]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <ul>
      {users.map((user) => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  );
}
```

### Problems with createAsyncThunk:

1. **Boilerplate** - Need to write actions, reducers, and handle 3 states (pending/fulfilled/rejected)
2. **Manual caching** - No automatic cache management
3. **No deduplication** - Multiple components trigger same request
4. **Manual invalidation** - Must manually update cache after mutations
5. **No retry logic** - Must implement yourself
6. **No optimistic updates** - Difficult to implement
7. **No request cancellation** - Must handle manually

---

## The Modern Way (RTK Query + React 19) ✅

### 1. RTK Query API

```typescript
// api.ts - AUTO-GENERATED
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const usersApi = createApi({
  reducerPath: 'usersApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  tagTypes: ['User'],
  endpoints: (builder) => ({
    getUsers: builder.query<User[], { limit: number }>({
      query: ({ limit }) => `users?limit=${limit}`,
      providesTags: ['User'],
    }),
    createUser: builder.mutation<User, Partial<User>>({
      query: (user) => ({
        url: 'users',
        method: 'POST',
        body: user,
      }),
      invalidatesTags: ['User'],
    }),
  }),
});

// Auto-generated hooks
export const { useGetUsersQuery, useCreateUserMutation } = usersApi;
```

### 2. React 19 Component

```typescript
// component.tsx
import { useGetUsersQuery, useCreateUserMutation } from './api';

function UserList() {
  // All state management handled automatically
  const { data: users, isLoading, error } = useGetUsersQuery({ limit: 10 });
  const [createUser, { isLoading: isCreating }] = useCreateUserMutation();

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <ul>
        {users?.map((user) => (
          <li key={user.id}>{user.name}</li>
        ))}
      </ul>
      <button onClick={() => createUser({ name: 'John' })}>
        Add User
      </button>
    </div>
  );
}
```

### Benefits:

✅ **Zero boilerplate** - Single API definition
✅ **Automatic caching** - Intelligent cache management
✅ **Request deduplication** - Same request called once
✅ **Auto invalidation** - Cache updates after mutations
✅ **Built-in retry** - Exponential backoff included
✅ **Automatic refetch** - On focus, reconnect, etc.
✅ **Request cancellation** - Built-in

---

## React 19 Features

### 1. Optimistic Updates with useOptimistic

```typescript
import { useOptimistic } from 'react';

function UserList() {
  const { data: users } = useGetUsersQuery();
  const [createUser] = useCreateUserMutation();

  const [optimisticUsers, addOptimisticUser] = useOptimistic(
    users,
    (state, newUser) => [...state, newUser]
  );

  const handleCreate = async (name: string) => {
    // Show immediately
    addOptimisticUser({ id: 'temp', name });

    // Actually create
    await createUser({ name });
  };

  return (
    <ul>
      {optimisticUsers?.map((user) => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  );
}
```

**With createAsyncThunk**: You'd need to manually manage optimistic state, handle rollbacks, etc.

### 2. Suspense with use Hook

```typescript
import { Suspense, use } from 'react';

function UserProfile({ userId }) {
  // use() suspends component until data loads
  const user = use(fetchUser(userId));

  return <div>{user.name}</div>;
}

function App() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <UserProfile userId="123" />
    </Suspense>
  );
}
```

**With createAsyncThunk**: No Suspense support without custom implementation.

### 3. Transitions with useTransition

```typescript
import { useTransition } from 'react';

function SearchUsers() {
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState('');

  const { data } = useGetUsersQuery({ search: query });

  const handleSearch = (value: string) => {
    // Non-blocking update
    startTransition(() => {
      setQuery(value);
    });
  };

  return (
    <div>
      <input onChange={(e) => handleSearch(e.target.value)} />
      {isPending && <Spinner />}
      <UserList users={data} />
    </div>
  );
}
```

**With createAsyncThunk**: No built-in transition support.

### 4. Form Actions (React 19)

```typescript
import { useFormStatus } from 'react-dom';

function CreateUserForm() {
  const [createUser] = useCreateUserMutation();

  async function handleSubmit(formData: FormData) {
    await createUser({
      name: formData.get('name'),
      email: formData.get('email'),
    });
  }

  return (
    <form action={handleSubmit}>
      <input name="name" required />
      <input name="email" type="email" required />
      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button disabled={pending}>Create</button>;
}
```

**With createAsyncThunk**: Manual form state management required.

---

## Feature Comparison

| Feature | createAsyncThunk | RTK Query + React 19 |
|---------|-----------------|---------------------|
| **Boilerplate** | High | Minimal |
| **Caching** | Manual | Automatic |
| **Deduplication** | No | Yes |
| **Cache Invalidation** | Manual | Automatic |
| **Retry Logic** | Manual | Built-in |
| **Loading States** | Manual | Automatic |
| **Error Handling** | Manual | Automatic |
| **Optimistic Updates** | Hard | Easy (useOptimistic) |
| **Suspense Support** | No | Yes (use hook) |
| **Transitions** | No | Yes (useTransition) |
| **Form Actions** | No | Yes (React 19) |
| **Request Cancellation** | Manual | Automatic |
| **Prefetching** | Manual | Built-in |
| **Polling** | Manual | Built-in |
| **Type Safety** | Partial | Full |
| **Bundle Size** | Small | Medium |
| **Learning Curve** | Steep | Moderate |

---

## Migration Strategy

### For New Projects:
✅ **Use RTK Query + React 19** exclusively
❌ **Skip createAsyncThunk** entirely

### For Existing Projects:
1. Keep createAsyncThunk code working
2. Use RTK Query for new features
3. Gradually migrate createAsyncThunk → RTK Query
4. Remove createAsyncThunk when fully migrated

---

## CLI Options

```bash
# Modern only (RTK Query + React 19)
openapi-redux-gen generate -i spec.yaml -o ./output --modern-only

# Legacy only (createAsyncThunk)
openapi-redux-gen generate -i spec.yaml -o ./output --legacy-only

# Both (default - for migration)
openapi-redux-gen generate -i spec.yaml -o ./output
```

---

## Real-World Example

### createAsyncThunk (100+ lines)

```typescript
// ❌ OLD WAY - Too much code
export const fetchPosts = createAsyncThunk('posts/fetch', async () => {
  const response = await fetch('/api/posts');
  return response.json();
});

export const createPost = createAsyncThunk('posts/create', async (post) => {
  const response = await fetch('/api/posts', {
    method: 'POST',
    body: JSON.stringify(post),
  });
  return response.json();
});

const postsSlice = createSlice({
  name: 'posts',
  initialState: { data: [], loading: false, error: null },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchPosts.pending, (state) => { state.loading = true; })
      .addCase(fetchPosts.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(fetchPosts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      .addCase(createPost.pending, (state) => { state.loading = true; })
      .addCase(createPost.fulfilled, (state, action) => {
        state.loading = false;
        state.data.push(action.payload);
      })
      .addCase(createPost.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      });
  },
});
```

### RTK Query (20 lines)

```typescript
// ✅ NEW WAY - Clean and simple
export const postsApi = createApi({
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  tagTypes: ['Post'],
  endpoints: (builder) => ({
    getPosts: builder.query<Post[], void>({
      query: () => 'posts',
      providesTags: ['Post'],
    }),
    createPost: builder.mutation<Post, Partial<Post>>({
      query: (post) => ({
        url: 'posts',
        method: 'POST',
        body: post,
      }),
      invalidatesTags: ['Post'],
    }),
  }),
});

export const { useGetPostsQuery, useCreatePostMutation } = postsApi;
```

**80% less code, 10x more features!**

---

## Conclusion

### createAsyncThunk is obsolete when you have:
- ✅ RTK Query for data fetching
- ✅ React 19 hooks for optimistic updates
- ✅ Suspense for loading states
- ✅ Transitions for non-blocking updates

### Use createAsyncThunk only if:
- ❌ You have complex business logic not related to API calls
- ❌ You need compatibility with legacy code
- ❌ You can't upgrade to React 19

### Recommended Default:
```bash
# Generate modern-only SDK
openapi-redux-gen generate -i spec.yaml -o ./output --modern-only
```

---

**The future is RTK Query + React 19. createAsyncThunk served us well, but it's time to move on! 🚀**
