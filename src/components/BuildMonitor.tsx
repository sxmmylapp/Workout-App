import React, { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

const NTFY_TOPIC = 'sammys-workout-app-builds-x9z2';
const POLL_INTERVAL = 60000; // Check every minute

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
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const checkBuildStatus = async () => {
            try {
                // Fetch last message from ntfy.sh
                // We use 'since=1h' to only care about recent failures
                const response = await fetch(`https://ntfy.sh/${NTFY_TOPIC}/json?since=1h&poll=1`);

                if (!response.ok) return;

                // ntfy returns a stream of JSON objects separated by newlines
                // For simple polling, we just read the text and parse the lines
                const text = await response.text();
                const lines = text.trim().split('\n');

                for (const line of lines) {
                    if (!line) continue;
                    try {
                        const msg = JSON.parse(line) as NtfyMessage;

                        // Check if it's a build failure message
                        // Netlify usually sends "Deploy failed" or similar in the title or message
                        // We'll look for keywords or just show whatever comes to this specific topic
                        // assuming the user ONLY sends build failures here.

                        // Check if we've already seen this message
                        const lastSeenId = localStorage.getItem('lastSeenBuildErrorId');
                        if (msg.id !== lastSeenId) {
                            setBuildError(msg);
                            setIsVisible(true);
                            // Don't auto-dismiss, let user dismiss
                        }
                    } catch (e) {
                        console.error('Error parsing ntfy message', e);
                    }
                }
            } catch (e) {
                console.error('Failed to check build status', e);
            }
        };

        // Check immediately and then interval
        checkBuildStatus();
        const interval = setInterval(checkBuildStatus, POLL_INTERVAL);

        return () => clearInterval(interval);
    }, []);

    const dismiss = () => {
        if (buildError) {
            localStorage.setItem('lastSeenBuildErrorId', buildError.id);
        }
        setIsVisible(false);
    };

    if (!isVisible || !buildError) return null;

    return (
        <div className="fixed bottom-4 right-4 left-4 md:left-auto md:w-96 bg-red-900/90 border border-red-500/50 text-white p-4 rounded-xl shadow-2xl backdrop-blur-md z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
            <div className="flex items-start gap-3">
                <div className="p-2 bg-red-500/20 rounded-lg shrink-0">
                    <AlertTriangle className="w-5 h-5 text-red-400" />
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-red-100">Build Failed</h3>
                    <p className="text-sm text-red-200/80 mt-1 break-words">
                        {buildError.title || buildError.message || 'Unknown error'}
                    </p>
                    <p className="text-xs text-red-300/50 mt-2">
                        {new Date(buildError.time * 1000).toLocaleTimeString()}
                    </p>
                </div>
                <button
                    onClick={dismiss}
                    className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                >
                    <X className="w-4 h-4 text-white/60" />
                </button>
            </div>
        </div>
    );
};
