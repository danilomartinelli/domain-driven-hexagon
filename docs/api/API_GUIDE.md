# API Documentation Guide

## Table of Contents

- [Getting Started](#getting-started)
- [Authentication](#authentication)
- [REST API Endpoints](#rest-api-endpoints)
- [GraphQL API](#graphql-api)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [Code Examples](#code-examples)
- [SDKs and Client Libraries](#sdks-and-client-libraries)

## Getting Started

The Domain-Driven Hexagon API provides both REST and GraphQL interfaces for managing users and wallets. The API follows RESTful principles and implements CQRS patterns for optimal performance and scalability.

### Base URL

- **Local Development**: `http://localhost:3000`
- **Production**: `https://api.your-domain.com`

### API Versioning

All API endpoints are versioned using URL path versioning:

- **Current Version**: `v1`
- **Base Path**: `/v1/`

Example: `GET http://localhost:3000/v1/users`

## Authentication

### JWT Bearer Token Authentication

The API uses JWT (JSON Web Token) for authentication. Include the token in the Authorization header of your requests:

```http
Authorization: Bearer <your-jwt-token>
```

### Obtaining a Token

```bash
# Login to get JWT token
curl -X POST http://localhost:3000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "your-password"
  }'
```

Response:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

### Permission System

The API uses a role-based access control (RBAC) system. Each endpoint requires specific permissions:

| Permission | Description |
|------------|-------------|
| `user:create` | Create new users |
| `user:list` | View user lists |
| `user:read` | View user details |
| `user:update` | Update user information |
| `user:delete` | Delete users |
| `wallet:list` | View wallet lists |
| `wallet:read` | View wallet details |
| `wallet:update` | Update wallet information |

## REST API Endpoints

### Users

#### Create User

Create a new user account with associated wallet.

```http
POST /v1/users
```

**Required Permissions**: `user:create`

**Request Body**:
```json
{
  "email": "john.doe@example.com",
  "name": "John Doe",
  "country": "France",
  "street": "123 Main Street",
  "postalCode": "75001"
}
```

**Response** (201 Created):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**cURL Example**:
```bash
curl -X POST http://localhost:3000/v1/users \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john.doe@example.com",
    "name": "John Doe",
    "country": "France",
    "street": "123 Main Street",
    "postalCode": "75001"
  }'
```

**JavaScript Example**:
```javascript
const response = await fetch('http://localhost:3000/v1/users', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer <your-token>',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    email: 'john.doe@example.com',
    name: 'John Doe',
    country: 'France',
    street: '123 Main Street',
    postalCode: '75001'
  })
});

const result = await response.json();
console.log('Created user ID:', result.id);
```

**Python Example**:
```python
import requests

url = "http://localhost:3000/v1/users"
headers = {
    "Authorization": "Bearer <your-token>",
    "Content-Type": "application/json"
}
data = {
    "email": "john.doe@example.com",
    "name": "John Doe",
    "country": "France",
    "street": "123 Main Street",
    "postalCode": "75001"
}

response = requests.post(url, headers=headers, json=data)
result = response.json()
print(f"Created user ID: {result['id']}")
```

#### List Users

Retrieve a paginated list of users with optional filtering.

```http
GET /v1/users
```

**Required Permissions**: `user:list`

**Query Parameters**:
- `page` (integer, optional): Page number (default: 1)
- `limit` (integer, optional): Items per page (default: 20, max: 100)
- `email` (string, optional): Filter by email address
- `country` (string, optional): Filter by country

**Response** (200 OK):
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "john.doe@example.com",
      "country": "France",
      "street": "123 Main Street",
      "postalCode": "75001",
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    },
    {
      "id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      "email": "jane.smith@example.com",
      "country": "Germany",
      "street": "456 Oak Avenue",
      "postalCode": "10115",
      "createdAt": "2024-01-16T14:20:00Z",
      "updatedAt": "2024-01-16T14:20:00Z"
    }
  ],
  "count": 2,
  "limit": 20,
  "page": 1,
  "hasNextPage": false
}
```

**Examples**:

```bash
# Basic listing
curl -X GET "http://localhost:3000/v1/users" \
  -H "Authorization: Bearer <your-token>"

# With pagination
curl -X GET "http://localhost:3000/v1/users?page=2&limit=10" \
  -H "Authorization: Bearer <your-token>"

# With filtering
curl -X GET "http://localhost:3000/v1/users?country=France&limit=50" \
  -H "Authorization: Bearer <your-token>"
```

```javascript
// Basic listing
const response = await fetch('http://localhost:3000/v1/users', {
  headers: {
    'Authorization': 'Bearer <your-token>'
  }
});

const users = await response.json();
console.log('Users:', users.data);

// With filtering and pagination
const filteredResponse = await fetch(
  'http://localhost:3000/v1/users?country=France&page=1&limit=10',
  {
    headers: {
      'Authorization': 'Bearer <your-token>'
    }
  }
);

const filteredUsers = await filteredResponse.json();
console.log('Filtered users:', filteredUsers.data);
```

#### Delete User

Soft delete a user by ID.

```http
DELETE /v1/users/{id}
```

**Required Permissions**: `user:delete`

**Path Parameters**:
- `id` (string, UUID): User unique identifier

**Response** (204 No Content): Empty body

**Examples**:

```bash
curl -X DELETE "http://localhost:3000/v1/users/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer <your-token>"
```

```javascript
await fetch('http://localhost:3000/v1/users/550e8400-e29b-41d4-a716-446655440000', {
  method: 'DELETE',
  headers: {
    'Authorization': 'Bearer <your-token>'
  }
});

console.log('User deleted successfully');
```

### Wallets

#### List Wallets

Retrieve a paginated list of wallets with optional filtering.

```http
GET /v1/wallets
```

**Required Permissions**: `wallet:list`

**Query Parameters**:
- `page` (integer, optional): Page number (default: 1)
- `limit` (integer, optional): Items per page (default: 20, max: 100)
- `userId` (string, UUID, optional): Filter by user ID

**Response** (200 OK):
```json
{
  "data": [
    {
      "id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      "userId": "550e8400-e29b-41d4-a716-446655440000",
      "balance": 1000.00,
      "currency": "USD",
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    }
  ],
  "count": 1,
  "limit": 20,
  "page": 1,
  "hasNextPage": false
}
```

## GraphQL API

The GraphQL endpoint is available at `/graphql` and provides an interactive playground for development.

### GraphQL Playground

Visit `http://localhost:3000/graphql` in your browser to access the GraphQL Playground, where you can:
- Explore the schema
- Write and test queries
- View documentation
- See query autocompletion

### Schema Overview

```graphql
type Query {
  users(options: String): UserPaginatedResponse
  user(id: ID!): User
  wallets(options: String): WalletPaginatedResponse
  wallet(id: ID!): Wallet
}

type Mutation {
  createUser(input: CreateUserInput!): IdResponse
  updateUser(id: ID!, input: UpdateUserInput!): User
  deleteUser(id: ID!): Boolean
}

type User {
  id: ID!
  email: String!
  country: String!
  street: String!
  postalCode: String!
  createdAt: DateTime!
  updatedAt: DateTime!
}

type Wallet {
  id: ID!
  userId: ID!
  balance: Float!
  currency: String!
  createdAt: DateTime!
  updatedAt: DateTime!
}
```

### Example Queries

#### Query Users

```graphql
query GetUsers {
  users(options: "{\"page\": 1, \"limit\": 10}") {
    data {
      id
      email
      country
      street
      postalCode
      createdAt
      updatedAt
    }
    count
    limit
    page
    hasNextPage
  }
}
```

#### Query Single User

```graphql
query GetUser($userId: ID!) {
  user(id: $userId) {
    id
    email
    country
    street
    postalCode
    createdAt
    updatedAt
  }
}
```

Variables:
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000"
}
```

#### Create User Mutation

```graphql
mutation CreateUser($input: CreateUserInput!) {
  createUser(input: $input) {
    id
  }
}
```

Variables:
```json
{
  "input": {
    "email": "john.doe@example.com",
    "name": "John Doe",
    "country": "France",
    "street": "123 Main Street",
    "postalCode": "75001"
  }
}
```

### GraphQL Client Examples

#### JavaScript (Apollo Client)

```javascript
import { ApolloClient, InMemoryCache, gql, createHttpLink } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';

const httpLink = createHttpLink({
  uri: 'http://localhost:3000/graphql',
});

const authLink = setContext((_, { headers }) => {
  const token = localStorage.getItem('token');
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : "",
    }
  }
});

