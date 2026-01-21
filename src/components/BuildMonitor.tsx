import React, { useEffect, useState } from 'react';
import { AlertTriangle, Copy, Check, RefreshCw } from 'lucide-react';

const NTFY_TOPIC = 'sammys-workout-app-builds-x9z2';

interface NtfyMessage {
    id: string;
    time: number;
    event: string;
    topic: string;
    message: string;
    title?: string;
}

export const BuildMonitor: React.FC = () => {
    const [buildError, setBuildError] = useState<NtfyMessage | null>(null);
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    const checkBuildStatus = async () => {
        setLoading(true);
        try {
            // Fetch last message from ntfy.sh
            const response = await fetch(`https://ntfy.sh/${NTFY_TOPIC}/json?since=24h&poll=1`);

            if (!response.ok) return;

            const text = await response.text();
            const lines = text.trim().split('\n');

            // Find the most recent failure
            for (let i = lines.length - 1; i >= 0; i--) {
                const line = lines[i];
                if (!line) continue;
                try {
                    const msg = JSON.parse(line) as NtfyMessage;

                    // Netlify sends the webhook payload as a stringified JSON in the 'message' field
                    try {
                        const netlifyPayload = JSON.parse(msg.message);
                        if (netlifyPayload && typeof netlifyPayload === 'object') {
                            // Enhance the message object with parsed data
                            msg.title = netlifyPayload.title || 'Build Failed';
                            msg.message = netlifyPayload.error_message || netlifyPayload.summary || msg.message;
                            // Store other useful info if needed, or just keep the parsed message
                        }
                    } catch {
                        // If it's not JSON, just use the message as is
                    }

                    setBuildError(msg);
                    break;
                } catch (e) {
                    console.error('Error parsing ntfy message', e);
                }
            }
        } catch (e) {
            console.error('Failed to check build status', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        checkBuildStatus();
    }, []);

    const handleCopy = () => {
        if (!buildError) return;
        const textToCopy = JSON.stringify(buildError, null, 2);
        navigator.clipboard.writeText(textToCopy);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (!buildError) {
        return (
            <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        <h3 className="font-bold text-lg">Build Status</h3>
                    </div>
                    <button onClick={checkBuildStatus} className="p-2 hover:bg-zinc-800 rounded-lg">
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
                <p className="text-zinc-500 text-sm mt-2">No recent build failures detected.</p>
            </div>
        );
    }

    return (
        <div className="bg-zinc-900 p-6 rounded-xl border border-red-900/50">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <AlertTriangle size={20} className="text-red-500" />
                    <h3 className="font-bold text-lg text-red-100">Build Failure Detected</h3>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={checkBuildStatus}
                        className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400"
                        title="Refresh"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <button
                        onClick={handleCopy}
                        className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-lg text-sm transition-colors"
                    >
                        {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                        {copied ? 'Copied' : 'Copy Debug Info'}
                    </button>
                </div>
            </div>

            <div className="bg-black/50 rounded-lg p-4 font-mono text-xs text-red-200/80 overflow-x-auto max-h-48 border border-red-900/30">
                <p className="mb-2 font-bold text-red-400">
                    {new Date(buildError.time * 1000).toLocaleString()}
                </p>
                <p className="whitespace-pre-wrap break-words">
                    {buildError.message || JSON.stringify(buildError, null, 2)}
                </p>
            </div>
        </div>
    );
};
