export default function AccountCard({ account }) {
  return (
    <div className="flex items-center justify-between py-3 px-4 bg-gray-800 rounded-lg">
      <div>
        <p className="font-mono text-sm text-gray-200">{account.accountId}</p>
        <p className="text-xs text-gray-500 mt-0.5">Vault key: {account.vaultKeyName}</p>
      </div>
      <p className="text-xs text-gray-400">{new Date(account.createdAt).toLocaleDateString()}</p>
    </div>
  );
}