const client = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache()
});

// Query users
const GET_USERS = gql`
  query GetUsers {
    users(options: "{\"page\": 1, \"limit\": 10}") {
      data {
        id
        email
        country
        createdAt
      }
      count
      hasNextPage
    }
  }
`;

const { data } = await client.query({ query: GET_USERS });
console.log('Users:', data.users.data);

// Create user
const CREATE_USER = gql`
  mutation CreateUser($input: CreateUserInput!) {
    createUser(input: $input) {
      id
    }
  }
`;

const { data: createData } = await client.mutate({
  mutation: CREATE_USER,
  variables: {
    input: {
      email: 'new.user@example.com',
      name: 'New User',
      country: 'Spain',
      street: '789 New Street',
      postalCode: '28001'
    }
  }
});

console.log('Created user ID:', createData.createUser.id);
```

#### Python (graphql-client)

```python
from gql import gql, Client
from gql.transport.requests import RequestsHTTPTransport

# Set up the transport with authentication
transport = RequestsHTTPTransport(
    url="http://localhost:3000/graphql",
    headers={"Authorization": "Bearer <your-token>"}
)

client = Client(transport=transport, fetch_schema_from_transport=True)

# Query users
query = gql("""
    query GetUsers {
        users(options: "{\"page\": 1, \"limit\": 10}") {
            data {
                id
                email
                country
                createdAt
            }
            count
            hasNextPage
        }
    }
""")

