export default function KeyCard({ keyName, onViewPublicKey, onDelete }) {
  return (
    <div className="flex items-center justify-between py-3 px-4 bg-gray-800 rounded-lg">
      <span className="font-mono text-sm text-gray-200">{keyName}</span>
      <div className="flex gap-2">
        <button
          onClick={() => onViewPublicKey(keyName)}
          className="text-xs px-3 py-1 rounded bg-indigo-700 hover:bg-indigo-600 text-white"
        >
          View Public Key
        </button>
        <button
          onClick={() => onDelete(keyName)}
          className="text-xs px-3 py-1 rounded bg-red-800 hover:bg-red-700 text-white"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
