import { groupsApi } from '@/lib/api/groups';

export default async function TestBackendPage() {
  let connectionStatus = 'unknown';
  let groups: any[] = [];
  let error: any = null;

  try {
    // Test backend connection
    const response = await groupsApi.list();
    groups = response.data || [];
    connectionStatus = 'connected';
  } catch (err: any) {
    connectionStatus = 'error';
    error = {
      message: err.message,
      status: err.status,
      name: err.name,
    };
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Backend Connection Test</h1>

        {/* Connection Status */}
        <div className="mb-8">
          {connectionStatus === 'connected' && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
              <div className="flex items-center">
                <span className="text-2xl mr-3">✅</span>
                <div>
                  <p className="font-bold">Backend Connected Successfully!</p>
                  <p className="text-sm">
                    Backend API is running on http://localhost:3001/api
                  </p>
                </div>
              </div>
            </div>
          )}

          {connectionStatus === 'error' && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              <div className="flex items-center">
                <span className="text-2xl mr-3">❌</span>
                <div>
                  <p className="font-bold">Backend Connection Failed</p>
                  <p className="text-sm">
                    Make sure backend is running: <code>cd backend && npm run dev</code>
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Groups Data */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-bold mb-4">Groups Data</h2>
          {groups.length > 0 ? (
            <div className="space-y-4">
              {groups.map((group) => (
                <div
                  key={group.id}
                  className="border border-gray-200 rounded p-4"
                >
                  <h3 className="font-bold">{group.name}</h3>
                  {group.description && (
                    <p className="text-gray-600 text-sm">{group.description}</p>
                  )}
                  <div className="mt-2 text-xs text-gray-500">
                    <p>Invite Code: {group.inviteCode}</p>
                    <p>Members: {group.members?.length || 0}</p>
                    <p>
                      Storage: {(group.storageUsed / 1024 / 1024).toFixed(2)}MB /{' '}
                      {(group.storageLimit / 1024 / 1024).toFixed(0)}MB
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">
              {connectionStatus === 'connected'
                ? 'No groups found. Create one to get started!'
                : 'Unable to load groups'}
            </p>
          )}
        </div>

        {/* Error Details */}
        {error && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-xl font-bold mb-4 text-red-600">Error Details</h2>
            <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
              {JSON.stringify(error, null, 2)}
            </pre>
          </div>
        )}

        {/* Connection Info */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">Connection Info</h2>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <dt className="font-semibold">Backend URL:</dt>
            <dd className="font-mono text-gray-600">
              {process.env.NEXT_PUBLIC_API_URL || 'Not set'}
            </dd>

            <dt className="font-semibold">Environment:</dt>
            <dd className="font-mono text-gray-600">
              {process.env.NODE_ENV}
            </dd>

            <dt className="font-semibold">Status:</dt>
            <dd className="font-mono text-gray-600">{connectionStatus}</dd>

            <dt className="font-semibold">Groups Count:</dt>
            <dd className="font-mono text-gray-600">{groups.length}</dd>
          </dl>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h2 className="text-lg font-bold mb-4">Quick Actions</h2>
          <div className="space-y-2 text-sm">
            <p>
              ✅ <strong>Start Backend:</strong>{' '}
              <code className="bg-white px-2 py-1 rounded">
                cd backend && npm run dev
              </code>
            </p>
            <p>
              ✅ <strong>Start Frontend:</strong>{' '}
              <code className="bg-white px-2 py-1 rounded">npm run dev</code>
            </p>
            <p>
              ✅ <strong>Test Health:</strong>{' '}
              <code className="bg-white px-2 py-1 rounded">
                curl http://localhost:3001/health
              </code>
            </p>
            <p>
              📚 <strong>Documentation:</strong> See{' '}
              <code className="bg-white px-2 py-1 rounded">
                BACKEND_INTEGRATION.md
              </code>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