result = client.execute(query)
print("Users:", result['users']['data'])

# Create user
create_mutation = gql("""
    mutation CreateUser($input: CreateUserInput!) {
        createUser(input: $input) {
            id
        }
    }
""")

variables = {
    "input": {
        "email": "python.user@example.com",
        "name": "Python User",
        "country": "Italy",
        "street": "456 Python Street",
        "postalCode": "00100"
    }
}

result = client.execute(create_mutation, variable_values=variables)
print("Created user ID:", result['createUser']['id'])
```

## Error Handling

The API uses standard HTTP status codes and returns consistent error responses.

### Error Response Format

```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable error message",
  "statusCode": 400,
  "timestamp": "2024-01-15T10:30:00Z",
  "path": "/v1/users",
  "correlationId": "b0c7b8c0-1234-4567-8901-123456789012",
  "details": [
    {
      "field": "email",
      "message": "Email is required",
      "value": ""
    }
  ]
}
```

### Common HTTP Status Codes

| Status Code | Description | When to Expect |
|------------|-------------|----------------|
| `200` | OK | Successful GET requests |
| `201` | Created | Successful POST requests |
| `204` | No Content | Successful DELETE requests |
| `400` | Bad Request | Validation errors, malformed requests |
| `401` | Unauthorized | Missing or invalid authentication token |
| `403` | Forbidden | Insufficient permissions |
| `404` | Not Found | Resource doesn't exist |
| `409` | Conflict | Resource already exists (e.g., duplicate email) |
| `429` | Too Many Requests | Rate limit exceeded |
| `500` | Internal Server Error | Unexpected server error |

### Error Types

#### Validation Errors (400)

```json
{
  "error": "VALIDATION_ERROR",
  "message": "Validation failed",
  "statusCode": 400,
  "timestamp": "2024-01-15T10:30:00Z",
  "path": "/v1/users",
  "correlationId": "b0c7b8c0-1234-4567-8901-123456789012",
  "details": [
    {
      "field": "email",
      "message": "Invalid email format",
      "value": "invalid-email"
    },
    {
      "field": "name",
      "message": "Name is required",
      "value": ""
    }
  ]
}
```

#### Authentication Errors (401)

```json
{
  "error": "UNAUTHORIZED",
  "message": "Authentication token is required",
  "statusCode": 401,
  "timestamp": "2024-01-15T10:30:00Z",
  "path": "/v1/users",
  "correlationId": "b0c7b8c0-1234-4567-8901-123456789012"
}
```

#### Permission Errors (403)

```json
{
  "error": "FORBIDDEN",
  "message": "Insufficient permissions. Required: user:create",
  "statusCode": 403,
  "timestamp": "2024-01-15T10:30:00Z",
  "path": "/v1/users",
  "correlationId": "b0c7b8c0-1234-4567-8901-123456789012"
}
```

#### Resource Conflicts (409)

```json
{
  "error": "GENERIC",
  "message": "User already exists",
  "statusCode": 409,
  "timestamp": "2024-01-15T10:30:00Z",
  "path": "/v1/users",
  "correlationId": "b0c7b8c0-1234-4567-8901-123456789012"
}
```

### Error Handling in Code

#### JavaScript

```javascript
async function createUser(userData) {
  try {
    const response = await fetch('http://localhost:3000/v1/users', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer <your-token>',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(userData)
    });

    if (!response.ok) {
      const error = await response.json();

      switch (response.status) {
        case 400:
          console.error('Validation errors:', error.details);
          throw new ValidationError(error.message, error.details);
        case 401:
          console.error('Authentication failed:', error.message);
          throw new AuthenticationError(error.message);
        case 403:
          console.error('Permission denied:', error.message);
          throw new PermissionError(error.message);
        case 409:
          console.error('User already exists:', error.message);
          throw new ConflictError(error.message);
        default:
          console.error('Unexpected error:', error.message);
          throw new Error(error.message);
      }
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to create user:', error);
    throw error;
  }
}
```

#### Python

```python
import requests
from typing import Dict, Any

class APIError(Exception):
    def __init__(self, message: str, status_code: int, details: list = None):
        self.message = message
        self.status_code = status_code
        self.details = details or []
        super().__init__(self.message)

def create_user(user_data: Dict[str, Any], token: str) -> Dict[str, Any]:
    url = "http://localhost:3000/v1/users"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    try:
        response = requests.post(url, headers=headers, json=user_data)

        if not response.ok:
            error_data = response.json()

            if response.status_code == 400:
                print(f"Validation errors: {error_data.get('details', [])}")
                raise APIError(error_data['message'], 400, error_data.get('details', []))
            elif response.status_code == 401:
                print(f"Authentication failed: {error_data['message']}")
                raise APIError(error_data['message'], 401)
            elif response.status_code == 403:
                print(f"Permission denied: {error_data['message']}")
                raise APIError(error_data['message'], 403)
            elif response.status_code == 409:
                print(f"User already exists: {error_data['message']}")
                raise APIError(error_data['message'], 409)
            else:
                print(f"Unexpected error: {error_data['message']}")
                raise APIError(error_data['message'], response.status_code)

        return response.json()

    except requests.RequestException as e:
        print(f"Network error: {e}")
        raise APIError(f"Network error: {e}", 0)
```

## Rate Limiting

The API implements rate limiting to prevent abuse and ensure fair usage.

### Rate Limit Headers

Every API response includes rate limiting information:

```http
HTTP/1.1 200 OK
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
X-RateLimit-RetryAfter: 60
```

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Maximum requests per time window |
| `X-RateLimit-Remaining` | Remaining requests in current window |
| `X-RateLimit-Reset` | Unix timestamp when the rate limit resets |
| `X-RateLimit-RetryAfter` | Seconds to wait before retrying (when rate limited) |

### Rate Limit Tiers

| Tier | Requests per Minute | Burst Limit |
|------|-------------------|-------------|
| **Default** | 100 | 10 |
| **Premium** | 1000 | 50 |
| **Enterprise** | 5000 | 100 |

### Handling Rate Limits

#### JavaScript with Retry Logic

```javascript
async function apiRequestWithRetry(url, options, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      if (response.status === 429) {
        const retryAfter = response.headers.get('X-RateLimit-RetryAfter');
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, attempt) * 1000;

        console.log(`Rate limited. Waiting ${waitTime}ms before retry ${attempt}/${maxRetries}`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }

      return response;
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}

// Usage
const response = await apiRequestWithRetry('http://localhost:3000/v1/users', {
  headers: { 'Authorization': 'Bearer <your-token>' }
});
```

## Code Examples

### Complete User Management Example

#### JavaScript/Node.js

```javascript
class UserAPIClient {
  constructor(baseURL, token) {
    this.baseURL = baseURL;
    this.token = token;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`API Error: ${error.message}`);
    }

    if (response.status === 204) {
      return null; // No content
    }

    return response.json();
  }

  // Create user
  async createUser(userData) {
    return this.request('/v1/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  // List users
  async listUsers(options = {}) {
    const params = new URLSearchParams(options);
    return this.request(`/v1/users?${params}`);
  }

  // Delete user
  async deleteUser(userId) {
    return this.request(`/v1/users/${userId}`, {
      method: 'DELETE',
    });
  }
}

// Usage
const client = new UserAPIClient('http://localhost:3000', 'your-jwt-token');

// Create a user
const newUser = await client.createUser({
  email: 'example@test.com',
  name: 'Example User',
  country: 'United States',
  street: '123 Main St',
  postalCode: '12345',
});

console.log('Created user:', newUser.id);

// List users
const users = await client.listUsers({ page: 1, limit: 10 });
console.log('Users:', users.data);

// Delete user
await client.deleteUser(newUser.id);
console.log('User deleted');
```

#### Python

```python
import requests
from typing import Dict, List, Optional, Any
import json

class UserAPIClient:
    def __init__(self, base_url: str, token: str):
        self.base_url = base_url
        self.token = token
        self.headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }

    def _request(self, endpoint: str, method: str = "GET", data: Dict = None) -> Any:
        url = f"{self.base_url}{endpoint}"

        response = requests.request(
            method=method,
            url=url,
            headers=self.headers,
            json=data if data else None
        )

        if not response.ok:
            error_data = response.json()
            raise Exception(f"API Error: {error_data['message']}")

        if response.status_code == 204:
            return None

        return response.json()

    def create_user(self, user_data: Dict[str, str]) -> Dict[str, Any]:
        """Create a new user"""
        return self._request("/v1/users", "POST", user_data)

    def list_users(self, page: int = 1, limit: int = 20, **filters) -> Dict[str, Any]:
        """List users with pagination and filtering"""
        params = {"page": page, "limit": limit, **filters}
        query_string = "&".join([f"{k}={v}" for k, v in params.items()])
        return self._request(f"/v1/users?{query_string}")

    def delete_user(self, user_id: str) -> None:
        """Delete a user by ID"""
        return self._request(f"/v1/users/{user_id}", "DELETE")

# Usage
client = UserAPIClient("http://localhost:3000", "your-jwt-token")

# Create a user
new_user = client.create_user({
    "email": "python@example.com",
    "name": "Python User",
    "country": "Canada",
    "street": "456 Python St",
    "postalCode": "K1A 0A6"
})

print(f"Created user: {new_user['id']}")

# List users
users = client.list_users(page=1, limit=10, country="Canada")
print(f"Found {users['count']} users")

# Delete user
client.delete_user(new_user['id'])
print("User deleted")
```

## SDKs and Client Libraries

### Official SDKs

Currently, the API doesn't have official SDKs, but you can use the code examples above as a starting point for creating your own client libraries.

### Community Libraries

- **JavaScript**: Use the fetch API or axios for HTTP requests
- **Python**: Use requests library as shown in examples
- **Java**: Use OkHttp or Apache HttpClient
- **C#**: Use HttpClient
- **Go**: Use the standard http package
- **PHP**: Use Guzzle HTTP client

### Postman Collection

You can import the API into Postman using the OpenAPI specification:

1. Open Postman
2. Click "Import"
3. Enter the OpenAPI URL: `http://localhost:3000/api-json`
4. Postman will automatically create a collection with all endpoints

### OpenAPI/Swagger Tools

The API provides an OpenAPI 3.0 specification that can be used with various tools:

- **Swagger UI**: `http://localhost:3000/api`
- **OpenAPI Spec**: `http://localhost:3000/api-json`
- **Code Generation**: Use tools like OpenAPI Generator to create client SDKs
- **Testing**: Use Insomnia, Postman, or other API testing tools

This comprehensive API guide should help you integrate with the Domain-Driven Hexagon API effectively. For additional support or questions, please refer to the project's GitHub repository or contact the development team.